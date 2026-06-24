import { describe, it, expect, beforeEach } from 'vitest';
const { FeedSupervisor } = require('../../supervision/FeedSupervisor');
const { FeedStates } = require('../../supervision/FeedState');
const { RetryPolicy } = require('../../supervision/RetryPolicy');
const { FakeClock } = require('../fakes/FakeClock');
const { FakeTransport } = require('../fakes/FakeTransport');
const { FakeFeed } = require('../fakes/FakeFeed');

// Deterministic, fast retry policy for tests.
function fastRetry() {
    return new RetryPolicy({ initialDelay: 100, maxDelay: 1000, factor: 2, jitter: 0, random: () => 0 });
}

function stateOf(sup, name) {
    return sup.observableState().find((s) => s.feed === name);
}

describe('FeedSupervisor (B3)', () => {
    let clock, sup;
    beforeEach(() => {
        clock = new FakeClock();
        sup = new FeedSupervisor({ clock });
    });

    // 1. Self-heal: fail to open 20× then succeed → CONNECTED; attempts reset.
    it('recovers to CONNECTED after a burst of open failures, resetting attempts', async () => {
        let count = 0;
        sup.register({
            name: 'ctrader',
            feed: new FakeFeed(),
            // First 20 transports fail open; the 21st opens successfully.
            transportFactory: () => { count += 1; return new FakeTransport({ openFailures: count <= 20 ? 1 : 0 }); },
            retry: fastRetry(),
            connectTimeoutMs: 5000,
            healthPollMs: 1000,
        });

        sup.start();
        await clock.advance(60000);

        const st = stateOf(sup, 'ctrader');
        expect(st.state).toBe(FeedStates.CONNECTED);
        expect(st.attempts).toBe(0);
    });

    // 2. reset(feed) returns a feed in BACKOFF to CONNECTING regardless of attempts.
    it('reset() zeroes attempts and forces CONNECTING from BACKOFF', async () => {
        sup.register({
            name: 'a',
            feed: new FakeFeed(),
            transportFactory: () => new FakeTransport({ openFailures: 1 }), // never opens
            retry: fastRetry(),
            connectTimeoutMs: 5000,
            healthPollMs: 1000,
        });

        sup.start();
        await clock.advance(30000);
        // After many failures: attempts climbed, state somewhere in the retry loop.
        const before = stateOf(sup, 'a');
        expect(before.attempts).toBeGreaterThan(0);

        sup.reset('a');
        // reset() is synchronous: state forced to CONNECTING, attempts zeroed,
        // before the async reconnect microtask runs.
        const after = stateOf(sup, 'a');
        expect(after.attempts).toBe(0);
        expect(after.state).toBe(FeedStates.CONNECTING);
    });

    // 3. Per-feed isolation: A stuck retrying does not block B reaching CONNECTED.
    it('isolates feeds: a perpetually-failing feed does not block another', async () => {
        sup.register({
            name: 'stuck',
            feed: new FakeFeed(),
            transportFactory: () => new FakeTransport({ openFailures: 1 }), // always fails
            retry: fastRetry(),
            connectTimeoutMs: 5000,
            healthPollMs: 1000,
        });
        sup.register({
            name: 'good',
            feed: new FakeFeed(),
            transportFactory: () => new FakeTransport({ openFailures: 0 }), // opens first try
            retry: fastRetry(),
            connectTimeoutMs: 5000,
            healthPollMs: 1000,
        });

        sup.start();
        await clock.advance(2000);

        expect(stateOf(sup, 'good').state).toBe(FeedStates.CONNECTED);
        expect([FeedStates.BACKOFF, FeedStates.CONNECTING]).toContain(stateOf(sup, 'stuck').state);
    });

    // 4. ObservableState transitions are emitted and accurate.
    it('emits accurate state transitions', async () => {
        const events = [];
        sup.on('state', (e) => events.push({ ...e }));
        sup.register({
            name: 'x',
            feed: new FakeFeed(),
            transportFactory: () => new FakeTransport({ openFailures: 0 }),
            retry: fastRetry(),
            connectTimeoutMs: 5000,
            healthPollMs: 1000,
        });

        sup.start();
        await clock.advance(2000);

        const connected = events.find((e) => e.feed === 'x' && e.state === FeedStates.CONNECTED);
        expect(connected).toBeDefined();
        expect(connected.attempts).toBe(0);
        expect(typeof connected.since).toBe('number');

        // CONNECTING/CONNECTED both emitted in order.
        const states = events.filter((e) => e.feed === 'x').map((e) => e.state);
        expect(states.indexOf(FeedStates.CONNECTING)).toBeLessThan(states.indexOf(FeedStates.CONNECTED));
    });

    // 5. Hang-after-open (#4): opens but never handshakes → deadline → reconnect → CONNECTED.
    it('times out of HANDSHAKING and recovers when auth never arrives', async () => {
        sup.register({
            name: 'hang',
            feed: new FakeFeed({ hangAttempts: 1 }), // attempt 1 hangs, attempt 2 succeeds
            transportFactory: () => new FakeTransport({ openFailures: 0 }), // open always succeeds
            retry: fastRetry(),
            connectTimeoutMs: 1000, // deadline that rescues the hung handshake
            healthPollMs: 1000,
        });

        sup.start();
        await clock.advance(5000);

        const st = stateOf(sup, 'hang');
        expect(st.state).toBe(FeedStates.CONNECTED);
        expect(st.attempts).toBe(0);
    });

    // 6. (bonus) resetAll recovers every feed.
    it('resetAll() forces reconnect of all feeds', async () => {
        let succeed = false;
        const factory = () => new FakeTransport({ openFailures: succeed ? 0 : 1 });
        sup.register({
            name: 'a', feed: new FakeFeed(), transportFactory: factory,
            retry: fastRetry(), connectTimeoutMs: 5000, healthPollMs: 1000,
        });
        sup.register({
            name: 'b', feed: new FakeFeed(), transportFactory: factory,
            retry: fastRetry(), connectTimeoutMs: 5000, healthPollMs: 1000,
        });

        sup.start();
        await clock.advance(5000); // both fail repeatedly → BACKOFF, attempts climbing
        expect(stateOf(sup, 'a').attempts).toBeGreaterThan(0);
        expect([FeedStates.BACKOFF, FeedStates.CONNECTING]).toContain(stateOf(sup, 'a').state);

        // Flip transports to succeed, then force a reconnect of everything.
        succeed = true;
        sup.resetAll();
        await clock.advance(5000);

        expect(stateOf(sup, 'a').state).toBe(FeedStates.CONNECTED);
        expect(stateOf(sup, 'b').state).toBe(FeedStates.CONNECTED);
    });
});
