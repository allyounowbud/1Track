-- Create separate tables for each category
-- This will replace the single 'items' table with category-specific tables

-- Pokemon Cards table
CREATE TABLE IF NOT EXISTS pokemon_cards (
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

-- Magic Cards table
CREATE TABLE IF NOT EXISTS magic_cards (
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

-- Yu-Gi-Oh Cards table
CREATE TABLE IF NOT EXISTS yugioh_cards (
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
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_name ON pokemon_cards(name);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_api_product_id ON pokemon_cards(api_product_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_cards_price_source ON pokemon_cards(price_source);

CREATE INDEX IF NOT EXISTS idx_video_games_name ON video_games(name);
CREATE INDEX IF NOT EXISTS idx_video_games_api_product_id ON video_games(api_product_id);
CREATE INDEX IF NOT EXISTS idx_video_games_price_source ON video_games(price_source);

CREATE INDEX IF NOT EXISTS idx_magic_cards_name ON magic_cards(name);
CREATE INDEX IF NOT EXISTS idx_magic_cards_api_product_id ON magic_cards(api_product_id);
CREATE INDEX IF NOT EXISTS idx_magic_cards_price_source ON magic_cards(price_source);

CREATE INDEX IF NOT EXISTS idx_yugioh_cards_name ON yugioh_cards(name);
CREATE INDEX IF NOT EXISTS idx_yugioh_cards_api_product_id ON yugioh_cards(api_product_id);
CREATE INDEX IF NOT EXISTS idx_yugioh_cards_price_source ON yugioh_cards(price_source);

-- Create RLS policies for each table
ALTER TABLE pokemon_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE yugioh_cards ENABLE ROW LEVEL SECURITY;

-- RLS policies for pokemon_cards
CREATE POLICY "Users can view their own pokemon cards" ON pokemon_cards
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own pokemon cards" ON pokemon_cards
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own pokemon cards" ON pokemon_cards
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own pokemon cards" ON pokemon_cards
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for video_games
CREATE POLICY "Users can view their own video games" ON video_games
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own video games" ON video_games
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own video games" ON video_games
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own video games" ON video_games
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for magic_cards
CREATE POLICY "Users can view their own magic cards" ON magic_cards
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own magic cards" ON magic_cards
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own magic cards" ON magic_cards
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own magic cards" ON magic_cards
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for yugioh_cards
CREATE POLICY "Users can view their own yugioh cards" ON yugioh_cards
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own yugioh cards" ON yugioh_cards
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own yugioh cards" ON yugioh_cards
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own yugioh cards" ON yugioh_cards
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Migrate existing data from 'items' table to appropriate category tables
-- This will preserve existing data when we transition

-- Migrate Pokemon Cards
INSERT INTO pokemon_cards (name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, created_at, updated_at)
SELECT name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, created_at, updated_at
FROM items 
WHERE product_category = 'Pokemon Cards' OR console_name ILIKE '%pokemon%' OR name ILIKE '%pokemon%';

-- Migrate Video Games
INSERT INTO video_games (name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, created_at, updated_at)
SELECT name, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, created_at, updated_at
FROM items 
WHERE product_category = 'Video Games' OR console_name NOT ILIKE '%pokemon%' AND console_name NOT ILIKE '%magic%' AND console_name NOT ILIKE '%yugioh%';

-- Note: Magic Cards and Yu-Gi-Oh Cards will be empty initially since we don't have data for those categories yet
