#!/usr/bin/env node
/**
 * Diagnostic script: tests which periods cTrader accepts for live trendbar
 * (candle) subscriptions on the currently running backend.
 *
 * Usage:
 *   node scripts/test-ctrader-subscriptions.js
 *
 * Requires the backend to be running on localhost:8080 with PostgreSQL and Redis.
 * Creates a temporary user, tests each period, prints a summary, then exits.
 */

const http = require('http');
const WebSocket = require('/workspaces/neurosensefx/node_modules/ws');

const HOST = 'localhost';
const PORT = 8080;
const BASE_URL = `http://${HOST}:${PORT}`;
const WS_URL = `ws://${HOST}:${PORT}`;
const SESSION_COOKIE_NAME = 'neurosense_session';
const SYMBOL = 'AUDUSD';
const LISTEN_MS = 5000; // how long to wait for candle data per period

// Resolution strings the frontend sends, mapped to the period strings the backend
// uses internally.  We iterate over the periods but must send the *resolution*
// that maps to each period.
const PERIOD_TO_RESOLUTION = {
    'M1':  '1m',
    'M5':  '5m',
    'M15': '15m',
    'M30': '30m',
    'H1':  '1h',
    'H4':  '4h',
    'H12': '12h',
    'D1':  'D',
};

const PERIODS = Object.keys(PERIOD_TO_RESOLUTION);

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

