-- Update invoices bucket to be public
UPDATE storage.buckets
SET public = true
WHERE id = 'invoices';

-- Allow public read access to all objects in the invoices bucket
-- This is necessary for images to show in emails and browser previews
-- without requiring a signed URL for every single load.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Public read access to invoices'
  ) THEN
    CREATE POLICY "Public read access to invoices"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'invoices');
  END IF;
END $$;
