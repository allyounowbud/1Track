import marketDataService from './marketDataService.js';

// Simple API test service to verify Card Market API connectivity
class ApiTestService {
  constructor() {
    this.testResults = [];
  }

  // Test basic API connectivity
  async testBasicConnectivity() {
    console.log('🧪 Testing Card Market API basic connectivity...');
    
    try {
      const result = await marketDataService.testCardMarketAPI();
      console.log('📊 API Test Results:', result);
      return result;
    } catch (error) {
      console.error('❌ API Test Failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Test simple search
  async testSimpleSearch() {
    console.log('🔍 Testing simple search...');
    
    try {
      const result = await marketDataService.searchCardMarketAll('charizard', 3);
      console.log('📊 Search Test Results:', result);
      return result;
    } catch (error) {
      console.error('❌ Search Test Failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Test with a known Pokemon product
  async testKnownProduct() {
    console.log('🎴 Testing with known Pokemon product...');
    
    try {
      const result = await marketDataService.searchCardMarketAll('evolving skies booster box', 3);
      console.log('📊 Known Product Test Results:', result);
      return result;
    } catch (error) {
      console.error('❌ Known Product Test Failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Running comprehensive API tests...');
    
    const tests = [
      { name: 'Basic Connectivity', test: () => this.testBasicConnectivity() },
      { name: 'Simple Search', test: () => this.testSimpleSearch() },
      { name: 'Known Product', test: () => this.testKnownProduct() }
    ];

    const results = [];
    
    for (const test of tests) {
      console.log(`\n🧪 Running test: ${test.name}`);
      try {
        const result = await test.test();
        results.push({
          name: test.name,
          success: result.success !== false,
          result: result
        });
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({
          name: test.name,
          success: false,
          error: error.message
        });
      }
    }

    console.log('\n📊 Test Summary:');
    results.forEach(test => {
      console.log(`${test.success ? '✅' : '❌'} ${test.name}: ${test.success ? 'PASSED' : 'FAILED'}`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
    });

    return results;
  }
}

// Create and export singleton instance
const apiTestService = new ApiTestService();
export default apiTestService;