/** POST JSON and return { statusCode, headers, body } as a Promise. */
function postJson(path, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const opts = {
            hostname: HOST,
            port: PORT,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
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

/** Extract the neurosense_session cookie value from a Set-Cookie header string. */
function extractSessionCookie(setCookieHeaders) {
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const h of headers) {
        const match = h.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
        if (match) return match[1];
    }
    return null;
}

/** Sleep for ms milliseconds. */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
    console.log('=== cTrader Candle Subscription Diagnostic ===\n');

    // Step 1 -- Register temporary user
    const email = randomEmail();
    const password = randomPassword();
    console.log(`[1] Registering temporary user: ${email}`);
    let regRes;
    try {
        regRes = await postJson('/api/register', { email, password });
    } catch (err) {
        console.error('FATAL: Could not reach backend. Is it running on port 8080?');
        console.error(err.message);
        process.exit(1);
    }
    if (regRes.statusCode !== 201) {
        console.error(`FATAL: Registration failed (HTTP ${regRes.statusCode}): ${regRes.body}`);
        process.exit(1);
    }
    console.log(`    Registration OK (HTTP 201)\n`);

    // Step 2 -- Get session cookie
    const sessionToken = extractSessionCookie(regRes.headers['set-cookie']);
    if (!sessionToken) {
        console.error('FATAL: No session cookie in registration response.');
        console.error('Set-Cookie headers:', regRes.headers['set-cookie']);
        process.exit(1);
    }
    console.log(`[2] Session cookie obtained: ${sessionToken.slice(0, 8)}...\n`);

    // Step 3 -- Connect WebSocket
    console.log('[3] Connecting WebSocket...');
    const ws = new WebSocket(WS_URL, {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}` },
    });

    const results = [];

    // Resolve when the WS is open so we can sequence tests
    const wsOpen = new Promise((resolve, reject) => {
        ws.on('open', () => {
            console.log('    WebSocket connected.\n');
            resolve();
        });
        ws.on('error', (err) => {
            console.error('FATAL: WebSocket error:', err.message);
            reject(err);
        });
        ws.on('close', (code, reason) => {
            console.log(`    WebSocket closed (code=${code}, reason=${reason || 'none'})`);
        });
    });

    await wsOpen;

    // Step 4 -- Test each period
    for (const period of PERIODS) {
        const resolution = PERIOD_TO_RESOLUTION[period];
        console.log(`--- Testing period ${period} (resolution="${resolution}") ---`);

        const record = {
            period,
            resolution,
            subscriptionResponse: null,
            candleUpdates: [],
            errors: [],
            backendError: null,
        };

        // Collect messages for this period
        const messageHandler = (raw) => {
            let msg;
            try {
                msg = JSON.parse(raw.toString());
            } catch {
                return;
            }
            if (msg.type === 'candleSubscription') {
                record.subscriptionResponse = msg;
            } else if (msg.type === 'candleUpdate') {
                record.candleUpdates.push(msg);
            } else if (msg.type === 'error') {
                record.errors.push(msg);
            }
        };
        ws.on('message', messageHandler);

        // (a) Subscribe
        ws.send(JSON.stringify({ type: 'subscribeCandles', symbol: SYMBOL, resolution }));

        // (b+c) Wait for responses
        await sleep(LISTEN_MS);

        // (d) Record results
        if (record.subscriptionResponse) {
            const status = record.subscriptionResponse.status;
            if (status === 'subscribed') {
                console.log(`    Subscription: OK  (period=${record.subscriptionResponse.period})`);
            } else {
                console.log(`    Subscription: UNEXPECTED status="${status}"`);
            }
        } else {
            console.log('    Subscription: NO response received');
        }

        if (record.candleUpdates.length > 0) {
            console.log(`    candleUpdate messages received: ${record.candleUpdates.length}`);
            for (const cu of record.candleUpdates) {
                const tf = cu.timeframe || cu.period || '?';
                const bar = cu.bar || cu.candle || cu;
                console.log(`      timeframe=${tf}  O=${bar.open}  H=${bar.high}  L=${bar.low}  C=${bar.close}  ts=${bar.timestamp || cu.timestamp || '?'}`);
            }
        } else {
            console.log('    candleUpdate messages: none received');
        }

        if (record.errors.length > 0) {
            console.log(`    Errors (${record.errors.length}):`);
            for (const e of record.errors) {
                console.log(`      [${e.code || 'ERR'}] ${e.message}`);
            }
        }

        // (f) Unsubscribe before next period
        ws.send(JSON.stringify({ type: 'unsubscribeCandles', symbol: SYMBOL, resolution }));
        ws.removeListener('message', messageHandler);
        console.log('    Unsubscribed.\n');

        results.push(record);
    }

    // Step 5 -- Disconnect
    ws.close();
    console.log('[5] WebSocket disconnected.\n');

    // Step 6 -- Print summary table
    console.log('=== SUMMARY ===\n');
    console.log('Period | Resolution | Subscribed | CandleUpdates | Errors');
    console.log('-------|------------|------------|---------------|-------');
    for (const r of results) {
        const subscribed = r.subscriptionResponse?.status === 'subscribed' ? 'YES' : 'NO';
        const candles = String(r.candleUpdates.length).padStart(2);
        const errCount = r.errors.length;
        const errStr = errCount > 0 ? `${errCount} error(s)` : '-';
        console.log(
            `${r.period.padEnd(6)} | ${r.resolution.padEnd(10)} | ${subscribed.padEnd(10)} | ${candles.padEnd(13)} | ${errStr}`
        );
    }

    // Highlight failures
    const failures = results.filter((r) => r.subscriptionResponse?.status !== 'subscribed');
    const noData = results.filter((r) => r.subscriptionResponse?.status === 'subscribed' && r.candleUpdates.length === 0);
    const successes = results.filter((r) => r.candleUpdates.length > 0);

    console.log('\n--- Analysis ---');
    if (successes.length > 0) {
        console.log(`Periods that RECEIVED candle data: ${successes.map((r) => r.period).join(', ')}`);
    } else {
        console.log('No period received candle data within the listen window.');
    }
    if (noData.length > 0) {
        console.log(`Periods subscribed but NO data (may need longer wait): ${noData.map((r) => r.period).join(', ')}`);
    }
    if (failures.length > 0) {
        console.log(`Periods that FAILED to subscribe: ${failures.map((r) => r.period).join(', ')}`);
        for (const f of failures) {
            for (const e of f.errors) {
                console.log(`  ${f.period}: [${e.code || 'ERR'}] ${e.message}`);
            }
            if (!f.subscriptionResponse && f.errors.length === 0) {
                console.log(`  ${f.period}: No subscription response at all.`);
            }
        }
    }

    console.log('\n--- Backend Error Patterns ---');
    let foundBackendError = false;
    for (const r of results) {
        const allMsgs = [...r.errors];
        if (r.subscriptionResponse && r.subscriptionResponse.status !== 'subscribed') {
            allMsgs.push(r.subscriptionResponse);
        }
        for (const m of allMsgs) {
            const text = JSON.stringify(m);
            if (/Failed to subscribe|ProtoOAErrorRes|SUBSCRIPTION_FAILED|error/i.test(text)) {
                console.log(`  ${r.period}: ${text}`);
                foundBackendError = true;
            }
        }
    }
    if (!foundBackendError) {
        console.log('  No backend error patterns detected in subscription responses.');
    }

    console.log('\n=== Diagnostic complete ===');
    process.exit(0);
})();
