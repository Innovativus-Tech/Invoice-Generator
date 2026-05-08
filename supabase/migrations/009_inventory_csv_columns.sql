DROP TABLE IF EXISTS inventory_items CASCADE;

CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  "#" INTEGER,
  "Book Title" TEXT NOT NULL,
  "ISBN" TEXT,
  "Product Form" TEXT,
  "Language" TEXT,
  "Applicant Type" TEXT,
  "Name of Publishing Agency/Publisher" TEXT,
  "Imprint" TEXT,
  "Name of Author/Editor" TEXT,
  "Publication Date" TEXT,
  price NUMERIC(12,2) DEFAULT 0,
  gst_rate NUMERIC(5,2) DEFAULT 18,
  stock INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their inventory"
  ON inventory_items FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX inventory_items_title_idx
  ON inventory_items USING gin(
    to_tsvector('english', "Book Title")
  );

CREATE INDEX inventory_items_isbn_idx
  ON inventory_items ("ISBN");
