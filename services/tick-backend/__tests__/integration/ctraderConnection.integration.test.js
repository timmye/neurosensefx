"use strict";

/**
 * Phase 0.1 — First-ever OFFLINE integration coverage of the REAL
 * `CTraderConnection` (libs/cTrader-Layer/build/entry/node/main), driven against
 * an in-process mock cTrader TLS server (helpers/mockCtraderServer.js).
 *
 * These are CHARACTERIZATION tests: they pin TODAY's behavior of the real
 * connection/socket/command paths. Where today's behavior is a known defect,
 * the test asserts the defective behavior and leaves a `// TODO(Lxx)` comment
 * pointing at the Phase-1 fix that will flip it green.
 *
 * The defect tags (L1/L2/L3/L5) cross-reference plans/ctrader-layer-hardening.md.
 *
 * HANG SAFETY: several current behaviors hang forever (open never rejects; close
 * strands in-flight commands). For every "hangs" assertion we race the promise
 * against a short timer and assert NON-resolution, then tear the server down in
 * afterEach. We never await an unbounded promise.
 *
 * TLS: the real CTraderSocket does tls.connect() with no rejectUnauthorized
 * override, so a self-signed cert fails the handshake. We disable Node's TLS
 * auth check PROCESS-SCOPED for the duration of this suite only (beforeAll/
 * afterAll restore). No production code or lib is modified.
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from "vitest";
const { CTraderConnection } = require(
    "../../../../libs/cTrader-Layer/build/entry/node/main",
);
const { createMockCtraderServer, PAYLOAD_TYPE } = require(
    "./helpers/mockCtraderServer",
);

// Short race window for "this promise must NOT settle" assertions. Well under
// the suite's 15s timeout, but long enough that a genuine resolve/reject would
// reliably fire within it.
const HANG_RACE_MS = 500;

/**
 * Race a (possibly never-settling) promise against a timer. Resolves with
 * { settled: boolean, value?: any, reason?: any }. Use to assert NON-resolution
 * without risking an unbounded await.
 */
function raceSettlement(promise, ms = HANG_RACE_MS) {
    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve({ settled: false }), ms);
    });
    return Promise.race([
        promise.then(
            (value) => { clearTimeout(timer); return { settled: true, value }; },
            (reason) => { clearTimeout(timer); return { settled: true, reason }; },
        ),
        timeout,
    ]);
}

let originalTlsReject;

beforeAll(() => {
    // The real CTraderSocket passes no rejectUnauthorized to tls.connect(), so a
    // self-signed cert would make the handshake FAIL by default. Disable Node's
    // TLS auth check for this suite only; restored in afterAll.
    originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
});

afterAll(() => {
    if (originalTlsReject === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
    }
});

// Track live servers so afterEach can always tear them down, even on early
// assertion failure mid-test.
const liveServers = [];
afterEach(async () => {
    while (liveServers.length) {
        const s = liveServers.pop();
        try { await s.stop(); } catch { /* ignore */ }
    }
});

async function startServer(mode) {
    const server = createMockCtraderServer({ mode });
    const port = await server.start();
    liveServers.push(server);
    return { server, port };
}

