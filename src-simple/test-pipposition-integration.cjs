const WebSocket = require('ws');

/**
 * Manual test to verify pipPosition integration in WebSocket symbol data package
 *
 * This test:
 * 1. Connects to the WebSocket server at ws://localhost:8080
 * 2. Requests symbol data for EURUSD
 * 3. Captures the symbolDataPackage message
 * 4. Verifies it contains pipPosition, pipSize, pipetteSize fields
 * 5. Logs the complete data structure
 */

class PipPositionTester {
    constructor() {
        this.ws = null;
        this.receivedMessages = [];
        this.testSymbol = 'EURUSD';
        this.serverUrl = 'ws://localhost:8080';
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
                console.log('Raw message:', data.toString());
            }
        });

        this.ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
        });

        this.ws.on('close', (code, reason) => {
            console.log(`🔌 WebSocket closed. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
        });

        // Set timeout for test completion
        setTimeout(() => {
            console.log('⏰ Test timeout reached');
            this.analyzeResults();
            process.exit(0);
        }, 15000); // 15 seconds
    }

    requestSymbolData() {
        console.log(`📊 Requesting symbol data package for: ${this.testSymbol}`);

        const request = {
            type: 'get_symbol_data_package',
            symbol: this.testSymbol,
            adrLookbackDays: 14
        };

        console.log('📤 Sending request:', JSON.stringify(request, null, 2));
        this.ws.send(JSON.stringify(request));
    }

    handleMessage(message) {
        this.receivedMessages.push(message);

        console.log('\n📥 Received message:');
        console.log('Type:', message.type);

        switch (message.type) {
            case 'status':
                console.log('Status:', message.status);
                if (message.availableSymbols) {
                    console.log('Available symbols:', message.availableSymbols.slice(0, 10), '...');
                }
                break;

            case 'ready':
                console.log('✅ Backend ready with', message.availableSymbols?.length || 0, 'symbols');
                break;

            case 'symbolDataPackage':
                console.log('📦 Symbol Data Package received for:', message.symbol);
                this.analyzeSymbolDataPackage(message);
                break;

            case 'tick':
                console.log('📈 Tick received for:', message.symbol, 'Price:', message.bid);
                break;

            case 'error':
                console.error('❌ Server error:', message.message);
                break;

            default:
                console.log('🤔 Unknown message type:', message.type);
        }
    }

    analyzeSymbolDataPackage(data) {
        console.log('\n🔍 ANALYZING SYMBOL DATA PACKAGE');
        console.log('='.repeat(50));

        // Log complete data structure
        console.log('\n📋 Complete data structure:');
        console.log(JSON.stringify(data, null, 2));

        // Check for pipPosition fields
        const pipPositionFields = ['pipPosition', 'pipSize', 'pipetteSize'];
        const presentFields = [];
        const missingFields = [];

        console.log('\n🔍 Checking for pipPosition fields:');

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
            console.log('🔧 The WebSocket server may need to be updated to include these fields.');
        }

        // Additional symbol info
        console.log('\n📈 Additional symbol information:');
        console.log(`- Symbol: ${data.symbol}`);
        console.log(`- Digits: ${data.digits}`);
        console.log(`- ADR: ${data.adr}`);
        console.log(`- Today's Open: ${data.todaysOpen}`);
        console.log(`- Today's High: ${data.todaysHigh}`);
        console.log(`- Today's Low: ${data.todaysLow}`);
        console.log(`- Initial Price: ${data.initialPrice}`);
        console.log(`- Market Profile entries: ${data.initialMarketProfile?.length || 0}`);
    }

    analyzeResults() {
        console.log('\n📊 FINAL TEST RESULTS');
        console.log('='.repeat(50));
        console.log(`Total messages received: ${this.receivedMessages.length}`);

        const symbolDataPackages = this.receivedMessages.filter(m => m.type === 'symbolDataPackage');

        if (symbolDataPackages.length > 0) {
            console.log(`✅ Received ${symbolDataPackages.length} symbol data package(s)`);
            console.log('🎯 Test completed successfully');
        } else {
            console.log('❌ No symbol data packages received');
            console.log('🤔 Possible issues:');
            console.log('  - WebSocket server not running');
            console.log('  - Symbol not available');
            console.log('  - Backend not connected to cTrader');
        }
    }
}

// Run the test
console.log('🚀 Starting pipPosition Integration Test');
console.log('=====================================');

const tester = new PipPositionTester();

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