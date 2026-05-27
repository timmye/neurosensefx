#!/usr/bin/env node
/**
 * cTrader connection diagnostic tool.
 * Tests each layer of the cTrader connection stack and reports findings.
 */
const tls = require("tls");

// Colors
const C = {
    reset: "\x1b[0m", bold: "\x1b[1m", green: "\x1b[32m", red: "\x1b[31m",
    yellow: "\x1b[33m", blue: "\x1b[34m", gray: "\x1b[90m"
};
function section(n) { console.log(`\n${C.bold}${C.blue}--- ${n} ---${C.reset}`); }
function ok(m)  { console.log(`${C.green}  ✓ ${m}${C.reset}`); }
function fail(m) { console.log(`${C.red}  ✗ ${m}${C.reset}`); }
function info(m) { console.log(`    ${C.gray}${m}${C.reset}`); }

// Parse .env manually (no dotenv dependency needed at project root)
const env = {};
try {
    const fs = require("fs");
    fs.readFileSync("/workspaces/neurosensefx/.env", "utf8").split("\n").forEach(line => {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) env[m[1].trim()] = m[2].trim();
    });
} catch(e) {}

const HOST = process.env.HOST || env.HOST;
const PORT = Number(process.env.PORT || env.PORT);
const CLIENT_ID = process.env.CTRADER_CLIENT_ID || env.CTRADER_CLIENT_ID;
const CLIENT_SECRET = process.env.CTRADER_CLIENT_SECRET || env.CTRADER_CLIENT_SECRET;
const ACCESS_TOKEN = process.env.CTRADER_ACCESS_TOKEN || env.CTRADER_ACCESS_TOKEN;
const REFRESH_TOKEN = process.env.CTRADER_REFRESH_TOKEN || env.CTRADER_REFRESH_TOKEN;
const ACCOUNT_ID = process.env.CTRADER_ACCOUNT_ID || env.CTRADER_ACCOUNT_ID;

let exitCode = 0;

// ── 1. Environment ─────────────────────────────────────────────
section("1. Environment");
for (const [key, val] of Object.entries({HOST, PORT, CLIENT_ID, CLIENT_SECRET, ACCESS_TOKEN, REFRESH_TOKEN, ACCOUNT_ID})) {
    if (val && String(val).length > 0) {
        const display = (key.includes("SECRET") || key.includes("TOKEN")) ? "****" + String(val).slice(-6) : val;
        ok(`${key}=${display}`);
    } else { fail(`${key} missing`); exitCode = 1; }
}

// ── 2. DNS ─────────────────────────────────────────────────────
section("2. DNS resolution");
require("dns").resolve(HOST, (err) => {
    if (err) { fail(`DNS failed: ${err.message}`); exitCode = 1; }
    else ok(`DNS resolved → OK`);

    // ── 3. TLS ────────────────────────────────────────────────
    section("3. TLS connectivity");
    const t0 = Date.now();
    const sock = tls.connect({ host: HOST, port: PORT, servername: HOST, timeout: 10000 });

    sock.on("secureConnect", () => {
        ok(`TLS handshake OK (${Date.now()-t0}ms)`);
        try {
            const cert = sock.getPeerCertificate();
            if (cert) info(`Issuer: ${cert.issuer?.O || "?"}, Valid until: ${cert.valid_to}`);
        } catch(e) {}
        sock.end();

        // ── 4+5. Protocol + Auth + Symbols ──────────────────────
        section("4. Protocol connection");
        doProtocolTest().then(ok2 => {
            if (!ok2) exitCode = 1;
            process.exit(exitCode);
        });
    });

    sock.on("timeout", () => {
        fail(`TLS timeout after 10s`);
        sock.destroy();
        section("5. RESULT");
        fail("Connection failed — TLS handshake never completed.");
        process.exit(1);
    });

    sock.on("error", (e) => {
        fail(`TLS error: ${e.message}`);
        sock.destroy();
        section("5. RESULT");
        fail("TLS connection failed.");
        process.exit(1);
    });
});

