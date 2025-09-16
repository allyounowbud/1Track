-- Create the missing category tables that the application expects
-- These tables use a unified structure for each card game category

-- Pokemon Cards table (unified)
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

-- Magic Cards table (unified)
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

-- Yu-Gi-Oh Cards table (unified)
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

CREATE INDEX IF NOT EXISTS idx_magic_cards_name ON magic_cards(name);
CREATE INDEX IF NOT EXISTS idx_magic_cards_api_product_id ON magic_cards(api_product_id);
CREATE INDEX IF NOT EXISTS idx_magic_cards_price_source ON magic_cards(price_source);

CREATE INDEX IF NOT EXISTS idx_yugioh_cards_name ON yugioh_cards(name);
CREATE INDEX IF NOT EXISTS idx_yugioh_cards_api_product_id ON yugioh_cards(api_product_id);
CREATE INDEX IF NOT EXISTS idx_yugioh_cards_price_source ON yugioh_cards(price_source);

-- Enable Row Level Security
ALTER TABLE pokemon_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE yugioh_cards ENABLE ROW LEVEL SECURITY;

-- RLS policies for pokemon_cards
DROP POLICY IF EXISTS "Users can view their own pokemon cards" ON pokemon_cards;
CREATE POLICY "Users can view their own pokemon cards" ON pokemon_cards
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own pokemon cards" ON pokemon_cards;
CREATE POLICY "Users can insert their own pokemon cards" ON pokemon_cards
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own pokemon cards" ON pokemon_cards;
CREATE POLICY "Users can update their own pokemon cards" ON pokemon_cards
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own pokemon cards" ON pokemon_cards;
CREATE POLICY "Users can delete their own pokemon cards" ON pokemon_cards
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for magic_cards
DROP POLICY IF EXISTS "Users can view their own magic cards" ON magic_cards;
CREATE POLICY "Users can view their own magic cards" ON magic_cards
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own magic cards" ON magic_cards;
CREATE POLICY "Users can insert their own magic cards" ON magic_cards
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own magic cards" ON magic_cards;
CREATE POLICY "Users can update their own magic cards" ON magic_cards
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own magic cards" ON magic_cards;
CREATE POLICY "Users can delete their own magic cards" ON magic_cards
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for yugioh_cards
DROP POLICY IF EXISTS "Users can view their own yugioh cards" ON yugioh_cards;
CREATE POLICY "Users can view their own yugioh cards" ON yugioh_cards
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own yugioh cards" ON yugioh_cards;
CREATE POLICY "Users can insert their own yugioh cards" ON yugioh_cards
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own yugioh cards" ON yugioh_cards;
CREATE POLICY "Users can update their own yugioh cards" ON yugioh_cards
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own yugioh cards" ON yugioh_cards;
CREATE POLICY "Users can delete their own yugioh cards" ON yugioh_cards
  FOR DELETE USING (auth.uid() IS NOT NULL);


