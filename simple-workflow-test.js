#!/usr/bin/env node

/**
 * Simple Primary Trader Workflow Test
 *
 * Basic connectivity and functionality test without external dependencies
 */

import http from 'http';

const TEST_CONFIG = {
  FRONTEND_URL: 'localhost:4173',
  BACKEND_URL: 'localhost:8080',
};

class SimpleWorkflowTester {
  constructor() {
    this.results = {
      frontend: { status: 'pending', details: [] },
      backend: { status: 'pending', details: [] },
      overall: { status: 'pending' }
    };
  }

  async runTest() {
    console.log('🎯 NEUROSENSE FX - SIMPLE WORKFLOW TEST');
    console.log('='.repeat(50));
    console.log(`Frontend: http://${TEST_CONFIG.FRONTEND_URL}`);
    console.log(`Backend:  http://${TEST_CONFIG.BACKEND_URL}`);
    console.log('='.repeat(50));

    try {
      await this.testFrontend();
      await this.testBackend();
      this.generateRecommendations();
      this.generateReport();
    } catch (error) {
      console.error('\n❌ Test execution failed:', error.message);
    }
  }

  async testFrontend() {
    console.log('\n🌐 FRONTEND CONNECTIVITY TEST');
    console.log('─'.repeat(40));

    try {
      const response = await this.makeHttpRequest(`http://${TEST_CONFIG.FRONTEND_URL}/`);

      if (response.statusCode === 200) {
        this.results.frontend.status = 'passed';
        this.results.frontend.details.push(`✅ HTTP ${response.statusCode} - Frontend accessible`);

        // Check content
        const body = response.body;
        if (body.includes('NeuroSense FX')) {
          this.results.frontend.details.push('✅ Application title found');
        }
        if (body.includes('<div id="app">')) {
          this.results.frontend.details.push('✅ React/Svelte app container present');
        }
        if (body.includes('script')) {
          this.results.frontend.details.push('✅ JavaScript modules present');
        }

        // Check for assets
        if (body.includes('/assets/')) {
          this.results.frontend.details.push('✅ Asset references found');
        }

      } else {
        this.results.frontend.status = 'failed';
        this.results.frontend.details.push(`❌ HTTP ${response.statusCode} - Unexpected response`);
      }
    } catch (error) {
      this.results.frontend.status = 'failed';
      this.results.frontend.details.push(`❌ Connection failed: ${error.message}`);
    }

    this.results.frontend.details.forEach(detail => console.log(detail));
  }

  async testBackend() {
    console.log('\n🔌 BACKEND CONNECTIVITY TEST');
    console.log('─'.repeat(40));

    try {
      const response = await this.makeHttpRequest(`http://${TEST_CONFIG.BACKEND_URL}/`);

      if (response.statusCode === 426) {
        this.results.backend.status = 'passed';
        this.results.backend.details.push(`✅ HTTP ${response.statusCode} - WebSocket upgrade required (expected)`);
        this.results.backend.details.push('✅ Backend server responding correctly');
      } else if (response.statusCode >= 200 && response.statusCode < 500) {
        this.results.backend.status = 'warning';
        this.results.backend.details.push(`⚠️  HTTP ${response.statusCode} - Unexpected but responding`);
      } else {
        this.results.backend.status = 'failed';
        this.results.backend.details.push(`❌ HTTP ${response.statusCode} - Backend not responding correctly`);
      }
    } catch (error) {
      this.results.backend.status = 'failed';
      this.results.backend.details.push(`❌ Backend connection failed: ${error.message}`);
    }

    this.results.backend.details.forEach(detail => console.log(detail));
  }

  async makeHttpRequest(url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method: 'GET',
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  generateRecommendations() {
    console.log('\n💡 RECOMMENDATIONS FOR MANUAL TESTING');
    console.log('─'.repeat(50));

    const frontendOk = this.results.frontend.status === 'passed';
    const backendOk = this.results.backend.status === 'passed';

    if (frontendOk && backendOk) {
      console.log('✅ Both services are running correctly');
      console.log('📋 MANUAL WORKFLOW TEST STEPS:');
      console.log('');
      console.log('1. Open browser to: http://localhost:4173');
      console.log('2. Wait for application to load');
      console.log('3. Press Ctrl+K to open symbol palette');
      console.log('4. Type "BTCUSD" and press Enter');
      console.log('5. Verify display creation and canvas rendering');
      console.log('6. Check browser console for expected messages:');
      console.log('   - "Creating display for symbol: BTCUSD"');
      console.log('   - "Successfully subscribed display to data"');
      console.log('   - "Canvas rendered for symbol: BTCUSD"');
      console.log('7. Press Ctrl+Tab to focus the display');
      console.log('8. Look for live price updates (within 5-15 seconds)');
      console.log('9. Try resizing the display to test responsiveness');
      console.log('10. Press Ctrl+Shift+W to close the display');
      console.log('');
      console.log('🔍 EXPECTED CONSOLE OUTPUT:');
      console.log('   Check browser F12 > Console tab for the messages above');
      console.log('   Look for WebSocket connection establishment');
      console.log('   Verify no error messages during the workflow');

    } else if (frontendOk && !backendOk) {
      console.log('⚠️  Frontend OK, but backend issues detected');
      console.log('💡 Check backend with: ./run.sh status');
      console.log('💡 Restart backend with: ./run.sh stop && ./run.sh dev');
    } else if (!frontendOk && backendOk) {
      console.log('⚠️  Backend OK, but frontend issues detected');
      console.log('💡 Frontend server should be running on port 4173');
      console.log('💡 Check Python HTTP server is still running');
    } else {
      console.log('❌ Both services have issues');
      console.log('💡 Run: ./run.sh status to check system state');
      console.log('💡 Restart services with: ./run.sh stop && ./run.sh dev');
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 SIMPLE WORKFLOW TEST REPORT');
    console.log('='.repeat(50));

    const frontendOk = this.results.frontend.status === 'passed';
    const backendOk = this.results.backend.status === 'passed';

    console.log(`\nFrontend: ${this.results.frontend.status.toUpperCase()}`);
    this.results.frontend.details.forEach(detail => console.log(`  ${detail}`));

    console.log(`\nBackend:  ${this.results.backend.status.toUpperCase()}`);
    this.results.backend.details.forEach(detail => console.log(`  ${detail}`));

    if (frontendOk && backendOk) {
      console.log('\n✅ SYSTEM READY FOR MANUAL WORKFLOW TESTING');
      console.log('📝 Follow the manual testing steps above');
      console.log('🎯 Primary Trader Workflow can now be tested manually');
    } else {
      console.log('\n❌ SYSTEM NOT READY FOR WORKFLOW TESTING');
      console.log('🔧 Resolve connectivity issues before manual testing');
    }

    console.log('='.repeat(50));
  }
}

// Run the test
const tester = new SimpleWorkflowTester();
tester.runTest().catch(console.error);