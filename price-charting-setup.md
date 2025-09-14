# Price Charting API Integration Setup Guide

## 🚀 **Overview**
This guide will help you set up the Price Charting API integration for automatic market value fetching in your 1Track application.

## 📋 **Prerequisites**
1. **Price Charting API Account**: Sign up at [pricecharting.com](https://www.pricecharting.com) and get your API key
2. **Database Schema**: Run the `price-charting-schema.sql` file in your Supabase SQL Editor
3. **Netlify Functions**: Deploy the new `price-charting.js` function

## 🔧 **Environment Variables Setup**

### **1. Netlify Environment Variables**
Add these environment variables to your Netlify site:

```bash
# Required: Price Charting API Key
PRICE_CHARTING_API_KEY=your_api_key_here

# Already configured (should exist):
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### **2. How to Add Environment Variables in Netlify**
1. Go to your Netlify dashboard
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Click **Add variable**
5. Add each variable above

## 🎯 **API Endpoints**

### **Search for Products**
```bash
GET /.netlify/functions/price-charting/search?q=product_name
```

**Example:**
```bash
GET /.netlify/functions/price-charting/search?q=charizard
```

**Response:**
```json
{
  "success": true,
  "cached": false,
  "data": {
    "products": [
      {
        "id": "12345",
        "product-name": "Charizard Base Set",
        "console-name": "Pokemon",
        "loose-price": "$150.00",
        "complete-price": "$200.00",
        "new-price": "$250.00"
      }
    ]
  }
}
```

### **Update Item Price**
```bash
POST /.netlify/functions/price-charting/update-price
Content-Type: application/json

{
  "itemId": "uuid-here",
  "productId": "12345"
}
```

### **Bulk Update Prices**
```bash
POST /.netlify/functions/price-charting/bulk-update
Content-Type: application/json

{
  "itemIds": ["uuid1", "uuid2", "uuid3"]
}
```

### **Check Cache Status**
```bash
GET /.netlify/functions/price-charting/cache-status
```

## 🗄️ **Database Tables**

### **Items Table (Updated)**
New columns added:
- `price_source`: 'manual', 'api', 'hybrid'
- `api_product_id`: Price Charting product ID
- `api_last_updated`: When API price was last fetched
- `api_price_cents`: API-fetched price in cents
- `manual_override`: User override flag

### **Price History Table**
Tracks all price changes over time:
- `item_id`: References items table
- `price_cents`: Price at time of recording
- `price_source`: 'manual' or 'api'
- `recorded_at`: Timestamp of price change

### **Price Cache Table**
Caches API responses to minimize API calls:
- `product_name`: Normalized product name
- `api_response`: Full API response JSON
- `cached_at`: When cached
- `expires_at`: When cache expires (24 hours)

## 🔄 **Rate Limiting & Caching**

### **Rate Limits**
- **Daily Limit**: 1000 API calls per day (configurable)
- **Caching**: 24-hour cache for API responses
- **Automatic Cleanup**: Expired cache entries are cleaned up

### **Caching Strategy**
1. **First Request**: Calls Price Charting API, caches response
2. **Subsequent Requests**: Returns cached data if available
3. **Cache Expiry**: After 24 hours, makes new API call
4. **Manual Refresh**: Can force refresh by clearing cache

## 🎨 **Frontend Integration**

### **1. Search for Products**
```javascript
const searchProducts = async (productName) => {
  const response = await fetch(`/.netlify/functions/price-charting/search?q=${encodeURIComponent(productName)}`);
  const data = await response.json();
  return data;
};
```

### **2. Update Item Price**
```javascript
const updateItemPrice = async (itemId, productId) => {
  const response = await fetch('/.netlify/functions/price-charting/update-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, productId })
  });
  const data = await response.json();
  return data;
};
```

### **3. Bulk Update Prices**
```javascript
const bulkUpdatePrices = async (itemIds) => {
  const response = await fetch('/.netlify/functions/price-charting/bulk-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemIds })
  });
  const data = await response.json();
  return data;
};
```

## 🚨 **Error Handling**

### **Common Error Responses**
```json
{
  "error": "Product name is required"
}
```

```json
{
  "error": "Daily API rate limit exceeded. Please try again tomorrow."
}
```

```json
{
  "error": "Price Charting API key not configured"
}
```

### **Rate Limit Handling**
- **HTTP 429**: Rate limit exceeded
- **Retry Logic**: Implement exponential backoff
- **User Feedback**: Show clear error messages

## 🧪 **Testing**

### **1. Test API Connection**
```bash
curl "https://your-site.netlify.app/.netlify/functions/price-charting/search?q=test"
```

### **2. Test with Sample Data**
1. Add a test item in your Settings page
2. Search for the product using the API
3. Link the product ID to the item
4. Update the price

### **3. Monitor API Usage**
Check cache status to monitor API usage:
```bash
curl "https://your-site.netlify.app/.netlify/functions/price-charting/cache-status"
```

## 🔒 **Security Considerations**

### **API Key Protection**
- ✅ API key stored in environment variables
- ✅ API key never exposed to frontend
- ✅ All API calls go through Netlify functions

### **Rate Limiting**
- ✅ Daily API call limits enforced
- ✅ Caching reduces API usage
- ✅ Error handling for rate limit exceeded

### **Data Validation**
- ✅ Input sanitization for product names
- ✅ UUID validation for item IDs
- ✅ Price validation (must be numeric)

## 📊 **Monitoring & Analytics**

### **Cache Statistics**
- Total cached entries
- Active vs expired cache
- API usage patterns

### **Price History Tracking**
- All price changes recorded
- Source tracking (API vs manual)
- Historical price analysis

## 🚀 **Next Steps**

1. **Deploy the Function**: Push your code to trigger Netlify deployment
2. **Set Environment Variables**: Add your Price Charting API key
3. **Test the Integration**: Use the test endpoints above
4. **Update Frontend**: Integrate the API calls into your Settings page
5. **Monitor Usage**: Check cache status regularly

## 🆘 **Troubleshooting**

### **Common Issues**
1. **"API key not configured"**: Check environment variables in Netlify
2. **"Rate limit exceeded"**: Wait for next day or increase limit
3. **"No valid price found"**: Product might not exist in Price Charting database
4. **Database errors**: Ensure schema was applied correctly

### **Debug Mode**
Add logging to the function to debug issues:
```javascript
console.log('Debug info:', { productName, apiResponse, error });
```

## 📞 **Support**
- **Price Charting API**: Check their documentation for API changes
- **Supabase**: Monitor database logs for any issues
- **Netlify**: Check function logs for deployment issues
