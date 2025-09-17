# Image Scraping Setup Guide

## Current Status
The image system is currently using placeholder images to show that the functionality works. To get real product images from PriceCharting, follow these steps:

## Step 1: Create Database Table
Run this SQL in your Supabase dashboard (SQL Editor):

```sql
-- Create table for caching product images
CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_name TEXT NOT NULL UNIQUE,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_images_name ON product_images(product_name);
CREATE INDEX IF NOT EXISTS idx_product_images_scraped_at ON product_images(scraped_at);

-- Add RLS policies
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated users to read product images" ON product_images
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role to manage
CREATE POLICY "Allow service role to manage product images" ON product_images
  FOR ALL USING (auth.role() = 'service_role');
```

## Step 2: Deploy Edge Function
If you have Supabase CLI installed:

```bash
supabase functions deploy price-charting-images
```

If not, you can deploy manually through the Supabase dashboard:
1. Go to Edge Functions in your Supabase dashboard
2. Create a new function called `price-charting-images`
3. Copy the contents from `supabase/functions/price-charting-images/index.ts`

## Step 3: Enable Real Image Scraping
Once the database table and edge function are set up, edit `src/services/imageService.js`:

1. Comment out the placeholder image section (lines 21-35)
2. Uncomment the real edge function call section (lines 37-69)

## Step 4: Test
Search for products and you should see real images loading from PriceCharting!

## Troubleshooting
- Check browser console for any error messages
- Verify the edge function is deployed and accessible
- Make sure the database table exists and has proper permissions
- Check that your Supabase environment variables are correct

## Current Behavior
Right now, you'll see placeholder images with "Product Image" text, which confirms the image system is working. Once you complete the setup above, you'll get real product images from PriceCharting.
