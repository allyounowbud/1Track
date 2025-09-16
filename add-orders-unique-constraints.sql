-- Add unique constraints to prevent duplicate orders at database level
-- Run this in your Supabase SQL Editor

-- First, let's see the current structure of the orders table
-- This will help us understand what fields are available for unique constraints
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;

-- Add a unique constraint based on a combination of fields that would indicate a true duplicate
-- This prevents identical orders (same item, same date, same retailer, same price) from being inserted
-- while still allowing legitimate multiple sales of the same item

-- Note: We'll use a partial unique index that only applies when all key fields are not null
-- This prevents true duplicates while allowing legitimate multiple sales

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_unique_order 
ON orders (item, order_date, retailer, marketplace, buy_price_cents, user_id)
WHERE item IS NOT NULL 
  AND order_date IS NOT NULL 
  AND retailer IS NOT NULL 
  AND marketplace IS NOT NULL 
  AND buy_price_cents IS NOT NULL
  AND user_id IS NOT NULL;

-- Alternative approach: If you want to be more restrictive and prevent ANY duplicates
-- (including legitimate multiple sales), uncomment the line below instead:

-- CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_strict_unique 
-- ON orders (item, order_date, retailer, marketplace, user_id)
-- WHERE item IS NOT NULL 
--   AND order_date IS NOT NULL 
--   AND retailer IS NOT NULL 
--   AND marketplace IS NOT NULL 
--   AND user_id IS NOT NULL;

-- Add a comment explaining the constraint
COMMENT ON INDEX idx_orders_unique_order IS 'Prevents duplicate orders with identical item, date, retailer, marketplace, and buy price for the same user';

-- Verify the constraint was created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'orders' 
AND indexname = 'idx_orders_unique_order';
