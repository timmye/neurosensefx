// Direct WebSocket Server Test
// Tests the non-FX symbol fix by directly connecting to the WebSocket server

const WebSocket = require('ws');

// Test symbols - mix of FX and non-FX
const testSymbols = [
    'EURUSD',  // FX symbol - should work
    'XAUUSD',  // Gold - should work after fix
    'BTCUSD',  // Bitcoin - should work after fix
    'XAGUSD',  // Silver - should work after fix
    'USDJPY'   // FX symbol - should work
];

function testSymbol(symbol) {
    return new Promise((resolve) => {
        console.log(`\n🧪 Testing ${symbol}...`);

        const ws = new WebSocket('ws://localhost:8080');
        let receivedData = false;
        let receivedError = false;

        const timeout = setTimeout(() => {
            console.log(`⏰ ${symbol}: Timeout (5s) - No response received`);
            ws.close();
            resolve({ symbol, success: false, error: 'Timeout' });
        }, 5000);

        ws.on('open', () => {
            console.log(`🔌 ${symbol}: Connected to WebSocket server`);

            // Send subscription request
            ws.send(JSON.stringify({
                type: 'subscribe',
                symbol: symbol,
                adrLookbackDays: 14
            }));

            console.log(`📤 ${symbol}: Sent subscription request`);
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);

                if (message.type === 'symbolDataPackage') {
                    receivedData = true;
                    console.log(`✅ ${symbol}: SUCCESS - Received data package`);
                    console.log(`   Symbol: ${message.symbol}`);
                    console.log(`   Data keys: ${Object.keys(message).join(', ')}`);

                    if (message.todayHigh !== undefined && message.todayLow !== undefined) {
                        console.log(`   OHLC data: Complete (High: ${message.todayHigh}, Low: ${message.todayLow})`);
                    } else {
                        console.log(`   OHLC data: Incomplete (missing todayHigh/todayLow)`);
                    }

                    clearTimeout(timeout);
                    ws.close();
                    resolve({ symbol, success: true, message: 'Data package received' });

                } else if (message.type === 'error') {
                    receivedError = true;
                    console.log(`❌ ${symbol}: ERROR - ${message.message}`);
                    clearTimeout(timeout);
                    ws.close();
                    resolve({ symbol, success: false, error: message.message });
                } else {
                    console.log(`📡 ${symbol}: Received other message type: ${message.type}`);
                }
            } catch (error) {
                console.log(`❌ ${symbol}: Failed to parse message: ${error.message}`);
            }
        });

        ws.on('error', (error) => {
            console.log(`❌ ${symbol}: WebSocket error - ${error.message}`);
            clearTimeout(timeout);
            resolve({ symbol, success: false, error: `WebSocket error: ${error.message}` });
        });

        ws.on('close', () => {
            if (!receivedData && !receivedError) {
                console.log(`🔌 ${symbol}: Connection closed without response`);
            }
            clearTimeout(timeout);
        });
    });
}

async function runTests() {
    console.log('🚀 Starting WebSocket Server Symbol Validation Test');
    console.log('Testing the fix for non-FX symbol subscription...');
    console.log('Expected behavior: All symbols should receive data packages (no "Invalid symbol" errors)');

    const results = [];

    // Test each symbol
    for (const symbol of testSymbols) {
        const result = await testSymbol(symbol);
        results.push(result);

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Analyze results
    console.log('\n=== Test Results Summary ===');
    console.log(`📊 Total symbols tested: ${results.length}`);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Successful subscriptions: ${successful.length}`);
    console.log(`❌ Failed subscriptions: ${failed.length}`);

    console.log('\n📋 Detailed Results:');
    results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`  ${status} ${result.symbol}: ${result.success ? 'Success' : result.error}`);
    });

    // Determine if fix is working
    const nonFxSymbols = testSymbols.filter(s => !s.endsWith('USD') || ['XAUUSD', 'BTCUSD', 'XAGUSD'].includes(s));
    const nonFxResults = results.filter(r => nonFxSymbols.includes(r.symbol));
    const nonFxSuccess = nonFxResults.filter(r => r.success).length;

    console.log('\n🎯 Non-FX Symbol Analysis:');
    console.log(`   Non-FX symbols tested: ${nonFxSymbols.length}`);
    console.log(`   Non-FX symbols working: ${nonFxSuccess}`);

    if (nonFxSuccess === nonFxSymbols.length) {
        console.log('🎉 FIX CONFIRMED: All non-FX symbols are now working!');
    } else if (nonFxSuccess > 0) {
        console.log(`⚠️ PARTIAL FIX: ${nonFxSuccess}/${nonFxSymbols.length} non-FX symbols working`);
    } else {
        console.log('❌ FIX NOT WORKING: No non-FX symbols are working');
    }

    // Check if FX symbols still work
    const fxSymbols = ['EURUSD', 'USDJPY'];
    const fxResults = results.filter(r => fxSymbols.includes(r.symbol));
    const fxSuccess = fxResults.filter(r => r.success).length;

    console.log('\n📈 FX Symbol Compatibility:');
    console.log(`   FX symbols tested: ${fxSymbols.length}`);
    console.log(`   FX symbols working: ${fxSuccess}`);

    if (fxSuccess === fxSymbols.length) {
        console.log('✅ COMPATIBILITY CONFIRMED: All FX symbols still work');
    } else {
        console.log('⚠️ REGRESSION: Some FX symbols stopped working');
    }
}

// Run the tests
runTests().catch(error => {
    console.error('❌ Test execution failed:', error);
});