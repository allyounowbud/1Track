import { useEffect } from 'react';
import { initializeBackgroundMarketData } from './services/backgroundMarketDataService.js';

function App({ children }) {
  useEffect(() => {
    // Initialize background market data loading when the app starts
    initializeBackgroundMarketData();
  }, []);

  return children;
}

export default App;
