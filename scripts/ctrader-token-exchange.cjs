#!/usr/bin/env node
/**
 * scripts/ctrader-token-exchange.cjs
 *
 * Helper for the cTrader Open API OAuth2 cutover. Mints fresh access + refresh
 * tokens for the app configured in the (gitignored) root .env and writes them
 * back to .env atomically (tmp + rename — mirrors CTraderSession.persistTokens()).
 *
 * This script contains NO secrets. It reads client_id / client_secret /
 * account_id from .env at runtime. Safe to commit.
 *
 * OAuth2 flow (https://help.ctrader.com/open-api/account-authentication/):
 *   1. `url`            -> print the authorize URL (open it, approve, capture ?code=)
 *   2. `exchange CODE`  -> swap the one-minute auth code for tokens, write to .env
 *   Alternative (if you minted tokens directly in the portal Playground):
 *   3. `set ACCESS REFRESH` -> write those tokens to .env
 *
 * Usage:
 *   node scripts/ctrader-token-exchange.cjs url [--scope trading|accounts]
 *   node scripts/ctrader-token-exchange.cjs exchange <code> [--redirect <uri>]
 *   node scripts/ctrader-token-exchange.cjs set <access_token> <refresh_token>
 *
 * Scope: `trading` (default — full access, parity with a general app) or
 * `accounts` (view-only; sufficient for a read-only tick feed, least privilege).
 * If the feed later fails to subscribe with `accounts`, re-run with `trading`.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ENV_PATH = path.resolve(__dirname, '..', '.env');
const TOKEN_HOST = 'openapi.ctrader.com';
const TOKEN_PATH = '/apps/token';
const AUTH_BASE = 'https://id.ctrader.com/my/settings/openapi/grantingaccess/';

// ── minimal .env reader (no deps) ───────────────────────────────────────
function readDotenv(file) {
    const text = fs.readFileSync(file, 'utf8');
    const out = {};
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        out[key] = val;
    }
    return out;
}

function getCreds() {
    if (!fs.existsSync(ENV_PATH)) {
        throw new Error(`No .env found at ${ENV_PATH}`);
    }
    const env = readDotenv(ENV_PATH);
    const clientId = env.CTRADER_CLIENT_ID;
    const clientSecret = env.CTRADER_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('CTRADER_CLIENT_ID / CTRADER_CLIENT_SECRET missing or empty in .env');
    }
    return { clientId, clientSecret, accountId: env.CTRADER_ACCOUNT_ID || '(unset)' };
}

// Registered playground redirect: https://openapi.ctrader.com/apps/<appId>/playground
// where <appId> is the numeric prefix of client_id (e.g. 15125 for "15125_...").
function defaultRedirect(clientId) {
    const appId = String(clientId).split('_')[0];
    return `https://openapi.ctrader.com/apps/${appId}/playground`;
}

function buildAuthUrl({ clientId, scope, redirectUri }) {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        product: 'web',
    });
    return AUTH_BASE + '?' + params.toString();
}

// GET the token endpoint; resolve { status, json, raw }.
function getToken(params) {
    const search = new URLSearchParams(params).toString();
    const url = `https://${TOKEN_HOST}${TOKEN_PATH}?${search}`;
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                let json = null;
                try { json = JSON.parse(body); } catch { /* non-JSON error body */ }
                resolve({ status: res.statusCode, json, raw: body });
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => req.destroy(new Error('token request timed out (15s)')));
    });
}

async function exchangeCode(code, redirectUri) {
    const { clientId, clientSecret } = getCreds();
    const { status, json, raw } = await getToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
    });
    if (!json || json.errorCode || !json.accessToken) {
        const why = json ? `${json.errorCode || 'unknown'}: ${json.description || ''}` : raw;
        throw new Error(`Token exchange failed (HTTP ${status}) — ${why}`);
    }
    return { accessToken: json.accessToken, refreshToken: json.refreshToken, expiresIn: json.expiresIn };
}

