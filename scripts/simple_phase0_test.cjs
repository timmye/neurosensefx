#!/usr/bin/env node

/**
 * Simple Phase 0 Integration Validation Test
 * Tests WebSocket connectivity and simplified architecture without browser automation
 */

const WebSocket = require('ws');
const http = require('http');

class SimplePhase0Test {
  constructor() {
    this.testResults = {
      serverConnectivity: false,
      webSocketConnection: false,
      realTimeDataFlow: false,
      backendStability: false
    };
  }

  async testServerConnectivity() {
    console.log('📡 Test 1: Server Connectivity...');
    
    try {
      // Test frontend server
      const frontendResponse = await this.makeRequest('http://localhost:5173');
      if (frontendResponse && frontendResponse.includes('<!DOCTYPE html>')) {
        console.log('✅ Frontend server (port 5173) accessible');
        this.testResults.serverConnectivity = true;
      } else {
        console.log('❌ Frontend server not responding correctly');
      }
    } catch (error) {
      console.error('❌ Frontend server connectivity failed:', error.message);
    }
  }

  makeRequest(url) {
    return new Promise((resolve, reject) => {
      const request = http.get(url, (response) => {
        let data = '';
        response.on('data', (chunk) => data += chunk);
        response.on('end', () => resolve(data));
      });
      
      request.on('error', reject);
      request.setTimeout(5000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  async testWebSocketConnection() {
    console.log('\n🔌 Test 2: WebSocket Connection...');
    
    try {
      const ws = new WebSocket('ws://localhost:8080');
      
      const connectionResult = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, 5000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          console.log('✅ Backend WebSocket connection established');
          resolve(true);
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      
      if (connectionResult) {
        this.testResults.webSocketConnection = true;
      }
      
      ws.close();
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error.message);
    }
  }

  async testRealTimeDataFlow() {
    console.log('\n🔄 Test 3: Real-time Data Flow...');
    
    try {
      const ws = new WebSocket('ws://localhost:8080');
      let dataReceived = false;
      let messageCount = 0;
      
      const dataFlowResult = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          if (messageCount > 0) {
            resolve(true);
          } else {
            reject(new Error('No data received within timeout'));
          }
        }, 10000); // 10 second timeout
        
        ws.on('open', () => {
          console.log('📡 WebSocket connected, subscribing to EURUSD...');
          // Subscribe to EURUSD to get real-time data
          ws.send(JSON.stringify({
            type: 'subscribe',
            symbol: 'EURUSD'
          }));
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            messageCount++;
            
            if (message.type === 'tick' || message.symbol) {
              dataReceived = true;
              console.log(`📈 Real-time data received: ${message.symbol || 'Unknown'} - ${message.bid || 'N/A'}/${message.ask || 'N/A'}`);
              
              if (messageCount >= 3) { // Receive a few messages to confirm flow
                clearTimeout(timeout);
                resolve(true);
              }
            }
          } catch (error) {
            // Ignore parsing errors, might be binary data
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      
      if (dataFlowResult) {
        console.log(`✅ Real-time data flow confirmed (${messageCount} messages received)`);
        this.testResults.realTimeDataFlow = true;
      }
      
      ws.close();
    } catch (error) {
      console.error('❌ Real-time data flow test failed:', error.message);
    }
  }

  async testBackendStability() {
    console.log('\n🛡️  Test 4: Backend Stability...');
    
    try {
      // Test multiple connections to check stability
      const connections = [];
      const connectionPromises = [];
      
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket('ws://localhost:8080');
        connections.push(ws);
        
        const promise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error(`Connection ${i} timeout`));
          }, 3000);
          
          ws.on('open', () => {
            clearTimeout(timeout);
            ws.send(JSON.stringify({
              type: 'subscribe',
              symbol: i === 0 ? 'EURUSD' : i === 1 ? 'GBPUSD' : 'USDJPY'
            }));
            
            // Wait a bit then close
            setTimeout(() => {
              ws.close();
              resolve(true);
            }, 1000);
          });
          
          ws.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
        
        connectionPromises.push(promise);
      }
      
      const results = await Promise.allSettled(connectionPromises);
      const successfulConnections = results.filter(r => r.status === 'fulfilled').length;
      
      if (successfulConnections >= 2) { // At least 2 out of 3 should work
        console.log(`✅ Backend stability confirmed (${successfulConnections}/3 connections successful)`);
        this.testResults.backendStability = true;
      } else {
        console.log(`❌ Backend stability issue: only ${successfulConnections}/3 connections successful`);
      }
    } catch (error) {
      console.error('❌ Backend stability test failed:', error.message);
    }
  }

  generateReport() {
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
      console.log('🎉 ALL CORE TESTS PASSED - Infrastructure Ready!');
      console.log('✅ Backend WebSocket server working correctly');
      console.log('✅ Real-time data flow confirmed');
      console.log('✅ Ready for browser-based integration testing');
    } else {
      console.log('⚠️  Some tests failed - Infrastructure needs attention');
      console.log('🔧 Address failed tests before proceeding');
    }
    
    return {
      passed: passedTests,
      total: totalTests,
      success: passedTests === totalTests,
      details: this.testResults
    };
  }

  async runAllTests() {
    console.log('🚀 Simple Phase 0 Integration Test - Starting...');
    
    try {
      await this.testServerConnectivity();
      await this.testWebSocketConnection();
      await this.testRealTimeDataFlow();
      await this.testBackendStability();
      
      const report = this.generateReport();
      return report;
    } catch (error) {
      console.error('🚨 Test execution failed:', error);
      throw error;
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const test = new SimplePhase0Test();
  test.runAllTests()
    .then(report => {
      process.exit(report.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = SimplePhase0Test;
