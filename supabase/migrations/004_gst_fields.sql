-- ============================================================
-- Migration 004: Indian GST fields
-- Run this in your Supabase SQL Editor
-- ============================================================

-- profiles: GST, website, bank details
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gstin TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_ifsc TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch TEXT;

-- clients: GST, state info
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS gstin TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS state_code TEXT;

-- invoice_items: HSN/SAC code, GST rate per item, discount percent
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS hsn_sac TEXT,
  ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) DEFAULT 18,
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0;

-- invoices: supply type (IGST vs CGST+SGST), bill number, place of supply
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS supply_type TEXT DEFAULT 'IGST'
    CHECK (supply_type IN ('IGST', 'CGST_SGST')),
  ADD COLUMN IF NOT EXISTS bill_number TEXT,
  ADD COLUMN IF NOT EXISTS place_of_supply TEXT;
