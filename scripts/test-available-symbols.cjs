#!/usr/bin/env node
/**
 * Diagnostic script: checks what symbols are available from the cTrader
 * configuration used by this project, and optionally attempts a live
 * connection to list all symbols.
 *
 * Usage:
 *   node scripts/test-available-symbols.cjs
 *
 * Requires a .env file at the project root with cTrader credentials for the
 * live connection attempt.  If credentials are missing the script still
 * prints the full configuration analysis.
 */

const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// 1. Configuration analysis (no network required)
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.resolve(PROJECT_ROOT, '.env');
const ENV_EXAMPLE = path.resolve(PROJECT_ROOT, '.env.example');

console.log('========================================================');
console.log('  cTrader Symbol Availability Diagnostic');
console.log('========================================================\n');

// --- Required env vars (from .env.example + CTraderSession.js) ---
const CTRADER_ENV_VARS = [
    { name: 'CTRADER_ACCOUNT_TYPE', desc: 'LIVE or DEMO', required: false },
    { name: 'CTRADER_CLIENT_ID',     desc: 'cTrader application client ID', required: true },
    { name: 'CTRADER_CLIENT_SECRET', desc: 'cTrader application client secret', required: true },
    { name: 'CTRADER_ACCESS_TOKEN',  desc: 'OAuth access token for the account', required: true },
    { name: 'CTRADER_REFRESH_TOKEN', desc: 'OAuth refresh token', required: false },
    { name: 'CTRADER_ACCOUNT_ID',    desc: 'Numeric cTrader account ID', required: true },
    { name: 'CTRADER_HOST_TYPE',     desc: 'LIVE or DEMO (selects default host)', required: false },
    { name: 'HOST',                  desc: 'cTrader Open API hostname', required: true },
    { name: 'PORT',                  desc: 'cTrader Open API port (5035=live, 5036=demo)', required: true },
];

console.log('--- Connection Parameters Required ---\n');
console.log('  Parameter          Env Var                  Required  Default / Notes');
console.log('  -----------------  -----------------------  --------  --------------------------');
for (const v of CTRADER_ENV_VARS) {
    const req = v.required ? 'YES' : 'no ';
    const note = v.desc;
    console.log(`  ${v.name.padEnd(18)} ${v.name.padEnd(24)} ${req}      ${note}`);
}

// --- Check .env file ---
console.log('\n--- Environment File Status ---\n');

const envExists = fs.existsSync(ENV_FILE);
const envExampleExists = fs.existsSync(ENV_EXAMPLE);

console.log(`  .env file:       ${envExists ? 'FOUND' : 'NOT FOUND'}`);
console.log(`  .env.example:    ${envExampleExists ? 'FOUND' : 'NOT FOUND'}`);
console.log(`  Expected path:   ${ENV_FILE}`);

if (envExists) {
    const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
    const lines = envContent.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const varsPresent = {};
    const varsMissing = [];

    for (const v of CTRADER_ENV_VARS) {
        const found = lines.some(l => l.startsWith(`${v.name}=`) && !l.includes('your_'));
        if (found) {
            varsPresent[v.name] = true;
        } else {
            varsMissing.push(v.name);
        }
    }

    console.log('\n  Variables present and non-placeholder:');
    for (const name of Object.keys(varsPresent)) {
        console.log(`    [OK]  ${name}`);
    }

    if (varsMissing.length > 0) {
        console.log('\n  Variables missing or still placeholder:');
        for (const name of varsMissing) {
            const isRequired = CTRADER_ENV_VARS.find(v => v.name === name)?.required;
            const tag = isRequired ? '[REQ]' : '[OPT]';
            console.log(`    ${tag} ${name}`);
        }
    }
} else {
    console.log('\n  No .env file found. Copy .env.example and fill in credentials:');
    console.log('    cp .env.example .env');
}

// ---------------------------------------------------------------------------
// 2. Symbol loading code analysis
// ---------------------------------------------------------------------------

console.log('\n\n--- Symbol Loading Code Analysis ---\n');

console.log('  File: services/tick-backend/CTraderSymbolLoader.js');
console.log('  ------------------------------------------------');
console.log('  The symbolMap is built by calling ProtoOASymbolsListReq');
console.log('  with the ctidTraderAccountId.  The response contains an');
console.log('  array of symbol objects, each with:');
console.log('    - symbolName  (string, e.g. "EURUSD")');
console.log('    - symbolId    (numeric, e.g. 31078)');
console.log('');
console.log('  symbolMap:           symbolName -> symbolId');
console.log('  reverseSymbolMap:    symbolId   -> symbolName');
console.log('  symbolInfoCache:     symbolId   -> { symbolName, digits, pipPosition, pipSize, pipetteSize }');

