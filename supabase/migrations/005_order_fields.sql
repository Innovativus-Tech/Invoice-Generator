-- Add order_id and order_date columns to invoices table
ALTER TABLE invoices
  ADD COLUMN order_id TEXT,
  ADD COLUMN order_date DATE;
