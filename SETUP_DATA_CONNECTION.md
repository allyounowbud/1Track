# 🔗 Data Connection Setup Guide

## ✅ Current Status

Your v2 workspace is properly configured with:
- ✅ **API Keys**: Card Market API (RapidAPI) + Price Charting fallback
- ✅ **Supabase**: Connected to your existing database
- ✅ **Background Service**: Auto-starts for daily price updates
- ✅ **Pro Plan**: 3,000 requests/day (conservative 24h updates)

## 🚀 Next Steps to Connect Data

### 1. Create Market Prices Table in Supabase

Run this SQL in your Supabase SQL Editor:

```sql
-- Create market_prices table for centralized price storage
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
CREATE POLICY IF NOT EXISTS "Allow public read access" 
ON public.market_prices 
FOR SELECT 
USING (true);

CREATE POLICY IF NOT EXISTS "Allow authenticated inserts" 
ON public.market_prices 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Allow authenticated updates" 
ON public.market_prices 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_market_prices_item_name 
ON public.market_prices (item_name);

CREATE INDEX IF NOT EXISTS idx_market_prices_last_updated 
ON public.market_prices (last_updated);
```

### 2. Test the Connection

1. **Open your app**: http://localhost:5173/
2. **Login with Discord** to access your Supabase data
3. **Go to Collection page** - you should see your real orders
4. **Click "Test API" button** to verify Card Market API is working
5. **Click "Update Prices" button** to populate the market_prices table

### 3. Verify Data Flow

The system works in this order:

1. **Collection Page** loads your orders from Supabase
2. **Database First**: Checks `market_prices` table for existing prices
3. **API Fallback**: If no database prices, fetches from Card Market API
4. **Background Updates**: Daily price updates via background service
5. **Display**: Shows item names, set names, and market values

## 🔍 How Item Matching Works

The system uses multiple search strategies to match your item names:

### Your Item Names → API Search Terms

**Example**: `"Elite Trainer Box - Pokemon Prismatic Evolutions"`

**Search Strategies**:
1. `"Elite Trainer Box - Pokemon Prismatic Evolutions"` (original)
2. `"Prismatic Evolutions"` (cleaned)
3. `"Prismatic Evolutions"` (set name only)
4. `"Elite Trainer Box - Prismatic Evolutions"` (without Pokemon)

### API Response → Display Format

**Card Market API returns**:
```json
{
  "name": "Elite Trainer Box",
  "set": "Prismatic Evolutions", 
  "price": 45.99,
  "image": "https://...",
  "rarity": "Ultra Rare"
}
```

**Displayed as**:
- **Item Name**: Elite Trainer Box
- **Set Name**: Prismatic Evolutions  
- **Market Value**: $45.99
- **Image**: Card image from API

## 🎯 Expected Results

After setup, you should see:

- ✅ **Real order data** from your Supabase database
- ✅ **Market prices** from Card Market API
- ✅ **Product images** for most items
- ✅ **Set names** extracted from API data
- ✅ **Daily price updates** via background service
- ✅ **Pro plan status** showing 1.5% API usage

## 🛠️ Troubleshooting

### If you see "No Market Data":
1. Check browser console for API errors
2. Verify API keys in `.env.local`
3. Click "Test API" button to verify connection
4. Click "Update Prices" to populate database

### If prices aren't updating:
1. Check if `market_prices` table exists in Supabase
2. Verify background service is running (check console logs)
3. Manual update via "Update Prices" button

### If item names don't match:
1. The system tries multiple search strategies automatically
2. Some items may not have exact matches in the API
3. Fallback to Price Charting API for better coverage

## 📊 API Usage Monitoring

Your Pro plan (3,000 requests/day) usage:
- **Current**: ~44 calls/day (1.5% usage)
- **Safety Buffer**: 2,956 unused calls (98.5% buffer)
- **Update Frequency**: Once every 24 hours
- **User Capacity**: 1,000+ users easily supported

The system is designed to be extremely conservative with API usage while providing fresh daily prices for all users.
