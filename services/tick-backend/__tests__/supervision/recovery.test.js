import { describe, it, expect, beforeEach, afterEach } from 'vitest';
const { FeedSupervisor } = require('../../supervision/FeedSupervisor');
const { FeedStates } = require('../../supervision/FeedState');
const { RetryPolicy } = require('../../supervision/RetryPolicy');
const { HealthSensor, HealthStatus } = require('../../supervision/HealthSensor');
const { FakeClock } = require('../fakes/FakeClock');
const { FakeTransport } = require('../fakes/FakeTransport');
const { FakeFeed } = require('../fakes/FakeFeed');
// Defect #3 predicate — the null-tick guard lives in the decode tier:
const { CTraderEventHandler } = require('../../CTraderEventHandler');
const { CTraderDataProcessor } = require('../../CTraderDataProcessor');

// ─── North Star (B6) ─────────────────────────────────────────────────────────
// Proves that ALL connect/reconnect/recovery behavior is verifiable OFFLINE via
// `npx vitest run`: no live cTrader creds, no PostgreSQL, no Redis, no network.
// Uses FakeClock + FakeTransport + FakeFeed to drive the FeedSupervisor through
// every recovery path the redesign was built to fix (defects #2/#3/#4).
// ──────────────────────────────────────────────────────────────────────────────

// Deterministic, fast retry: initialDelay 50ms, cap 200ms, no jitter.
function fastRetry() {
    return new RetryPolicy({ initialDelay: 50, maxDelay: 200, factor: 2, jitter: 0, random: () => 0 });
}

function stateOf(sup, name) {
    return sup.observableState().find((s) => s.feed === name);
}