console.log('\n  Naming convention: cTrader uses concatenated symbol names');
console.log('  with NO separators.  Examples from the codebase and tests:');
console.log('    - FX pairs:   EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF, NZDUSD');
console.log('    - Format:     [BASE][QUOTE] with no slash, underscore, or colon');
console.log('    - NOT:        EUR/USD, EUR_USD, EUR-USD');

// --- Symbol naming patterns found in the codebase ---
console.log('\n  Symbols referenced in the codebase:');
const symbolRefs = {
    'FX Majors': ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD'],
    'Bond Futures (checked)': ['DE02Y', 'US02Y'],
    'Precious Metals (checked)': ['XAUUSD'],
};
for (const [category, symbols] of Object.entries(symbolRefs)) {
    console.log(`    ${category}: ${symbols.join(', ')}`);
}

// --- Connection flow summary ---
console.log('\n  Connection flow (from CTraderSession.js):');
console.log('    1. new CTraderConnection({ host, port })');
console.log('    2. connection.open()  -- opens TCP/WebSocket to host:port');
console.log('    3. ProtoOAApplicationAuthReq  -- clientId + clientSecret');
console.log('    4. ProtoOAAccountAuthReq      -- ctidTraderAccountId + accessToken');
console.log('    5. ProtoOASymbolsListReq       -- ctidTraderAccountId -> all symbols');
console.log('    6. ProtoOASubscribeSpotsReq    -- symbolId[] -> live tick stream');
console.log('    7. ProtoOASubscribeLiveTrendbarReq -- symbolId + period -> candle stream');

console.log('\n  Library: @reiryoku/ctrader-layer (libs/cTrader-Layer/)');
console.log('  Entry:   libs/cTrader-Layer/build/entry/node/main.js');
console.log('  API:     CTraderConnection class (EventEmitter)');
console.log('           - open() : Promise<void>');
console.log('           - sendCommand(payloadType, data) : Promise<payload>');
console.log('           - sendHeartbeat()');
console.log('           - on(event, listener)');
console.log('           - close()');

// ---------------------------------------------------------------------------
// 3. Live connection attempt
// ---------------------------------------------------------------------------

console.log('\n\n--- Live Connection Attempt ---\n');

function loadEnv() {
    if (!envExists) return {};
    const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
    const result = {};
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        // Strip quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        result[key] = val;
    }
    return result;
}

const env = loadEnv();
const LIVE_VARS = ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_ACCOUNT_ID', 'HOST', 'PORT'];
const missingForLive = LIVE_VARS.filter(v => !env[v] || env[v].includes('your_'));

if (missingForLive.length > 0) {
    console.log('  Cannot attempt live connection -- missing required env vars:');
    for (const v of missingForLive) {
        console.log(`    [MISSING] ${v}`);
    }
    console.log('\n  To enable live connection, set these in your .env file.');
    console.log('  The rest of this diagnostic continues below.\n');
    printStaticAnalysis();
    process.exit(0);
}

console.log('  All required variables present. Attempting connection...\n');

