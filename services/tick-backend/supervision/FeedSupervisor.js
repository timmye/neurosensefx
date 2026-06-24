const EventEmitter = require('events');
const { FeedState, FeedStates } = require('./FeedState');
const { HealthSensor, HealthStatus } = require('./HealthSensor');
const { RetryPolicy } = require('./RetryPolicy');
const { createLogger } = require('../utils/Logger');
const log = createLogger('FeedSupervisor');

const DEFAULTS = {
    connectTimeoutMs: 15000, // CONNECTING + HANDSHAKING deadline (fixes hang-after-open, #4)
    healthPollMs: 5000,
    retry: { initialDelay: 500, maxDelay: 15000, factor: 2, jitter: 0.3 },
    health: { dataStaleMs: 60000, heartbeatStaleMs: 30000 },
};

/**
 * FeedSupervisor — the missing supervision tier.
 *
 * Owns the connection lifecycle for N feeds. Each feed is a FeedHandle
 * { name, feed, transportFactory, state, retry, health, attempts } driven by an
 * explicit FeedState machine. The supervisor applies RetryPolicy (NEVER gives
 * up), observes HealthSensor, and emits ObservableState for /health.
 *
 * Everything is scheduled through the injected `clock` so recovery is
 * deterministic and unit-testable offline (FakeClock + FakeTransport).
 *
 * Key guarantees vs. the old embedded-in-session design:
 *   - No terminal DEAD state; BACKOFF retries indefinitely with capped delay.
 *   - A connect-phase deadline: CONNECTING/HANDSHAKING held too long → BACKOFF,
 *     so a feed that opens but never handshakes cannot stall forever (#4).
 *   - Per-feed isolation (each handle has its own state/counter).
 *   - Health split: data-stale-but-heartbeat-fresh → DEGRADED; both stale →
 *     forced reconnect (never-received-data is detected, #2).
 *   - Escalation: at the RetryPolicy plateau, a periodic "still retrying" log.
 */
class FeedSupervisor extends EventEmitter {
    /**
     * @param {Object} opts
     * @param {Object} opts.clock - Injectable Clock { setTimeout, clearTimeout, now }.
     */
    constructor({ clock } = {}) {
        super();
        if (!clock) throw new Error('FeedSupervisor: clock is required');
        this.clock = clock;
        this.handles = new Map();
    }

    /**
     * Register a feed. No connection is started until `start()`.
     * @param {Object} h
     * @param {string} h.name
     * @param {Object} h.feed - Feed instance (Transport/Feed contract).
     * @param {Function} h.transportFactory - () => Transport instance.
     * @param {Object} [h.retryPolicy]
     * @param {Object} [h.healthSensor]
     * @param {number} [h.connectTimeoutMs]
     * @param {number} [h.healthPollMs]
     */
    register(h) {
        const now = () => this.clock.now();
        const handle = {
            name: h.name,
            feed: h.feed,
            transportFactory: h.transportFactory,
            transport: null,
            state: new FeedState({ now }),
            retry: h.retryPolicy || h.retry || new RetryPolicy({ ...DEFAULTS.retry }),
            health: h.healthSensor || new HealthSensor({ ...DEFAULTS.health, now }),
            attempts: 0,
            connectTimeoutMs: h.connectTimeoutMs || DEFAULTS.connectTimeoutMs,
            healthPollMs: h.healthPollMs || DEFAULTS.healthPollMs,
            deadlineTimer: null,
            _deadlineReject: null,
            reconnectTimer: null,
            healthTimer: null,
            connected: false,
            stopped: false,
        };
        this._wireFeed(handle);
        this.handles.set(h.name, handle);
        return handle;
    }

    /** Wire feed domain events into supervisor state/health. */
    _wireFeed(handle) {
        handle.feed.on('connected', () => this._onFeedConnected(handle));
        handle.feed.on('disconnected', () => this._onFeedDisconnected(handle));
        handle.feed.on('tick', () => handle.health.recordDataTick());
        handle.feed.on('heartbeat', () => handle.health.recordHeartbeat());
    }

