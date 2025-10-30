#!/usr/bin/env node

/**
 * Phase 0 Integration Validation Test
 * Tests the simplified architecture under real-world conditions
 */

const puppeteer = require('puppeteer');
const WebSocket = require('ws');

class Phase0IntegrationTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = {
      serverConnectivity: false,
      webSocketConnection: false,
      simplifiedStoreIntegration: false,
      singleDisplayCreation: false,
      realTimeUpdates: false,
      multiDisplayPerformance: false,
      errorHandling: false
    };
  }

  async initialize() {
    console.log('🚀 Phase 0 Integration Test - Initializing...');
    
    // Launch browser
    this.browser = await puppeteer.launch({
      headless: false, // Set to true for headless testing
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // Enable console logging from page
    this.page.on('console', msg => {
      const text = msg.text();
      if (text.includes('CONNECTION_DEBUG') || 
          text.includes('FLOATING_STORE') || 
          text.includes('🎨') ||
          text.includes('🚨')) {
        console.log('📝 Browser Console:', text);
      }
    });
    
    // Enable request/response monitoring
    this.page.on('request', request => {
      if (request.url().includes('ws://localhost:8080')) {
        console.log('🌐 WebSocket Request:', request.url());
      }
    });
  }

  async testServerConnectivity() {
    console.log('\n📡 Test 1: Server Connectivity...');
    
    try {
      // Test frontend server
      const response = await this.page.goto('http://localhost:5173', { 
        waitUntil: 'networkidle0',
        timeout: 10000 
      });
      
      if (response.status() === 200) {
        console.log('✅ Frontend server accessible');
        
        // Wait for app to load
        await this.page.waitForSelector('#app', { timeout: 5000 });
        console.log('✅ Application loaded successfully');
        
        this.testResults.serverConnectivity = true;
      }
    } catch (error) {
      console.error('❌ Server connectivity failed:', error.message);
    }
  }

  async testWebSocketConnection() {
    console.log('\n🔌 Test 2: WebSocket Connection...');
    
    try {
      // Test backend WebSocket directly
      const ws = new WebSocket('ws://localhost:8080');
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          console.log('✅ Backend WebSocket connection established');
          ws.close();
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      
      // Test WebSocket from browser
      const wsConnected = await this.page.evaluate(() => {
        return new Promise((resolve) => {
          const ws = new WebSocket('ws://localhost:8080');
          
          const timeout = setTimeout(() => {
            ws.close();
            resolve(false);
          }, 3000);
          
          ws.onopen = () => {
            clearTimeout(timeout);
            ws.close();
            resolve(true);
          };
          
          ws.onerror = () => {
            clearTimeout(timeout);
            resolve(false);
          };
        });
      });
      
      if (wsConnected) {
        console.log('✅ Browser WebSocket connection working');
        this.testResults.webSocketConnection = true;
      }
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error.message);
    }
  }

  async testSimplifiedStoreIntegration() {
    console.log('\n🏪 Test 3: Simplified Store Integration...');
    
    try {
      // Check if simplified store is loaded and functional
      const storeState = await this.page.evaluate(() => {
        return new Promise((resolve) => {
          // Wait a bit for store initialization
          setTimeout(() => {
            if (window.floatingStore) {
              resolve({
                storeExists: true,
                displays: window.floatingStore.displays || [],
                panels: window.floatingStore.panels || [],
                icons: window.floatingStore.icons || []
              });
            } else {
              resolve({ storeExists: false });
            }
          }, 1000);
        });
      });
      
      if (storeState.storeExists) {
        console.log('✅ Simplified floating store loaded');
        console.log(`📊 Store state: ${storeState.displays.length} displays, ${storeState.panels.length} panels, ${storeState.icons.length} icons`);
        this.testResults.simplifiedStoreIntegration = true;
      } else {
        console.log('❌ Simplified store not found in window object');
      }
    } catch (error) {
      console.error('❌ Store integration test failed:', error.message);
    }
  }

  async testSingleDisplayCreation() {
    console.log('\n🎨 Test 4: Single Display Creation...');
    
    try {
      // Look for SymbolPalette component
      const symbolPaletteExists = await this.page.waitForSelector('[data-testid="symbol-palette"], .symbol-palette, #symbol-palette', { 
        timeout: 5000 
      }).catch(() => false);
      
      if (symbolPaletteExists) {
        console.log('✅ SymbolPalette component found');
        
        // Try to create a display using keyboard shortcut Ctrl+K
        await this.page.keyboard.down('Control');
        await this.page.keyboard.press('k');
        await this.page.keyboard.up('Control');
        
        // Wait for search input to appear
        await this.page.waitForSelector('input[type="search"], .search-input', { timeout: 3000 });
        
        // Type BTCUSD and select it
        await this.page.type('input[type="search"], .search-input', 'BTCUSD');
        await this.page.keyboard.press('Enter');
        
        // Wait for display to be created
        await this.page.waitForTimeout(2000);
        
        // Check if display was created
        const displayCount = await this.page.evaluate(() => {
          return window.floatingStore?.displays?.length || 0;
        });
        
        if (displayCount > 0) {
          console.log(`✅ Display created successfully (${displayCount} displays total)`);
          this.testResults.singleDisplayCreation = true;
        } else {
          console.log('❌ No displays created after symbol selection');
        }
      } else {
        console.log('❌ SymbolPalette component not found');
      }
    } catch (error) {
      console.error('❌ Single display creation test failed:', error.message);
    }
  }

  async testRealTimeUpdates() {
    console.log('\n🔄 Test 5: Real-time Updates...');
    
    try {
      // Monitor console for real-time data updates
      const realTimeDetected = await this.page.evaluate(() => {
        return new Promise((resolve) => {
          let updateDetected = false;
          const timeout = setTimeout(() => resolve(updateDetected), 10000);
          
          // Monitor console for connection and update messages
          const originalLog = console.log;
          console.log = function(...args) {
            const message = args.join(' ');
            if (message.includes('CONNECTION_DEBUG') && 
                (message.includes('Real-time update') || message.includes('Updating display'))) {
              updateDetected = true;
              clearTimeout(timeout);
              resolve(true);
            }
            originalLog.apply(console, args);
          };
        });
      });
      
      if (realTimeDetected) {
        console.log('✅ Real-time updates detected');
        this.testResults.realTimeUpdates = true;
      } else {
        console.log('⚠️  No real-time updates detected within timeout');
      }
    } catch (error) {
      console.error('❌ Real-time updates test failed:', error.message);
    }
  }

  async testMultiDisplayPerformance() {
    console.log('\n⚡ Test 6: Multi-Display Performance...');
    
    try {
      // Create multiple displays to test performance
      const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'];
      let createdCount = 0;
      
      for (const symbol of symbols) {
        try {
          // Use keyboard shortcut to open symbol palette
          await this.page.keyboard.down('Control');
          await this.page.keyboard.press('k');
          await this.page.keyboard.up('Control');
          
          // Wait for search input
          await this.page.waitForSelector('input[type="search"], .search-input', { timeout: 2000 });
          
          // Type symbol and select
          await this.page.type('input[type="search"], .search-input', symbol);
          await this.page.keyboard.press('Enter');
          
          // Wait for creation
          await this.page.waitForTimeout(1000);
          
          createdCount++;
          console.log(`📈 Created display for ${symbol} (${createdCount}/${symbols.length})`);
        } catch (error) {
          console.log(`⚠️  Failed to create display for ${symbol}:`, error.message);
        }
      }
      
      // Check final display count
      const finalDisplayCount = await this.page.evaluate(() => {
        return window.floatingStore?.displays?.length || 0;
      });
      
      if (finalDisplayCount >= 5) {
        console.log(`✅ Multi-display performance test passed (${finalDisplayCount} displays)`);
        
        // Test performance metrics
        const performanceMetrics = await this.page.evaluate(() => {
          return new Promise((resolve) => {
            setTimeout(() => {
              const displays = window.floatingStore?.displays || [];
              resolve({
                displayCount: displays.length,
                memoryUsage: performance.memory ? {
                  used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                  total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
                } : null
              });
            }, 2000);
          });
        });
        
        if (performanceMetrics.memoryUsage) {
          console.log(`📊 Memory usage: ${performanceMetrics.memoryUsage.used}MB / ${performanceMetrics.memoryUsage.total}MB`);
        }
        
        this.testResults.multiDisplayPerformance = true;
      } else {
        console.log(`❌ Multi-display test failed: only ${finalDisplayCount} displays created`);
      }
    } catch (error) {
      console.error('❌ Multi-display performance test failed:', error.message);
    }
  }

  async testErrorHandling() {
    console.log('\n🛡️  Test 7: Error Handling...');
    
    try {
      // Test error handling by trying to access invalid symbol
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('k');
      await this.page.keyboard.up('Control');
      
      await this.page.waitForSelector('input[type="search"], .search-input', { timeout: 2000 });
      await this.page.type('input[type="search"], .search-input', 'INVALIDSYMBOL123');
      await this.page.keyboard.press('Enter');
      
      // Wait to see if error is handled gracefully
      await this.page.waitForTimeout(3000);
      
      // Check if application is still responsive
      const stillResponsive = await this.page.evaluate(() => {
        return !!window.floatingStore;
      });
      
      if (stillResponsive) {
        console.log('✅ Error handling working - application still responsive');
        this.testResults.errorHandling = true;
      } else {
        console.log('❌ Application became unresponsive after error');
      }
    } catch (error) {
      console.error('❌ Error handling test failed:', error.message);
    }
  }

  async generateReport() {
    console.log('\n📋 PHASE 0 INTEGRATION TEST REPORT');
    console.log('=' .repeat(50));
    
    const passedTests = Object.values(this.testResults).filter(result => result).length;
    const totalTests = Object.keys(this.testResults).length;
    
    for (const [test, result] of Object.entries(this.testResults)) {
      const status = result ? '✅ PASS' : '❌ FAIL';
      const testName = test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      console.log(`${status} ${testName}`);
    }
    
    console.log('=' .repeat(50));
    console.log(`📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED - Phase 0 Integration Validation COMPLETE!');
      console.log('✅ Simplified architecture is ready for production migration');
    } else {
      console.log('⚠️  Some tests failed - Integration validation needs attention');
      console.log('🔧 Address failed tests before proceeding to Phase 3.3');
    }
    
    return {
      passed: passedTests,
      total: totalTests,
      success: passedTests === totalTests,
      details: this.testResults
    };
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async runAllTests() {
    try {
      await this.initialize();
      await this.testServerConnectivity();
      await this.testWebSocketConnection();
      await this.testSimplifiedStoreIntegration();
      await this.testSingleDisplayCreation();
      await this.testRealTimeUpdates();
      await this.testMultiDisplayPerformance();
      await this.testErrorHandling();
      
      const report = await this.generateReport();
      await this.cleanup();
      
      return report;
    } catch (error) {
      console.error('🚨 Test execution failed:', error);
      await this.cleanup();
      throw error;
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const test = new Phase0IntegrationTest();
  test.runAllTests()
    .then(report => {
      process.exit(report.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = Phase0IntegrationTest;
