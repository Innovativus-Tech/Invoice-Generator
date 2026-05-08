-- ============================================================
-- Migration 016: Fix RLS infinite recursion
-- ============================================================
-- Root cause: policies on organization_members query organization_members
-- themselves, causing infinite recursion. Fix: use a SECURITY DEFINER
-- function that runs outside RLS context.
-- ============================================================

-- Step 1: Create the SECURITY DEFINER helper function
-- This runs as the function owner (bypasses RLS) so it never recurses.
CREATE OR REPLACE FUNCTION get_user_org_id(user_uuid UUID)
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT org_id
  FROM organization_members
  WHERE user_id = user_uuid
    AND status = 'active'
  LIMIT 1;
$$;

-- ============================================================
-- Step 2: organizations
-- ============================================================
DROP POLICY IF EXISTS "Members can view their org" ON organizations;
DROP POLICY IF EXISTS "Owners can update their org" ON organizations;
DROP POLICY IF EXISTS "service_role_organizations" ON organizations;

CREATE POLICY "service_role_organizations"
  ON organizations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_read_organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (id = get_user_org_id(auth.uid()));

-- ============================================================
-- Step 3: organization_members
-- ============================================================
DROP POLICY IF EXISTS "Members can view their org members" ON organization_members;
DROP POLICY IF EXISTS "service_role_organization_members" ON organization_members;

CREATE POLICY "service_role_organization_members"
  ON organization_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Members can see their own row OR all rows in their org
CREATE POLICY "authenticated_read_organization_members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id = get_user_org_id(auth.uid())
  );

-- ============================================================
-- Step 4: organization_invitations
-- ============================================================
DROP POLICY IF EXISTS "Team managers can view invitations" ON organization_invitations;
DROP POLICY IF EXISTS "service_role_organization_invitations" ON organization_invitations;

CREATE POLICY "service_role_organization_invitations"
  ON organization_invitations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_read_organization_invitations"
  ON organization_invitations FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- ============================================================
-- Step 5: profiles
-- ============================================================
DROP POLICY IF EXISTS "Users own their profile" ON profiles;
DROP POLICY IF EXISTS "Org members can access profiles" ON profiles;
DROP POLICY IF EXISTS "service_role_profiles" ON profiles;

CREATE POLICY "service_role_profiles"
  ON profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Members can see their own profile OR the org owner's profile
CREATE POLICY "authenticated_read_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR org_id = get_user_org_id(auth.uid())
  );

-- ============================================================
-- Step 6: clients
-- ============================================================
DROP POLICY IF EXISTS "Users own their clients" ON clients;
DROP POLICY IF EXISTS "Org members can access clients" ON clients;
DROP POLICY IF EXISTS "service_role_clients" ON clients;

CREATE POLICY "service_role_clients"
  ON clients FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_read_clients"
  ON clients FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- ============================================================
-- Step 7: invoices
-- ============================================================
DROP POLICY IF EXISTS "Users own their invoices" ON invoices;
DROP POLICY IF EXISTS "Org members can access invoices" ON invoices;
DROP POLICY IF EXISTS "service_role_invoices" ON invoices;

CREATE POLICY "service_role_invoices"
  ON invoices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_read_invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- ============================================================
-- Step 8: invoice_items
-- ============================================================
DROP POLICY IF EXISTS "Users own invoice items via invoice" ON invoice_items;
DROP POLICY IF EXISTS "Org members can access invoice items" ON invoice_items;
DROP POLICY IF EXISTS "service_role_invoice_items" ON invoice_items;

CREATE POLICY "service_role_invoice_items"
  ON invoice_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_read_invoice_items"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- ============================================================
-- Step 9: inventory_items
-- ============================================================
DROP POLICY IF EXISTS "Users own their inventory" ON inventory_items;
DROP POLICY IF EXISTS "Org members can access inventory" ON inventory_items;
DROP POLICY IF EXISTS "service_role_inventory_items" ON inventory_items;

CREATE POLICY "service_role_inventory_items"
  ON inventory_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_read_inventory_items"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- ============================================================
-- Step 10: notifications
-- ============================================================
DROP POLICY IF EXISTS "Users own their notifications" ON notifications;
DROP POLICY IF EXISTS "Org members can access notifications" ON notifications;
DROP POLICY IF EXISTS "service_role_notifications" ON notifications;

CREATE POLICY "service_role_notifications"
  ON notifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_read_notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- ============================================================
-- Step 11: notification_preferences
-- ============================================================
DROP POLICY IF EXISTS "Users own their preferences" ON notification_preferences;
DROP POLICY IF EXISTS "service_role_notification_preferences" ON notification_preferences;

CREATE POLICY "service_role_notification_preferences"
  ON notification_preferences FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_own_notification_preferences"
  ON notification_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Step 12: purchase_orders
-- ============================================================
DROP POLICY IF EXISTS "Users own their purchases" ON purchase_orders;
DROP POLICY IF EXISTS "Org members can access purchases" ON purchase_orders;
DROP POLICY IF EXISTS "service_role_purchase_orders" ON purchase_orders;

CREATE POLICY "service_role_purchase_orders"
  ON purchase_orders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_read_purchase_orders"
  ON purchase_orders FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- ============================================================
-- Grant execute on helper function to authenticated role
-- ============================================================
GRANT EXECUTE ON FUNCTION get_user_org_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_org_id(UUID) TO service_role;
