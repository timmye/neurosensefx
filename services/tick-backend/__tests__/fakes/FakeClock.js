'use strict';

/**
 * FakeClock — a deterministic Clock for FeedSupervisor tests.
 *
 * It OWNS timer scheduling: FeedSupervisor calls `clock.setTimeout(fn, ms)`
 * and the FakeClock holds those timers in a priority queue, firing them in
 * time/id order only when `advance(ms)` moves the virtual clock forward. No
 * real timers run.
 *
 * Async-aware: `advance` awaits each timer's callback (which may be async,
 * e.g. a reconnect attempt that opens a transport) and drains the microtask
 * queue between firings, so detached async continuations (e.g. a deadline
 * rejecting an in-flight connect race) settle before we look for the next
 * due timer. This makes the supervisor's async connect/recover chain fully
 * observable after `await clock.advance(ms)`.
 */
class FakeClock {
    constructor() {
        this._t = 0;
        this._timers = [];
        this._nextId = 1;
        this._lastError = null;
    }

    now() {
        return this._t;
    }

    setTimeout(fn, ms = 0) {
        const timer = { id: this._nextId++, time: this._t + (ms || 0), fn, cancelled: false };
        this._timers.push(timer);
        return timer;
    }

    clearTimeout(timer) {
        if (timer) timer.cancelled = true;
        return undefined;
    }

    /** Number of armed (non-cancelled) timers — handy for assertions. */
    get pendingCount() {
        return this._timers.filter((t) => !t.cancelled).length;
    }

    /** Drain the microtask queue a bounded number of times. */
    async _flush() {
        for (let i = 0; i < 200; i++) await Promise.resolve();
    }

    /**
     * Advance virtual time by `ms`, firing every timer due within the window in
     * time/id order. Re-scheduled timers (a fired callback that calls
     * setTimeout) are picked up on the next loop iteration if still within the
     * window. Returns when no more timers are due before the target time.
     * @param {number} ms
     */
    async advance(ms) {
        const target = this._t + ms;
        let guard = 0;
        while (guard++ < 1000000) {
            await this._flush();
            const due = this._timers
                .filter((t) => !t.cancelled && t.time <= target)
                .sort((a, b) => a.time - b.time || a.id - b.id);
            if (due.length === 0) break;
            const next = due[0];
            this._t = next.time;
            this._timers = this._timers.filter((t) => t !== next);
            if (!next.cancelled) {
                try {
                    await next.fn();
                } catch (e) {
                    this._lastError = e;
                }
            }
        }
        this._t = target;
    }

    /** Fire all currently-armed timers (regardless of due time), draining async. */
    async runAll() {
        while (this.pendingCount > 0) {
            await this._flush();
            const armed = this._timers
                .filter((t) => !t.cancelled)
                .sort((a, b) => a.time - b.time || a.id - b.id);
            if (armed.length === 0) break;
            const next = armed[0];
            this._t = next.time;
            this._timers = this._timers.filter((t) => t !== next);
            if (!next.cancelled) {
                try {
                    await next.fn();
                } catch (e) {
                    this._lastError = e;
                }
            }
        }
    }
}

module.exports = { FakeClock };
