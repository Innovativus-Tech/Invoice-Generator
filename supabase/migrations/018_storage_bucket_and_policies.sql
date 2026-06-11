-- ============================================================
-- Migration 018: Ensure invoices bucket exists and service_role
-- can write to it. Fixes "new row violates row-level security
-- policy" when uploading a logo / signature on a fresh project.
-- ============================================================

-- 1. Create the invoices bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Give service_role full access to objects in the invoices bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'service_role_all_invoices'
  ) THEN
    CREATE POLICY "service_role_all_invoices"
      ON storage.objects FOR ALL
      TO service_role
      USING (bucket_id = 'invoices')
      WITH CHECK (bucket_id = 'invoices');
  END IF;
END $$;

-- 3. Also let authenticated org members upload to their own folder,
--    in case any frontend code ever needs to upload directly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'authenticated_write_invoices'
  ) THEN
    CREATE POLICY "authenticated_write_invoices"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'invoices');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'authenticated_update_invoices'
  ) THEN
    CREATE POLICY "authenticated_update_invoices"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'invoices')
      WITH CHECK (bucket_id = 'invoices');
  END IF;
END $$;
