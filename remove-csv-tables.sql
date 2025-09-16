-- Remove CSV-related database tables and data
-- Run this in your Supabase SQL Editor to clean up CSV-related tables

-- Drop CSV-related tables
DROP TABLE IF EXISTS price_charting_products CASCADE;
DROP TABLE IF EXISTS csv_download_logs CASCADE;

-- Drop any related indexes (they should be dropped automatically with the tables)
-- But just in case, let's be explicit:
DROP INDEX IF EXISTS idx_price_charting_products_category;
DROP INDEX IF EXISTS idx_price_charting_products_product_id;
DROP INDEX IF EXISTS idx_price_charting_products_product_name;
DROP INDEX IF EXISTS idx_price_charting_products_console_name;
DROP INDEX IF EXISTS idx_price_charting_products_downloaded_at;

DROP INDEX IF EXISTS idx_csv_download_logs_category;
DROP INDEX IF EXISTS idx_csv_download_logs_downloaded_at;
DROP INDEX IF EXISTS idx_csv_download_logs_success;

-- Verify tables are removed
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('price_charting_products', 'csv_download_logs');
