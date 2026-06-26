"use strict";

/**
 * Phase-1 live gate for plans/ctrader-layer-hardening.md (L1 + L2, plus L3/L4 happy path).
 *
 * READ-ONLY: app-auth (ProtoOAApplicationAuthReq) only. No account-auth, no trading,
 * no subscription. Validates the REAL rebuilt CTraderConnection against the live cTrader
 * server (live.ctraderapi.com:5035).
 *
 * Validates:
 *   L1  — open() resolves against the live server (fast).
 *   L2  — sendHeartbeat() writes the raw leak-free frame:
 *           (a) pendingCommandCount stays 0 across a burst,
 *           (b) the server echoes ProtoHeartbeatEvent (payloadType 51),
 *           (c) connection stays alive past ~28s (old dup-connection FIN threshold).
 *   L3/L4 happy path — app-auth sendCommand resolves (real command settles, TTL clears).
 *
 * Secrets: loaded from process.env at runtime; never logged. Only timings, counts,
 * event types/payloadTypes, and connect/close/error occurrence are logged.
 */

// Load creds from the REPO-ROOT .env (not services/tick-backend/.env).
require("dotenv").config({ path: "/workspaces/neurosensefx/.env" });

// Script lives at services/tick-backend/scripts/ ; repo-root libs is three levels up.
const { CTraderConnection } = require("../../../libs/cTrader-Layer/build/entry/node/main");

const HOST = process.env.HOST;
const PORT = process.env.PORT ? Number(process.env.PORT) : undefined;
const CLIENT_ID = process.env.CTRADER_CLIENT_ID;
const CLIENT_SECRET = process.env.CTRADER_CLIENT_SECRET;

// Run config
const RUN_DURATION_MS = 90_000;      // ~90s total run
const HEARTBEAT_INTERVAL_MS = 10_000; // heartbeat every 10s
const LOG_INTERVAL_MS = 10_000;       // status line every ~10s

// --- Pre-flight: creds + endpoint present (do NOT fabricate results) ---
const missing = [];
if (!HOST) missing.push("HOST");
if (!PORT) missing.push("PORT");
if (!CLIENT_ID) missing.push("CTRADER_CLIENT_ID");
if (!CLIENT_SECRET) missing.push("CTRADER_CLIENT_SECRET");
if (missing.length > 0) {
    console.error(`[FAIL] Missing required env vars: ${missing.join(", ")}. Aborting (not fabricating).`);
    process.exit(2);
}

const ts = () => new Date().toISOString();
const since = (t0) => Date.now() - t0;

// Counters / flags
let heartbeatsSent = 0;
let heartbeatsEchoed = 0;
let maxPending = 0;
let closeFired = null;   // { elapsed } or null
let errorFired = null;   // { elapsed, code } or null
let connectElapsedMs = null;
let authResult = null;   // "ok" | "error:<...>"
let authElapsedMs = null;

const t0 = Date.now();
const conn = new CTraderConnection({ host: HOST, port: PORT });

// Wire listeners BEFORE open.
// ProtoHeartbeatEvent -> payloadType 51; on() normalizes the name to "51" and push
// events emit payloadType.toString(), so this fires on the server echo.
conn.on("ProtoHeartbeatEvent", () => {
    heartbeatsEchoed += 1;
});

// Use addListener for close/error to skip the on() proto-lookup warn (those names are
// not payload types; parseInt is NaN -> warning). EventEmitter inherited as-is.
conn.addListener("close", () => {
    closeFired = { elapsed: since(t0) };
    console.log(`[${ts()}] +${since(t0)}ms EVENT close (connection torn down)`);
});
conn.addListener("error", (err) => {
    // Log only safe metadata: never the message body (could carry a token in theory).
    const code = err && (err.code || err.errno);
    errorFired = { elapsed: since(t0), code: code != null ? String(code) : "n/a" };
    console.log(`[${ts()}] +${since(t0)}ms EVENT error code=${errorFired.code}`);
});

let heartbeatTimer = null;
let logTimer = null;
let hardExitTimer = null;
let settled = false;

function logStatus(reason) {
    const pending = conn.pendingCommandCount;
    if (pending > maxPending) maxPending = pending;
    console.log(
        `[${ts()}] +${since(t0).toString().padStart(5)}ms ${reason.padEnd(18)} ` +
        `hbSent=${heartbeatsSent} hbEchoed=${heartbeatsEchoed} ` +
        `pending=${pending} maxPending=${maxPending} ` +
        `closed=${closeFired ? "Y" : "N"}`
    );
}

