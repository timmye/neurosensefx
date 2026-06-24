'use strict';

/**
 * Feed loop stabilization — Phase 2.2 supervisor DEGRADED gate (Loop-B / Known
 * Risk #1, the critical part).
 *
 * 'connected' now emits BEFORE data flows, so during the restore window
 * heartbeats flow (fresh) but no data ticks arrive → HealthSensor goes DEGRADED
 * after dataStaleMs. Without the gate, _reactToHealth would force-reconnect
 * mid-restore → re-enter the reconnect loop. The additive `restoreActive` hook
 * holds DEGRADED during restore (no force-reconnect) while STALE still forces
 * one (genuinely dead = both clocks stale).
 *
 * Uses a scriptable feed that emits the restore lifecycle events the supervisor
 * now listens for, with FakeTransport + FakeClock (same patterns as recovery.test.js).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
const { FeedSupervisor } = require('../../supervision/FeedSupervisor');
const { FeedStates } = require('../../supervision/FeedState');
const { RetryPolicy } = require('../../supervision/RetryPolicy');
const { HealthSensor } = require('../../supervision/HealthSensor');
const { FakeClock } = require('../fakes/FakeClock');
const { FakeTransport } = require('../fakes/FakeTransport');

const EventEmitter = require('events');

/**
 * A feed that emits 'connected' on connect and supports an explicit restore
 * lifecycle (restoreStart → ... → restoreComplete) plus tick/heartbeat emits.
 * Models the Phase-2.2 CTraderSession: 'connected' fires immediately, restore
 * runs as a background task the test controls via completeRestore().
 */
class RestoreAwareFeed extends EventEmitter {
    constructor() {
        super();
        this.connectAttempts = 0;
        this.restoreActive = false;
        this._restoreTimer = null;
    }

    async connect(transport) {
        this.connectAttempts += 1;
        this.lastTransport = transport;
        this.emit('connected');
        // Simulate a restore that starts immediately and stays "in flight" until
        // completeRestore() is called. restoreActive is true for the whole window.
        this.beginRestore();
    }

    beginRestore() {
        if (this.restoreActive) return;
        this.restoreActive = true;
        this.emit('restoreStart');
    }

    completeRestore() {
        if (!this.restoreActive) return;
        this.restoreActive = false;
        this.emit('restoreComplete');
    }

    // Feed contract stubs (supervisor may call these).
    async stop() {}
    disconnect() { this.emit('disconnected'); }
}

function fastRetry() {
    return new RetryPolicy({ initialDelay: 50, maxDelay: 200, factor: 2, jitter: 0, random: () => 0 });
}

function stateOf(sup, name) {
    return sup.observableState().find((s) => s.feed === name);
}

