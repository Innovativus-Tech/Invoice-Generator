-- ============================================================
-- Migration 019: Book metadata on invoice line items
-- ============================================================
-- Adds optional ISBN / Author columns on invoice_items so that
-- book sellers can print structured metadata under each line's
-- Description. Also adds a `show_book_metadata` toggle on the
-- owner profile so the org can opt in/out at the workspace level.
-- ============================================================

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS isbn   TEXT,
  ADD COLUMN IF NOT EXISTS author TEXT;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_book_metadata BOOLEAN NOT NULL DEFAULT FALSE;
