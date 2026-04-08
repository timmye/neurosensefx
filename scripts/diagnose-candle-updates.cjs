#!/usr/bin/env node
/**
 * Diagnostic: monitors candleUpdate messages from the live backend to determine
 * which timeframes actually receive real-time bar data from cTrader.
 *
 * Unlike test-ctrader-subscriptions.cjs (which tests one period at a time with
 * short listen windows), this subscribes to ALL periods simultaneously and
 * monitors for a longer duration, logging every message with timing.
 *
 * Usage:
 *   node scripts/diagnose-candle-updates.cjs           # 60s default
 *   node scripts/diagnose-candle-updates.cjs 120       # custom duration
 *
 * Requires the backend to be running on localhost:8080 with PostgreSQL and Redis.
 */

const http = require('http');
const WebSocket = require('/workspaces/neurosensefx/node_modules/ws');

const HOST = 'localhost';
const PORT = 8080;
const BASE_URL = `http://${HOST}:${PORT}`;
const WS_URL = `ws://${HOST}:${PORT}`;
const SESSION_COOKIE_NAME = 'neurosense_session';
const SYMBOL = 'AUDUSD';
const LISTEN_MS = parseInt(process.argv[2], 10) || 60_000;

// Test all available periods
const PERIODS = [
    { resolution: '1m',  period: 'M1'  },
    { resolution: '5m',  period: 'M5'  },
    { resolution: '15m', period: 'M15' },
    { resolution: '30m', period: 'M30' },
    { resolution: '1h',  period: 'H1'  },
    { resolution: '4h',  period: 'H4'  },
    { resolution: '12h', period: 'H12' },
    { resolution: 'D',   period: 'D1'  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomEmail() {
    const id = Math.random().toString(36).slice(2, 10);
    return `diag-${id}@neurosensefx.test`;
}

function randomPassword() {
    return 'Test' + Math.random().toString(36).slice(2, 14) + '!Xx';
}

function postJson(path, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const opts = {
            hostname: HOST, port: PORT, path, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        };
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(new Error('HTTP request timed out')); });
        req.write(payload);
        req.end();
    });
}