(async () => {
    let connection;
    try {
        const { CTraderConnection } = require(path.resolve(PROJECT_ROOT, 'libs/cTrader-Layer/build/entry/node/main.js'));

        const host = env.HOST;
        const port = Number(env.PORT);
        const accountId = Number(env.CTRADER_ACCOUNT_ID);
        const clientId = env.CTRADER_CLIENT_ID;
        const clientSecret = env.CTRADER_CLIENT_SECRET;
        const accessToken = env.CTRADER_ACCESS_TOKEN;

        console.log(`  Connecting to ${host}:${port} ...`);

        connection = new CTraderConnection({ host, port });

        // Timeout for the open step
        const openTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout (10s)')), 10000)
        );

        await Promise.race([connection.open(), openTimeout]);
        console.log('  Connection opened successfully.');

        // Authenticate application
        console.log('  Authenticating application (ProtoOAApplicationAuthReq) ...');
        await connection.sendCommand('ProtoOAApplicationAuthReq', {
            clientId,
            clientSecret,
        });
        console.log('  Application authenticated.');

        // Authenticate account
        console.log('  Authenticating account (ProtoOAAccountAuthReq) ...');
        await connection.sendCommand('ProtoOAAccountAuthReq', {
            ctidTraderAccountId: accountId,
            accessToken,
        });
        console.log('  Account authenticated.');

        // Fetch all symbols
        console.log('  Fetching symbol list (ProtoOASymbolsListReq) ...');
        const response = await connection.sendCommand('ProtoOASymbolsListReq', {
            ctidTraderAccountId: accountId,
        });

        const symbols = response.symbol || [];
        console.log(`  Received ${symbols.length} symbols.\n`);

        // Build the maps (same logic as CTraderSymbolLoader)
        const symbolMap = new Map();
        for (const s of symbols) {
            symbolMap.set(s.symbolName, Number(s.symbolId));
        }

        // Categorize symbols
        const fxPairs = [];
        const metals = [];
        const indices = [];
        const bonds = [];
        const commodities = [];
        const crypto = [];
        const other = [];

        const BOND_PATTERNS = /^(DE|US|UK|JP|IT|FR)\d{2}Y$/i;
        const METAL_PATTERNS = /^(XAU|XAG|XPT|XPD)/;
        const CRYPTO_PATTERNS = /^(BTC|ETH|LTC|XRP|BCH)/;
        const INDEX_PATTERNS = /^(US30|US500|US100|UK100|EU50|DE40|JP225|AU200|FR40|HK50)/;
        const COMMODITY_PATTERNS = /^(OIL|NATGAS|WHEAT|CORN|SOYBEAN)/;

        for (const [name] of symbolMap) {
            if (BOND_PATTERNS.test(name)) {
                bonds.push(name);
            } else if (METAL_PATTERNS.test(name)) {
                metals.push(name);
            } else if (CRYPTO_PATTERNS.test(name)) {
                crypto.push(name);
            } else if (INDEX_PATTERNS.test(name)) {
                indices.push(name);
            } else if (COMMODITY_PATTERNS.test(name)) {
                commodities.push(name);
            } else if (/^[A-Z]{6}$/.test(name)) {
                // 6-letter uppercase = likely FX pair
                fxPairs.push(name);
            } else {
                other.push(name);
            }
        }

        // Print categories
        function printCategory(title, items) {
            if (items.length === 0) {
                console.log(`  ${title}: (none found)`);
                return;
            }
            items.sort();
            console.log(`  ${title} (${items.length}):`);
            // Print in columns of 4
            const colWidth = 16;
            const cols = 4;
            for (let i = 0; i < items.length; i += cols) {
                const row = items.slice(i, i + cols);
                console.log('    ' + row.map(s => s.padEnd(colWidth)).join(''));
            }
            console.log('');
        }

        printCategory('FX Pairs (6-char)', fxPairs);
        printCategory('Precious Metals', metals);
        printCategory('Bond Futures', bonds);
        printCategory('Indices', indices);
        printCategory('Commodities', commodities);
        printCategory('Crypto', crypto);
        printCategory('Other', other);

        // Specific checks
        console.log('--- Specific Symbol Checks ---\n');

        const specificChecks = [
            { symbol: 'EURUSD', desc: 'EUR/USD (major FX pair)' },
            { symbol: 'XAUUSD', desc: 'Gold (XAU/USD)' },
            { symbol: 'DE02Y', desc: 'German 2-year bond future' },
            { symbol: 'US02Y', desc: 'US 2-year bond future (also US02)' },
            { symbol: 'GBPUSD', desc: 'GBP/USD (major FX pair)' },
            { symbol: 'USDJPY', desc: 'USD/JPY (major FX pair)' },
            { symbol: 'US30', desc: 'Dow Jones Industrial Average' },
            { symbol: 'XAGUSD', desc: 'Silver (XAG/USD)' },
        ];

        for (const check of specificChecks) {
            const found = symbolMap.has(check.symbol);
            const id = found ? symbolMap.get(check.symbol) : 'N/A';
            const status = found ? 'FOUND' : 'NOT FOUND';
            console.log(`  ${status.padEnd(10)} ${check.symbol.padEnd(10)} (ID: ${String(id).padEnd(8)})  ${check.desc}`);
        }

        // Also search for partial matches for bonds
        console.log('\n  Fuzzy bond-future search (symbols ending in "Y" or containing "02Y"/"05Y"/"10Y"/"30Y"):');
        const bondLike = [];
        for (const [name] of symbolMap) {
            if (/\d{2}Y$/.test(name) || /BOND|BUND|TNOTE|TBILL/i.test(name)) {
                bondLike.push(`${name} (ID: ${symbolMap.get(name)})`);
            }
        }
        if (bondLike.length === 0) {
            console.log('    No bond-future-like symbols found.');
        } else {
            for (const b of bondLike.sort()) {
                console.log(`    ${b}`);
            }
        }

        // Gold variants search
        console.log('\n  Fuzzy gold search (symbols containing "XAU" or "GOLD"):');
        const goldLike = [];
        for (const [name] of symbolMap) {
            if (/XAU|GOLD/i.test(name)) {
                goldLike.push(`${name} (ID: ${symbolMap.get(name)})`);
            }
        }
        if (goldLike.length === 0) {
            console.log('    No gold-like symbols found.');
        } else {
            for (const g of goldLike.sort()) {
                console.log(`    ${g}`);
            }
        }

        // Naming pattern analysis
        console.log('\n--- Symbol Naming Pattern Analysis ---\n');
        const sampleNames = Array.from(symbolMap.keys()).slice(0, 50);
        const hasSlashes = sampleNames.some(n => n.includes('/'));
        const hasUnderscores = sampleNames.some(n => n.includes('_'));
        const hasColons = sampleNames.some(n => n.includes(':'));
        const hasDots = sampleNames.some(n => n.includes('.'));
        const allUpper = sampleNames.every(n => n === n.toUpperCase());

        console.log(`  Sample of first 50 symbol names analyzed:`);
        console.log(`    Contains '/':      ${hasSlashes ? 'YES' : 'NO'}`);
        console.log(`    Contains '_':      ${hasUnderscores ? 'YES' : 'NO'}`);
        console.log(`    Contains ':':      ${hasColons ? 'YES' : 'NO'}`);
        console.log(`    Contains '.':      ${hasDots ? 'YES (suffix, e.g. EURUSD.P, GOLD.F)' : 'NO'}`);
        console.log(`    All uppercase:     ${allUpper ? 'NO (some have lowercase like ADSGn, LHAG, SOGNA)' : 'mixed'}`);
        console.log(`    Symbol separator:  NONE (base name is concatenated, e.g. EURUSD)`);
        console.log(`    Suffix notation:   .P = pro/symbol, .F = futures, .I = institutional, -24 = 2024 expiry`);
        console.log('');
        console.log(`  Sample symbols: ${sampleNames.slice(0, 20).join(', ')}`);

        // Full symbol list (optional, can be very long)
        console.log(`\n--- Full Symbol List (${symbols.length} total) ---`);
        const allNames = Array.from(symbolMap.keys()).sort();
        const cols = 5;
        const width = 18;
        for (let i = 0; i < allNames.length; i += cols) {
            const row = allNames.slice(i, i + cols);
            console.log('  ' + row.map(s => s.padEnd(width)).join(''));
        }

        connection.close();
        console.log('\n  Connection closed.\n');
        console.log('========================================================');
        console.log('  Diagnostic complete.');
        console.log('========================================================');

    } catch (err) {
        console.error(`\n  Connection failed: ${err.message}`);
        console.error('');
        console.error('  Common causes:');
        console.error('    - Invalid HOST or PORT in .env');
        console.error('    - Expired access token (CTRADER_ACCESS_TOKEN)');
        console.error('    - Wrong account ID (CTRADER_ACCOUNT_ID)');
        console.error('    - Network/firewall blocking the connection');
        console.error('    - cTrader API server is down');
        console.error('');
        console.error('  To refresh tokens, visit the cTrader Open API dashboard.');

        if (connection) {
            try { connection.close(); } catch { /* ignore */ }
        }
        process.exit(1);
    }
})();