// Write tokens to .env atomically (mirrors CTraderSession.persistTokens regex).
function writeTokens(accessToken, refreshToken) {
    const tmp = ENV_PATH + '.tmp';
    let content = fs.readFileSync(ENV_PATH, 'utf8');
    const beforeAccess = /^CTRADER_ACCESS_TOKEN=.*$/m;
    const beforeRefresh = /^CTRADER_REFRESH_TOKEN=.*$/m;
    if (!beforeAccess.test(content) || !beforeRefresh.test(content)) {
        throw new Error('.env is missing CTRADER_ACCESS_TOKEN / CTRADER_REFRESH_TOKEN lines');
    }
    content = content.replace(beforeAccess, `CTRADER_ACCESS_TOKEN=${accessToken}`);
    content = content.replace(beforeRefresh, `CTRADER_REFRESH_TOKEN=${refreshToken}`);
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, ENV_PATH);
}

function last4(s) { return s ? '…' + s.slice(-4) : '(none)'; }

// ── CLI ─────────────────────────────────────────────────────────────────
function parseArgs(argv) {
    const [cmd, ...rest] = argv;
    const opts = { scope: 'trading', redirect: null };
    const positional = [];
    for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--scope') opts.scope = rest[++i];
        else if (a === '--redirect') opts.redirect = rest[++i];
        else positional.push(a);
    }
    return { cmd, positional, opts };
}

async function main() {
    const { cmd, positional, opts } = parseArgs(process.argv.slice(2));
    const { clientId, accountId } = getCreds();
    const scope = (opts.scope === 'accounts' || opts.scope === 'trading') ? opts.scope : 'trading';

    if (cmd === 'url') {
        const redirectUri = opts.redirect || defaultRedirect(clientId);
        console.log('\n=== cTrader OAuth authorize URL ===');
        console.log(buildAuthUrl({ clientId, scope, redirectUri }));
        console.log(`\nRedirect URI : ${redirectUri}`);
        console.log(`Scope        : ${scope}  (view-only: --scope accounts)`);
        console.log(`Client ID    : ${clientId}`);
        console.log(`Account ID   : ${accountId}`);
        console.log('\nNext steps:');
        console.log('  1. Open the URL above in a browser.');
        console.log('  2. Sign in with your cTID and approve access for account ' + accountId + '.');
        console.log('  3. You will be redirected to the playground URL with ?code=<CODE>.');
        console.log('     (the code expires in 60 seconds — exchange it immediately)');
        console.log('  4. Run:  node scripts/ctrader-token-exchange.cjs exchange <CODE>');
        return;
    }

    if (cmd === 'exchange') {
        const code = positional[0];
        if (!code) throw new Error('Usage: exchange <code>');
        const redirectUri = opts.redirect || defaultRedirect(clientId);
        console.log(`Exchanging auth code (last4 ${last4(code)}) at ${TOKEN_HOST}${TOKEN_PATH}…`);
        const tok = await exchangeCode(code, redirectUri);
        writeTokens(tok.accessToken, tok.refreshToken);
        console.log('\nOK — access + refresh tokens written to .env');
        console.log(`  access  : ${last4(tok.accessToken)}  (expires in ${tok.expiresIn}s ≈ ${Math.round((tok.expiresIn || 0) / 86400)}d)`);
        console.log(`  refresh : ${last4(tok.refreshToken)}  (no expiry)`);
        console.log('\nNext: restart the backend and verify (see runbook Phase 3).');
        return;
    }

    if (cmd === 'set') {
        const [access, refresh] = positional;
        if (!access || !refresh) throw new Error('Usage: set <access_token> <refresh_token>');
        writeTokens(access, refresh);
        console.log('OK — tokens written to .env');
        console.log(`  access  : ${last4(access)}`);
        console.log(`  refresh : ${last4(refresh)}`);
        return;
    }

    console.log('cTrader Open API token-exchange helper (no secrets embedded).');
    console.log('');
    console.log('Usage: node scripts/ctrader-token-exchange.cjs <command> [...]');
    console.log('  url                     Print the OAuth authorize URL to open in a browser');
    console.log('  exchange <code>         Exchange a 60s auth code for tokens; writes .env');
    console.log('  set <access> <refresh>  Write Playground-sourced tokens to .env');
    console.log('');
    console.log('Options: --scope trading|accounts   --redirect <uri>');
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