function finish(code) {
    if (settled) return;
    settled = true;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (logTimer) clearInterval(logTimer);
    if (hardExitTimer) clearTimeout(hardExitTimer);
    try { conn.close(); } catch (_) { /* already closed */ }

    console.log("\n=== SUMMARY ===");
    console.log(`connectElapsedMs      : ${connectElapsedMs}`);
    console.log(`authResult            : ${authResult}`);
    console.log(`authElapsedMs         : ${authElapsedMs}`);
    console.log(`heartbeatsSent        : ${heartbeatsSent}`);
    console.log(`heartbeatsEchoed      : ${heartbeatsEchoed}`);
    console.log(`maxPendingCommandCount: ${maxPending}`);
    console.log(`closeFired            : ${closeFired ? `@+${closeFired.elapsed}ms` : "no"}`);
    console.log(`errorFired            : ${errorFired ? `@+${errorFired.elapsed}ms code=${errorFired.code}` : "no"}`);
    console.log(`totalRunMs            : ${since(t0)}`);
    process.exit(code);
}

// Hard safety net so the agent can never hang.
hardExitTimer = setTimeout(() => {
    console.log(`[${ts()}] +${since(t0)}ms HARD TIMEOUT — forcing exit`);
    finish(3);
}, 115_000);

(async () => {
    try {
        // --- L1: open() against the live server ---
        console.log(`[${ts()}] +${since(t0)}ms open() host=${HOST} port=${PORT}`);
        const openT = Date.now();
        await conn.open();
        connectElapsedMs = Date.now() - openT;
        console.log(`[${ts()}] +${since(t0)}ms open() RESOLVED in ${connectElapsedMs}ms`);

        // --- L3/L4 happy path: app-auth sendCommand (read-only, no account scope) ---
        const authT = Date.now();
        try {
            const res = await conn.sendCommand("ProtoOAApplicationAuthReq", {
                clientId: CLIENT_ID,
                clientSecret: CLIENT_SECRET,
            });
            authElapsedMs = Date.now() - authT;
            // Log only settlement, never payload (could carry identity fields).
            const hasError = res && (typeof res.errorCode === "string" || typeof res.errorCode === "number");
            authResult = hasError ? `error:errorCode=${res.errorCode}` : "ok";
            console.log(`[${ts()}] +${since(t0)}ms sendCommand(ProtoOAApplicationAuthReq) ${authResult} in ${authElapsedMs}ms`);
            if (hasError) {
                // App-auth failed at the application layer — not a transport failure, report it.
                console.log(`[${ts()}] +${since(t0)}ms auth errorCode=${res.errorCode} description=${res.description}`);
            }
        } catch (e) {
            authElapsedMs = Date.now() - authT;
            authResult = `rejected:${(e && e.message) ? "msg" : "n/a"}`;
            console.log(`[${ts()}] +${since(t0)}ms sendCommand(ProtoOAApplicationAuthReq) REJECTED in ${authElapsedMs}ms`);
            // Still proceed to the heartbeat phase: transport open is what L1/L2 gate on.
        }

        // --- Sample pendingCommandCount right after the command settles (must be 0) ---
        const pendingAfterAuth = conn.pendingCommandCount;
        if (pendingAfterAuth > maxPending) maxPending = pendingAfterAuth;
        console.log(`[${ts()}] +${since(t0)}ms pendingCommandCount after auth settle = ${pendingAfterAuth}`);

        // --- L2: heartbeat burst every 10s ---
        heartbeatTimer = setInterval(() => {
            try {
                conn.sendHeartbeat();
                heartbeatsSent += 1;
            } catch (e) {
                console.log(`[${ts()}] +${since(t0)}ms sendHeartbeat() threw (closed?)`);
            }
            // Fire one immediately too so the first echo lands early.
        }, HEARTBEAT_INTERVAL_MS);

        // Send one heartbeat immediately (don't wait 10s for the first echo).
        try { conn.sendHeartbeat(); heartbeatsSent += 1; } catch (_) {}

        logTimer = setInterval(() => logStatus("tick"), LOG_INTERVAL_MS);

        // Run for ~90s, then summarize + close.
        setTimeout(() => {
            logStatus("final");
            finish(0);
        }, RUN_DURATION_MS);
    } catch (err) {
        // open() rejected (L1 failure path) or unexpected throw.
        const code = err && (err.code || err.errno);
        console.log(`[${ts()}] +${since(t0)}ms open()/setup FAILED code=${code != null ? String(code) : "n/a"}`);
        finish(1);
    }
})();
