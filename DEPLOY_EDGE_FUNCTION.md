# 🚀 Deploy Updated Edge Function

## Quick Steps to Deploy the Fixed Edge Function

### 1. Get Your Supabase Anon Key
1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **anon public** key

### 2. Deploy the Edge Function
1. Go to **Edge Functions** in your Supabase dashboard
2. Click on **price-charting-images** function
3. **Replace ALL the code** with the content from `supabase/functions/price-charting-images/index.ts`
4. Click **Deploy**

### 3. Test the Function
1. Open `test-edge-function.html` in your browser
2. Paste your Supabase anon key in the script (line 45)
3. Test with "Pikachu" or any product name
4. Check the results and image previews

## What Was Fixed

### 🐛 Issues Found:
- **Database column mismatch**: `scraped_at` → `last_scraped`
- **Missing console name handling**: Function now properly handles console names
- **Restrictive scraping patterns**: Added multiple regex patterns for better image detection
- **Poor filtering logic**: Improved filtering to keep product-related images

### ✅ Improvements:
- **Better error handling** with detailed logging
- **Multiple image detection patterns** (img tags, data attributes, background images, etc.)
- **Smarter filtering** that keeps product images while removing UI elements
- **Enhanced debugging** with console logs showing what's happening

## Expected Results

After deployment, you should see:
- ✅ **Real product images** instead of 0 images
- ✅ **Detailed console logs** showing the scraping process
- ✅ **Proper caching** in the database
- ✅ **Better error messages** if something goes wrong

## Troubleshooting

### If Still Getting 0 Images:
1. **Check Edge Function Logs** in Supabase dashboard
2. **Test with simple product names** like "Pikachu" or "Charizard"
3. **Try force refresh** to bypass cache
4. **Check network requests** in browser dev tools

### Common Issues:
- **CORS errors**: Make sure the function is deployed correctly
- **Timeout errors**: PriceCharting might be slow to respond
- **Rate limiting**: Too many requests might get blocked

## Next Steps

Once the function is working:
1. **Test with various products** to ensure it's working consistently
2. **Check the database** to see if images are being cached
3. **Monitor the logs** for any errors or issues
4. **Update the main app** to use the working image service

---

**Need Help?** Check the browser console and Supabase function logs for detailed error messages.

