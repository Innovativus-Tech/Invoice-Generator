-- ============================================================
-- QuickInvoice — Fresh Database Setup
-- ============================================================
-- Run this entire script in Supabase SQL Editor on a brand-new
-- project to create the complete database schema from scratch.
--
-- Covers all migrations: 001 → 020
--
-- Usage:
--   1. Create a new Supabase project.
--   2. Open the SQL Editor.
--   3. Paste and run this entire file.
--   4. Storage bucket "invoices" is created automatically below.
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
  org_id               UUID    REFERENCES public.organizations(id) ON DELETE SET NULL,
  show_book_metadata   BOOLEAN NOT NULL DEFAULT FALSE  -- migration 019
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
  discount_percent NUMERIC(5,2)  DEFAULT 0,
  isbn             TEXT,         -- migration 019: book metadata
  author           TEXT          -- migration 019: book metadata
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

-- service_role: full access (used by the API server for PDF/logo uploads)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'service_role_all_invoices'
  ) THEN
    CREATE POLICY "service_role_all_invoices"
      ON storage.objects FOR ALL
      TO service_role
      USING (bucket_id = 'invoices')
      WITH CHECK (bucket_id = 'invoices');
  END IF;
END $$;

-- Authenticated users: INSERT into the invoices bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'authenticated_write_invoices'
  ) THEN
    CREATE POLICY "authenticated_write_invoices"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'invoices');
  END IF;
END $$;

-- Authenticated users: UPDATE objects in the invoices bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'authenticated_update_invoices'
  ) THEN
    CREATE POLICY "authenticated_update_invoices"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'invoices')
      WITH CHECK (bucket_id = 'invoices');
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
-- MIGRATION 020: BILLING ERP
-- Voucher types (estimate, challan, returns, credit/debit notes,
-- purchase bills, binding orders), party credit terms, payments,
-- stock movements and per-type number series.
-- (Data back-fill statements below are no-ops on a fresh database.)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Parties (clients)
-- ------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS party_type       TEXT          NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS credit_days      INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_limit     NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance  NUMERIC(12,2) NOT NULL DEFAULT 0,  -- + receivable (Dr), - payable (Cr)
  ADD COLUMN IF NOT EXISTS pincode          TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address TEXT,
  ADD COLUMN IF NOT EXISTS shipping_state   TEXT,
  ADD COLUMN IF NOT EXISTS shipping_pincode TEXT;

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_party_type_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_party_type_check
  CHECK (party_type IN ('customer', 'supplier', 'binder', 'both'));

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_credit_days_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_credit_days_check
  CHECK (credit_days >= 0);

CREATE INDEX IF NOT EXISTS idx_clients_org_party_type ON public.clients(org_id, party_type);

-- ------------------------------------------------------------
-- 2. Inventory
-- ------------------------------------------------------------
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS binding       TEXT,
  ADD COLUMN IF NOT EXISTS purchase_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock     INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_stock INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hsn_code      TEXT;

