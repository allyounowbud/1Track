// API configuration based on your Pro plan
export const API_CONFIG = {
  // Plan details
  plan: 'pro', // 'free', 'pro', 'premium'
  
  // API limits (Pro plan: 3,000 requests/day)
  dailyLimit: 3000, // requests per day
  
  // Update frequency (conservative to stay well under limits)
  priceUpdateInterval: 24, // hours between price updates (once per day)
  checkInterval: 60, // minutes between checks (every hour)
  
  // Cache settings
  cacheTimeout: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  
  // Batch settings (conservative for reliability)
  batchSize: 8, // items per batch
  batchDelay: 1000, // milliseconds between batches (1 second for safety)
  
  // User capacity estimates
  maxUsers: {
    free: 50,
    pro: 1000,
    premium: 5000
  }
};

// Get current plan settings
export function getPlanSettings() {
  return {
    dailyLimit: API_CONFIG.dailyLimit,
    updateInterval: API_CONFIG.priceUpdateInterval,
    maxUsers: API_CONFIG.maxUsers[API_CONFIG.plan],
    cacheTimeout: API_CONFIG.cacheTimeout
  };
}

// Check if we can handle a certain number of users
export function canHandleUsers(userCount) {
  const maxUsers = API_CONFIG.maxUsers[API_CONFIG.plan];
  return userCount <= maxUsers;
}

// Get estimated daily API usage for a given number of users
export function getEstimatedUsage(userCount) {
  const uniqueProducts = 44; // Your current product count
  const updatesPerDay = 24 / API_CONFIG.priceUpdateInterval; // 1 update per day with 24-hour interval
  
  return {
    dailyCalls: uniqueProducts * updatesPerDay,
    percentage: ((uniqueProducts * updatesPerDay) / API_CONFIG.dailyLimit) * 100,
    canHandle: (uniqueProducts * updatesPerDay) <= API_CONFIG.dailyLimit,
    safetyMargin: API_CONFIG.dailyLimit - (uniqueProducts * updatesPerDay)
  };
}
