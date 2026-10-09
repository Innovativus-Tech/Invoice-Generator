-- ============================================================
-- Migration 021: Binding charges on purchases
-- ============================================================
-- * invoice_items.binding_charge — per-copy binding charge on a line
--   (line amount = qty × (rate + binding charge) × (1 − discount))
-- * inventory_items.binding_charge — last binding charge paid per copy;
--   landed cost of a title = purchase_rate + binding_charge
-- * binding_rates — the organisation's rate card (Paperback, Hardbound…)
--   used to pre-fill the binding charge when a binding type is chosen
-- Safe to re-run.
-- ============================================================

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS binding_charge NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS invoice_items_binding_charge_check;
ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_binding_charge_check
  CHECK (binding_charge >= 0);

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS binding_charge NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.binding_rates (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name       TEXT          NOT NULL,
  charge     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (charge >= 0),
  sort_order INTEGER       NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ   DEFAULT NOW(),
  updated_at TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (org_id, name)
);

DROP TRIGGER IF EXISTS binding_rates_updated_at ON public.binding_rates;
CREATE TRIGGER binding_rates_updated_at
  BEFORE UPDATE ON public.binding_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_binding_rates_org ON public.binding_rates(org_id, sort_order);

ALTER TABLE public.binding_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_binding_rates" ON public.binding_rates;
CREATE POLICY "service_role_binding_rates"
  ON public.binding_rates FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_binding_rates" ON public.binding_rates;
CREATE POLICY "authenticated_read_binding_rates"
  ON public.binding_rates FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));
