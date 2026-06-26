'use strict';

/**
 * B0 — CTraderSession connect/reconnect characterization tests.
 *
 * These capture the CURRENT behavior of the real CTraderSession with a faked
 * transport (no live network, deterministic config). They are the load-bearing
 * safety net for the B4 extraction: the full multi-step protobuf handshake
 * (app-auth → account-auth → symbols-list → subscribe-spots/M1) is scripted
 * end-to-end, subscription restore is asserted symbol-for-symbol, and today's
 * mid-handshake hang is documented as a baseline.
 *
 * I/O isolation: since B4 the session takes an injected transport in
 * `connect(transport)` (CTraderTransportAdapter in production, a fake here), so
 * we pass the fake directly — no library mutation needed. The REAL CTraderSession
 * handshake code stays fully under test; only the transport is faked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const {
    createFakeConnection,
    applyFakeConfig,
} = require('./helpers/ctraderFake');

// Deterministic config must be applied before CTraderSession snapshots it.
applyFakeConfig();
const { CTraderSession } = require('../../CTraderSession');

// Symbols used across tests. EURUSD (plain) + GBP/USD (slash → normalized to
// GBPUSD) so name normalization is exercised on connect.
const SYMBOLS = [
    { symbolName: 'EURUSD', symbolId: 1 },
    { symbolName: 'GBP/USD', symbolId: 2 },
];
const EXPECTED_NAMES = ['EURUSD', 'GBPUSD'];

function symbolsListResponse() {
    return { symbol: SYMBOLS };
}

describe('CTraderSession connect/reconnect characterization (B0)', () => {
    let session;

    beforeEach(() => {
        session = new CTraderSession();
    });

    afterEach(() => {
        // Sessions arm a real 10s heartbeat interval on connect(); clear any
        // outstanding timers so they cannot leak across tests.
        try { if (session) session.stopHeartbeat(); } catch (e) {}
        try { if (session && session.healthMonitor) session.healthMonitor.stop(); } catch (e) {}
        try { if (session && session.reconnection) session.reconnection.cancelReconnect(); } catch (e) {}
    });

    // ─── 1. Happy path: full ordered handshake + symbol normalization + reset ──
    it('happy path: emits connected with normalized symbols, ordered command sequence, resets reconnect counter', async () => {
        const fake = createFakeConnection({
            openResult: true,
            scripts: {
                ProtoOAApplicationAuthReq: {},
                ProtoOAAccountAuthReq: {},
                ProtoOASymbolsListReq: symbolsListResponse(),
            },
        });

        const connected = vi.fn();
        session.on('connected', connected);

        await session.connect(fake);

        // connect() resolved and emitted 'connected' exactly once.
        expect(connected).toHaveBeenCalledTimes(1);

        // Symbol names normalized: GBP/USD → GBPUSD.
        const emittedNames = connected.mock.calls[0][0];
        expect(emittedNames).toEqual(EXPECTED_NAMES);

        // The ordered handshake command sequence (auth before symbols-list).
        // Phase 2.2: restore is now POST-connect, and a lazy background symbol-map
        // refresh (Phase 2.1) issues a SECOND ProtoOASymbolsListReq after
        // 'connected'. The load-bearing invariant is the ORDERED PREFIX:
        // app-auth → account-auth → symbols-list, with auth before symbols.
        const commandNames = fake.receivedCommands.map((c) => c.name);
        expect(commandNames.slice(0, 3)).toEqual([
            'ProtoOAApplicationAuthReq',
            'ProtoOAAccountAuthReq',
            'ProtoOASymbolsListReq',
        ]);
        // No subscribe command fires during the handshake (restore is deferred).
        expect(commandNames).not.toContain('ProtoOASubscribeSpotsReq');
        expect(commandNames).not.toContain('ProtoOASubscribeLiveTrendbarReq');

        // account-auth payload carried the configured account id + access token.
        const accountAuth = fake.receivedCommands.find(
            (c) => c.name === 'ProtoOAAccountAuthReq'
        );
        expect(accountAuth.payload).toEqual({
            ctidTraderAccountId: 12345,
            accessToken: 'test-access-token',
        });

        // A successful connect resets the reconnect counter (A2 contract).
        expect(session.reconnection.reconnectAttempts).toBe(0);
    });

    // ─── 2. Subscription send is symbol-for-symbol ────────────────────────────
    //   The per-symbol subscribe → sendCommand mapping is the B4-movable unit.
    //   We exercise the REAL subscribeToTicks / subscribeToM1Bars methods (only
    //   the transport is faked) and assert the recorded sendCommand set maps back
    //   — symbol for symbol — to the intended set, with ticks-before-bars order.
    it('subscribe + restoreSubscriptions send symbol-for-symbol: restored set equals the pre-disconnect set exactly', async () => {
        const fake = createFakeConnection({
            openResult: true,
            scripts: {
                ProtoOASubscribeSpotsReq: {},
                ProtoOASubscribeLiveTrendbarReq: {},
            },
        });

        // Seed a real CTraderSymbolLoader so subscribeToTicks/M1Bars can resolve
        // symbolIds. The subscribe path under test is the REAL one.
        const { CTraderSymbolLoader } = require('../../CTraderSymbolLoader');
        session.symbolLoader = new CTraderSymbolLoader(fake, 12345);
        session.symbolLoader.symbolMap.set('EURUSD', 1);
        session.symbolLoader.symbolMap.set('GBPUSD', 2);
        session.symbolLoader.reverseSymbolMap.set(1, 'EURUSD');
        session.symbolLoader.reverseSymbolMap.set(2, 'GBPUSD');
        session.connection = fake;

        const preDisconnect = new Set(['EURUSD', 'GBPUSD']);

        // Fresh tick-subscribe path (the unit that must survive extraction).
        session.activeSubscriptions = new Set();
        for (const name of preDisconnect) {
            await session.subscribeToTicks(name);
        }
        expect(session.activeSubscriptions).toEqual(preDisconnect);

        // Restore M1 bars for the same set via the real method.
        session.activeBarSubscriptions = new Map();
        for (const name of preDisconnect) {
            await session.subscribeToM1Bars(name);
        }

        // Tick payloads → symbolId → name must equal the pre-disconnect set exactly.
        const spotPayloads = fake.receivedCommands
            .filter((c) => c.name === 'ProtoOASubscribeSpotsReq')
            .map((c) => c.payload);
        const restoredTickNames = new Set(
            spotPayloads.map((p) => {
                const id = Array.isArray(p.symbolId) ? p.symbolId[0] : p.symbolId;
                return session.symbolLoader.getSymbolName(id);
            })
        );
        expect(restoredTickNames).toEqual(preDisconnect);

        // M1 bar payloads map back symbol-for-symbol, period='M1'.
        const m1Payloads = fake.receivedCommands
            .filter((c) => c.name === 'ProtoOASubscribeLiveTrendbarReq')
            .map((c) => c.payload);
        expect(m1Payloads).toHaveLength(2);
        expect(m1Payloads.every((p) => p.period === 'M1')).toBe(true);

        // Ordering invariant: ALL ticks sent before ALL M1 bars.
        const ordered = fake.receivedCommands
            .filter((c) => c.name === 'ProtoOASubscribeSpotsReq' || c.name === 'ProtoOASubscribeLiveTrendbarReq')
            .map((c) => c.name);
        expect(ordered.lastIndexOf('ProtoOASubscribeSpotsReq')).toBeLessThan(
            ordered.indexOf('ProtoOASubscribeLiveTrendbarReq')
        );
    });

    // ─── 2b. Reconnect re-establishes subscriptions symbol-for-symbol on the new
    //   transport (was a B0 BASELINE defect: restoreSubscriptions no-op'd because
    //   the idempotency guard short-circuited on the preserved set, leaving a
    //   reconnected feed silent). Fixed by snapshot+clear in restoreSubscriptions.
    it('reconnect re-subscribes symbol-for-symbol: restored set equals the pre-disconnect set', async () => {
        const fake = createFakeConnection({
            openResult: true,
            scripts: {
                ProtoOAApplicationAuthReq: {},
                ProtoOAAccountAuthReq: {},
                ProtoOASymbolsListReq: symbolsListResponse(),
                ProtoOASubscribeSpotsReq: {},
                ProtoOASubscribeLiveTrendbarReq: {},
            },
        });

        const { CTraderSymbolLoader } = require('../../CTraderSymbolLoader');
        session.symbolLoader = new CTraderSymbolLoader(fake, 12345);
        session.symbolLoader.symbolMap.set('EURUSD', 1);
        session.symbolLoader.symbolMap.set('GBPUSD', 2);
        session.symbolLoader.reverseSymbolMap.set(1, 'EURUSD');
        session.symbolLoader.reverseSymbolMap.set(2, 'GBPUSD');
        session.activeSubscriptions = new Set(['EURUSD', 'GBPUSD']);
        session.connection = fake;

        // reconnect() → disconnect(false) preserves activeSubscriptions, then
        // connect(fake) emits 'connected' and DEFERS restore to a background
        // task (Phase 2.2). Awaiting session.restorePromise (or the
        // 'restoreComplete' event) observes restore settling before asserting.
        await session.reconnect(fake);
        // Restore is detached post-connect; await it so the symbol-for-symbol
        // assertion runs against the fully-restored set.
        if (session.restorePromise) {
            await session.restorePromise;
        }
        // Let any detached microtasks (deferred-subscription retries) settle.
        await new Promise((resolve) => setImmediate(resolve));

        const spotPayloads = fake.receivedCommands
            .filter((c) => c.name === 'ProtoOASubscribeSpotsReq')
            .map((c) => c.payload);
        // FIXED: subscriptions ARE re-sent on the new transport.
        expect(spotPayloads).toHaveLength(2);
        const restoredNames = new Set(
            spotPayloads.map((p) => {
                const id = Array.isArray(p.symbolId) ? p.symbolId[0] : p.symbolId;
                return session.symbolLoader.getSymbolName(id);
            })
        );
        expect(restoredNames).toEqual(new Set(['EURUSD', 'GBPUSD']));
        expect(session.activeSubscriptions).toEqual(new Set(['EURUSD', 'GBPUSD']));
        expect(session.reconnection.reconnectAttempts).toBe(0);
    });

    // ─── 3. Mid-handshake hang (BASELINE capture) ─────────────────────────────
    //   BASELINE: connect() hangs after open() if auth never responds.
    //   B4 removed the session's 10s open() wrapper (now redundant — the layer's
    //   open() self-rejects on socket failure per L1, live-validated). That
    //   wrapper only ever raced open() anyway, NOT authenticate(). The raw
    //   session therefore STILL hangs inside authenticate() on a dead auth
    //   response; the supervisor's connect-phase deadline is what rescues this
    //   in production.
    it('BASELINE: connect() hangs if auth never responds (open() self-rejects only on socket failure, not on a dead auth response)', async () => {
        vi.useFakeTimers();

        const fake = createFakeConnection({
            openResult: true,
            scripts: {
                // App-auth resolves, but account-auth has no script → perpetual
                // pending promise, modelling a dead auth response.
                ProtoOAApplicationAuthReq: {},
            },
        });

        const connected = vi.fn();
        session.on('connected', connected);
        const disconnected = vi.fn();
        session.on('disconnected', disconnected);

        const connectPromise = session.connect(fake);

        // Flush pending microtasks. open() resolved (openResult: true) and the
        // session now awaits authenticate()'s account-auth, which never responds.
        // (B4: the former 10s open() wrapper is gone; open() no longer arms a
        // timer here. advanceTimersByTimeAsync still flushes the microtask queue.)
        await vi.advanceTimersByTimeAsync(12000);

        // BASELINE assertion: still hanging — no connected, no disconnected.
        expect(connected).not.toHaveBeenCalled();
        expect(disconnected).not.toHaveBeenCalled();

        vi.useRealTimers();
        // Swallow the still-pending promise so it cannot surface as an unhandled
        // rejection when fake timers are torn down.
        connectPromise.catch(() => {});
    });

    // ─── 4. reconnect() resets the counter before re-connecting ───────────────
    it('reconnect() resets reconnectAttempts to 0 at reconnect time', async () => {
        session.reconnection.reconnectAttempts = 7;

        const fake = createFakeConnection({
            openResult: true,
            scripts: {
                ProtoOAApplicationAuthReq: {},
                ProtoOAAccountAuthReq: {},
                ProtoOASymbolsListReq: symbolsListResponse(),
                ProtoOASubscribeSpotsReq: {},
                ProtoOASubscribeLiveTrendbarReq: {},
            },
        });

        const { CTraderSymbolLoader } = require('../../CTraderSymbolLoader');
        session.symbolLoader = new CTraderSymbolLoader(fake, 12345);
        session.symbolLoader.symbolMap.set('EURUSD', 1);
        session.symbolLoader.symbolMap.set('GBPUSD', 2);
        session.symbolLoader.reverseSymbolMap.set(1, 'EURUSD');
        session.symbolLoader.reverseSymbolMap.set(2, 'GBPUSD');
        session.activeSubscriptions = new Set(['EURUSD', 'GBPUSD']);

        await session.reconnect(fake);

        // A2 contract: reconnect() calls reset() before connect(), so by the
        // time connect() completes the counter is back to 0.
        expect(session.reconnection.reconnectAttempts).toBe(0);
    });
});