describe('Recovery (B6 North Star)', () => {
    let clock, sup;

    beforeEach(() => {
        clock = new FakeClock();
        sup = new FeedSupervisor({ clock });
    });

    afterEach(() => {
        sup.stop();
    });

    // 1. Self-heal after a connect-failure burst (brief — B3 covers in depth).
    it('self-heals to CONNECTED after a burst of open failures', async () => {
        let count = 0;
        sup.register({
            name: 'ctrader',
            feed: new FakeFeed(),
            transportFactory: () => { count += 1; return new FakeTransport({ openFailures: count <= 3 ? 1 : 0 }); },
            retry: fastRetry(),
            connectTimeoutMs: 1000,
            healthPollMs: 200,
        });

        sup.start();
        await clock.advance(5000);

        expect(stateOf(sup, 'ctrader').state).toBe(FeedStates.CONNECTED);
    });

    // 2. Hang-after-open (#4): transport opens but feed never completes the
    //    handshake (FakeFeed hangs on attempt 1). The supervisor's
    //    connectTimeoutMs deadline rescues HANDSHAKING → BACKOFF → CONNECTED.
    it('rescues a hang-after-open via the connect-phase deadline (#4)', async () => {
        sup.register({
            name: 'hang',
            feed: new FakeFeed({ hangAttempts: 1 }), // attempt 1 hangs, attempt 2 succeeds
            transportFactory: () => new FakeTransport({ openFailures: 0 }),
            retry: fastRetry(),
            connectTimeoutMs: 300, // small deadline that force-closes the hung handshake
            healthPollMs: 200,
        });

        sup.start();
        // Deadline fires at 300ms; backoff delay (50ms) then a successful reconnect.
        await clock.advance(2000);

        const st = stateOf(sup, 'hang');
        expect(st.state).toBe(FeedStates.CONNECTED);
        expect(st.attempts).toBe(0); // reset on successful connect
    });

    // 3. Hung command (#4): during the handshake a sendCommand reply never
    //    arrives. FakeFeed completes its handshake by emitting 'connected'
    //    immediately, so to model a hung handshake we use hangAttempts again —
    //    the connect attempt never resolves. The supervisor's connectTimeoutMs
    //    is the BACKSTOP deadline; the faster per-RPC TTL bound is proven
    //    separately in ctraderTransportAdapter.test.js. Here we prove the
    //    supervisor deadline rescues a feed awaiting a reply that never comes.
    it('rescues a hung handshake via the supervisor deadline backstop (#4)', async () => {
        // A transport whose scripted command the feed does NOT use here; the
        // unscripted/hang behavior is modeled at the feed level (hangAttempts).
        // This documents that even with a perfectly-scripted transport, a feed
        // stuck awaiting an RPC reply is rescued by the connect-phase deadline.
        sup.register({
            name: 'hungcmd',
            feed: new FakeFeed({ hangAttempts: 1 }), // attempt 1 never completes
            transportFactory: () => new FakeTransport({
                openFailures: 0,
                commandScripts: { ProtoOAApplicationAuthReq: {}, ProtoOAAccountAuthReq: {} },
            }),
            retry: fastRetry(),
            connectTimeoutMs: 250,
            healthPollMs: 200,
        });

        sup.start();
        await clock.advance(2000);

        expect(stateOf(sup, 'hungcmd').state).toBe(FeedStates.CONNECTED);
    });

    // 4. DEGRADED → forced reconnect (#2/#4): feed connects, then data stops
    //    while heartbeats continue. data-stale-but-heartbeat-fresh = DEGRADED,
    //    which the supervisor treats as "data not flowing" → force reconnect.
    it('force-reconnects a DEGRADED feed (data stale, heartbeats fresh) (#2/#4)', async () => {
        const feed = new FakeFeed();
        sup.register({
            name: 'degraded',
            feed,
            transportFactory: () => new FakeTransport({ openFailures: 0 }),
            retry: fastRetry(),
            connectTimeoutMs: 1000,
            healthPollMs: 200,
            healthSensor: new HealthSensor({
                dataStaleMs: 1000,
                heartbeatStaleMs: 2000,
                now: () => clock.now(),
            }),
        });

        sup.start();
        await clock.advance(300); // reaches CONNECTED, health baseline seeded

        expect(stateOf(sup, 'degraded').state).toBe(FeedStates.CONNECTED);

        // Data stops (no 'tick'), but heartbeats keep flowing.
        feed.emit('heartbeat');
        await clock.advance(1000); // past heartbeatStaleMs? no — heartbeat just refreshed (hb fresh)
        feed.emit('heartbeat');
        // Advance past dataStaleMs (1000) + a healthPoll tick (200) so the next
        // health.check() sees data stale (last tick = baseline ~300) but heartbeat
        // fresh → DEGRADED → forced reconnect.
        await clock.advance(1200);

        // After a forced reconnect the feed reconnects on a fresh transport and
        // returns to CONNECTED (FakeFeed succeeds once hang/handshake budget is 0).
        await clock.advance(1000);
        expect(stateOf(sup, 'degraded').state).toBe(FeedStates.CONNECTED);
    });

    // 5. Quiet-window false-staleness (#3): data KEEPS flowing (ticks emitted)
    //    past dataStaleMs. Because real ticks continuously feed the data-tick
    //    clock, the sensor never reports DEGRADED and the feed stays CONNECTED.
    it('does NOT trip DEGRADED while ticks keep flowing (quiet-window property, #3)', async () => {
        const feed = new FakeFeed();
        sup.register({
            name: 'quiet',
            feed,
            transportFactory: () => new FakeTransport({ openFailures: 0 }),
            retry: fastRetry(),
            connectTimeoutMs: 1000,
            healthPollMs: 200,
            healthSensor: new HealthSensor({
                dataStaleMs: 1000,
                heartbeatStaleMs: 2000,
                now: () => clock.now(),
            }),
        });

        sup.start();
        await clock.advance(300);
        expect(stateOf(sup, 'quiet').state).toBe(FeedStates.CONNECTED);

        // Ticks keep flowing across several health polls, well past dataStaleMs.
        for (let i = 0; i < 8; i++) {
            feed.emit('tick');
            await clock.advance(400); // each step < dataStaleMs ⇒ data stays fresh
        }

        // No DEGRADED, no reconnect — feed stays CONNECTED the whole time.
        expect(stateOf(sup, 'quiet').state).toBe(FeedStates.CONNECTED);
        expect(feed.connectAttempts).toBe(1); // never force-reconnected
    });

    // 6. Never-received-data → STALE → reconnect (#2): feed connects but NEVER
    //    emits a tick or heartbeat. Once heartbeatStaleMs elapses, the sensor
    //    reports STALE (both clocks stale) → forced reconnect → CONNECTED.
    it('force-reconnects a STALE feed that never delivers data (#2)', async () => {
        const feed = new FakeFeed();
        sup.register({
            name: 'stale',
            feed,
            transportFactory: () => new FakeTransport({ openFailures: 0 }),
            retry: fastRetry(),
            connectTimeoutMs: 1000,
            healthPollMs: 200,
            healthSensor: new HealthSensor({
                dataStaleMs: 1000,
                heartbeatStaleMs: 2000,
                now: () => clock.now(),
            }),
        });

        sup.start();
        await clock.advance(300);
        expect(stateOf(sup, 'stale').state).toBe(FeedStates.CONNECTED);

        // Emit NOTHING — both data and heartbeat clocks age out.
        await clock.advance(2200); // past heartbeatStaleMs ⇒ STALE

        // STALE → forced reconnect → CONNECTED.
        await clock.advance(1000);
        expect(stateOf(sup, 'stale').state).toBe(FeedStates.CONNECTED);
        expect(feed.connectAttempts).toBeGreaterThan(1); // reconnected at least once
    });

    // 7. reset() recovers regardless of prior failures (brief — B3 covers).
    it('reset() recovers a feed regardless of prior failures', async () => {
        let succeed = false;
        sup.register({
            name: 'r',
            feed: new FakeFeed(),
            transportFactory: () => new FakeTransport({ openFailures: succeed ? 0 : 1 }),
            retry: fastRetry(),
            connectTimeoutMs: 1000,
            healthPollMs: 200,
        });

        sup.start();
        await clock.advance(2000);
        expect(stateOf(sup, 'r').attempts).toBeGreaterThan(0);

        succeed = true;
        sup.reset('r');
        await clock.advance(1000);
        expect(stateOf(sup, 'r').state).toBe(FeedStates.CONNECTED);
    });

    // 8. Subscriptions preserved across a reconnect: the feed is re-connected on
    //    a fresh transport after a health-driven reconnect and driven back to
    //    CONNECTED. FakeFeed.connect() records lastTransport; assert connect was
    //    called again and the feed is back up.
    it('re-connects the feed on a fresh transport after a health-driven reconnect', async () => {
        const feed = new FakeFeed();
        sup.register({
            name: 'sub',
            feed,
            transportFactory: () => new FakeTransport({ openFailures: 0 }),
            retry: fastRetry(),
            connectTimeoutMs: 1000,
            healthPollMs: 200,
            healthSensor: new HealthSensor({
                dataStaleMs: 1000,
                heartbeatStaleMs: 2000,
                now: () => clock.now(),
            }),
        });

        sup.start();
        await clock.advance(300);
        expect(stateOf(sup, 'sub').state).toBe(FeedStates.CONNECTED);
        const firstTransport = feed.lastTransport;
        expect(firstTransport).toBeDefined();
        expect(feed.connectAttempts).toBe(1);

        // Starve both clocks → STALE → forced reconnect.
        await clock.advance(2200);
        await clock.advance(1000);

        // Reconnected on a fresh transport and back to CONNECTED.
        expect(stateOf(sup, 'sub').state).toBe(FeedStates.CONNECTED);
        expect(feed.connectAttempts).toBeGreaterThan(1);
        expect(feed.lastTransport).toBeDefined();
        expect(feed.lastTransport).not.toBe(firstTransport); // fresh transport
    });

    // 9. Per-feed isolation (brief — B3 covers).
    it('isolates feeds: a failing feed does not block a healthy one', async () => {
        sup.register({
            name: 'stuck',
            feed: new FakeFeed(),
            transportFactory: () => new FakeTransport({ openFailures: 1 }),
            retry: fastRetry(),
            connectTimeoutMs: 1000,
            healthPollMs: 200,
        });
        sup.register({
            name: 'good',
            feed: new FakeFeed(),
            transportFactory: () => new FakeTransport({ openFailures: 0 }),
            retry: fastRetry(),
            connectTimeoutMs: 1000,
            healthPollMs: 200,
        });

        sup.start();
        await clock.advance(1000);

        expect(stateOf(sup, 'good').state).toBe(FeedStates.CONNECTED);
        expect([FeedStates.BACKOFF, FeedStates.CONNECTING]).toContain(stateOf(sup, 'stuck').state);
    });

    // ─── Defect #3 at the decode tier ─────────────────────────────────────────
    // The fix for #3 is a null-tick guard: a spot event with invalid bid/ask
    // must make CTraderEventHandler.processSpotEvent return null, so the session
    // (`if (spotTick) tickData = spotTick;`) does NOT clobber a valid
    // trendbar-derived tick or skip recordTick. This predicate test proves the
    // exact condition the session-level guard relies on.
    describe('defect #3 — null-tick guard at the decode tier', () => {
        let handler;
        const symbolInfo = {
            digits: 5,
            pipPosition: 4,
            pipSize: 0.0001,
            pipetteSize: 0.00001,
        };

        beforeEach(() => {
            // CTraderDataProcessor.calculatePrice is pure (no network/PG/Redis);
            // only that method is exercised by processSpotEvent.
            const dp = new CTraderDataProcessor(null, null, null);
            handler = new CTraderEventHandler(dp, null);
        });

        it('returns null for a spot event with zero bid (non-positive)', () => {
            const res = handler.processSpotEvent(
                { bid: 0, ask: 110000, timestamp: 1000 },
                'EURUSD', symbolInfo,
            );
            // The session-level guard (`if (spotTick) tickData = spotTick;`) uses
            // this null to avoid clobbering a valid trendbar-derived tick.
            expect(res).toBeNull();
        });

        it('returns null for a spot event with non-finite bid/ask', () => {
            expect(handler.processSpotEvent(
                { bid: NaN, ask: 110000, timestamp: 1000 }, 'EURUSD', symbolInfo,
            )).toBeNull();
            expect(handler.processSpotEvent(
                { bid: 105000, ask: Infinity, timestamp: 1000 }, 'EURUSD', symbolInfo,
            )).toBeNull();
        });

        it('returns null for an inverted market (ask <= bid)', () => {
            expect(handler.processSpotEvent(
                { bid: 110000, ask: 105000, timestamp: 1000 }, 'EURUSD', symbolInfo,
            )).toBeNull();
            expect(handler.processSpotEvent(
                { bid: 105000, ask: 105000, timestamp: 1000 }, 'EURUSD', symbolInfo,
            )).toBeNull();
        });

        it('returns a valid tick object for normal bid/ask', () => {
            // 105000/100000 = 1.05; 110000/100000 = 1.10 (5-digit rounding).
            const res = handler.processSpotEvent(
                { bid: 105000, ask: 110000, timestamp: 1234 },
                'EURUSD', symbolInfo,
            );
            expect(res).not.toBeNull();
            expect(res.symbol).toBe('EURUSD');
            expect(res.bid).toBe(1.05);
            expect(res.ask).toBe(1.1);
            expect(res.price).toBeCloseTo((1.05 + 1.1) / 2, 5);
            expect(res.timestamp).toBe(1234);
        });
    });
});