-- ------------------------------------------------------------
-- 3. Vouchers (invoices table)
-- ------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS doc_type               TEXT          NOT NULL DEFAULT 'sales_invoice',
  ADD COLUMN IF NOT EXISTS payment_mode           TEXT          NOT NULL DEFAULT 'credit',
  ADD COLUMN IF NOT EXISTS party_name             TEXT,
  ADD COLUMN IF NOT EXISTS party_phone            TEXT,
  ADD COLUMN IF NOT EXISTS credit_days            INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date               DATE,
  ADD COLUMN IF NOT EXISTS billing_address        TEXT,
  ADD COLUMN IF NOT EXISTS shipping_name          TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address       TEXT,
  ADD COLUMN IF NOT EXISTS extra_discount_type    TEXT          NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS extra_discount_value   NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS postage_charge         NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_charges          NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_charges_label    TEXT,
  ADD COLUMN IF NOT EXISTS apply_round_off        BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS round_off              NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid            NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_doc_id          UUID          REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS party_ref_number       TEXT,
  ADD COLUMN IF NOT EXISTS party_ref_date         DATE,
  ADD COLUMN IF NOT EXISTS affects_stock          BOOLEAN       NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS valid_until            DATE,
  ADD COLUMN IF NOT EXISTS reason                 TEXT,
  ADD COLUMN IF NOT EXISTS approval_status        TEXT,
  ADD COLUMN IF NOT EXISTS approved_by            UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason       TEXT,
  -- dispatch: courier
  ADD COLUMN IF NOT EXISTS dispatch_mode          TEXT          NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS delivery_status        TEXT          NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS courier_name           TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number        TEXT,
  ADD COLUMN IF NOT EXISTS dispatch_date          DATE,
  ADD COLUMN IF NOT EXISTS expected_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS delivered_date         DATE,
  -- dispatch: transport
  ADD COLUMN IF NOT EXISTS transport_name         TEXT,
  ADD COLUMN IF NOT EXISTS lr_number              TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_number         TEXT,
  ADD COLUMN IF NOT EXISTS cartons                INTEGER,
  ADD COLUMN IF NOT EXISTS freight_type           TEXT,
  ADD COLUMN IF NOT EXISTS delivery_type          TEXT,
  ADD COLUMN IF NOT EXISTS transport_details      TEXT;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled', 'converted'));

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_doc_type_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_doc_type_check
  CHECK (doc_type IN (
    'sales_invoice', 'estimate', 'delivery_challan', 'sales_return', 'credit_note',
    'purchase_bill', 'purchase_return', 'debit_note', 'binding_order'
  ));

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_payment_mode_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_payment_mode_check
  CHECK (payment_mode IN ('cash', 'credit'));

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_extra_discount_type_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_extra_discount_type_check
  CHECK (extra_discount_type IN ('percent', 'amount'));

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_charges_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_charges_check
  CHECK (extra_discount_value >= 0 AND postage_charge >= 0 AND other_charges >= 0 AND credit_days >= 0);

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_dispatch_mode_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_dispatch_mode_check
  CHECK (dispatch_mode IN ('none', 'courier', 'transport', 'hand'));

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_delivery_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_delivery_status_check
  CHECK (delivery_status IN ('pending', 'dispatched', 'in_transit', 'delivered', 'returned'));

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_freight_type_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_freight_type_check
  CHECK (freight_type IS NULL OR freight_type IN ('paid', 'to_pay'));

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_delivery_type_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_delivery_type_check
  CHECK (delivery_type IS NULL OR delivery_type IN ('door', 'godown'));

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_approval_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_approval_status_check
  CHECK (approval_status IS NULL OR approval_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_invoices_org_doc_date ON public.invoices(org_id, doc_type, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_org_client   ON public.invoices(org_id, client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_source_doc   ON public.invoices(source_doc_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date     ON public.invoices(org_id, due_date);

-- Existing bills: derive credit days from "Net N" payment terms and set due dates.
UPDATE public.invoices
SET credit_days = substring(terms FROM 'Net\s*(\d+)')::INTEGER
WHERE terms ~ 'Net\s*\d+' AND credit_days = 0;

UPDATE public.invoices
SET due_date = issue_date + credit_days
WHERE due_date IS NULL;

-- Document numbers must be unique per organisation and type. Older data
-- may contain duplicates, so only add the index when it is safe to do so;
-- the API enforces uniqueness for new documents either way.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.invoices
    GROUP BY org_id, doc_type, invoice_number
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_org_doc_number
      ON public.invoices(org_id, doc_type, invoice_number);
  ELSE
    RAISE NOTICE 'Duplicate document numbers found — unique index uq_invoices_org_doc_number not created';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Line items
-- ------------------------------------------------------------
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS item_id     UUID          REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS binding     TEXT,
  ADD COLUMN IF NOT EXISTS damaged_qty NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS invoice_items_damaged_qty_check;
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_damaged_qty_check
  CHECK (damaged_qty >= 0 AND damaged_qty <= quantity);

CREATE INDEX IF NOT EXISTS idx_invoice_items_item_id ON public.invoice_items(item_id);

-- ------------------------------------------------------------
-- 5. Number series (one per organisation + document type)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.number_series (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  doc_type     TEXT        NOT NULL,
  prefix       TEXT        NOT NULL,
  next_number  INTEGER     NOT NULL DEFAULT 1 CHECK (next_number > 0),
  include_year BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, doc_type)
);

DROP TRIGGER IF EXISTS number_series_updated_at ON public.number_series;
CREATE TRIGGER number_series_updated_at
  BEFORE UPDATE ON public.number_series
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Carry over the existing invoice numbering from the org owner's profile.
INSERT INTO public.number_series (org_id, doc_type, prefix, next_number)
SELECT o.id, 'sales_invoice',
       COALESCE(NULLIF(p.invoice_prefix, ''), 'INV'),
       GREATEST(COALESCE(p.next_invoice_number, 1001), 1)
FROM public.organizations o
LEFT JOIN public.profiles p ON p.id = o.owner_id
ON CONFLICT (org_id, doc_type) DO NOTHING;

-- ------------------------------------------------------------
-- 6. Payments (receipts from / payments to parties)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id        UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id      UUID          REFERENCES public.clients(id)  ON DELETE SET NULL,
  invoice_id     UUID          REFERENCES public.invoices(id) ON DELETE SET NULL,
  direction      TEXT          NOT NULL CHECK (direction IN ('in', 'out')),
  payment_number TEXT,
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
  mode           TEXT          NOT NULL DEFAULT 'cash'
                   CHECK (mode IN ('cash', 'upi', 'bank', 'cheque', 'card', 'other')),
  reference      TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ   DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   DEFAULT NOW()
);

DROP TRIGGER IF EXISTS payments_updated_at ON public.payments;
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_payments_org_date   ON public.payments(org_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_client     ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice    ON public.payments(invoice_id);

-- Invoices that were marked paid before the payments ledger existed get a
-- matching receipt so balances stay correct.
INSERT INTO public.payments (org_id, user_id, client_id, invoice_id, direction, amount, payment_date, mode, notes)
SELECT i.org_id, i.user_id, i.client_id, i.id, 'in', i.total,
       COALESCE(i.paid_at::DATE, i.issue_date), 'other',
       'Recorded automatically: invoice was marked paid'
FROM public.invoices i
WHERE i.status = 'paid'
  AND i.total > 0
  AND i.org_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.invoice_id = i.id);

UPDATE public.invoices SET amount_paid = total WHERE status = 'paid';

-- ------------------------------------------------------------
-- 7. Stock movements (audit trail; inventory stock = sum of movements)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID          NOT NULL REFERENCES public.organizations(id)   ON DELETE CASCADE,
  item_id        UUID          NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  doc_id         UUID          REFERENCES public.invoices(id) ON DELETE CASCADE,
  doc_type       TEXT          NOT NULL,  -- voucher type, or 'opening' / 'adjustment'
  movement_date  DATE          NOT NULL DEFAULT CURRENT_DATE,
  qty_change     INTEGER       NOT NULL DEFAULT 0,  -- effect on saleable stock
  damaged_change INTEGER       NOT NULL DEFAULT 0,  -- effect on damaged stock
  rate           NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason         TEXT,
  user_id        UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON public.stock_movements(item_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_doc  ON public.stock_movements(doc_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_org  ON public.stock_movements(org_id, movement_date DESC);

-- Record today's stock as opening stock so the movement history adds up.
INSERT INTO public.stock_movements (org_id, item_id, doc_type, movement_date, qty_change, rate, reason, user_id)
SELECT ii.org_id, ii.id, 'opening', COALESCE(ii.created_at::DATE, CURRENT_DATE),
       COALESCE(ii.stock, 0), COALESCE(ii.price, 0), 'Opening stock', ii.user_id
FROM public.inventory_items ii
WHERE ii.org_id IS NOT NULL
  AND COALESCE(ii.stock, 0) <> 0
  AND NOT EXISTS (SELECT 1 FROM public.stock_movements sm WHERE sm.item_id = ii.id);

-- ------------------------------------------------------------
-- 8. Notifications: approval requests
-- ------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('invoice_viewed', 'payment_received', 'invoice_overdue', 'approval_pending'));

-- ------------------------------------------------------------
-- 9. Row level security (same pattern as migration 016)
-- ------------------------------------------------------------
ALTER TABLE public.number_series   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_number_series" ON public.number_series;
CREATE POLICY "service_role_number_series"
  ON public.number_series FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_number_series" ON public.number_series;
CREATE POLICY "authenticated_read_number_series"
  ON public.number_series FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "service_role_payments" ON public.payments;
CREATE POLICY "service_role_payments"
  ON public.payments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_payments" ON public.payments;
CREATE POLICY "authenticated_read_payments"
  ON public.payments FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "service_role_stock_movements" ON public.stock_movements;
CREATE POLICY "service_role_stock_movements"
  ON public.stock_movements FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_stock_movements" ON public.stock_movements;
CREATE POLICY "authenticated_read_stock_movements"
  ON public.stock_movements FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

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
