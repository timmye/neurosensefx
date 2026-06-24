'use strict';

/**
 * Feed loop stabilization — Phase 2/3/4 session-level tests (Loop-B/C/D/E/G).
 *
 * Drives the REAL CTraderSession with a faked transport (ctraderFake) and the
 * REAL bounded-concurrency restore runner. All timers are real, so the restore
 * tuning is overridden to small values via config to keep tests fast, and every
 * subscribe command the restore will issue is scripted (restore auto-restores
 * M1 bars for each tick symbol, so both spots + trendbar scripts are needed).
 *
 * Covers:
 *   1. 'connected' emits BEFORE any subscribe command (Phase 2.2 / Loop-B).
 *   2. A stalling SubscribeLiveTrendbarReq does NOT abort connect and is
 *      isolated (other subs still restore) (Phase 2.2 + 4.1).
 *   4. The SAME symbolLoader is reused across two connects; symbolInfoCache
 *      survives (no second SymbolByIdReq) (Phase 2.1 / Loop-G).
 *   5. Defer-queue: a symbol absent now but present after the lazy refresh is
 *      eventually subscribed (Phase 3 / Loop-C).
 *   6. Throttle: in-flight sendCommand never exceeds the configured cap
 *      (Phase 4.1 / Loop-E).
 *   7. errorCode classification: already-subscribed → success; rate-limit →
 *      backoff (not immediate retry); permanent → logged, not retried forever
 *      (Phase 4.2 / Loop-D).
 *
 * The supervisor DEGRADED-gate is covered separately in
 * supervision/restoreDegradedGate.test.js (uses FakeFeed/FakeTransport).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
const {
    createFakeConnection,
    applyFakeConfig,
    errorRejection,
} = require('./helpers/ctraderFake');

// Deterministic config must be applied before CTraderSession snapshots it.
applyFakeConfig();
const { CTraderSession } = require('../../CTraderSession');
const { ctraderErrorCategory, classifyErrorCode } = require('../../utils/ctraderErrorCode');

function symbolsListResponse(pairs) {
    return { symbol: pairs.map((p) => ({ symbolName: p.symbolName, symbolId: p.symbolId })) };
}

// Standard auth + symbols + (resolving) subscribe scripts.
function baseScripts(pairs, extra = {}) {
    return {
        ProtoOAApplicationAuthReq: {},
        ProtoOAAccountAuthReq: {},
        ProtoOASymbolsListReq: symbolsListResponse(pairs),
        ProtoOASubscribeSpotsReq: {},
        ProtoOASubscribeLiveTrendbarReq: {},
        ...extra,
    };
}

describe('Feed loop stabilization — session restore (Phase 2/3/4)', () => {
    let session;

    beforeEach(() => {
        session = new CTraderSession();
    });

    afterEach(() => {
        try { if (session) session.stopHeartbeat(); } catch (e) { /* ignore */ }
        try { if (session && session.healthMonitor) session.healthMonitor.stop(); } catch (e) { /* ignore */ }
        try { if (session && session.reconnection) session.reconnection.cancelReconnect(); } catch (e) { /* ignore */ }
    });

    // ── 1. connected BEFORE any subscribe (Phase 2.2 / Loop-B) ───────────────
    it('emits "connected" before any ProtoOASubscribeSpotsReq / SubscribeLiveTrendbarReq is sent', async () => {
        const pairs = [{ symbolName: 'EURUSD', symbolId: 1 }, { symbolName: 'GBPUSD', symbolId: 2 }];
        const fake = createFakeConnection({ openResult: true, scripts: baseScripts(pairs) });

        session.activeSubscriptions = new Set(['EURUSD', 'GBPUSD']);
        session.activeBarSubscriptions = new Map([['EURUSD:M1', true], ['GBPUSD:M1', true]]);

        // Snapshot the subscribe count AT THE INSTANT 'connected' emits — that is
        // the precise Phase-2.2 guarantee: 'connected' fires before ANY subscribe.
        let subsAtConnected = -1;
        session.on('connected', () => {
            subsAtConnected = fake.receivedCommands.filter(
                (c) => c.name === 'ProtoOASubscribeSpotsReq' || c.name === 'ProtoOASubscribeLiveTrendbarReq'
            ).length;
        });

        await session.connect(fake);

        // No subscribe had been sent when 'connected' fired.
        expect(subsAtConnected).toBe(0);

        // After awaiting restore, subscribes DO appear (post-connect).
        if (session.restorePromise) await session.restorePromise;
        await new Promise((r) => setImmediate(r));

        const subsAfter = fake.receivedCommands.filter(
            (c) => c.name === 'ProtoOASubscribeSpotsReq' || c.name === 'ProtoOASubscribeLiveTrendbarReq'
        );
        expect(subsAfter.length).toBeGreaterThan(0);
    });

    // ── 2. Stalling command isolated; connect not aborted (Phase 2.2 + 4.1) ──
    it('a stalling SubscribeLiveTrendbarReq does NOT abort connect and is isolated (other subs restore)', async () => {
        const pairs = [{ symbolName: 'EURUSD', symbolId: 1 }, { symbolName: 'GBPUSD', symbolId: 2 }];

        // EURUSD (symbolId 1) M1 subscribe hangs; everything else resolves.
        const m1Script = (payload) => {
            if (payload && payload.symbolId === 1) return new Promise(() => {}); // never resolves
            return {};
        };

        const fake = createFakeConnection({
            openResult: true,
            scripts: baseScripts(pairs, { ProtoOASubscribeLiveTrendbarReq: m1Script }),
        });

        session.activeSubscriptions = new Set(['EURUSD', 'GBPUSD']);
        session.activeBarSubscriptions = new Map([['EURUSD:M1', true], ['GBPUSD:M1', true]]);

        const connected = vi.fn();
        session.on('connected', connected);

        // Override the per-command budget with a short one so the stalling
        // command rejects quickly (default is 15s — too slow for a unit test).
        session._sendWithBudget = function (send) {
            let handle;
            const budget = new Promise((_, reject) => {
                handle = setTimeout(() => {
                    const e = new Error('restore command timed out');
                    e.code = 'RESTORE_COMMAND_TIMEOUT';
                    reject(e);
                }, 150);
            });
            return Promise.race([send(), budget]).finally(() => clearTimeout(handle));
        };

        await session.connect(fake);

        // 'connected' fired even though a restore command will stall.
        expect(connected).toHaveBeenCalledTimes(1);

        // Restore settles — the stalling command is rejected by the per-command
        // budget (300ms here), so restorePromise resolves.
        if (session.restorePromise) await session.restorePromise;
        await new Promise((r) => setImmediate(r));

        // GBPUSD M1 (id 2) restored; EURUSD M1 (id 1) stalled + was isolated.
        const m1Ids = fake.receivedCommands
            .filter((c) => c.name === 'ProtoOASubscribeLiveTrendbarReq')
            .map((c) => c.payload.symbolId);
        expect(m1Ids).toContain(2);
        // Both spots restored (spots resolve instantly).
        const spotCount = fake.receivedCommands.filter((c) => c.name === 'ProtoOASubscribeSpotsReq').length;
        expect(spotCount).toBe(2);
    }, 10000);

    // ── 4. Persistent symbolLoader; symbolInfoCache survives (Phase 2.1 / Loop-G)
    it('reuses the same symbolLoader across two connects; symbolInfoCache survives (no second SymbolByIdReq)', async () => {
        const pairs = [{ symbolName: 'EURUSD', symbolId: 1 }];
        let symbolByIdCalls = 0;
        const symById = () => {
            symbolByIdCalls += 1;
            return { symbol: [{ symbolName: 'EURUSD', digits: 5, pipPosition: 4 }] };
        };

        const fake1 = createFakeConnection({ openResult: true, scripts: baseScripts(pairs, { ProtoOASymbolByIdReq: symById }) });
        await session.connect(fake1);
        const loaderAfterConnect1 = session.symbolLoader;

        await session.symbolLoader.getFullSymbolInfo(1);
        expect(symbolByIdCalls).toBe(1);
        expect(session.symbolLoader.symbolInfoCache.has(1)).toBe(true);

        // Connect 2 on a fresh transport: SAME loader reused.
        const fake2 = createFakeConnection({ openResult: true, scripts: baseScripts(pairs, { ProtoOASymbolByIdReq: symById }) });
        await session.connect(fake2);

        expect(session.symbolLoader).toBe(loaderAfterConnect1);
        // Cache hit: no second SymbolByIdReq.
        await session.symbolLoader.getFullSymbolInfo(1);
        expect(symbolByIdCalls).toBe(1);
    });

    // ── 5. Defer-queue: deferred symbol subscribes after refresh (Phase 3) ───
    it('defers an unresolved symbol and subscribes it after the lazy refresh resolves it', async () => {
        // Cold map (handshake loadAllSymbols): only EURUSD. The lazy refresh
        // (triggered because NEWPAIR is deferred) returns EURUSD + NEWPAIR.
        const coldPairs = [{ symbolName: 'EURUSD', symbolId: 1 }];
        const refreshedPairs = [{ symbolName: 'EURUSD', symbolId: 1 }, { symbolName: 'NEWPAIR', symbolId: 9 }];

        let symbolsListCalls = 0;
        const fake = createFakeConnection({
            openResult: true,
            scripts: {
                ProtoOAApplicationAuthReq: {},
                ProtoOAAccountAuthReq: {},
                ProtoOASymbolsListReq: () => {
                    symbolsListCalls += 1;
                    return symbolsListResponse(symbolsListCalls === 1 ? coldPairs : refreshedPairs);
                },
                ProtoOASubscribeSpotsReq: {},
                ProtoOASubscribeLiveTrendbarReq: {},
            },
        });

        // EURUSD resolves immediately; NEWPAIR is unresolved against the cold
        // map → deferred → retried after the lazy refresh adds it.
        session.activeSubscriptions = new Set(['EURUSD', 'NEWPAIR']);
        session.activeBarSubscriptions = new Map();

        await session.connect(fake);
        if (session.restorePromise) await session.restorePromise;
        // Wait for the lazy refresh + deferred retry.
        if (session._symbolMapRefresh) await session._symbolMapRefresh;
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));

        const spotIds = fake.receivedCommands
            .filter((c) => c.name === 'ProtoOASubscribeSpotsReq')
            .map((c) => c.payload.symbolId[0]);

        expect(spotIds).toContain(1);  // EURUSD during restore
        expect(spotIds).toContain(9);  // NEWPAIR after refresh
    });

    // ── 6. Throttle: never exceeds the in-flight cap (Phase 4.1 / Loop-E) ────
    it('never exceeds the configured in-flight cap during restore', async () => {
        const pairs = [];
        for (let i = 1; i <= 12; i++) pairs.push({ symbolName: `SYM${i}`, symbolId: i });

        let inFlight = 0;
        let maxInFlight = 0;

        const fake = createFakeConnection({
            openResult: true,
            scripts: {
                ProtoOAApplicationAuthReq: {},
                ProtoOAAccountAuthReq: {},
                ProtoOASymbolsListReq: symbolsListResponse(pairs),
                ProtoOASubscribeSpotsReq: () => {
                    inFlight += 1;
                    maxInFlight = Math.max(maxInFlight, inFlight);
                    return new Promise((resolve) => {
                        setImmediate(() => { inFlight -= 1; resolve({}); });
                    });
                },
                ProtoOASubscribeLiveTrendbarReq: {},
            },
        });

        session.activeSubscriptions = new Set(pairs.map((p) => p.symbolName));
        // No M1 bars — keep the in-flight measurement to spots only.
        session.activeBarSubscriptions = new Map();

        await session.connect(fake);
        if (session.restorePromise) await session.restorePromise;
        await new Promise((r) => setImmediate(r));

        // Default cap is 6. The runner must never exceed it.
        expect(maxInFlight).toBeLessThanOrEqual(6);
        expect(maxInFlight).toBeGreaterThan(0); // it ran concurrently
    });

    // ── 7. errorCode classification (Phase 4.2 / Loop-D) ─────────────────────
    describe('errorCode classification (Phase 4.2)', () => {
        it('classifies already-subscribed / rate-limit / permanent codes', () => {
            expect(classifyErrorCode('CH_SYMBOL_ALREADY_SUBSCRIBED')).toBe(ctraderErrorCategory.ALREADY_SUBSCRIBED);
            expect(classifyErrorCode('CH_ALREADY_SUBSCRIBED')).toBe(ctraderErrorCategory.ALREADY_SUBSCRIBED);
            expect(classifyErrorCode('CH_SPEED_OVERLIMIT')).toBe(ctraderErrorCategory.RATE_LIMIT);
            expect(classifyErrorCode('REQUEST_FREQUENCY_EXCEEDED')).toBe(ctraderErrorCategory.RATE_LIMIT);
            expect(classifyErrorCode('CH_ACCESS_DENIED')).toBe(ctraderErrorCategory.PERMANENT);
            expect(classifyErrorCode('SOME_UNKNOWN_CODE')).toBe(ctraderErrorCategory.PERMANENT);
            expect(classifyErrorCode(null)).toBe(ctraderErrorCategory.UNKNOWN);
        });

        // Live-confirmed: cTrader returns these codes BARE (no `CH_` prefix) on
        // reconnect re-subscribes — e.g. errorCode=ALREADY_SUBSCRIBED with
        // description "Try to subscribe to Trendbar twice". Before the CH_ strip
        // these fell through to PERMANENT and broke restore (logged "permanently
        // failed" instead of treating the live subscription as restored).
        it('classifies the BARE (non-CH_-prefixed) codes cTrader returns live', () => {
            expect(classifyErrorCode('ALREADY_SUBSCRIBED')).toBe(ctraderErrorCategory.ALREADY_SUBSCRIBED);
            expect(classifyErrorCode('SYMBOL_ALREADY_SUBSCRIBED')).toBe(ctraderErrorCategory.ALREADY_SUBSCRIBED);
            expect(classifyErrorCode('SPEED_OVERLIMIT')).toBe(ctraderErrorCategory.RATE_LIMIT);
        });

        it('treats an already-subscribed rejection as success (restore does not fail)', async () => {
            const pairs = [{ symbolName: 'EURUSD', symbolId: 1 }];
            const fake = createFakeConnection({
                openResult: true,
                scripts: baseScripts(pairs, {
                    ProtoOASubscribeSpotsReq: { __reject: errorRejection('CH_SYMBOL_ALREADY_SUBSCRIBED') },
                }),
            });

            session.activeSubscriptions = new Set(['EURUSD']);
            session.activeBarSubscriptions = new Map();

            await session.connect(fake);
            if (session.restorePromise) await session.restorePromise;
            await new Promise((r) => setImmediate(r));

            // Idempotent success: symbol tracked as restored.
            expect(session.activeSubscriptions.has('EURUSD')).toBe(true);
        });

        it('on a rate-limit, backs off and retries (not an immediate success drop)', async () => {
            const pairs = [{ symbolName: 'EURUSD', symbolId: 1 }, { symbolName: 'GBPUSD', symbolId: 2 }];
            const attempts = [];

            const fake = createFakeConnection({
                openResult: true,
                scripts: {
                    ProtoOAApplicationAuthReq: {},
                    ProtoOAAccountAuthReq: {},
                    ProtoOASymbolsListReq: symbolsListResponse(pairs),
                    ProtoOASubscribeSpotsReq: () => {
                        attempts.push(Date.now());
                        // First two attempts (initial burst) rate-limit; later OK.
                        if (attempts.length <= 2) return Promise.reject(errorRejection('CH_SPEED_OVERLIMIT'));
                        return {};
                    },
                    ProtoOASubscribeLiveTrendbarReq: {},
                },
            });

            session.activeSubscriptions = new Set(['EURUSD', 'GBPUSD']);
            session.activeBarSubscriptions = new Map();

            await session.connect(fake);
            if (session.restorePromise) await session.restorePromise;
            await new Promise((r) => setImmediate(r));

            // Rate-limited attempts were retried (>2 attempts for 2 symbols).
            expect(attempts.length).toBeGreaterThan(2);
        });

        it('on a permanent rejection, logs + skips (does not retry forever)', async () => {
            const pairs = [{ symbolName: 'EURUSD', symbolId: 1 }];
            let spotsAttempts = 0;

            const fake = createFakeConnection({
                openResult: true,
                scripts: {
                    ProtoOAApplicationAuthReq: {},
                    ProtoOAAccountAuthReq: {},
                    ProtoOASymbolsListReq: symbolsListResponse(pairs),
                    ProtoOASubscribeSpotsReq: () => {
                        spotsAttempts += 1;
                        return Promise.reject(errorRejection('CH_ACCESS_DENIED'));
                    },
                    ProtoOASubscribeLiveTrendbarReq: {},
                },
            });

            session.activeSubscriptions = new Set(['EURUSD']);
            session.activeBarSubscriptions = new Map();

            await session.connect(fake);
            if (session.restorePromise) await session.restorePromise;
            await new Promise((r) => setImmediate(r));

            // PERMANENT → exactly one attempt (no retry). Not retried forever.
            expect(spotsAttempts).toBe(1);
            expect(session.activeSubscriptions.has('EURUSD')).toBe(false);
        });
    });

    // ── 8. Gen-token: a stale restore does not send against a new transport (B1)
    it('a stale restore (superseded by a newer connect) sends NOTHING against the new transport', async () => {
        const pairs = [];
        for (let i = 1; i <= 8; i++) pairs.push({ symbolName: `S${i}`, symbolId: i });

        // Transport 1: spots resolve SLOWLY so the first restore is still
        // mid-flight (launching tasks against fake1) when the second connect
        // bumps the generation token.
        const fake1 = createFakeConnection({
            openResult: true,
            scripts: {
                ProtoOAApplicationAuthReq: {},
                ProtoOAAccountAuthReq: {},
                ProtoOASymbolsListReq: symbolsListResponse(pairs),
                ProtoOASubscribeSpotsReq: () => new Promise((res) => setTimeout(() => res({}), 10)),
                ProtoOASubscribeLiveTrendbarReq: {},
            },
        });

        session.activeSubscriptions = new Set(pairs.map((p) => p.symbolName));
        session.activeBarSubscriptions = new Map();

        await session.connect(fake1);
        // Let the first restore start launching its (slow) spots against fake1.
        await new Promise((r) => setImmediate(r));
        const staleGen = session._restoreGen;
        expect(staleGen).toBeGreaterThan(0);

        // restoreSubscriptions() cleared the tracking sets when it snapshotted
        // them. Re-populate so the NEW restore on transport 2 has work to do
        // (this mirrors a real reconnect: the set is repopulated before the
        // next restore runs).
        session.activeSubscriptions = new Set(pairs.map((p) => p.symbolName));
        session.activeBarSubscriptions = new Map();

        // Transport 2: fresh, everything resolves instantly.
        const fake2 = createFakeConnection({
            openResult: true,
            scripts: baseScripts(pairs),
        });

        // A second connect bumps the generation token → the first restore is
        // now stale. connect() returns once the handshake + 'connected' are done.
        await session.connect(fake2);
        expect(session._restoreGen).toBeGreaterThan(staleGen);

        // Await the NEW restore (it owns transport 2).
        if (session.restorePromise) await session.restorePromise;
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));

        // The NEW restore owns transport 2 and sends exactly the 8 spots once.
        // If the STALE restore were also sending against transport 2, we would
        // see MORE than 8 (its tasks would re-dispatch via this.connection).
        const spotsOnT2 = fake2.receivedCommands.filter((c) => c.name === 'ProtoOASubscribeSpotsReq').length;
        expect(spotsOnT2).toBe(8);

        // The new restore also sent one M1 trendbar per tick symbol (8), once.
        const trendbarsOnT2 = fake2.receivedCommands.filter((c) => c.name === 'ProtoOASubscribeLiveTrendbarReq').length;
        expect(trendbarsOnT2).toBe(8);
    }, 15000);

    // ── 9. UNKNOWN/transient error re-defers, not permanent-skip (M3) ─────────
    it('a subscribe that rejects with a timeout (no errorCode) is re-deferred and retried, not permanently skipped', async () => {
        const pairs = [{ symbolName: 'EURUSD', symbolId: 1 }];

        let spotsAttempts = 0;
        const fake = createFakeConnection({
            openResult: true,
            scripts: {
                ProtoOAApplicationAuthReq: {},
                ProtoOAAccountAuthReq: {},
                ProtoOASymbolsListReq: symbolsListResponse(pairs),
                ProtoOASubscribeSpotsReq: () => {
                    spotsAttempts += 1;
                    // Reject with NO errorCode → classifyError returns UNKNOWN.
                    // M3 says this is TRANSIENT → re-defer → retried via refresh.
                    return Promise.reject(new Error('restore command timed out'));
                },
                ProtoOASubscribeLiveTrendbarReq: {},
            },
        });

        session.activeSubscriptions = new Set(['EURUSD']);
        session.activeBarSubscriptions = new Map();

        await session.connect(fake);
        if (session.restorePromise) await session.restorePromise;
        await new Promise((r) => setImmediate(r));

        // The transient task was re-deferred (parked in _deferredSubscriptions),
        // which triggered the lazy refresh. Wait for the refresh + deferred retry.
        if (session._symbolMapRefresh) await session._symbolMapRefresh;
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));

        // It was retried (>1 attempt) — NOT permanently skipped after one try.
        expect(spotsAttempts).toBeGreaterThan(1);
    });

    // ── 10. _rateLimited resets on success (M2) ──────────────────────────────
    it('clears _rateLimited after a successful command so concurrency is restored', async () => {
        const pairs = [{ symbolName: 'EURUSD', symbolId: 1 }, { symbolName: 'GBPUSD', symbolId: 2 }];

        let spotsAttempts = 0;
        const fake = createFakeConnection({
            openResult: true,
            scripts: {
                ProtoOAApplicationAuthReq: {},
                ProtoOAAccountAuthReq: {},
                ProtoOASymbolsListReq: symbolsListResponse(pairs),
                ProtoOASubscribeSpotsReq: () => {
                    spotsAttempts += 1;
                    // First attempt rate-limits; subsequent attempts succeed.
                    if (spotsAttempts === 1) return Promise.reject(errorRejection('CH_SPEED_OVERLIMIT'));
                    return {};
                },
                ProtoOASubscribeLiveTrendbarReq: {},
            },
        });

        session.activeSubscriptions = new Set(['EURUSD', 'GBPUSD']);
        session.activeBarSubscriptions = new Map();

        await session.connect(fake);
        if (session.restorePromise) await session.restorePromise;
        await new Promise((r) => setImmediate(r));

        // The rate-limit set _rateLimited=true for one command, but the next
        // SUCCESS cleared it. By end of restore the flag must be false again
        // (not sticky for the whole pass).
        expect(session._rateLimited).toBe(false);
    });
});
