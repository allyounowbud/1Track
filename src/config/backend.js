// Backend configuration for 1Track v2
// Update these URLs to point to your deployed services

const config = {
  // Your deployed Netlify site URL
  netlifySiteUrl: 'https://your-existing-site.netlify.app',
  
  // Function endpoints
  functions: {
    priceCharting: '/.netlify/functions/price-charting',
    gmailSync: '/.netlify/functions/gmail-sync',
    emailNormalize: '/.netlify/functions/email-normalize',
    // Add other function endpoints as needed
  },
  
  // Get the full URL for a function
  getFunctionUrl: (functionName) => {
    const isDevelopment = import.meta.env.DEV;
    const baseUrl = isDevelopment 
      ? '' // Local development - use relative URLs
      : config.netlifySiteUrl; // Production - use full URL
    
    return `${baseUrl}${config.functions[functionName]}`;
  }
};

export default config;
