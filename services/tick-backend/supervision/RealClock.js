/**
 * RealClock — production Clock implementation that delegates to the global
 * timer/clock APIs. FeedSupervisor schedules ALL timers through an injected
 * Clock so recovery is deterministic under FakeClock in tests; in production
 * this is the clock that's injected.
 */
class RealClock {
    setTimeout(fn, ms = 0) {
        return setTimeout(fn, ms);
    }

    clearTimeout(timer) {
        return clearTimeout(timer);
    }

    now() {
        return Date.now();
    }
}

module.exports = { RealClock };
