-- Drop existing table
DROP TABLE IF EXISTS inventory_items CASCADE;

-- Recreate with new schema
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_title TEXT NOT NULL,
  isbn TEXT,
  product_form TEXT,
  language TEXT,
  applicant_type TEXT,
  publisher TEXT,
  imprint TEXT,
  author TEXT,
  publication_date TEXT,
  price NUMERIC(12,2) DEFAULT 0,
  gst_rate NUMERIC(5,2) DEFAULT 18,
  stock INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their inventory"
  ON inventory_items FOR ALL
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX inventory_items_book_title_idx
  ON inventory_items USING gin(to_tsvector('english', coalesce(book_title, '')));

CREATE INDEX inventory_items_isbn_idx
  ON inventory_items (isbn);