// ── Protocol test using cTrader library ────────────────────────
async function doProtocolTest() {
    // Load from backend's node_modules path so all deps resolve
    const libPath = "/workspaces/neurosensefx/services/tick-backend/node_modules";
    const mainMod = require("/workspaces/neurosensefx/libs/cTrader-Layer/build/entry/node/main");
    const { CTraderConnection } = mainMod;

    const conn = new CTraderConnection({ host: HOST, port: PORT });
    let connected = false;

    return new Promise((resolve) => {
        let done = false;
        function finish(ok) { if (!done) { done = true; resolve(ok); } }

        conn.onOpen = () => {
            connected = true;
            ok("Protocol connection established");
        };
        conn.on("error", (e) => info(`conn error: ${e.message}`));

        // Timeout
        const timer = setTimeout(() => {
            fail("Protocol timeout after 10s");
            conn.close();
            section("5. RESULT");
            if (!connected) fail("Connection never established.");
            else ok("Connected but auth failed — check credentials");
            resolve(connected);
        }, 12000);

        // Auth handler
        let gotAuth = false;
        const onAuthResp = (data) => {
            info(`Account auth: errorCode=${data.errorCode || "none"}`);
            if (!data.errorCode) {
                ok("Authentication succeeded");
                gotAuth = true;

                // Load symbols
                section("5. Symbol loading");
                conn.sendCommand("ProtoOASymbolsListReq", { ctidTraderAccountId: Number(ACCOUNT_ID) })
                    .then(symData => {
                        if (symData && symData.symbol && symData.symbol.length > 0) {
                            ok(`Loaded ${symData.symbol.length} symbols`);
                            const sample = symData.symbol.slice(0,5).map(s => s.symbolName);
                            info(`Sample: ${sample.join(", ")}`);
                        } else {
                            fail("Empty symbol list returned");
                        }
                    })
                    .catch(e => fail(`Symbol load error: ${e.message}`))
                    .finally(() => {
                        clearTimeout(timer);
                        conn.close();
                        section("5. RESULT");
                        if (connected && gotAuth) {
                            ok("cTrader fully connected and authenticated.");
                        } else {
                            const parts = [];
                            if (!connected) parts.push("connection");
                            if (!gotAuth) parts.push("auth");
                            fail(`Failed: ${parts.join(", ") || "unknown"}`);
                        }
                        resolve(connected && gotAuth);
                    });
            } else {
                clearTimeout(timer);
                conn.close();
                if (data.errorCode === "CH_ACCESS_TOKEN_INVALID") {
                    fail(`Access token expired (${data.errorCode})`);
                    info("Token refresh via CTRADER_REFRESH_TOKEN may be needed");
                } else {
                    fail(`Auth rejected: ${data.errorCode}`);
                }
                section("5. RESULT");
                fail("Auth failed.");
                resolve(false);
            }
        };
        conn.on("PROTO_OA_ACCOUNT_AUTH_RESP", onAuthResp);

        // Application auth handler — just log it
        conn.on("PROTO_OA_APPLICATION_AUTH_RESP", (d) => {
            info(`App auth: errorCode=${d.errorCode || "none"}, msgId=${d.msgId}`);
        });

        // Connect with timeout
        const connectDone = new Promise((res) => {
            conn.onOpen = () => { connected = true; ok("Protocol connection established"); res(); };
        });

        const timeout = new Promise((_, rej) =>
            setTimeout(() => rej(new Error("timeout")), 10000)
        );

        // Auth check (can't use await here inside sync callback, so just log and let timer handle it)
        if (!ACCOUNT_ID || !ACCESS_TOKEN) {
            fail("No credentials — cannot auth or load symbols");
            clearTimeout(timer);
            conn.close();
            section("5. RESULT");
            ok("Connection OK, but missing credentials.");
            resolve(false);
            return;
        }

        // Authenticate via async IIFE (await not valid in this Promise callback scope)
        (async () => {
            try {
                await Promise.race([connectDone, timeout]);
            } catch(e) {
                clearTimeout(timer);
                conn.close();
                section("5. RESULT");
                fail(`Protocol connection: ${e.message}`);
                resolve(false);
                return;
            }

            section("5. Authentication");
            info(`Client ID: ${CLIENT_ID}`);
            info(`Account ID: ${ACCOUNT_ID}`);

            try {
                await conn.sendCommand("ProtoOAApplicationAuthReq", { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
                await conn.sendCommand("ProtoOAAccountAuthReq", { ctidTraderAccountId: Number(ACCOUNT_ID), accessToken: ACCESS_TOKEN });
                // Auth response handled by onAuthResp listener above — it will finish the flow
            } catch(e) {
                info(`sendCommand error: ${e.message || e}`);
            }
        })();
    });
}
