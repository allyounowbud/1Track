-- Create separate tables for each category
-- This will replace the single 'items' table with category-specific tables

-- Pokemon Singles table
CREATE TABLE IF NOT EXISTS pokemon_singles (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pokemon Sealed table
CREATE TABLE IF NOT EXISTS pokemon_sealed (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video Games table
CREATE TABLE IF NOT EXISTS video_games (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Magic Singles table
CREATE TABLE IF NOT EXISTS magic_singles (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Magic Sealed table
CREATE TABLE IF NOT EXISTS magic_sealed (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Yu-Gi-Oh Singles table
CREATE TABLE IF NOT EXISTS yugioh_singles (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Yu-Gi-Oh Sealed table
CREATE TABLE IF NOT EXISTS yugioh_sealed (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pokemon_singles_name ON pokemon_singles(name);
CREATE INDEX IF NOT EXISTS idx_pokemon_singles_api_product_id ON pokemon_singles(api_product_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_singles_price_source ON pokemon_singles(price_source);

CREATE INDEX IF NOT EXISTS idx_pokemon_sealed_name ON pokemon_sealed(name);
CREATE INDEX IF NOT EXISTS idx_pokemon_sealed_api_product_id ON pokemon_sealed(api_product_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_sealed_price_source ON pokemon_sealed(price_source);

CREATE INDEX IF NOT EXISTS idx_video_games_name ON video_games(name);
CREATE INDEX IF NOT EXISTS idx_video_games_api_product_id ON video_games(api_product_id);
CREATE INDEX IF NOT EXISTS idx_video_games_price_source ON video_games(price_source);

CREATE INDEX IF NOT EXISTS idx_magic_singles_name ON magic_singles(name);
CREATE INDEX IF NOT EXISTS idx_magic_singles_api_product_id ON magic_singles(api_product_id);
CREATE INDEX IF NOT EXISTS idx_magic_singles_price_source ON magic_singles(price_source);

CREATE INDEX IF NOT EXISTS idx_magic_sealed_name ON magic_sealed(name);
CREATE INDEX IF NOT EXISTS idx_magic_sealed_api_product_id ON magic_sealed(api_product_id);
CREATE INDEX IF NOT EXISTS idx_magic_sealed_price_source ON magic_sealed(price_source);

CREATE INDEX IF NOT EXISTS idx_yugioh_singles_name ON yugioh_singles(name);
CREATE INDEX IF NOT EXISTS idx_yugioh_singles_api_product_id ON yugioh_singles(api_product_id);
CREATE INDEX IF NOT EXISTS idx_yugioh_singles_price_source ON yugioh_singles(price_source);

CREATE INDEX IF NOT EXISTS idx_yugioh_sealed_name ON yugioh_sealed(name);
CREATE INDEX IF NOT EXISTS idx_yugioh_sealed_api_product_id ON yugioh_sealed(api_product_id);
CREATE INDEX IF NOT EXISTS idx_yugioh_sealed_price_source ON yugioh_sealed(price_source);

-- Create RLS policies for each table
ALTER TABLE pokemon_singles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pokemon_sealed ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_singles ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_sealed ENABLE ROW LEVEL SECURITY;
ALTER TABLE yugioh_singles ENABLE ROW LEVEL SECURITY;
ALTER TABLE yugioh_sealed ENABLE ROW LEVEL SECURITY;

-- RLS policies for pokemon_singles
DROP POLICY IF EXISTS "Users can view their own pokemon singles" ON pokemon_singles;
CREATE POLICY "Users can view their own pokemon singles" ON pokemon_singles
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own pokemon singles" ON pokemon_singles;
CREATE POLICY "Users can insert their own pokemon singles" ON pokemon_singles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own pokemon singles" ON pokemon_singles;
CREATE POLICY "Users can update their own pokemon singles" ON pokemon_singles
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own pokemon singles" ON pokemon_singles;
CREATE POLICY "Users can delete their own pokemon singles" ON pokemon_singles
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for pokemon_sealed
DROP POLICY IF EXISTS "Users can view their own pokemon sealed" ON pokemon_sealed;
CREATE POLICY "Users can view their own pokemon sealed" ON pokemon_sealed
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own pokemon sealed" ON pokemon_sealed;
CREATE POLICY "Users can insert their own pokemon sealed" ON pokemon_sealed
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own pokemon sealed" ON pokemon_sealed;
CREATE POLICY "Users can update their own pokemon sealed" ON pokemon_sealed
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own pokemon sealed" ON pokemon_sealed;
CREATE POLICY "Users can delete their own pokemon sealed" ON pokemon_sealed
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for video_games
DROP POLICY IF EXISTS "Users can view their own video games" ON video_games;
CREATE POLICY "Users can view their own video games" ON video_games
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own video games" ON video_games;
CREATE POLICY "Users can insert their own video games" ON video_games
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own video games" ON video_games;
CREATE POLICY "Users can update their own video games" ON video_games
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own video games" ON video_games;
CREATE POLICY "Users can delete their own video games" ON video_games
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for magic_singles
DROP POLICY IF EXISTS "Users can view their own magic singles" ON magic_singles;
CREATE POLICY "Users can view their own magic singles" ON magic_singles
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own magic singles" ON magic_singles;
CREATE POLICY "Users can insert their own magic singles" ON magic_singles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own magic singles" ON magic_singles;
CREATE POLICY "Users can update their own magic singles" ON magic_singles
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own magic singles" ON magic_singles;
CREATE POLICY "Users can delete their own magic singles" ON magic_singles
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for magic_sealed
DROP POLICY IF EXISTS "Users can view their own magic sealed" ON magic_sealed;
CREATE POLICY "Users can view their own magic sealed" ON magic_sealed
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own magic sealed" ON magic_sealed;
CREATE POLICY "Users can insert their own magic sealed" ON magic_sealed
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own magic sealed" ON magic_sealed;
CREATE POLICY "Users can update their own magic sealed" ON magic_sealed
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own magic sealed" ON magic_sealed;
CREATE POLICY "Users can delete their own magic sealed" ON magic_sealed
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for yugioh_singles
DROP POLICY IF EXISTS "Users can view their own yugioh singles" ON yugioh_singles;
CREATE POLICY "Users can view their own yugioh singles" ON yugioh_singles
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own yugioh singles" ON yugioh_singles;
CREATE POLICY "Users can insert their own yugioh singles" ON yugioh_singles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own yugioh singles" ON yugioh_singles;
CREATE POLICY "Users can update their own yugioh singles" ON yugioh_singles
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own yugioh singles" ON yugioh_singles;
CREATE POLICY "Users can delete their own yugioh singles" ON yugioh_singles
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for yugioh_sealed
DROP POLICY IF EXISTS "Users can view their own yugioh sealed" ON yugioh_sealed;
CREATE POLICY "Users can view their own yugioh sealed" ON yugioh_sealed
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own yugioh sealed" ON yugioh_sealed;
CREATE POLICY "Users can insert their own yugioh sealed" ON yugioh_sealed
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own yugioh sealed" ON yugioh_sealed;
CREATE POLICY "Users can update their own yugioh sealed" ON yugioh_sealed
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own yugioh sealed" ON yugioh_sealed;
CREATE POLICY "Users can delete their own yugioh sealed" ON yugioh_sealed
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Migrate existing data from 'items' table to appropriate category tables
-- This will preserve existing data when we transition

-- Migrate Pokemon Cards (will need to be manually categorized into singles vs sealed)
INSERT INTO pokemon_singles (name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, created_at, updated_at)
SELECT name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, created_at, NOW() as updated_at
FROM items 
WHERE (product_category = 'Pokemon Cards' OR console_name ILIKE '%pokemon%' OR name ILIKE '%pokemon%')
AND (name ILIKE '%card%' OR name ILIKE '%single%' OR console_name ILIKE '%card%');

INSERT INTO pokemon_sealed (name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, created_at, updated_at)
SELECT name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, created_at, NOW() as updated_at
FROM items 
WHERE (product_category = 'Pokemon Cards' OR console_name ILIKE '%pokemon%' OR name ILIKE '%pokemon%')
AND (name ILIKE '%box%' OR name ILIKE '%pack%' OR name ILIKE '%sealed%' OR name ILIKE '%booster%' OR console_name ILIKE '%box%' OR console_name ILIKE '%pack%');

-- Migrate Video Games
INSERT INTO video_games (name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, created_at, updated_at)
SELECT name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, created_at, NOW() as updated_at
FROM items 
WHERE product_category = 'Video Games' OR console_name NOT ILIKE '%pokemon%' AND console_name NOT ILIKE '%magic%' AND console_name NOT ILIKE '%yugioh%';

-- Note: Magic Cards and Yu-Gi-Oh Cards will be empty initially since we don't have data for those categories yet
