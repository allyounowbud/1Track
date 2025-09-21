-- Create market_prices table for centralized price storage
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.market_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_name TEXT NOT NULL UNIQUE,
  market_value_cents BIGINT,
  image_url TEXT,
  set_name TEXT,
  rarity TEXT,
  source TEXT DEFAULT 'cardmarket',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access" ON public.market_prices;
DROP POLICY IF EXISTS "Allow authenticated inserts" ON public.market_prices;
DROP POLICY IF EXISTS "Allow authenticated updates" ON public.market_prices;

-- Create new policies
CREATE POLICY "Allow public read access" 
ON public.market_prices 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated inserts" 
ON public.market_prices 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated updates" 
ON public.market_prices 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_market_prices_item_name 
ON public.market_prices (item_name);

CREATE INDEX IF NOT EXISTS idx_market_prices_last_updated 
ON public.market_prices (last_updated);