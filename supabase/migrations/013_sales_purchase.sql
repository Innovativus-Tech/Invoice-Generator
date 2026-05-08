-- Purchase orders table (manually entered by user)
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  order_id TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  status TEXT DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their purchases"
  ON purchase_orders FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE INDEX purchase_orders_user_date_idx
  ON purchase_orders (user_id, purchase_date DESC);

CREATE INDEX purchase_orders_org_date_idx
  ON purchase_orders (org_id, purchase_date DESC);

-- Auto-generate order_id trigger
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
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  WHEN (NEW.order_id IS NULL OR NEW.order_id = '')
  EXECUTE FUNCTION generate_purchase_order_id();

-- Update trigger for updated_at
CREATE TRIGGER purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
