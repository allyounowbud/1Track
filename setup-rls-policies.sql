-- Setup Row Level Security (RLS) for 1Track main tables
-- Run this in your Supabase SQL Editor

-- First, add user_id columns to main tables if they don't exist
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE retailers 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE marketplaces 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_retailers_user_id ON retailers(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplaces_user_id ON marketplaces(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- Enable Row Level Security on all main tables
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop any existing open policies (if they exist)
DROP POLICY IF EXISTS "Allow public read access to items" ON items;
DROP POLICY IF EXISTS "Allow public read access to retailers" ON retailers;
DROP POLICY IF EXISTS "Allow public read access to marketplaces" ON marketplaces;

-- Create secure RLS policies for items
CREATE POLICY "Users can view their own items" ON items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own items" ON items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own items" ON items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own items" ON items
  FOR DELETE USING (auth.uid() = user_id);

-- Create secure RLS policies for retailers
CREATE POLICY "Users can view their own retailers" ON retailers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own retailers" ON retailers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own retailers" ON retailers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own retailers" ON retailers
  FOR DELETE USING (auth.uid() = user_id);

-- Create secure RLS policies for marketplaces
CREATE POLICY "Users can view their own marketplaces" ON marketplaces
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own marketplaces" ON marketplaces
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own marketplaces" ON marketplaces
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own marketplaces" ON marketplaces
  FOR DELETE USING (auth.uid() = user_id);

-- Create secure RLS policies for orders
CREATE POLICY "Users can view their own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders" ON orders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own orders" ON orders
  FOR DELETE USING (auth.uid() = user_id);

-- Optional: Create a function to automatically set user_id on insert
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically set user_id
CREATE TRIGGER set_items_user_id
  BEFORE INSERT ON items
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

CREATE TRIGGER set_retailers_user_id
  BEFORE INSERT ON retailers
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

CREATE TRIGGER set_marketplaces_user_id
  BEFORE INSERT ON marketplaces
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

CREATE TRIGGER set_orders_user_id
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();
