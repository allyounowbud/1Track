import React, { useState, useEffect } from 'react';
import itemMatchingService from '../services/itemMatchingService.js';
import apiTestService from '../services/apiTestService.js';

const ItemMatchingManager = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState(null);
  const [processingResults, setProcessingResults] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isTestingAPI, setIsTestingAPI] = useState(false);
  const [apiTestResults, setApiTestResults] = useState(null);

  // Load stats on component mount
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const statsData = await itemMatchingService.getMatchingStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleProcessItems = async () => {
    setIsProcessing(true);
    setProcessingResults(null);
    
    try {
      console.log('🚀 Starting item matching process...');
      const results = await itemMatchingService.processAllItems();
      setProcessingResults(results);
      
      // Reload stats after processing
      await loadStats();
      
    } catch (error) {
      console.error('Error processing items:', error);
      setProcessingResults({
        success: false,
        error: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTestAPI = async () => {
    setIsTestingAPI(true);
    setApiTestResults(null);
    
    try {
      console.log('🧪 Starting API tests...');
      
      // First, check environment variables
      const envCheck = {
        name: 'Environment Variables',
        success: true,
        details: {
          rapidApiKey: !!import.meta.env.VITE_RAPIDAPI_KEY,
          priceChartingKey: !!import.meta.env.VITE_PRICECHARTING_API_KEY,
          supabaseUrl: !!import.meta.env.VITE_SUPABASE_URL
        }
      };
      
      console.log('🔧 Environment check:', envCheck);
      
      if (!import.meta.env.VITE_RAPIDAPI_KEY) {
        setApiTestResults([{
          name: 'Environment Variables',
          success: false,
          error: 'VITE_RAPIDAPI_KEY not found in environment variables'
        }]);
        return;
      }
      
      const results = await apiTestService.runAllTests();
      setApiTestResults([envCheck, ...results]);
    } catch (error) {
      console.error('Error testing API:', error);
      setApiTestResults([{
        name: 'API Test',
        success: false,
        error: error.message
      }]);
    } finally {
      setIsTestingAPI(false);
    }
  };

  const formatPrice = (cents) => {
    if (!cents) return 'N/A';
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (!stats) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-3 bg-gray-700 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Item Matching Status</h3>
          <p className="text-sm text-gray-400">Link existing items with Card Market API data</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTestAPI}
            disabled={isTestingAPI}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              isTestingAPI 
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isTestingAPI ? 'Testing...' : 'Test API'}
          </button>
          <button
            onClick={loadStats}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{stats.totalItems}</div>
          <div className="text-sm text-gray-400">Total Items</div>
        </div>
        
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{stats.itemsWithMarketData}</div>
          <div className="text-sm text-gray-400">With Market Data</div>
        </div>
        
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">{stats.itemsWithCardMarketData}</div>
          <div className="text-sm text-gray-400">Card Market API</div>
        </div>
        
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">{stats.coverage}%</div>
          <div className="text-sm text-gray-400">Coverage</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Market Data Coverage</span>
          <span className="text-white">{stats.itemsWithMarketData}/{stats.totalItems}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${stats.coverage}%` }}
          ></div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {stats.totalItems - stats.itemsWithMarketData} items need market data updates
        </div>
        <button
          onClick={handleProcessItems}
          disabled={isProcessing || stats.totalItems === stats.itemsWithMarketData}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            isProcessing || stats.totalItems === stats.itemsWithMarketData
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isProcessing ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing...
            </div>
          ) : (
            'Update Market Data'
          )}
        </button>
      </div>

      {/* API Test Results */}
      {apiTestResults && (
        <div className="bg-gray-900 rounded-lg p-4 space-y-4">
          <h4 className="text-lg font-semibold text-white">API Test Results</h4>
          <div className="space-y-2">
            {apiTestResults.map((test, index) => (
              <div 
                key={index}
                className={`p-3 rounded-lg text-sm ${
                  test.success 
                    ? 'bg-green-900/30 border border-green-700/50' 
                    : 'bg-red-900/30 border border-red-700/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">{test.name}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    test.success 
                      ? 'bg-green-700 text-green-100' 
                      : 'bg-red-700 text-red-100'
                  }`}>
                    {test.success ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
                {test.error && (
                  <div className="text-red-400 mt-1 text-xs">
                    Error: {test.error}
                  </div>
                )}
                {test.result && test.result.error && (
                  <div className="text-red-400 mt-1 text-xs">
                    API Error: {test.result.error}
                  </div>
                )}
                {test.details && (
                  <div className="text-gray-400 mt-1 text-xs">
                    <div>RapidAPI Key: {test.details.rapidApiKey ? '✅ Found' : '❌ Missing'}</div>
                    <div>PriceCharting Key: {test.details.priceChartingKey ? '✅ Found' : '❌ Missing'}</div>
                    <div>Supabase URL: {test.details.supabaseUrl ? '✅ Found' : '❌ Missing'}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing Results */}
      {processingResults && (
        <div className="bg-gray-900 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-white">Processing Results</h4>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          {processingResults.success ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">{processingResults.processed}</div>
                  <div className="text-sm text-gray-400">Total Processed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{processingResults.successful}</div>
                  <div className="text-sm text-gray-400">Successful</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-400">{processingResults.failed}</div>
                  <div className="text-sm text-gray-400">Failed</div>
                </div>
              </div>

              {showDetails && processingResults.results && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {processingResults.results.map((result, index) => (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg text-sm ${
                        result.success 
                          ? 'bg-green-900/30 border border-green-700/50' 
                          : 'bg-red-900/30 border border-red-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">
                          {result.matchedItem?.name || 'Unknown Item'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          result.success 
                            ? 'bg-green-700 text-green-100' 
                            : 'bg-red-700 text-red-100'
                        }`}>
                          {result.success ? 'Success' : 'Failed'}
                        </span>
                      </div>
                      {result.success && result.marketValue && (
                        <div className="text-gray-400 mt-1">
                          Market Value: {formatPrice(result.marketValue * 100)}
                        </div>
                      )}
                      {!result.success && result.reason && (
                        <div className="text-red-400 mt-1">
                          Reason: {result.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-red-400">
              Error: {processingResults.error}
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-blue-400 mt-0.5">ℹ️</div>
          <div className="text-sm text-blue-100">
            <p className="font-medium mb-1">How Item Matching Works:</p>
            <ul className="space-y-1 text-blue-200">
              <li>• Searches Card Market API for each item name from your orders</li>
              <li>• Finds the best match using exact and partial name matching</li>
              <li>• Updates market prices, images, and set information</li>
              <li>• Processes items in small batches to respect API limits</li>
              <li>• Only updates items that haven't been updated in the last 24 hours</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemMatchingManager;
