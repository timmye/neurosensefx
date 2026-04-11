/**
 * Test TradingView math expression data series.
 * Creates chart sessions, resolves symbols, requests D1 bars,
 * and verifies that real OHLC candle data arrives.
 *
 * Usage: cd /workspaces/neurosensefx && node scripts/test-tv-expression-series.cjs
 */

// Load env from backend directory (contains TRADINGVIEW_SESSION_ID)
require('/workspaces/neurosensefx/services/tick-backend/node_modules/dotenv').config({ path: '/workspaces/neurosensefx/services/tick-backend/.env' });

const { connect } = require('../services/tick-backend/node_modules/tradingview-ws');

const EXPRESSIONS = [
    'DE02Y/US02Y',
    '1/XAUUSD',
    'FX:EURUSD/FX:GBPUSD',
    'EURUSD',
];

const BARS_REQUESTED = 10;
const PER_EXPRESSION_TIMEOUT_MS = 10000;
const OVERALL_TIMEOUT_MS = 30000;

function formatTimestamp(unixSec) {
    return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

async function testExpression(client, expression) {
    const sessionId = `cs_test_${expression.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    const seriesId = 'sds_1';
    const symbolId = `sds_sym_${sessionId}`;
    let description = null;
    let resolveOk = false;
    let seriesCreatedOk = false;
    let candlesReceived = [];
    let seriesCompleted = false;
    let symbolError = null;

    const eventHandler = (event) => {
        if (event.name === 'symbol_resolved' && event.params) {
            const symName = event.params[1]?.name;
            if (symName === symbolId) {
                description = event.params[1]?.description || 'N/A';
                resolveOk = true;
            }
        }

        if (event.name === 'symbol_error' && event.params) {
            symbolError = event.params.toString();
        }

        if ((event.name === 'timescale_update' || event.name === 'du') && event.params) {
            const chartSession = event.params[0];
            const seriesData = event.params[1];
            if (chartSession === sessionId && seriesData) {
                const candles = seriesData[seriesId]?.s;
                if (candles && candles.length > 0) {
                    seriesCreatedOk = true;
                    for (const c of candles) {
                        candlesReceived.push({
                            time: c.v[0],
                            open: c.v[1],
                            high: c.v[2],
                            low: c.v[3],
                            close: c.v[4],
                            volume: c.v[5],
                        });
                    }
                }
            }
        }

        if (event.name === 'series_completed' && event.params) {
            const chartSession = event.params[0];
            if (chartSession === sessionId) {
                seriesCompleted = true;
            }
        }
    };

    const unsub = client.subscribe(eventHandler);

    try {
        client.send('chart_create_session', [sessionId, '']);
        client.send('resolve_symbol', [sessionId, symbolId, '=' + JSON.stringify({ symbol: expression, adjustment: 'splits' })]);
        client.send('create_series', [sessionId, seriesId, 's0', symbolId, '1D', BARS_REQUESTED, '']);
    } catch (err) {
        unsub();
        return { expression, resolveOk: false, seriesCreatedOk: false, candlesCount: 0, seriesCompleted: false, symbolError: err.message, candles: [] };
    }

    await new Promise((resolve) => setTimeout(resolve, PER_EXPRESSION_TIMEOUT_MS));

    unsub();

    try {
        client.send('delete_chart_session', [sessionId]);
    } catch (_) {
        // best-effort cleanup
    }

    return { expression, resolveOk, description, seriesCreatedOk, candlesCount: candlesReceived.length, seriesCompleted, symbolError, candles: candlesReceived };
}

async function main() {
    console.log('TradingView Expression Series Test');
    console.log(`Overall timeout: ${OVERALL_TIMEOUT_MS / 1000}s | Per-expression timeout: ${PER_EXPRESSION_TIMEOUT_MS / 1000}s | Bars requested: ${BARS_REQUESTED}`);
    console.log('');

    const options = process.env.TRADINGVIEW_SESSION_ID ? { sessionId: process.env.TRADINGVIEW_SESSION_ID } : {};
    const client = await connect(options);
    console.log('Connected to TradingView\n');

    const overallTimer = setTimeout(() => {
        console.error('\nOverall timeout reached, exiting');
        process.exit(1);
    }, OVERALL_TIMEOUT_MS);

    const results = [];

    for (const expr of EXPRESSIONS) {
        console.log(`=== Testing: ${expr} ===`);
        const r = await testExpression(client, expr);

        if (r.resolveOk) {
            console.log(`  Resolve: OK (description: "${r.description}")`);
        } else {
            console.log(`  Resolve: FAIL${r.symbolError ? ` (error: ${r.symbolError})` : ''}`);
        }

        if (r.seriesCreatedOk) {
            console.log(`  Series created: OK`);
        } else {
            console.log(`  Series created: FAIL`);
        }

        console.log(`  Candles received: ${r.candlesCount}/${BARS_REQUESTED}`);
        console.log(`  Series completed: ${r.seriesCompleted ? 'YES' : 'NO'}`);

        if (r.candles.length > 0) {
            const last3 = r.candles.slice(-3);
            for (const c of last3) {
                console.log(`  Candle: ${formatTimestamp(c.time)} O:${c.open} H:${c.high} L:${c.low} C:${c.close}`);
            }
        }

        const passed = r.resolveOk && r.seriesCreatedOk && r.candlesCount > 0;
        console.log(`  Result: ${passed ? 'PASS' : 'FAIL'}`);
        console.log('');

        results.push({ ...r, passed });
    }

    clearTimeout(overallTimer);

    try {
        client.close();
    } catch (_) {}

    // Summary table
    console.log('=== Summary ===');
    console.log('Expression              | Resolve | Series | Candles | Completed | Result');
    console.log('------------------------|---------|--------|---------|-----------|-------');
    for (const r of results) {
        const expr = r.expression.padEnd(24);
        const resolve = r.resolveOk ? 'OK' : 'FAIL';
        const series = r.seriesCreatedOk ? 'OK' : 'FAIL';
        const candles = `${r.candlesCount}/${BARS_REQUESTED}`.padEnd(7);
        const completed = r.seriesCompleted ? 'YES' : 'NO';
        const result = r.passed ? 'PASS' : 'FAIL';
        console.log(`${expr} | ${resolve.padEnd(7)} | ${series.padEnd(6)} | ${candles} | ${completed.padEnd(9)} | ${result}`);
    }

    const allPassed = results.every(r => r.passed);
    console.log(`\nOverall: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'} (${results.filter(r => r.passed).length}/${results.length})`);

    process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
