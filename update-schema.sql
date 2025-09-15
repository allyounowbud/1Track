-- Update price_charting_products table to add UPC field and UNIQUE constraint
-- Run this in your Supabase SQL Editor

-- Add UPC field if it doesn't exist
ALTER TABLE price_charting_products ADD COLUMN IF NOT EXISTS upc_code TEXT;

-- Check if constraint already exists before adding it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'price_charting_products_category_product_id_unique'
        AND table_name = 'price_charting_products'
    ) THEN
        -- Add UNIQUE constraint to prevent duplicate products
        ALTER TABLE price_charting_products ADD CONSTRAINT price_charting_products_category_product_id_unique UNIQUE (category, product_id);
    END IF;
END $$;

-- If you get an error about existing duplicates, run this first:
-- DELETE FROM price_charting_products 
-- WHERE id NOT IN (
--   SELECT MIN(id) 
--   FROM price_charting_products 
--   GROUP BY category, product_id
-- );
