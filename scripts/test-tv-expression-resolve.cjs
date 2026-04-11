#!/usr/bin/env node
/**
 * Test script: checks whether TradingView's resolve_symbol accepts math expressions
 * like "DE02Y/US02Y" or "1/XAUUSD".
 *
 * Usage:
 *   cd /workspaces/neurosensefx && node scripts/test-tv-expression-resolve.cjs
 */

// Load env from backend directory (contains TRADINGVIEW_SESSION_ID)
require('/workspaces/neurosensefx/services/tick-backend/node_modules/dotenv').config({ path: '/workspaces/neurosensefx/services/tick-backend/.env' });

const { connect } = require('/workspaces/neurosensefx/services/tick-backend/node_modules/tradingview-ws');
const crypto = require('crypto');

const EXPRESSIONS = [
    { expr: 'DE02Y/US02Y',           desc: 'Bond spread (native TV format)' },
    { expr: 'FX:EURUSD/FX:GBPUSD',   desc: 'FX cross with prefix' },
    { expr: '1/XAUUSD',              desc: 'Inverse' },
    { expr: 'EURUSD',                desc: 'Simple control' },
    { expr: 'FX:EURUSD',             desc: 'Prefixed control' },
    { expr: 'TVC:US02Y',             desc: '2-year yield via TV data' },
    { expr: 'EUREX:DE02Y',           desc: 'German bond via Eurex' },
    { expr: 'CBOT:US02Y',            desc: 'US bond via CBOT' },
    { expr: 'BITSTAMP:BTCUSD*1000',  desc: 'Crypto with scalar' },
];

const PER_TEST_TIMEOUT_MS = 8000;

function uid() {
    return crypto.randomBytes(6).toString('hex');
}

async function testExpression(client, allEvents, expr, desc) {
    const sessionId = `cs_${uid()}`;
    const symbolId = `sym_${uid()}`;

    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            cleanup();
            resolve({ expr, desc, status: 'TIMEOUT' });
        }, PER_TEST_TIMEOUT_MS);

        // Collect all events for this session for debugging
        const eventLog = [];
        const handler = (event) => {
            eventLog.push(event);
            const name = event.name;
            const params = event.params || [];

            // TradingView sends back symbol_resolved (not resolve_symbol)
            if (name === 'symbol_resolved' || name === 'resolve_symbol') {
                if (params[0] === sessionId && params[1] === symbolId) {
                    clearTimeout(timer);
                    cleanup();
                    const payload = typeof params[2] === 'string' ? params[2] : '';
                    let symbolInfo = null;
                    try {
                        symbolInfo = JSON.parse(payload.replace(/^=/, ''));
                    } catch {
                        symbolInfo = { raw: payload };
                    }
                    resolve({ expr, desc, status: 'RESOLVED', symbolInfo, eventLog });
                }
            } else if (name === 'symbol_error') {
                if (params[0] === sessionId) {
                    clearTimeout(timer);
                    cleanup();
                    resolve({ expr, desc, status: 'ERROR', error: params[2] || params[1] || 'Unknown', eventLog });
                }
            }
        };

        allEvents.push(handler);

        function cleanup() {
            const idx = allEvents.indexOf(handler);
            if (idx !== -1) allEvents.splice(idx, 1);
            try { client.send('delete_chart_session', [sessionId]); } catch { /* ignore */ }
        }

        try {
            client.send('chart_create_session', [sessionId, '']);
            client.send('resolve_symbol', [
                sessionId,
                symbolId,
                '=' + JSON.stringify({ symbol: expr, adjustment: 'splits' }),
            ]);
        } catch (err) {
            clearTimeout(timer);
            cleanup();
            resolve({ expr, desc, status: 'EXCEPTION', error: err.message, eventLog });
        }
    });
}

function printResult(r) {
    const tag = r.status === 'RESOLVED' ? 'PASS' : 'FAIL';
    console.log(`  ${tag.padEnd(6)}  ${r.expr.padEnd(30)}  ${r.desc}`);

    if (r.status === 'RESOLVED' && r.symbolInfo) {
        const info = r.symbolInfo;
        console.log(`          -> ${info.full_name || info.name || '(no name)'}  [${info.exchange || ''} ${info.type || ''}]`);
    } else if (r.status === 'ERROR') {
        console.log(`          -> error: ${typeof r.error === 'string' ? r.error : JSON.stringify(r.error)}`);
    } else if (r.status === 'TIMEOUT') {
        // Log all events received for debugging
        if (r.eventLog && r.eventLog.length > 0) {
            console.log(`          -> no resolve within ${PER_TEST_TIMEOUT_MS}ms. Events seen:`);
            for (const ev of r.eventLog.slice(0, 5)) {
                console.log(`             ${ev.name}: ${JSON.stringify(ev.params || []).substring(0, 120)}`);
            }
        } else {
            console.log(`          -> no response within ${PER_TEST_TIMEOUT_MS}ms (no events at all)`);
        }
    } else if (r.status === 'EXCEPTION') {
        console.log(`          -> exception: ${r.error}`);
    }
}

async function main() {
    console.log('========================================================');
    console.log('  TradingView resolve_symbol Expression Test');
    console.log('========================================================\n');

    const options = process.env.TRADINGVIEW_SESSION_ID
        ? { sessionId: process.env.TRADINGVIEW_SESSION_ID }
        : {};

    console.log(`  Connecting to TradingView${options.sessionId ? ' (authenticated)' : ' (unauthenticated)'}...`);

    let client;
    try {
        client = await connect(options);
        console.log('  Connected.\n');
    } catch (err) {
        console.error(`  Connection failed: ${err.message}`);
        process.exit(1);
    }

    // Single subscriber, dispatch to per-test handlers
    const handlers = [];
    const unsub = client.subscribe((event) => {
        // Debug: log first few events globally
        for (const h of [...handlers]) {
            h(event);
        }
    });

    const results = [];
    for (const { expr, desc } of EXPRESSIONS) {
        const result = await testExpression(client, handlers, expr, desc);
        results.push(result);
        printResult(result);
    }

    unsub();
    try { client.close(); } catch { /* ignore */ }

    // Summary
    console.log('\n========================================================');
    console.log('  Summary');
    console.log('========================================================\n');

    const passCount = results.filter(r => r.status === 'RESOLVED').length;
    const failCount = results.length - passCount;
    console.log(`  Total: ${results.length}  |  PASS: ${passCount}  |  FAIL: ${failCount}\n`);

    for (const r of results) {
        const tag = r.status === 'RESOLVED' ? 'PASS' : 'FAIL';
        console.log(`  ${tag.padEnd(8)}${r.expr.padEnd(32)}${r.desc}`);
    }

    console.log('\n========================================================');
}

main().catch((err) => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
