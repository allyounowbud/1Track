-- Create Unified Products Table
-- This consolidates all product categories into a single table with category field

-- Create the unified products table
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('tcg_sealed', 'tcg_singles', 'video_games', 'other_items')),
  market_value_cents INTEGER DEFAULT 0,
  price_source TEXT DEFAULT 'manual' CHECK (price_source IN ('manual', 'api')),
  api_product_id TEXT,
  api_last_updated TIMESTAMP WITH TIME ZONE,
  api_price_cents INTEGER,
  manual_override BOOLEAN DEFAULT FALSE,
  upc_code TEXT,
  console_name TEXT,
  search_terms TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_api_product_id ON products(api_product_id);
CREATE INDEX IF NOT EXISTS idx_products_price_source ON products(price_source);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- RLS policies for products
DROP POLICY IF EXISTS "Users can view their own products" ON products;
CREATE POLICY "Users can view their own products" ON products
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own products" ON products;
CREATE POLICY "Users can insert their own products" ON products
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own products" ON products;
CREATE POLICY "Users can update their own products" ON products
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own products" ON products;
CREATE POLICY "Users can delete their own products" ON products
  FOR DELETE USING (auth.uid() IS NOT NULL);