    /** Begin supervising: kick every registered feed toward CONNECTING. */
    start() {
        for (const handle of this.handles.values()) {
            handle.stopped = false;
            this._connectNow(handle);
        }
    }

    /** Stop supervising: clear timers, close transports, go DISCONNECTED. */
    stop() {
        for (const handle of this.handles.values()) {
            handle.stopped = true;
            this._clearAllTimers(handle);
            this._forceClose(handle);
            handle.connected = false;
            handle.health.stop();
            if (handle.state.canTransition(FeedStates.DISCONNECTED)) {
                handle.state.transition(FeedStates.DISCONNECTED);
            }
            this._emitState(handle);
        }
    }

    /**
     * Force a feed to reconnect now regardless of current state/attempts.
     * Backed by reset(): clears timers, zeroes attempts, force-closes, reconnects.
     */
    reset(name) {
        const handle = this.handles.get(name);
        if (!handle) return false;
        log.info(`[${name}] reset() requested — forcing reconnect`);
        this._clearAllTimers(handle);
        handle.attempts = 0;
        handle.connected = false;
        handle.health.stop();
        this._forceClose(handle);
        this._connectNow(handle);
        return true;
    }

    resetAll() {
        for (const name of this.handles.keys()) this.reset(name);
    }

    /** Snapshot of observable state for all feeds (for GET /health). */
    observableState() {
        return Array.from(this.handles.values()).map((h) => ({
            feed: h.name,
            state: h.state.current,
            since: h.state.since,
            attempts: h.attempts,
        }));
    }

    // ── Connect lifecycle ──────────────────────────────────────────────────

    /** Move toward CONNECTING via legal transitions, then attempt a connect. */
    _connectNow(handle) {
        if (handle.stopped) return;
        this._transitionTowardConnecting(handle);
        // Fire and forget; failures route through _onConnectFailure.
        this._attemptConnect(handle).catch((e) => log.error(`[${handle.name}] unhandled connect error:`, e.message));
    }

    _transitionTowardConnecting(handle) {
        const s = handle.state;
        if (s.current === FeedStates.CONNECTING || s.current === FeedStates.HANDSHAKING) return;
        if (s.canTransition(FeedStates.CONNECTING)) {
            s.transition(FeedStates.CONNECTING);
            return;
        }
        // CONNECTED / DEGRADED / HANDSHAKING → BACKOFF → CONNECTING
        if (s.canTransition(FeedStates.BACKOFF)) s.transition(FeedStates.BACKOFF);
        if (s.canTransition(FeedStates.CONNECTING)) s.transition(FeedStates.CONNECTING);
    }

    async _attemptConnect(handle) {
        try {
            this._startDeadline(handle);
            handle.transport = handle.transportFactory();
            handle.transport.on('close', () => this._onTransportClosed(handle));
            handle.transport.on('error', () => this._onTransportClosed(handle));

            // Race the WHOLE connect phase (open + handshake) against the
            // connect-phase deadline. This bounds BOTH failure modes:
            //   - a hanging open() (the cTrader library's WSL2 TLS fallback trap,
            //     where tls.connect(hostname) can hang on a DNS throw), and
            //   - a hung handshake (defect #4: auth/subscribe reply never arrives).
            // On deadline the transport is force-closed and the race rejects →
            // _onConnectFailure → BACKOFF → re-arm. (The library's own open()
            // promise may stay pending after force-close; that is a harmless leak
            // — the supervisor has already moved on to a fresh transport.)
            await Promise.race([
                this._openAndHandshake(handle),
                new Promise((_, reject) => { handle._deadlineReject = reject; }),
            ]);

            // On success the feed emits 'connected' → _onFeedConnected. If it
            // resolved without emitting, normalize here.
            if (!handle.connected) {
                this._onFeedConnected(handle);
            }
        } catch (err) {
            await this._onConnectFailure(handle, err);
        }
    }

