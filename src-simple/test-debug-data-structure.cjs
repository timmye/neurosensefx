// Test OHLC Data Structure for Non-FX Symbols
// Detailed test to verify the actual data structure received for dayRangeMeter

const WebSocket = require('ws');

function testSymbolOHLC(symbol) {
    return new Promise((resolve) => {
        console.log(`\n🧪 Testing OHLC data structure for ${symbol}...`);

        const ws = new WebSocket('ws://localhost:8080');

        ws.on('open', () => {
            console.log(`🔌 Connected to WebSocket server`);

            // Send subscription request
            ws.send(JSON.stringify({
                type: 'subscribe',
                symbol: symbol,
                adrLookbackDays: 14
            }));

            console.log(`📤 Sent subscription request`);
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);

                if (message.type === 'symbolDataPackage') {
                    console.log(`✅ Received data package for ${symbol}`);
                    console.log('\n📊 Complete Data Structure:');
                    Object.keys(message).forEach(key => {
                        console.log(`   ${key}: ${message[key]}`);
                    });

                    // Check OHLC data specifically
                    console.log('\n🎯 OHLC Data Analysis:');
                    console.log(`   todaysOpen: ${message.todaysOpen}`);
                    console.log(`   todaysHigh: ${message.todaysHigh}`);
                    console.log(`   todaysLow: ${message.todaysLow}`);
                    console.log(`   initialPrice: ${message.initialPrice}`);

                    // Check if OHLC data is complete and valid
                    const hasOpen = message.todaysOpen !== undefined && message.todaysOpen !== null;
                    const hasHigh = message.todaysHigh !== undefined && message.todaysHigh !== null;
                    const hasLow = message.todaysLow !== undefined && message.todaysLow !== null;
                    const hasInitial = message.initialPrice !== undefined && message.initialPrice !== null;

                    console.log('\n✅ Data Completeness Check:');
                    console.log(`   ✅ Open data: ${hasOpen ? 'Present' : 'Missing'}`);
                    console.log(`   ✅ High data: ${hasHigh ? 'Present' : 'Missing'}`);
                    console.log(`   ✅ Low data: ${hasLow ? 'Present' : 'Missing'}`);
                    console.log(`   ✅ Current price: ${hasInitial ? 'Present' : 'Missing'}`);

                    if (hasOpen && hasHigh && hasLow && hasInitial) {
                        console.log('\n🎉 COMPLETE OHLC DATA: All required price data available for dayRangeMeter');
                    } else {
                        console.log('\n⚠️ INCOMPLETE OHLC DATA: Some price data missing');
                    }

                    // Check price consistency
                    if (hasHigh && hasLow) {
                        const priceRange = message.todaysHigh - message.todaysLow;
                        console.log(`   📏 Daily range: ${priceRange.toFixed(5)}`);
                    }

                    ws.close();
                    resolve({
                        symbol,
                        success: true,
                        hasCompleteOHLC: hasOpen && hasHigh && hasLow && hasInitial,
                        data: message
                    });
                }
            } catch (error) {
                console.log(`❌ Failed to parse message: ${error.message}`);
                resolve({ symbol, success: false, error: error.message });
            }
        });

        ws.on('error', (error) => {
            console.log(`❌ WebSocket error: ${error.message}`);
            resolve({ symbol, success: false, error: error.message });
        });

        setTimeout(() => {
            console.log(`⏰ Timeout - closing connection`);
            ws.close();
            resolve({ symbol, success: false, error: 'Timeout' });
        }, 5000);
    });
}

async function testOHLCDataStructure() {
    console.log('🔍 Testing OHLC Data Structure for Non-FX Symbols');
    console.log('This test verifies the actual field names and data completeness...');

    const symbols = ['XAUUSD', 'BTCUSD', 'XAGUSD', 'EURUSD']; // Mix of non-FX and FX
    const results = [];

    for (const symbol of symbols) {
        const result = await testSymbolOHLC(symbol);
        results.push(result);

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n=== OHLC Data Structure Analysis ===');
    console.log(`📊 Total symbols tested: ${results.length}`);

    const completeOHLC = results.filter(r => r.hasCompleteOHLC);
    console.log(`✅ Symbols with complete OHLC data: ${completeOHLC.length}`);

    console.log('\n📋 Symbol-by-Symbol Results:');
    results.forEach(result => {
        const status = result.success && result.hasCompleteOHLC ? '✅' : '❌';
        const ohlcStatus = result.hasCompleteOHLC ? 'Complete' : 'Incomplete';
        console.log(`  ${status} ${result.symbol}: OHLC data ${ohlcStatus}`);
    });

    // Check if the fix resolves the dayRangeMeter issue
    const nonFxResults = results.filter(r => ['XAUUSD', 'BTCUSD', 'XAGUSD'].includes(r.symbol));
    const nonFxComplete = nonFxResults.filter(r => r.hasCompleteOHLC).length;

    console.log('\n🎯 Non-FX Symbol Impact on dayRangeMeter:');
    console.log(`   Non-FX symbols with complete OHLC: ${nonFxComplete}/${nonFxResults.length}`);

    if (nonFxComplete === nonFxResults.length) {
        console.log('🎉 DAYRANGE FIX CONFIRMED: Non-FX symbols now have complete OHLC data for dayRangeMeter visualization');
        console.log('   The dayRangeMeter should now properly display Open/High/Low/Current price markers for all symbols');
    } else {
        console.log('⚠️ DAYRANGE ISSUE PERSISTS: Some non-FX symbols still have incomplete OHLC data');
    }

    console.log('\n📝 Field Name Analysis:');
    console.log('   Expected fields: todaysOpen, todaysHigh, todaysLow, initialPrice');
    console.log('   These field names should match what dayRangeMeter expects in the displayDataProcessor');
}

// Run the test
testOHLCDataStructure().catch(error => {
    console.error('❌ Test execution failed:', error);
});