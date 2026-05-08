-- ============================================================
-- QuickInvoice — Fresh Database Setup
-- ============================================================
-- Run this entire script in Supabase SQL Editor on a brand-new
-- project to create the complete database schema from scratch.
--
-- Usage:
--   1. Create a new Supabase project.
--   2. Open the SQL Editor.
--   3. Paste and run this entire file.
--   4. Go to Storage → create a bucket named "invoices" (public).
--      (The INSERT below handles it, but the UI also works.)
--   5. Update your .env files with the new project's credentials.
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SHARED UTILITY FUNCTIONS
-- (must exist before triggers reference them)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: organizations
-- (created first — everything else references it)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  owner_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: contacts
-- (global contact directory, not org-scoped)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  email      TEXT,
  company    TEXT,
  phone      TEXT,
  gstin      TEXT,
  address    TEXT,
  state      TEXT,
  state_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: books
-- (global book catalogue, not org-scoped)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.books (
  id                                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "Book Title"                                TEXT        NOT NULL,
  "ISBN"                                      TEXT,
  "Product Form"                              TEXT,
  "Language"                                  TEXT,
  "Applicant Type"                            TEXT,
  "Name of Publishing Agency/Publisher"       TEXT,
  "Imprint"                                   TEXT,
  "Name of Author/Editor"                     TEXT,
  "Publication Date"                          TEXT,
  created_at                                  TIMESTAMPTZ DEFAULT NOW(),
  search_vector                               TSVECTOR
    GENERATED ALWAYS AS (
      to_tsvector('simple',
        coalesce("Book Title",                                  '') || ' ' ||
        coalesce("ISBN",                                        '') || ' ' ||
        coalesce("Name of Author/Editor",                      '') || ' ' ||
        coalesce("Name of Publishing Agency/Publisher",        '') || ' ' ||
        coalesce("Imprint",                                    '')
      )
    ) STORED
);

CREATE INDEX IF NOT EXISTS books_search_idx  ON public.books USING gin(search_vector);
CREATE INDEX IF NOT EXISTS books_isbn_idx    ON public.books ("ISBN");

-- ============================================================
-- TABLE: profiles
-- (one row per auth user; id == auth.users.id)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                   UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name        TEXT,
  business_email       TEXT,
  business_address     TEXT,
  business_phone       TEXT,
  logo_url             TEXT,
  currency             TEXT    DEFAULT 'USD',
  payment_terms        TEXT    DEFAULT 'Net 30',
  invoice_prefix       TEXT    DEFAULT 'INV',
  next_invoice_number  INTEGER DEFAULT 1001,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  signatory_name       TEXT,
  signature_url        TEXT,
  gstin                TEXT,
  website              TEXT,
  bank_name            TEXT,
  bank_account_number  TEXT,
  bank_ifsc            TEXT,
  bank_branch          TEXT,
  org_id               UUID    REFERENCES public.organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);