    /** Open the transport, then run the feed handshake. Thrown errors reject the
     *  connect-phase race in _attemptConnect. */
    async _openAndHandshake(handle) {
        await handle.transport.open();
        if (handle.state.canTransition(FeedStates.HANDSHAKING)) {
            handle.state.transition(FeedStates.HANDSHAKING);
            this._emitState(handle);
        }
        await handle.feed.connect(handle.transport);
    }

    _onFeedConnected(handle) {
        if (handle.connected) return; // dedup
        this._clearDeadline(handle);
        if (handle.state.canTransition(FeedStates.CONNECTED)) {
            handle.state.transition(FeedStates.CONNECTED);
        }
        handle.attempts = 0;
        handle.connected = true;
        handle.health.start(this.clock.now());
        this._startHealthPoll(handle);
        this._emitState(handle);
        log.info(`[${handle.name}] connected`);
    }

    async _onConnectFailure(handle, err) {
        this._clearDeadline(handle);
        if (handle.connected) return; // recovered concurrently; ignore
        handle.connected = false;
        handle.attempts += 1;
        const failIndex = handle.attempts - 1;

        if (handle.state.canTransition(FeedStates.BACKOFF)) {
            handle.state.transition(FeedStates.BACKOFF);
        }
        this._emitState(handle);

        if (handle.retry.isPlateau(failIndex)) {
            log.warn(`[${handle.name}] still reconnecting — attempt ${handle.attempts} (capped at maxDelay ${handle.retry.maxDelay}ms): ${err?.message || err}`);
        } else {
            log.error(`[${handle.name}] connect attempt ${handle.attempts} failed: ${err?.message || err}`);
        }

        const delay = handle.retry.delayFor(failIndex);
        this._scheduleReconnect(handle, delay);
    }

    _scheduleReconnect(handle, delay) {
        this._clearReconnect(handle);
        handle.reconnectTimer = this.clock.setTimeout(() => {
            handle.reconnectTimer = null;
            // Return the kick's promise so an awaiting fake clock transitively
            // awaits the full reconnect chain (deterministic test progress).
            return this._kickFromBackoff(handle);
        }, delay);
    }

    _kickFromBackoff(handle) {
        if (handle.stopped) return undefined;
        if (handle.state.canTransition(FeedStates.CONNECTING)) {
            handle.state.transition(FeedStates.CONNECTING);
            this._emitState(handle);
        }
        return this._attemptConnect(handle).catch((e) =>
            log.error(`[${handle.name}] unhandled reconnect error:`, e.message)
        );
    }

    _onFeedDisconnected(handle) {
        // Feed signalled an internal disconnect while we thought it was up.
        if (!handle.connected) return;
        this._handleLoss(handle, new Error('feed disconnected'));
    }

    _onTransportClosed(handle, err) {
        // Only meaningful when connected; during connect the attempt's catch
        // (or the deadline) owns failure handling.
        if (!handle.connected) return;
        this._handleLoss(handle, err || new Error('transport closed'));
    }

    _handleLoss(handle, err) {
        log.warn(`[${handle.name}] connection lost: ${err?.message || err}`);
        this._clearDeadline(handle);
        this._stopHealthPoll(handle);
        handle.health.stop();
        handle.connected = false;
        handle.attempts += 1;
        if (handle.state.canTransition(FeedStates.BACKOFF)) {
            handle.state.transition(FeedStates.BACKOFF);
        }
        this._emitState(handle);
        const delay = handle.retry.delayFor(handle.attempts - 1);
        this._scheduleReconnect(handle, delay);
    }

    // ── Connect-phase deadline (hang-after-open fix, #4) ────────────────────

