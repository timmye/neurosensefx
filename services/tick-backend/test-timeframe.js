// Test script to verify TradingView timeframe capabilities for FX symbols
const { connect } = require('tradingview-ws');

async function testTimeframe(symbol, timeframe) {
    console.log(`\n========================================`);
    console.log(`Testing ${symbol} with timeframe: ${timeframe}`);
    console.log(`========================================`);

    return new Promise((resolve) => {
        let candlesReceived = 0;
        let symbolError = false;
        let seriesCompleted = false;
        let messageReceived = false;

        const timeout = setTimeout(() => {
            if (!messageReceived) {
                console.log(`TIMEOUT: No messages received after 15 seconds`);
                resolve({ success: false, reason: 'timeout', count: 0 });
            }
        }, 15000);

        connect().then((connection) => {
            const chartSession = `cs_test_${Date.now()}`;
            const amount = 10;

            const unsubscribe = connection.subscribe((event) => {
                messageReceived = true;
                console.log(`   Event: ${event.name}`);

                if (event.name === 'timescale_update') {
                    const candles = event.params[1]['sds_1']['s'];
                    candlesReceived = candles.length;
                    console.log(`   Received ${candles.length} candles`);
                }

                if (event.name === 'series_completed') {
                    seriesCompleted = true;
                    clearTimeout(timeout);
                    unsubscribe();
                    connection.close();
                    resolve({ success: true, count: candlesReceived });
                }

                if (event.name === 'symbol_error') {
                    symbolError = true;
                    clearTimeout(timeout);
                    unsubscribe();
                    connection.close();
                    resolve({ success: false, reason: 'symbol_error', error: event.params });
                }
            });

            // Create chart session
            connection.send('chart_create_session', [chartSession, '']);
            connection.send('resolve_symbol', [
                chartSession,
                'sds_sym',
                '=' + JSON.stringify({ symbol, adjustment: 'splits' })
            ]);
            connection.send('create_series', [
                chartSession,
                'sds_1',
                's0',
                'sds_sym',
                String(timeframe),
                amount,
                ''
            ]);

        }).catch((error) => {
            console.log(`Connection error: ${error.message}`);
            resolve({ success: false, reason: 'connection_error', error: error.message });
        });
    });
}

async function runTests() {
    console.log('TradingView FX Timeframe Test');
    console.log('==============================');

    const testCases = [
        // FX symbol with different timeframes
        { symbol: 'FX:EURUSD', timeframe: '1' },      // 1 minute as string
        { symbol: 'FX:EURUSD', timeframe: 1 },        // 1 minute as number
        { symbol: 'FX:EURUSD', timeframe: '1M' },     // 1 month (or minute?)
        { symbol: 'FX:EURUSD', timeframe: 5 },        // 5 minutes
        { symbol: 'FX:EURUSD', timeframe: 15 },       // 15 minutes
        { symbol: 'FX:EURUSD', timeframe: 60 },       // 1 hour
        { symbol: 'FX:EURUSD', timeframe: '1D' },     // 1 day
        { symbol: 'FX:EURUSD', timeframe: '1W' },     // 1 week
        { symbol: 'FX:GBPUSD', timeframe: 1 },        // Different FX pair, 1 min
        { symbol: 'FX:JPYUSD', timeframe: 1 },        // JPY pair, 1 min
        // Non-FX for comparison
        { symbol: 'NASDAQ:AAPL', timeframe: 1 },      // Stock, 1 min
    ];

    const results = [];

    for (const testCase of testCases) {
        const result = await testTimeframe(testCase.symbol, testCase.timeframe);
        results.push({ ...testCase, result });
        // Small delay between tests
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n\n========================================');
    console.log('FINAL RESULTS');
    console.log('========================================\n');

    results.forEach(r => {
        const status = r.result.success ? 'SUCCESS' : 'FAILED';
        console.log(`${r.symbol.padEnd(15)} timeframe: ${String(r.timeframe).padEnd(5)} => ${status} ${r.result.success ? `(${r.result.count} candles)` : `(${r.result.reason})`}`);
    });

    // Summary for 1-minute FX
    console.log('\n\n1-MINUTE FX SUMMARY:');
    const oneMinFx = results.filter(r => String(r.timeframe) === '1' || r.timeframe === 1);
    oneMinFx.forEach(r => {
        if (r.symbol.startsWith('FX:')) {
            const status = r.result.success ? 'WORKS' : 'FAILS';
            console.log(`  ${r.symbol}: ${status}`);
        }
    });
}

runTests().then(() => {
    console.log('\nTest complete.');
    process.exit(0);
}).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
