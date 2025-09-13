-- 1Track Database Schema
-- Run this in your Supabase SQL Editor to create the missing tables

-- Create email_orders table
CREATE TABLE IF NOT EXISTS email_orders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  retailer TEXT NOT NULL,
  order_id TEXT NOT NULL,
  order_date DATE,
  item_name TEXT,
  quantity INTEGER,
  unit_price_cents INTEGER,
  total_cents INTEGER,
  image_url TEXT,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'ordered',
  source_message_id TEXT,
  source_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, retailer, order_id)
);

-- Create indexes for email_orders
CREATE INDEX IF NOT EXISTS idx_email_orders_user_id ON email_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_email_orders_retailer ON email_orders(retailer);
CREATE INDEX IF NOT EXISTS idx_email_orders_order_date ON email_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_email_orders_status ON email_orders(status);

-- Create email_shipments table
CREATE TABLE IF NOT EXISTS email_shipments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  retailer TEXT NOT NULL,
  order_id TEXT NOT NULL,
  tracking_number TEXT,
  carrier TEXT,
  status TEXT DEFAULT 'in_transit',
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, retailer, order_id, tracking_number)
);

-- Create indexes for email_shipments
CREATE INDEX IF NOT EXISTS idx_email_shipments_user_id ON email_shipments(user_id);
CREATE INDEX IF NOT EXISTS idx_email_shipments_retailer ON email_shipments(retailer);
CREATE INDEX IF NOT EXISTS idx_email_shipments_tracking ON email_shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_email_shipments_status ON email_shipments(status);

-- Create email_accounts table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS email_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gmail',
  access_token TEXT,
  refresh_token TEXT,
  token_scope TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, email_address)
);

-- Create indexes for email_accounts
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_provider ON email_accounts(provider);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE email_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - users can only see their own data
CREATE POLICY "Users can view their own email orders" ON email_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email orders" ON email_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email orders" ON email_orders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own email shipments" ON email_shipments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email shipments" ON email_shipments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email shipments" ON email_shipments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own email accounts" ON email_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email accounts" ON email_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email accounts" ON email_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email accounts" ON email_accounts
  FOR DELETE USING (auth.uid() = user_id);