    _startDeadline(handle) {
        this._clearDeadline(handle);
        handle._deadlineReject = null;
        handle.deadlineTimer = this.clock.setTimeout(() => {
            if (handle.connected) return;
            log.warn(`[${handle.name}] connect-phase deadline exceeded (state ${handle.state.current}) — forcing backoff`);
            this._forceClose(handle);
            if (handle._deadlineReject) {
                handle._deadlineReject(new Error('connect-phase deadline exceeded'));
            }
        }, handle.connectTimeoutMs);
    }

    _clearDeadline(handle) {
        if (handle.deadlineTimer) {
            this.clock.clearTimeout(handle.deadlineTimer);
            handle.deadlineTimer = null;
        }
        handle._deadlineReject = null;
    }

    // ── Health observation ──────────────────────────────────────────────────

    _startHealthPoll(handle) {
        this._stopHealthPoll(handle);
        const tick = () => {
            handle.healthTimer = null;
            if (handle.stopped || !handle.connected) return;
            const status = handle.health.check();
            this._reactToHealth(handle, status);
            if (handle.connected) {
                handle.healthTimer = this.clock.setTimeout(tick, handle.healthPollMs);
            }
        };
        handle.healthTimer = this.clock.setTimeout(tick, handle.healthPollMs);
    }

    _stopHealthPoll(handle) {
        if (handle.healthTimer) {
            this.clock.clearTimeout(handle.healthTimer);
            handle.healthTimer = null;
        }
    }

    _reactToHealth(handle, status) {
        if (status === HealthStatus.STALE || status === HealthStatus.DEGRADED) {
            // Both mean the feed is not delivering data. Force a reconnect so a
            // partially-alive transport (heartbeats flowing, no data — DEGRADED)
            // or a fully-dead one (STALE) self-heals. The generous dataStaleMs
            // plus the defect-#3 fix (real ticks keep flowing in quiet windows)
            // together prevent false trips during illiquid/rollover periods.
            if (status === HealthStatus.DEGRADED && handle.state.canTransition(FeedStates.DEGRADED)) {
                handle.state.transition(FeedStates.DEGRADED);
                this._emitState(handle);
            }
            log.warn(`[${handle.name}] ${status} — data not flowing, forcing reconnect`);
            this._forceReconnect(handle, `${status.toLowerCase()}: data not flowing`);
        } else if (status === HealthStatus.HEALTHY) {
            if (handle.state.current === FeedStates.DEGRADED && handle.state.canTransition(FeedStates.CONNECTED)) {
                handle.state.transition(FeedStates.CONNECTED);
                this._emitState(handle);
                log.info(`[${handle.name}] resumed HEALTHY`);
            }
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    _forceClose(handle) {
        if (handle.transport) {
            try { handle.transport.close(); } catch (e) { /* ignore */ }
        }
    }

    /**
     * Force a reconnect from a health-driven trigger (STALE/DEGRADED). Marks the
     * handle not-connected BEFORE closing so the synchronous 'close' event from
     * _forceClose is a no-op in _onTransportClosed — without this, the close
     * event would re-enter _handleLoss and double-count the loss (attempts++ and
     * a duplicate reconnect timer). _handleLoss then runs exactly once.
     */
    _forceReconnect(handle, reason) {
        handle.connected = false;
        this._forceClose(handle);
        this._handleLoss(handle, new Error(reason));
    }

    _clearReconnect(handle) {
        if (handle.reconnectTimer) {
            this.clock.clearTimeout(handle.reconnectTimer);
            handle.reconnectTimer = null;
        }
    }

    _clearAllTimers(handle) {
        this._clearDeadline(handle);
        this._clearReconnect(handle);
        this._stopHealthPoll(handle);
    }

    _emitState(handle) {
        this.emit('state', {
            feed: handle.name,
            state: handle.state.current,
            since: handle.state.since,
            attempts: handle.attempts,
        });
    }
}

module.exports = { FeedSupervisor, FeedStates };