describe("CTraderConnection (real lib) vs mock cTrader server", () => {
    test("happy path: open() resolves, sendCommand resolves with mocked response, heartbeat does not throw", async () => {
        const { port } = await startServer("happy");
        const conn = new CTraderConnection({ host: "127.0.0.1", port });

        await conn.open();

        // Auth request answered by the happy server with a matching Res carrying
        // the same clientMsgId -> sendCommand resolves with the (empty) payload.
        const res = await conn.sendCommand("ProtoOAApplicationAuthReq", {
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
        });
        expect(res).toBeDefined();
        // ProtoOAApplicationAuthRes has no data fields; payload is an object.
        expect(typeof res).toBe("object");

        // A heartbeat is a fire-and-forget event; it must not throw synchronously.
        expect(() => conn.sendHeartbeat()).not.toThrow();

        conn.close();
    });

    test("L1: against a hang server, open() REJECTS within ~12s (TLS handshake timeout destroys the socket)", async () => {
        // L1 (FIXED): the real CTraderSocket now sets `timeout: 10000` on
        // tls.connect() AND listens for the socket 'timeout' event to destroy().
        // Against a server that never completes the TLS handshake, the socket
        // times out at 10s -> destroy() -> 'error'/'close' fires ->
        // rejectConnectionPromise rejects. So open() rejects instead of hanging.
        // The race window (13s) is strictly greater than the 10s socket timeout
        // but still bounded under the suite's 15s timeout.
        const { port } = await startServer("hang");
        const conn = new CTraderConnection({ host: "127.0.0.1", port });

        const result = await raceSettlement(conn.open(), 13000);

        expect(result.settled).toBe(true);
        expect(result.reason).toBeInstanceOf(Error);

        // Cleanup: the rejected open() leaves no pending socket, but call close()
        // defensively in case of any race.
        conn.close();
    });

    test("L2: heartbeat is leak-free — a burst of heartbeats does NOT grow pendingCommandCount", async () => {
        // L2 (FIXED): sendHeartbeat() used to route through sendCommand(), which
        // registered an entry in CTraderCommandMap keyed by clientMsgId that was
        // never extracted (the server doesn't correlate heartbeat responses) — a
        // slow leak. sendHeartbeat() now writes the raw leak-free 8-byte frame
        // (00 00 00 04 08 33 12 00) directly via the socket, bypassing the command
        // map entirely. Observable now via the read-only pendingCommandCount
        // accessor: a burst of heartbeats must leave it at zero.
        const { port } = await startServer("happy");
        const conn = new CTraderConnection({ host: "127.0.0.1", port });
        await conn.open();

        expect(conn.pendingCommandCount).toBe(0);

        // A burst of heartbeats — none should throw and none should leak a map entry.
        for (let i = 0; i < 5; i += 1) {
            expect(() => conn.sendHeartbeat()).not.toThrow();
        }
        expect(conn.pendingCommandCount).toBe(0);

        // Give the server a tick to process; the connection stays usable for a
        // real command afterwards (proving we did not throw or corrupt state).
        const res = await conn.sendCommand("ProtoOAApplicationAuthReq", {
            clientId: "c", clientSecret: "s",
        });
        expect(res).toBeDefined();

        conn.close();
    });

    test("L3: close() REJECTS an in-flight command within ~500ms (rejectAll settles pending commands)", async () => {
        // L3 (FIXED): close() now calls commandMap.rejectAll(new Error(...)) BEFORE
        // emit('close'), so every pending command's promise rejects with a proper
        // Error instead of hanging forever. The closeOnCommand server destroys the
        // socket on receipt of any frame; we issue a command it won't answer, then
        // call conn.close() and assert the in-flight promise rejects as an Error
        // within a bounded ~500ms window.
        const { port } = await startServer("closeOnCommand");
        const conn = new CTraderConnection({ host: "127.0.0.1", port });
        await conn.open();

        // Issue a command; the server will destroy the socket on receipt.
        const inFlight = conn.sendCommand("ProtoOAApplicationAuthReq", {
            clientId: "c", clientSecret: "s",
        }).catch((reason) => ({ __rejected: true, reason }));

        // Give the framed command a moment to hit the wire / trigger the destroy.
        await new Promise((r) => setTimeout(r, 50));
        conn.close();

        const result = await raceSettlement(inFlight, 500);
        expect(result.settled).toBe(true);
        // The inFlight promise catches and wraps the rejection as
        // { __rejected: true, reason }, so raceSettlement reports it on `value`.
        expect(result.value).toBeTruthy();
        expect(result.value.__rejected).toBe(true);
        // The rejection reason is a proper Error (L8 intent satisfied at the
        // connection/map level — callers can `instanceof Error`).
        expect(result.value.reason).toBeInstanceOf(Error);
    });

    test("L5: a server-side close emits the lib 'close' event EXACTLY once (once-guard)", async () => {
        // L5 (characterization, NOT a defect): the plan hypothesized a hard
        // server-side destroy might NOT emit the connection's 'close' event.
        // Pinning the ACTUAL observed behavior: a remote socket.destroy() causes
        // the client TLS socket to emit 'end', which CTraderSocket wires to
        // onClose -> CTraderConnection.#onClose -> emit('close'). So 'close'
        // DOES fire on a hard destroy today. This is good behavior — keep it.
        // TODO(L5): if a future Phase-1 change to CTraderSocket's event wiring
        // regresses this, this assertion will catch it. (No L5 defect confirmed.)
        const { port } = await startServer("closeOnCommand");
        const conn = new CTraderConnection({ host: "127.0.0.1", port });
        await conn.open();

        let closeCount = 0;
        // Register via the underlying EventEmitter to avoid the cosmetic
        // "unknown event type" warning from CTraderConnection.on()'s proto lookup.
        conn.addListener("close", () => { closeCount += 1; });

        // Trigger a server-side close by sending a frame the server tears down.
        conn.sendHeartbeat();

        await new Promise((r) => setTimeout(r, HANG_RACE_MS + 50));

        // 'close' must fire, AND (once-guard) EXACTLY ONCE. The socket binds both
        // 'end' and 'close' to onClose; without CTraderConnection.#onClose's #closed
        // guard a single disconnect would emit 'close' twice. This count catches that.
        expect(closeCount).toBe(1);
    });

    test("L8: a server errorCode response rejects sendCommand with an Error carrying errorCode", async () => {
        // L8 (FIXED): #onDecodedData used to call sentCommand.reject(payload) — a
        // raw object, not an Error, so callers couldn't `instanceof Error` or read
        // `.message` and the backend worked around it with `err?.message || err`.
        // The call site now wraps the payload: Object.assign(new Error(...), payload),
        // so the rejection IS an Error AND still carries errorCode/description. The
        // errorRes server replies to any request with a ProtoOAErrorRes (matched by
        // clientMsgId), driving this path end-to-end through the real connection.
        const { port } = await startServer("errorRes");
        const conn = new CTraderConnection({ host: "127.0.0.1", port });
        await conn.open();

        let caught;
        try {
            await conn.sendCommand("ProtoOAApplicationAuthReq", {
                clientId: "c", clientSecret: "s",
            });
        } catch (e) {
            caught = e;
        }

        expect(caught).toBeInstanceOf(Error);
        // The wrapped Error preserves the errorCode + description from the payload.
        expect(caught.errorCode).toBe("CH_BAD_REQUEST");
        expect(typeof caught.message).toBe("string");
        expect(caught.message).toContain("CH_BAD_REQUEST");

        conn.close();
    });
});
