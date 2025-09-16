-- Create price_cache table for Price Charting API caching
-- This table stores API responses to reduce API calls and improve performance

CREATE TABLE IF NOT EXISTS price_cache (
  id SERIAL PRIMARY KEY,
  product_name TEXT NOT NULL,
  api_response JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_price_cache_product_name ON price_cache(product_name);
CREATE INDEX IF NOT EXISTS idx_price_cache_expires_at ON price_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_price_cache_cached_at ON price_cache(cached_at);

-- Create unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_cache_unique_product ON price_cache(product_name);

-- Add RLS (Row Level Security) policies
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read from cache
CREATE POLICY "Allow authenticated users to read price cache" ON price_cache
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role to manage cache (for API functions)
CREATE POLICY "Allow service role to manage price cache" ON price_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_price_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_price_cache_updated_at
  BEFORE UPDATE ON price_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_price_cache_updated_at();

-- Create function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_price_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM price_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment to table
COMMENT ON TABLE price_cache IS 'Caches Price Charting API responses to reduce API calls and improve performance';
COMMENT ON COLUMN price_cache.product_name IS 'Normalized product name used for caching';
COMMENT ON COLUMN price_cache.api_response IS 'Full API response from Price Charting API';
COMMENT ON COLUMN price_cache.cached_at IS 'When the response was cached';
COMMENT ON COLUMN price_cache.expires_at IS 'When the cache entry expires (typically 24 hours)';