-- ============================================================
-- TABLE: clients
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     UUID        REFERENCES public.organizations(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  email      TEXT,
  company    TEXT,
  address    TEXT,
  phone      TEXT,
  notes      TEXT,
  gstin      TEXT,
  state      TEXT,
  state_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_org_id  ON public.clients(org_id);

-- ============================================================
-- TABLE: organization_members
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_members (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
  invited_by UUID        REFERENCES auth.users(id),
  status     TEXT        NOT NULL DEFAULT 'active'
               CHECK (status IN ('pending', 'active', 'suspended')),
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_org_id  ON public.organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);

-- ============================================================
-- TABLE: organization_invitations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email      TEXT        NOT NULL,
  role       TEXT        NOT NULL CHECK (role IN ('admin', 'staff')),
  invited_by UUID        NOT NULL REFERENCES auth.users(id),
  token      TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status     TEXT        DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_id ON public.organization_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_token  ON public.organization_invitations(token);

-- ============================================================
-- TABLE: org_books
-- (org-specific pricing/stock overlay on the global books table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.org_books (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  book_id    UUID        NOT NULL REFERENCES public.books(id)          ON DELETE CASCADE,
  price      NUMERIC(12,2) DEFAULT 0,
  gst_rate   NUMERIC(5,2)  DEFAULT 0,
  stock      INTEGER       DEFAULT 1,
  added_by   UUID        REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_books_org_id  ON public.org_books(org_id);
CREATE INDEX IF NOT EXISTS idx_org_books_book_id ON public.org_books(book_id);

-- ============================================================
-- TABLE: org_clients
-- (org-specific link to the global contacts table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.org_clients (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID        NOT NULL REFERENCES public.contacts(id)       ON DELETE CASCADE,
  notes      TEXT,
  added_by   UUID        REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_clients_org_id     ON public.org_clients(org_id);
CREATE INDEX IF NOT EXISTS idx_org_clients_contact_id ON public.org_clients(contact_id);

-- ============================================================
-- TABLE: invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id          UUID        REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id       UUID        REFERENCES public.clients(id)       ON DELETE SET NULL,
  contact_id      UUID        REFERENCES public.contacts(id)      ON DELETE SET NULL,
  invoice_number  TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','viewed','paid','overdue','cancelled')),
  issue_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,2)  DEFAULT 0,
  tax_amount      NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency        TEXT          DEFAULT 'INR',
  notes           TEXT,
  terms           TEXT,
  pdf_url         TEXT,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  supply_type     TEXT          DEFAULT 'IGST'
                    CHECK (supply_type IN ('IGST','CGST_SGST')),
  bill_number     TEXT,
  place_of_supply TEXT,
  order_id        TEXT,
  order_date      DATE,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_invoices_user_id   ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_id    ON public.invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status    ON public.invoices(status);

-- ============================================================
-- TABLE: invoice_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID          NOT NULL REFERENCES public.invoices(id)      ON DELETE CASCADE,
  org_id           UUID          REFERENCES public.organizations(id)          ON DELETE CASCADE,
  description      TEXT          NOT NULL,
  quantity         NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order       INTEGER       DEFAULT 0,
  hsn_sac          TEXT,
  gst_rate         NUMERIC(5,2)  DEFAULT 0,
  discount_percent NUMERIC(5,2)  DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_org_id     ON public.invoice_items(org_id);

-- ============================================================
-- TABLE: inventory_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id                                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                               UUID          REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id                                UUID          REFERENCES public.organizations(id) ON DELETE CASCADE,
  "#"                                   INTEGER,
  "Book Title"                          TEXT          NOT NULL,
  "ISBN"                                TEXT,
  "Product Form"                        TEXT,
  "Language"                            TEXT,
  "Applicant Type"                      TEXT,
  "Name of Publishing Agency/Publisher" TEXT,
  "Imprint"                             TEXT,
  "Name of Author/Editor"               TEXT,
  "Publication Date"                    TEXT,
  price                                 NUMERIC(12,2) DEFAULT 0,
  gst_rate                              NUMERIC(5,2)  DEFAULT 0,
  stock                                 INTEGER       DEFAULT 1,
  created_at                            TIMESTAMPTZ   DEFAULT NOW(),
  search_vector                         TSVECTOR
    GENERATED ALWAYS AS (
      to_tsvector('simple',
        coalesce("Book Title",                                  '') || ' ' ||
        coalesce("ISBN",                                        '') || ' ' ||
        coalesce("Name of Author/Editor",                      '') || ' ' ||
        coalesce("Name of Publishing Agency/Publisher",        '') || ' ' ||
        coalesce("Imprint",                                    '')
      )
    ) STORED
);

CREATE INDEX IF NOT EXISTS inventory_items_search_idx    ON public.inventory_items USING gin(search_vector);
CREATE INDEX IF NOT EXISTS inventory_items_isbn_idx      ON public.inventory_items ("ISBN");
CREATE INDEX IF NOT EXISTS idx_inventory_items_org_id    ON public.inventory_items(org_id);

-- ============================================================
-- TABLE: purchase_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id        UUID          REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id      TEXT          NOT NULL UNIQUE,
  client_id     UUID          REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name   TEXT          NOT NULL,
  item_name     TEXT          NOT NULL,
  quantity      NUMERIC(10,2) DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchase_date DATE          NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  status        TEXT          DEFAULT 'completed'
                  CHECK (status IN ('pending','completed','cancelled')),
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION generate_purchase_order_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_id := 'PO-' ||
    TO_CHAR(NOW(), 'YYYY') || '-' ||
    LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_purchase_order_id
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW
  WHEN (NEW.order_id IS NULL OR NEW.order_id = '')
  EXECUTE FUNCTION generate_purchase_order_id();

CREATE TRIGGER purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS purchase_orders_org_date_idx  ON public.purchase_orders(org_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS purchase_orders_user_date_idx ON public.purchase_orders(user_id, purchase_date DESC);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     UUID        REFERENCES public.organizations(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL
               CHECK (type IN ('invoice_viewed','payment_received','invoice_overdue')),
  title      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  invoice_id UUID        REFERENCES public.invoices(id) ON DELETE CASCADE,
  is_read    BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_org_id      ON public.notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id     ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read)
  WHERE is_read = false;

-- ============================================================
-- TABLE: notification_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id          UUID     PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_viewed   BOOLEAN  DEFAULT true,
  payment_received BOOLEAN  DEFAULT true,
  invoice_overdue  BOOLEAN  DEFAULT true,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================
ALTER TABLE public.organizations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_books                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECURITY DEFINER HELPER (avoids RLS recursion on org lookup)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_org_id(user_uuid UUID)
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT org_id
  FROM   organization_members
  WHERE  user_id = user_uuid
    AND  status  = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_org_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org_id(UUID) TO service_role;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- Pattern: service_role gets full access (used by the API server),
--          authenticated users get read access scoped to their org.
-- ============================================================

-- organizations
CREATE POLICY "service_role_organizations"
  ON public.organizations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (id = get_user_org_id(auth.uid()));

-- contacts (global table — authenticated users can read/write all)
CREATE POLICY "service_role_contacts"
  ON public.contacts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all_contacts"
  ON public.contacts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- books (global table — authenticated users can read all)
CREATE POLICY "service_role_books"
  ON public.books FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all_books"
  ON public.books FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- profiles
CREATE POLICY "service_role_profiles"
  ON public.profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR org_id = get_user_org_id(auth.uid()));

-- clients
CREATE POLICY "service_role_clients"
  ON public.clients FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_clients"
  ON public.clients FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- organization_members
CREATE POLICY "service_role_organization_members"
  ON public.organization_members FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_organization_members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR org_id = get_user_org_id(auth.uid()));

-- organization_invitations
CREATE POLICY "service_role_organization_invitations"
  ON public.organization_invitations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_organization_invitations"
  ON public.organization_invitations FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- org_books
CREATE POLICY "service_role_org_books"
  ON public.org_books FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_org_books"
  ON public.org_books FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- org_clients
CREATE POLICY "service_role_org_clients"
  ON public.org_clients FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_org_clients"
  ON public.org_clients FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- invoices
CREATE POLICY "service_role_invoices"
  ON public.invoices FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- invoice_items
CREATE POLICY "service_role_invoice_items"
  ON public.invoice_items FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_invoice_items"
  ON public.invoice_items FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- inventory_items
CREATE POLICY "service_role_inventory_items"
  ON public.inventory_items FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_inventory_items"
  ON public.inventory_items FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- purchase_orders
CREATE POLICY "service_role_purchase_orders"
  ON public.purchase_orders FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_purchase_orders"
  ON public.purchase_orders FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- notifications
CREATE POLICY "service_role_notifications"
  ON public.notifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

-- notification_preferences
CREATE POLICY "service_role_notification_preferences"
  ON public.notification_preferences FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_own_notification_preferences"
  ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- Fires after a new auth.users row is inserted by Supabase Auth.
-- The app's /auth/register route then fills in the org details.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, business_email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- STORAGE: invoices bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Authenticated users can upload/manage files inside their own folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users manage own invoice files'
  ) THEN
    CREATE POLICY "Authenticated users manage own invoice files"
      ON storage.objects FOR ALL
      TO authenticated
      USING (
        bucket_id = 'invoices'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'invoices'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

-- Public read access (needed for PDF previews and email attachments)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read access to invoices'
  ) THEN
    CREATE POLICY "Public read access to invoices"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'invoices');
  END IF;
END $$;

-- ============================================================
-- DONE
-- Update your .env / environment variables:
--   SUPABASE_URL         = https://<project-ref>.supabase.co
--   SUPABASE_SERVICE_ROLE_KEY = <service role key>
--   DATABASE_URL         = postgresql://postgres.<ref>:<password>@...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
--   DIRECT_URL           = postgresql://postgres.<ref>:<password>@...pooler.supabase.com:5432/postgres
-- Remember to URL-encode special chars in the password:
--   *  →  %2A       /  →  %2F       @  →  %40
-- ============================================================
