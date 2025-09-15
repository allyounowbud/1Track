-- Price Charting API Integration Database Schema
-- Run this in your Supabase SQL Editor to add price charting support

-- Add new columns to items table for API integration
ALTER TABLE items ADD COLUMN IF NOT EXISTS price_source TEXT DEFAULT 'manual'; -- 'manual', 'api', 'hybrid'
ALTER TABLE items ADD COLUMN IF NOT EXISTS api_product_id TEXT; -- Price Charting product ID
ALTER TABLE items ADD COLUMN IF NOT EXISTS api_last_updated TIMESTAMP WITH TIME ZONE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS api_price_cents INTEGER; -- API-fetched price
ALTER TABLE items ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT FALSE; -- User override flag
ALTER TABLE items ADD COLUMN IF NOT EXISTS upc_code TEXT; -- UPC/EAN barcode for product identification
ALTER TABLE items ADD COLUMN IF NOT EXISTS product_category TEXT; -- Video Games, Trading Cards, etc.
ALTER TABLE items ADD COLUMN IF NOT EXISTS console_name TEXT; -- Nintendo Switch, PlayStation 5, etc.
ALTER TABLE items ADD COLUMN IF NOT EXISTS search_terms TEXT; -- Additional search terms for fuzzy matching

-- Create price_history table for tracking price changes over time
CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE, -- Corrected: items.id is UUID
  price_cents INTEGER NOT NULL,
  price_source TEXT NOT NULL, -- 'manual', 'api'
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  api_product_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create price_cache table for API response caching to minimize API calls
CREATE TABLE IF NOT EXISTS price_cache (
  id BIGSERIAL PRIMARY KEY,
  product_name TEXT NOT NULL,
  api_response JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE(product_name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_price_history_item_id ON price_history(item_id);
CREATE INDEX IF NOT EXISTS idx_price_history_user_id ON price_history(user_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_price_cache_product_name ON price_cache(product_name);
CREATE INDEX IF NOT EXISTS idx_price_cache_expires_at ON price_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_items_price_source ON items(price_source);
CREATE INDEX IF NOT EXISTS idx_items_api_product_id ON items(api_product_id);
CREATE INDEX IF NOT EXISTS idx_items_upc_code ON items(upc_code);
CREATE INDEX IF NOT EXISTS idx_items_product_category ON items(product_category);
CREATE INDEX IF NOT EXISTS idx_items_console_name ON items(console_name);

-- Enable Row Level Security (RLS) for new tables
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own price history" ON price_history;
DROP POLICY IF EXISTS "Users can insert their own price history" ON price_history;
DROP POLICY IF EXISTS "Users can update their own price history" ON price_history;
DROP POLICY IF EXISTS "Users can view price cache" ON price_cache;

-- Create RLS policies - users can only see their own price history
CREATE POLICY "Users can view their own price history" ON price_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own price history" ON price_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own price history" ON price_history
  FOR UPDATE USING (auth.uid() = user_id);

-- Price cache is read-only for users (managed by server functions)
CREATE POLICY "Users can view price cache" ON price_cache
  FOR SELECT USING (true);

-- Add function to automatically create price history entries when market_value_cents changes
CREATE OR REPLACE FUNCTION create_price_history_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create history entry if market_value_cents actually changed
  IF OLD.market_value_cents IS DISTINCT FROM NEW.market_value_cents THEN
    INSERT INTO price_history (user_id, item_id, price_cents, price_source, api_product_id)
    VALUES (
      auth.uid(),
      NEW.id,
      NEW.market_value_cents,
      COALESCE(NEW.price_source, 'manual'),
      NEW.api_product_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically track price changes
DROP TRIGGER IF EXISTS items_price_history_trigger ON items;
CREATE TRIGGER items_price_history_trigger
  AFTER UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION create_price_history_entry();

-- Add function to clean up expired price cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_price_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM price_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON price_history TO authenticated;
GRANT SELECT ON price_cache TO authenticated;
GRANT USAGE ON SEQUENCE price_history_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE price_cache_id_seq TO authenticated;

-- Optional: Create a view for easy price tracking
DROP VIEW IF EXISTS item_price_summary;
CREATE OR REPLACE VIEW item_price_summary AS
SELECT 
  i.id,
  i.name,
  i.market_value_cents,
  i.price_source,
  i.api_last_updated,
  i.manual_override,
  ph.latest_price_cents,
  ph.price_change_cents,
  ph.days_since_last_update
FROM items i
LEFT JOIN LATERAL (
  SELECT 
    price_cents as latest_price_cents,
    price_cents - LAG(price_cents) OVER (ORDER BY recorded_at) as price_change_cents,
    EXTRACT(DAYS FROM NOW() - recorded_at)::INTEGER as days_since_last_update
  FROM price_history 
  WHERE item_id = i.id 
  ORDER BY recorded_at DESC 
  LIMIT 1
) ph ON true;

-- Grant access to the view
GRANT SELECT ON item_price_summary TO authenticated;

-- Create table for storing Price Charting CSV data
CREATE TABLE IF NOT EXISTS price_charting_products (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL, -- 'video_games', 'pokemon_cards', 'magic_cards', 'yugioh_cards'
  product_id TEXT NOT NULL, -- Price Charting product ID
  product_name TEXT NOT NULL,
  console_name TEXT,
  loose_price DECIMAL(10,2),
  cib_price DECIMAL(10,2),
  new_price DECIMAL(10,2),
  graded_price DECIMAL(10,2),
  box_price DECIMAL(10,2),
  manual_price DECIMAL(10,2),
  upc_code TEXT, -- UPC/EAN barcode
  raw_data JSONB, -- Store the complete CSV row data
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category, product_id) -- Ensure unique products per category
);

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_price_charting_products_category ON price_charting_products(category);
CREATE INDEX IF NOT EXISTS idx_price_charting_products_product_id ON price_charting_products(product_id);
CREATE INDEX IF NOT EXISTS idx_price_charting_products_product_name ON price_charting_products USING gin(to_tsvector('english', product_name));
CREATE INDEX IF NOT EXISTS idx_price_charting_products_console_name ON price_charting_products(console_name);
CREATE INDEX IF NOT EXISTS idx_price_charting_products_downloaded_at ON price_charting_products(downloaded_at);

-- Enable RLS for the new table
ALTER TABLE price_charting_products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - users can view all price charting data
CREATE POLICY "Users can view price charting products" ON price_charting_products
  FOR SELECT USING (true);

-- Grant necessary permissions
GRANT SELECT ON price_charting_products TO authenticated;
GRANT USAGE ON SEQUENCE price_charting_products_id_seq TO authenticated;

-- Create table for CSV download logs
CREATE TABLE IF NOT EXISTS csv_download_logs (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  product_count INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for download logs
CREATE INDEX IF NOT EXISTS idx_csv_download_logs_category ON csv_download_logs(category);
CREATE INDEX IF NOT EXISTS idx_csv_download_logs_downloaded_at ON csv_download_logs(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_csv_download_logs_success ON csv_download_logs(success);

-- Enable RLS for download logs
ALTER TABLE csv_download_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for download logs
CREATE POLICY "Users can view download logs" ON csv_download_logs
  FOR SELECT USING (true);

-- Grant permissions for download logs
GRANT SELECT ON csv_download_logs TO authenticated;
GRANT USAGE ON SEQUENCE csv_download_logs_id_seq TO authenticated;
