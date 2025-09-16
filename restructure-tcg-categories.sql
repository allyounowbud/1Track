-- Restructure TCG Categories
-- This script consolidates Pokemon, Magic, and Yu-Gi-Oh categories into TCG Sealed and TCG Singles

-- Create new TCG tables
CREATE TABLE IF NOT EXISTS tcg_sealed (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  market_value_cents INTEGER DEFAULT 0,
  price_source TEXT DEFAULT 'manual' CHECK (price_source IN ('manual', 'api')),
  api_product_id TEXT,
  api_last_updated TIMESTAMP WITH TIME ZONE,
  api_price_cents INTEGER,
  manual_override BOOLEAN DEFAULT FALSE,
  upc_code TEXT,
  console_name TEXT,
  search_terms TEXT,
  game_type TEXT, -- 'pokemon', 'magic', 'yugioh' to track which game the item belongs to
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tcg_singles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  market_value_cents INTEGER DEFAULT 0,
  price_source TEXT DEFAULT 'manual' CHECK (price_source IN ('manual', 'api')),
  api_product_id TEXT,
  api_last_updated TIMESTAMP WITH TIME ZONE,
  api_price_cents INTEGER,
  manual_override BOOLEAN DEFAULT FALSE,
  upc_code TEXT,
  console_name TEXT,
  search_terms TEXT,
  game_type TEXT, -- 'pokemon', 'magic', 'yugioh' to track which game the item belongs to
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tcg_sealed_name ON tcg_sealed(name);
CREATE INDEX IF NOT EXISTS idx_tcg_sealed_api_product_id ON tcg_sealed(api_product_id);
CREATE INDEX IF NOT EXISTS idx_tcg_sealed_price_source ON tcg_sealed(price_source);
CREATE INDEX IF NOT EXISTS idx_tcg_sealed_game_type ON tcg_sealed(game_type);

CREATE INDEX IF NOT EXISTS idx_tcg_singles_name ON tcg_singles(name);
CREATE INDEX IF NOT EXISTS idx_tcg_singles_api_product_id ON tcg_singles(api_product_id);
CREATE INDEX IF NOT EXISTS idx_tcg_singles_price_source ON tcg_singles(price_source);
CREATE INDEX IF NOT EXISTS idx_tcg_singles_game_type ON tcg_singles(game_type);

-- Enable RLS for new tables
ALTER TABLE tcg_sealed ENABLE ROW LEVEL SECURITY;
ALTER TABLE tcg_singles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tcg_sealed
DROP POLICY IF EXISTS "Users can view tcg sealed" ON tcg_sealed;
CREATE POLICY "Users can view tcg sealed" ON tcg_sealed
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert tcg sealed" ON tcg_sealed;
CREATE POLICY "Users can insert tcg sealed" ON tcg_sealed
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update tcg sealed" ON tcg_sealed;
CREATE POLICY "Users can update tcg sealed" ON tcg_sealed
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete tcg sealed" ON tcg_sealed;
CREATE POLICY "Users can delete tcg sealed" ON tcg_sealed
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create RLS policies for tcg_singles
DROP POLICY IF EXISTS "Users can view tcg singles" ON tcg_singles;
CREATE POLICY "Users can view tcg singles" ON tcg_singles
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert tcg singles" ON tcg_singles;
CREATE POLICY "Users can insert tcg singles" ON tcg_singles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update tcg singles" ON tcg_singles;
CREATE POLICY "Users can update tcg singles" ON tcg_singles
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete tcg singles" ON tcg_singles;
CREATE POLICY "Users can delete tcg singles" ON tcg_singles
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Migrate data from existing tables to new consolidated tables
-- Migrate Pokemon Sealed to TCG Sealed
INSERT INTO tcg_sealed (name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, game_type, created_at, updated_at)
SELECT name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, 'pokemon', created_at, NOW() as updated_at
FROM pokemon_sealed;

-- Migrate Magic Sealed to TCG Sealed
INSERT INTO tcg_sealed (name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, game_type, created_at, updated_at)
SELECT name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, 'magic', created_at, NOW() as updated_at
FROM magic_sealed;

-- Migrate Yu-Gi-Oh Sealed to TCG Sealed
INSERT INTO tcg_sealed (name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, game_type, created_at, updated_at)
SELECT name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, 'yugioh', created_at, NOW() as updated_at
FROM yugioh_sealed;

-- Migrate Pokemon Singles to TCG Singles
INSERT INTO tcg_singles (name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, game_type, created_at, updated_at)
SELECT name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, 'pokemon', created_at, NOW() as updated_at
FROM pokemon_singles;

-- Migrate Magic Singles to TCG Singles
INSERT INTO tcg_singles (name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, game_type, created_at, updated_at)
SELECT name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, 'magic', created_at, NOW() as updated_at
FROM magic_singles;

-- Migrate Yu-Gi-Oh Singles to TCG Singles
INSERT INTO tcg_singles (name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, game_type, created_at, updated_at)
SELECT name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, 'yugioh', created_at, NOW() as updated_at
FROM yugioh_singles;

-- Note: After running this script and updating the application code, you can optionally drop the old tables:
-- DROP TABLE IF EXISTS pokemon_sealed;
-- DROP TABLE IF EXISTS pokemon_singles;
-- DROP TABLE IF EXISTS magic_sealed;
-- DROP TABLE IF EXISTS magic_singles;
-- DROP TABLE IF EXISTS yugioh_sealed;
-- DROP TABLE IF EXISTS yugioh_singles;
