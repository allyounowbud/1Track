-- Fix the unique constraint to allow legitimate multiple orders
-- The Order Book is designed to track individual items, so multiple identical orders
-- (same item, date, retailer, price) are normal and expected behavior

-- Drop the existing constraint completely
DROP INDEX IF EXISTS idx_orders_unique_order;

-- Note: We're removing the unique constraint entirely because:
-- 1. Multiple identical orders are legitimate (buying 3 of the same item)
-- 2. The Order Book tracks individual items, not bulk purchases
-- 3. True duplicates are prevented by the application logic and user workflow
-- 4. Database constraints should not interfere with normal business operations

-- If you want to add a constraint later, consider using a different approach
-- such as a composite key that includes a sequence number or timestamp
-- to allow multiple identical orders while preventing true duplicates

-- Verify the constraint was updated
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'orders' 
AND indexname = 'idx_orders_unique_order';
