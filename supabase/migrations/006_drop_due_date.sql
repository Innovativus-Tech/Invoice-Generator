-- Remove due_date column from invoices table
ALTER TABLE invoices DROP COLUMN IF EXISTS due_date;