describe('Phase 2.2 — DEGRADED-during-restore gate', () => {
    let clock, sup;

    beforeEach(() => {
        clock = new FakeClock();
        sup = new FeedSupervisor({ clock });
    });

    afterEach(() => {
        sup.stop();
    });

    // 3a. While restoreActive, DEGRADED does NOT force a reconnect.
    it('does NOT force-reconnect on DEGRADED while restore is active', async () => {
        const feed = new RestoreAwareFeed();
        sup.register({
            name: 'gated',
            feed,
            transportFactory: () => new FakeTransport({ openFailures: 0 }),
            retry: fastRetry(),
            connectTimeoutMs: 1000,
            healthPollMs: 200,
            healthSensor: new HealthSensor({
                dataStaleMs: 1000,
                heartbeatStaleMs: 5000, // heartbeats stay fresh → DEGRADED, not STALE
                now: () => clock.now(),
            }),
        });

        sup.start();
        await clock.advance(300); // reaches CONNECTED; restore started (restoreActive=true)
        expect(stateOf(sup, 'gated').state).toBe(FeedStates.CONNECTED);
        expect(feed.connectAttempts).toBe(1);

        // Data stops (no tick), but heartbeats keep flowing. Advance past
        // dataStaleMs so the next health poll computes DEGRADED.
        feed.emit('heartbeat');
        await clock.advance(1200); // lastDataTick aged out, heartbeat fresh → DEGRADED
        feed.emit('heartbeat');

        // Even after a poll sees DEGRADED, restore is still active → NO reconnect.
        await clock.advance(400);

        // Still on the SAME connect attempt: DEGRADED was held, not force-reconnected.
        expect(feed.connectAttempts).toBe(1);
        // The feed may be in DEGRADED state (held) but NOT force-reconnected.
        expect([FeedStates.CONNECTED, FeedStates.DEGRADED]).toContain(stateOf(sup, 'gated').state);

        // Restore completes → restoreActive flips false. BEFORE the next health
        // poll, emit a data tick so the sensor reads HEALTHY (not DEGRADED) —
        // otherwise the first post-restore poll would force-reconnect.
        feed.completeRestore();
        feed.emit('tick'); // data flows again → dataFresh → HEALTHY
        await clock.advance(600);
        expect(stateOf(sup, 'gated').state).toBe(FeedStates.CONNECTED);
        expect(feed.connectAttempts).toBe(1); // never reconnected
    });

    // 3b. After restoreComplete, DEGRADED DOES force a reconnect (gate cleared).
    it('force-reconnects on DEGRADED AFTER restore completes (gate cleared)', async () => {
        const feed = new RestoreAwareFeed();
        sup.register({
            name: 'post',
            feed,
            transportFactory: () => new FakeTransport({ openFailures: 0 }),
            retry: fastRetry(),
            connectTimeoutMs: 1000,
            healthPollMs: 200,
            healthSensor: new HealthSensor({
                dataStaleMs: 1000,
                heartbeatStaleMs: 5000,
                now: () => clock.now(),
            }),
        });

        sup.start();
        await clock.advance(300);
        expect(stateOf(sup, 'post').state).toBe(FeedStates.CONNECTED);

        // Complete restore up front so the gate is NOT active.
        feed.completeRestore();
        await clock.advance(200);

        // Now data stops while heartbeats flow → DEGRADED → force reconnect.
        feed.emit('heartbeat');
        await clock.advance(1200);
        feed.emit('heartbeat');
        await clock.advance(600);

        // Reconnected (attempt > 1).
        expect(feed.connectAttempts).toBeGreaterThan(1);
        // The reconnect re-arms restore; complete it + emit a tick so the feed
        // returns to CONNECTED (HEALTHY) rather than holding DEGRADED.
        feed.completeRestore();
        feed.emit('tick');
        await clock.advance(600);
        expect(stateOf(sup, 'post').state).toBe(FeedStates.CONNECTED);
    });

    // 3c. STALE always forces a reconnect EVEN during restore (genuinely dead).
    it('force-reconnects on STALE even while restore is active', async () => {
        const feed = new RestoreAwareFeed();
        sup.register({
            name: 'stale',
            feed,
            transportFactory: () => new FakeTransport({ openFailures: 0 }),
            retry: fastRetry(),
            connectTimeoutMs: 1000,
            healthPollMs: 200,
            healthSensor: new HealthSensor({
                dataStaleMs: 1000,
                heartbeatStaleMs: 1000,
                now: () => clock.now(),
            }),
        });

        sup.start();
        await clock.advance(300);
        expect(stateOf(sup, 'stale').state).toBe(FeedStates.CONNECTED);
        // restore is still active here (we never call completeRestore).

        // Emit NOTHING — both data and heartbeat age out → STALE.
        await clock.advance(1300); // past both stale thresholds
        await clock.advance(600);

        // STALE forces a reconnect even though restoreActive is true.
        expect(feed.connectAttempts).toBeGreaterThan(1);
        await clock.advance(1000);
        expect(stateOf(sup, 'stale').state).toBe(FeedStates.CONNECTED);
    });

    // FIX B2: a mid-restore disconnect resets restoreActive so a later DEGRADED
    // observation can still force a reconnect (the gate doesn't latch open).
    it('resets restoreActive on a mid-restore disconnect', async () => {
        const feed = new RestoreAwareFeed();
        sup.register({
            name: 'reset',
            feed,
            transportFactory: () => new FakeTransport({ openFailures: 0 }),
            retry: fastRetry(),
            connectTimeoutMs: 1000,
            healthPollMs: 200,
            healthSensor: new HealthSensor({
                dataStaleMs: 1000,
                heartbeatStaleMs: 5000,
                now: () => clock.now(),
            }),
        });

        sup.start();
        await clock.advance(300); // CONNECTED, restore started
        const handle = sup.handles.get('reset');
        // The supervisor latched restoreActive=true from the feed's restoreStart.
        expect(handle.restoreActive).toBe(true);

        // The feed disconnects mid-restore (before 'restoreComplete' ever fires).
        feed.emit('disconnected');

        // FIX B2: the supervisor's restoreActive must flip false on disconnect —
        // cleared by the disconnect listener, not waiting for a 'restoreComplete'
        // that never comes. This is what unblocks a later DEGRADED force-reconnect.
        expect(handle.restoreActive).toBe(false);
    });
});
