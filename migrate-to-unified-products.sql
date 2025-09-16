-- Migrate Data to Unified Products Table
-- This script migrates data from separate tables to the unified products table

-- Migrate TCG Sealed data
INSERT INTO products (name, category, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, created_at, updated_at)
SELECT 
  name,
  'tcg_sealed' as category,
  market_value_cents,
  price_source,
  api_product_id,
  api_last_updated,
  api_price_cents,
  manual_override,
  upc_code,
  console_name,
  search_terms,
  created_at,
  updated_at
FROM tcg_sealed
WHERE NOT EXISTS (
  SELECT 1 FROM products p 
  WHERE p.name = tcg_sealed.name 
  AND p.category = 'tcg_sealed'
);

-- Migrate TCG Singles data
INSERT INTO products (name, category, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, created_at, updated_at)
SELECT 
  name,
  'tcg_singles' as category,
  market_value_cents,
  price_source,
  api_product_id,
  api_last_updated,
  api_price_cents,
  manual_override,
  upc_code,
  console_name,
  search_terms,
  created_at,
  updated_at
FROM tcg_singles
WHERE NOT EXISTS (
  SELECT 1 FROM products p 
  WHERE p.name = tcg_singles.name 
  AND p.category = 'tcg_singles'
);

-- Migrate Video Games data
INSERT INTO products (name, category, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, created_at, updated_at)
SELECT 
  name,
  'video_games' as category,
  market_value_cents,
  price_source,
  api_product_id,
  api_last_updated,
  api_price_cents,
  manual_override,
  upc_code,
  console_name,
  search_terms,
  created_at,
  updated_at
FROM video_games
WHERE NOT EXISTS (
  SELECT 1 FROM products p 
  WHERE p.name = video_games.name 
  AND p.category = 'video_games'
);

-- Migrate Other Items data
INSERT INTO products (name, category, market_value_cents, price_source, api_product_id, api_last_updated, api_price_cents, manual_override, upc_code, console_name, search_terms, created_at, updated_at)
SELECT 
  name,
  'other_items' as category,
  market_value_cents,
  price_source,
  api_product_id,
  api_last_updated,
  api_price_cents,
  manual_override,
  upc_code,
  console_name,
  search_terms,
  created_at,
  updated_at
FROM items
WHERE NOT EXISTS (
  SELECT 1 FROM products p 
  WHERE p.name = items.name 
  AND p.category = 'other_items'
);

-- Verify migration
SELECT 
  category,
  COUNT(*) as count
FROM products
GROUP BY category
ORDER BY category;
