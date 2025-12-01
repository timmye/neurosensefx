const WebSocket = require('ws');

/**
 * Simplified test to verify pipPosition integration in WebSocket symbol data package
 *
 * This test focuses only on checking for pipPosition fields without printing large data structures
 */

class PipPositionSimpleTester {
    constructor() {
        this.ws = null;
        this.testSymbol = 'EURUSD';
        this.serverUrl = 'ws://localhost:8080';
        this.testComplete = false;
    }

    connect() {
        console.log('🔌 Connecting to WebSocket server at:', this.serverUrl);

        this.ws = new WebSocket(this.serverUrl);

        this.ws.on('open', () => {
            console.log('✅ Connected to WebSocket server');
            this.requestSymbolData();
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(message);
            } catch (error) {
                console.error('❌ Failed to parse message:', error);
            }
        });

        this.ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            this.finishTest();
        });

        this.ws.on('close', () => {
            console.log('🔌 WebSocket closed');
            this.finishTest();
        });

        // Set timeout for test completion
        setTimeout(() => {
            console.log('⏰ Test timeout reached');
            this.finishTest();
        }, 10000); // 10 seconds
    }

    requestSymbolData() {
        console.log(`📊 Requesting symbol data package for: ${this.testSymbol}`);

        const request = {
            type: 'get_symbol_data_package',
            symbol: this.testSymbol,
            adrLookbackDays: 14
        };

        this.ws.send(JSON.stringify(request));
    }

    handleMessage(message) {
        switch (message.type) {
            case 'status':
                console.log('📡 Status:', message.status);
                break;

            case 'ready':
                console.log('✅ Backend ready');
                break;

            case 'symbolDataPackage':
                console.log('📦 Symbol Data Package received for:', message.symbol);
                this.analyzePipPositionFields(message);
                break;

            case 'error':
                console.error('❌ Server error:', message.message);
                this.finishTest();
                break;

            default:
                // Ignore other message types
                break;
        }
    }

    analyzePipPositionFields(data) {
        console.log('\n🔍 CHECKING FOR PIPPOSITION FIELDS');
        console.log('='.repeat(40));

        // Check for pipPosition fields
        const pipPositionFields = ['pipPosition', 'pipSize', 'pipetteSize'];
        const presentFields = [];
        const missingFields = [];

        pipPositionFields.forEach(field => {
            if (data.hasOwnProperty(field)) {
                presentFields.push(field);
                console.log(`✅ ${field}:`, data[field]);
            } else {
                missingFields.push(field);
                console.log(`❌ ${field}: MISSING`);
            }
        });

        // Analysis results
        console.log('\n📊 ANALYSIS RESULTS:');
        console.log(`- Fields present: ${presentFields.length}/${pipPositionFields.length}`);
        console.log(`- Present: [${presentFields.join(', ')}]`);
        console.log(`- Missing: [${missingFields.join(', ')}]`);

        if (missingFields.length === 0) {
            console.log('\n🎉 SUCCESS: All pipPosition fields are present!');
            console.log('💡 The pipPosition integration is working correctly end-to-end.');
        } else {
            console.log('\n⚠️  ISSUE: Some pipPosition fields are missing.');
            console.log('🔧 The WebSocket server needs to be updated to include these fields.');
        }

        // Show basic symbol info
        console.log('\n📈 Basic symbol information:');
        console.log(`- Symbol: ${data.symbol}`);
        console.log(`- Digits: ${data.digits}`);
        console.log(`- ADR: ${data.adr}`);

        this.finishTest();
    }

    finishTest() {
        if (!this.testComplete) {
            this.testComplete = true;
            console.log('\n🏁 Test completed');
            if (this.ws) {
                this.ws.close();
            }
            process.exit(0);
        }
    }
}

// Run the test
console.log('🚀 Starting Simple pipPosition Integration Test');
console.log('===========================================');

const tester = new PipPositionSimpleTester();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Test interrupted by user');
    if (tester.ws) {
        tester.ws.close();
    }
    process.exit(0);
});

// Start the test
tester.connect();