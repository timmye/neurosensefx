const EventEmitter = require('events');

/**
 * FeedStates — the legal lifecycle states for a supervised feed.
 * There is intentionally NO terminal DEAD state: "give up forever" was the bug.
 * Every state has a path back to CONNECTING (see LEGAL_TRANSITIONS proof below).
 */
const FeedStates = {
    DISCONNECTED: 'DISCONNECTED',
    CONNECTING: 'CONNECTING',
    HANDSHAKING: 'HANDSHAKING',
    CONNECTED: 'CONNECTED',
    DEGRADED: 'DEGRADED',
    BACKOFF: 'BACKOFF',
};

/**
 * Legal transitions. Anything not listed here is rejected by `transition()`.
 *
 * No-dead-end proof (every state ⇒ CONNECTING):
 *   DISCONNECTED → CONNECTING
 *   CONNECTING   → (itself, or HANDSHAKING/BACKOFF/DISCONNECTED, all ⇒ … → CONNECTING)
 *   HANDSHAKING  → BACKOFF → CONNECTING  (or → CONNECTED → BACKOFF → CONNECTING)
 *   CONNECTED    → BACKOFF → CONNECTING  (or → DISCONNECTED → CONNECTING)
 *   DEGRADED     → BACKOFF → CONNECTING  (or → CONNECTED → BACKOFF → CONNECTING)
 *   BACKOFF      → CONNECTING
 */
const LEGAL_TRANSITIONS = {
    DISCONNECTED: [FeedStates.CONNECTING],
    CONNECTING: [FeedStates.HANDSHAKING, FeedStates.BACKOFF, FeedStates.DISCONNECTED],
    HANDSHAKING: [FeedStates.CONNECTED, FeedStates.BACKOFF, FeedStates.DISCONNECTED],
    CONNECTED: [FeedStates.DEGRADED, FeedStates.BACKOFF, FeedStates.DISCONNECTED],
    DEGRADED: [FeedStates.CONNECTED, FeedStates.BACKOFF, FeedStates.DISCONNECTED],
    BACKOFF: [FeedStates.CONNECTING],
};

/**
 * FeedState — an explicit, validated state machine for one feed's lifecycle.
 *
 * The `HANDSHAKING → BACKOFF` transition is the fix-path for hang-after-open
 * (defect #4): today authenticate/loadAllSymbols/restoreSubscriptions have no
 * timeout and can hang the whole connect forever. The FeedSupervisor detects
 * "HANDSHAKING held past its deadline" by comparing `since` to the injected
 * clock and calls `transition('BACKOFF')`; FeedState just records and validates.
 */
class FeedState extends EventEmitter {
    /**
     * @param {Object} [opts]
     * @param {Function} [opts.now] - Injectable clock (`() => ms`). Default `Date.now`.
     * @param {string} [opts.initial] - Starting state. Default DISCONNECTED.
     */
    constructor({ now = () => Date.now(), initial = FeedStates.DISCONNECTED } = {}) {
        super();
        this._now = now;
        this.current = initial;
        this.since = this._now();
    }

    /**
     * Whether a transition to `to` is legal from the current state.
     * @param {string} to
     * @returns {boolean}
     */
    canTransition(to) {
        const allowed = LEGAL_TRANSITIONS[this.current] || [];
        return allowed.includes(to);
    }

    /**
     * Move to `to`. Throws on unknown or illegal transitions. Records `since`.
     * Emits `'transition' { from, to, since }`.
     * @param {string} to
     * @returns {FeedState} this
     */
    transition(to) {
        if (!FeedStates[to]) {
            throw new Error(`FeedState: unknown state "${to}"`);
        }
        if (!this.canTransition(to)) {
            throw new Error(`FeedState: illegal transition ${this.current} → ${to}`);
        }
        const from = this.current;
        this.current = to;
        this.since = this._now();
        this.emit('transition', { from, to, since: this.since });
        return this;
    }
}

module.exports = { FeedState, FeedStates };
