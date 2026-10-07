-- ============================================================
-- Migration 020: Billing ERP
-- ============================================================
-- Turns the invoice table into a general voucher table so every
-- trading document shares one structure, numbering, PDF and ledger:
--
--   sales_invoice, estimate, delivery_challan, sales_return,
--   credit_note, purchase_bill, purchase_return, debit_note,
--   binding_order
--
-- Adds:
--   * party fields on clients (type, credit days, opening balance,
--     shipping address)
--   * bill fields: cash/credit, due date, billing/shipping address,
--     extra discount, postage & other charges, round-off,
--     courier tracking, transport (cartons, freight paid/to-pay,
--     door delivery), return approval, document conversion links
--   * line fields: inventory link, binding, damaged quantity
--   * inventory fields: binding, purchase rate, reorder level,
--     damaged stock, HSN
--   * number_series   — independent numbering per document type
--   * payments        — receipts from / payments to parties
--   * stock_movements — audit trail of every stock change
--
-- Safe to run on an existing database: existing invoices become
-- sales invoices, invoices already marked paid get a matching
-- payment row, and current stock is recorded as opening stock.
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