function extractSessionCookie(setCookieHeaders) {
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const h of headers) {
        const match = h.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
        if (match) return match[1];
    }
    return null;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function ts() {
    return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
    console.log('=== candleUpdate Flow Diagnostic ===');
    console.log(`Symbol: ${SYMBOL}  |  Listen duration: ${LISTEN_MS / 1000}s  |  Periods: ${PERIODS.length}\n`);

    // Step 1 -- Auth
    const email = randomEmail();
    const password = randomPassword();
    console.log(`[${ts()}] Registering user: ${email}`);
    let regRes;
    try {
        regRes = await postJson('/api/register', { email, password });
    } catch (err) {
        console.error('FATAL: Cannot reach backend. Is it running on port 8080?');
        process.exit(1);
    }
    if (regRes.statusCode !== 201) {
        console.error(`FATAL: Registration failed (HTTP ${regRes.statusCode}): ${regRes.body}`);
        process.exit(1);
    }

    const sessionToken = extractSessionCookie(regRes.headers['set-cookie']);
    if (!sessionToken) {
        console.error('FATAL: No session cookie in response.');
        process.exit(1);
    }

    // Step 2 -- Connect WebSocket
    console.log(`[${ts()}] Connecting WebSocket...`);
    const ws = new WebSocket(WS_URL, {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}` },
    });

    const wsOpen = new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
    });
    await wsOpen;
    console.log(`[${ts()}] WebSocket connected.\n`);

    // Step 3 -- Track all messages
    const stats = {};
    for (const p of PERIODS) {
        stats[p.period] = {
            resolution: p.resolution,
            subResponse: null,
            updates: [],       // { elapsed, timeframe, isBarClose, bar }
            tickCount: 0,
        };
    }
    let totalTicks = 0;
    let otherMessages = [];
    const startTime = Date.now();

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (msg.type === 'candleSubscription') {
            // Match by resolution
            for (const p of PERIODS) {
                if (p.resolution === msg.resolution) {
                    stats[p.period].subResponse = msg;
                    break;
                }
            }
        } else if (msg.type === 'candleUpdate') {
            const tf = msg.timeframe || '?';
            if (stats[tf]) {
                const entry = { elapsed, timeframe: tf, isBarClose: msg.isBarClose, bar: msg.bar };
                stats[tf].updates.push(entry);
                console.log(
                    `  [${elapsed}s] candleUpdate  tf=${tf}  close=${msg.bar?.close}  ts=${msg.bar?.timestamp}  isBarClose=${msg.isBarClose}`
                );
            } else {
                console.log(`  [${elapsed}s] candleUpdate  tf=${tf}  (UNEXPECTED period)`);
                otherMessages.push({ elapsed, msg });
            }
        } else if (msg.type === 'spotTick' || msg.type === 'tick') {
            totalTicks++;
            // Only log first 3 and then every 10th to reduce noise
            if (totalTicks <= 3 || totalTicks % 10 === 0) {
                console.log(`  [${elapsed}s] ${msg.type}  ${SYMBOL} bid=${msg.bid ?? msg.current}  (total ticks: ${totalTicks})`);
            }
        } else if (msg.type === 'candleHistory') {
            console.log(`  [${elapsed}s] candleHistory  tf=${msg.resolution}  bars=${msg.bars?.length}`);
        } else if (msg.type === 'error') {
            console.log(`  [${elapsed}s] ERROR  ${msg.message}`);
            otherMessages.push({ elapsed, msg });
        } else if (msg.type !== 'ready' && msg.type !== 'status') {
            // Track unexpected message types
            if (!otherMessages.some(m => m.msg.type === msg.type)) {
                console.log(`  [${elapsed}s] OTHER  type=${msg.type}`);
                otherMessages.push({ elapsed, msg });
            }
        }
    });

    // Step 4 -- Subscribe to all periods simultaneously
    console.log(`[${ts()}] Subscribing to all ${PERIODS.length} periods...\n`);
    for (const p of PERIODS) {
        ws.send(JSON.stringify({ type: 'subscribeCandles', symbol: SYMBOL, resolution: p.resolution }));
    }

    // Step 5 -- Wait
    console.log(`[${ts()}] Listening for ${LISTEN_MS / 1000}s...\n`);
    await sleep(LISTEN_MS);

    // Step 6 -- Cleanup
    console.log(`\n[${ts()}] Unsubscribing and disconnecting...`);
    for (const p of PERIODS) {
        ws.send(JSON.stringify({ type: 'unsubscribeCandles', symbol: SYMBOL, resolution: p.resolution }));
    }
    ws.close();

    // Step 7 -- Summary
    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n=== RESULTS (${totalElapsed}s) ===\n`);

    console.log('Period | Res  | Subscribed | Updates | BarCloses | First Update (s) | Update Rate (/min)');
    console.log('-------|------|------------|---------|-----------|-------------------|------------------');

    for (const p of PERIODS) {
        const s = stats[p.period];
        const subOk = s.subResponse?.status === 'subscribed' ? 'YES' : 'NO';
        const updateCount = s.updates.length;
        const barCloses = s.updates.filter(u => u.isBarClose).length;
        const firstUpdate = s.updates.length > 0 ? s.updates[0].elapsed : '-';
        const rate = s.updates.length > 0 && parseFloat(totalElapsed) > 0
            ? ((s.updates.length / parseFloat(totalElapsed)) * 60).toFixed(1)
            : '-';

        console.log(
            `${p.period.padEnd(6)} | ${p.resolution.padEnd(4)} | ${subOk.padEnd(10)} | ${String(updateCount).padStart(7)} | ${String(barCloses).padStart(9)} | ${String(firstUpdate).padEnd(17)} | ${String(rate).padStart(16)}`
        );
    }

    console.log(`\nTotal ticks received: ${totalTicks} (${(totalTicks / parseFloat(totalElapsed) * 60).toFixed(0)}/min)`);

    // Analysis
    console.log('\n--- Analysis ---');

    const subscribedOk = PERIODS.filter(p => stats[p.period].subResponse?.status === 'subscribed');
    const subFailed = PERIODS.filter(p => stats[p.period].subResponse?.status !== 'subscribed');
    const receivedData = PERIODS.filter(p => stats[p.period].updates.length > 0);
    const noData = PERIODS.filter(p => stats[p.period].subResponse?.status === 'subscribed' && stats[p.period].updates.length === 0);

    console.log(`Subscriptions accepted: ${subscribedOk.map(p => p.period).join(', ') || 'NONE'}`);
    console.log(`Subscriptions failed:   ${subFailed.map(p => p.period).join(', ') || 'NONE'}`);
    console.log(`Received candleUpdate:  ${receivedData.map(p => p.period).join(', ') || 'NONE'}`);
    console.log(`Subscribed but no data: ${noData.map(p => p.period).join(', ') || 'NONE'}`);

    // Timestamp analysis for periods that received data
    for (const p of receivedData) {
        const s = stats[p.period];
        const timestamps = s.updates.map(u => u.bar?.timestamp).filter(Boolean);
        if (timestamps.length < 2) continue;

        const uniqueTs = new Set(timestamps);
        const tsGaps = [];
        for (let i = 1; i < timestamps.length; i++) {
            tsGaps.push(timestamps[i] - timestamps[i - 1]);
        }

        const periodMs = {
            M1: 60000, M5: 300000, M15: 900000, M30: 1800000,
            H1: 3600000, H4: 14400000, H12: 43200000, D1: 86400000,
        }[p.period] || 0;

        console.log(`\n  ${p.period} timestamp analysis:`);
        console.log(`    Updates: ${s.updates.length}, Unique timestamps: ${uniqueTs.size}`);
        console.log(`    Timestamp range: ${new Date(Math.min(...timestamps)).toISOString()} → ${new Date(Math.max(...timestamps)).toISOString()}`);

        if (periodMs > 0) {
            const sameTsUpdates = s.updates.length - uniqueTs.size;
            const expectedPeriodMin = periodMs / 60000;
            console.log(`    Expected bar period: ${expectedPeriodMin}min`);
            console.log(`    Same-timestamp updates (close-only): ${sameTsUpdates}`);

            // Check if timestamps are M1-aligned (minute boundary) vs proper period-aligned
            const firstTs = Math.min(...timestamps);
            const isMinuteAligned = timestamps.every(t => t % 60000 === 0);
            const isPeriodAligned = timestamps.every(t => t % periodMs === 0);
            console.log(`    Timestamps minute-aligned: ${isMinuteAligned ? 'YES' : 'NO'}`);
            console.log(`    Timestamps period-aligned:  ${isPeriodAligned ? 'YES (correct)' : 'NO (suspicious)'}`);

            if (!isPeriodAligned && isMinuteAligned) {
                console.log(`    >>> WARNING: ${p.period} updates carry M1-aligned timestamps — likely M1 data misrouted as ${p.period}`);
            }
        }
    }

    // Unexpected messages
    if (otherMessages.length > 0) {
        console.log('\n--- Unexpected Messages ---');
        for (const { elapsed, msg } of otherMessages) {
            console.log(`  [${elapsed}s] ${JSON.stringify(msg)}`);
        }
    }

    console.log('\n=== Diagnostic complete ===');
    process.exit(0);
})();
