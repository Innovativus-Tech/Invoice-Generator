-- Add a generated tsvector column that combines all searchable fields
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce("Book Title", '') || ' ' ||
      coalesce("ISBN", '') || ' ' ||
      coalesce("Name of Author/Editor", '') || ' ' ||
      coalesce("Name of Publishing Agency/Publisher", '') || ' ' ||
      coalesce("Imprint", '')
    )
  ) STORED;

-- Create GIN index on the tsvector column for fast search
CREATE INDEX IF NOT EXISTS inventory_items_search_idx
  ON inventory_items USING gin(search_vector);

-- Also keep a simple index on ISBN for exact lookups
CREATE INDEX IF NOT EXISTS inventory_items_isbn_exact_idx
  ON inventory_items ("ISBN");
