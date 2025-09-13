-- Fix missing columns in email_orders table
-- Run this in your Supabase SQL Editor

-- Add missing source_email column if it doesn't exist
ALTER TABLE email_orders 
ADD COLUMN IF NOT EXISTS source_email TEXT;

-- Add missing source_message_id column if it doesn't exist  
ALTER TABLE email_orders 
ADD COLUMN IF NOT EXISTS source_message_id TEXT;

-- Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'email_orders' 
ORDER BY ordinal_position;
