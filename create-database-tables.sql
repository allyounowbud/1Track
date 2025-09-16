-- Create Database Tables for the new Database section
-- This creates the proper table structure for singles/sealed organization

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

-- Video Games table (single type, no singles/sealed distinction)
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pokemon_singles_name ON pokemon_singles(name);
CREATE INDEX IF NOT EXISTS idx_pokemon_singles_api_product_id ON pokemon_singles(api_product_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_singles_price_source ON pokemon_singles(price_source);

CREATE INDEX IF NOT EXISTS idx_pokemon_sealed_name ON pokemon_sealed(name);
CREATE INDEX IF NOT EXISTS idx_pokemon_sealed_api_product_id ON pokemon_sealed(api_product_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_sealed_price_source ON pokemon_sealed(price_source);

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

CREATE INDEX IF NOT EXISTS idx_video_games_name ON video_games(name);
CREATE INDEX IF NOT EXISTS idx_video_games_api_product_id ON video_games(api_product_id);
CREATE INDEX IF NOT EXISTS idx_video_games_price_source ON video_games(price_source);

-- Enable Row Level Security
ALTER TABLE pokemon_singles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pokemon_sealed ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_singles ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_sealed ENABLE ROW LEVEL SECURITY;
ALTER TABLE yugioh_singles ENABLE ROW LEVEL SECURITY;
ALTER TABLE yugioh_sealed ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_games ENABLE ROW LEVEL SECURITY;

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


