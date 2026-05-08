-- QuickInvoice RBAC and multi-organization support
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members (links users to orgs with roles)
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
  invited_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'suspended')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- Invitations table (for pending email invites)
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add org_id to existing org-owned tables that exist at this point in migration order.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE IF EXISTS purchase_orders ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

-- Enable RLS on new tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- Keep updated_at current for organizations.
DROP TRIGGER IF EXISTS organizations_updated_at ON organizations;
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create an org for each existing profile so existing users are not locked out.
INSERT INTO organizations (name, slug, owner_id)
SELECT
  COALESCE(NULLIF(business_name, ''), NULLIF(business_email, ''), 'My Organization'),
  LOWER(REGEXP_REPLACE(
    COALESCE(NULLIF(business_name, ''), split_part(NULLIF(business_email, ''), '@', 1), 'org'),
    '[^a-z0-9]', '-', 'g'
  )) || '-' || SUBSTRING(gen_random_uuid()::text, 1, 6),
  id
FROM profiles
ON CONFLICT DO NOTHING;

-- Create owner membership for each existing user.
INSERT INTO organization_members (org_id, user_id, role, status)
SELECT o.id, o.owner_id, 'owner', 'active'
FROM organizations o
ON CONFLICT DO NOTHING;

-- Update existing profiles and business data to link to the new org.
UPDATE profiles p
SET org_id = (
  SELECT o.id FROM organizations o WHERE o.owner_id = p.id LIMIT 1
)
WHERE org_id IS NULL;

UPDATE clients c
SET org_id = (
  SELECT o.id FROM organizations o WHERE o.owner_id = c.user_id LIMIT 1
)
WHERE org_id IS NULL;

UPDATE invoices i
SET org_id = (
  SELECT o.id FROM organizations o WHERE o.owner_id = i.user_id LIMIT 1
)
WHERE org_id IS NULL;

UPDATE invoice_items ii
SET org_id = (
  SELECT i.org_id FROM invoices i WHERE i.id = ii.invoice_id LIMIT 1
)
WHERE org_id IS NULL;

UPDATE inventory_items ii
SET org_id = (
  SELECT o.id FROM organizations o WHERE o.owner_id = ii.user_id LIMIT 1
)
WHERE org_id IS NULL;

DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    UPDATE notifications n
    SET org_id = (
      SELECT o.id FROM organizations o WHERE o.owner_id = n.user_id LIMIT 1
    )
    WHERE org_id IS NULL;

    EXECUTE 'DROP POLICY IF EXISTS "Users own their notifications" ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS "Org members can access notifications" ON notifications';
    EXECUTE 'CREATE POLICY "Org members can access notifications"
      ON notifications FOR ALL
      USING (
        org_id IN (
          SELECT org_id FROM organization_members
          WHERE user_id = auth.uid() AND status = ''active''
        )
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON notifications(org_id)';
  END IF;

  IF to_regclass('public.purchase_orders') IS NOT NULL THEN
    UPDATE purchase_orders po
    SET org_id = (
      SELECT o.id FROM organizations o WHERE o.owner_id = po.user_id LIMIT 1
    )
    WHERE org_id IS NULL;

    EXECUTE 'DROP POLICY IF EXISTS "Users own their purchases" ON purchase_orders';
    EXECUTE 'DROP POLICY IF EXISTS "Org members can access purchases" ON purchase_orders';
    EXECUTE 'CREATE POLICY "Org members can access purchases"
      ON purchase_orders FOR ALL
      USING (
        org_id IN (
          SELECT org_id FROM organization_members
          WHERE user_id = auth.uid() AND status = ''active''
        )
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_id ON purchase_orders(org_id)';
  END IF;
END $$;

-- RLS: users can see orgs and members for orgs they belong to.
DROP POLICY IF EXISTS "Members can view their org" ON organizations;
CREATE POLICY "Members can view their org"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Owners can update their org" ON organizations;
CREATE POLICY "Owners can update their org"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'owner'
    )
  );

DROP POLICY IF EXISTS "Members can view their org members" ON organization_members;
CREATE POLICY "Members can view their org members"
  ON organization_members FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Team managers can view invitations" ON organization_invitations;
CREATE POLICY "Team managers can view invitations"
  ON organization_invitations FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Update RLS on existing tables to use org_id instead of user_id.
DROP POLICY IF EXISTS "Users own their profile" ON profiles;
CREATE POLICY "Org members can access profiles"
  ON profiles FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users own their clients" ON clients;
CREATE POLICY "Org members can access clients"
  ON clients FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users own their invoices" ON invoices;
CREATE POLICY "Org members can access invoices"
  ON invoices FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users own invoice items via invoice" ON invoice_items;
CREATE POLICY "Org members can access invoice items"
  ON invoice_items FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users own their inventory" ON inventory_items;
CREATE POLICY "Org members can access inventory"
  ON inventory_items FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_id ON organization_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON clients(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_org_id ON invoice_items(org_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_org_id ON inventory_items(org_id);
