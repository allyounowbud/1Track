-- Create table for caching product images
CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_name TEXT NOT NULL UNIQUE,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_images_name ON product_images(product_name);
CREATE INDEX IF NOT EXISTS idx_product_images_scraped_at ON product_images(scraped_at);

-- Add RLS policies
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated users to read product images" ON product_images
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role to manage
CREATE POLICY "Allow service role to manage product images" ON product_images
  FOR ALL USING (auth.role() = 'service_role');