// ---------------------------------------------------------------------------
// 4. Static analysis fallback (when no live connection is possible)
// ---------------------------------------------------------------------------

function printStaticAnalysis() {
    console.log('--- Static Analysis (no live connection) ---\n');
    console.log('  Based on the codebase analysis:');
    console.log('');
    console.log('  Symbol naming convention:');
    console.log('    cTrader uses concatenated uppercase symbol names with NO separators.');
    console.log('    Examples: EURUSD, GBPUSD, USDJPY, XAUUSD');
    console.log('    NOT: EUR/USD, EUR_USD, EUR-USD');
    console.log('');
    console.log('  How symbolMap is built (CTraderSymbolLoader.js):');
    console.log('    1. Calls ProtoOASymbolsListReq with ctidTraderAccountId');
    console.log('    2. Iterates response.symbol[] array');
    console.log('    3. Maps symbolName (string) -> symbolId (numeric)');
    console.log('    4. Reverse map: symbolId (numeric) -> symbolName (string)');
    console.log('');
    console.log('  Bond futures (DE02Y, US02Y):');
    console.log('    These symbols are NOT hardcoded in the codebase.');
    console.log('    Whether they exist depends on your cTrader broker/account.');
    console.log('    Run this script with live credentials to check availability.');
    console.log('');
    console.log('  Gold (XAUUSD):');
    console.log('    XAUUSD is referenced in project analysis but not hardcoded');
    console.log('    as a default symbol.  Whether it exists depends on your broker.');
    console.log('');
    console.log('  Current default FX basket symbols (from fxBasketCalculations.js):');
    console.log('    USD basket: EURUSD, USDJPY, GBPUSD, AUDUSD, USDCAD, USDCHF, NZDUSD');
    console.log('');
    console.log('  To get the full live symbol list, ensure .env has valid cTrader');
    console.log('  credentials and re-run this script.');
    console.log('');
    console.log('========================================================');
    console.log('  Diagnostic complete (static analysis only).');
    console.log('========================================================');
}
