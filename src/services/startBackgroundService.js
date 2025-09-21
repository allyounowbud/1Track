// Start the background price service
import { backgroundPriceService } from './backgroundPriceService.js';

// Start the background service when the app loads
export function startBackgroundPriceService() {
  console.log('🚀 Starting background price service...');
  
  // Start the service
  backgroundPriceService.start();
  
  // Log status every 5 minutes
  setInterval(() => {
    const status = backgroundPriceService.getStatus();
    console.log('📊 Background service status:', status);
  }, 5 * 60 * 1000);
}

// Export for manual testing
export { backgroundPriceService };
