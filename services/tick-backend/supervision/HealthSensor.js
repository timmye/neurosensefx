const EventEmitter = require('events');

/**
 * HealthStatus values emitted/returned by HealthSensor.
 *   HEALTHY  — recent data ticks.
 *   DEGRADED — data ticks have gone stale BUT heartbeats are still fresh
 *              (a partial stall: the transport is alive but not delivering data).
 *   STALE    — both data and heartbeat have gone stale (or never received).
 *   UNKNOWN  — not started.
 */
const HealthStatus = {
    HEALTHY: 'HEALTHY',
    DEGRADED: 'DEGRADED',
    STALE: 'STALE',
    UNKNOWN: 'UNKNOWN',
};

/**
 * HealthSensor — splits data-ness from liveness (fixes defect #2).
 *
 * The old HealthMonitor fed one `recordTick()` from BOTH ticks and heartbeats,
 * so heartbeats masked partial stalls, and staleness required a prior tick
 * (never-connected feeds were undetectable). HealthSensor tracks data ticks and
 * heartbeats separately and treats never-received-data as stale after threshold.
 *
 * NOTE on illiquid windows: the threshold here only gates time-since-last-data.
 * False DEGRADED during quiet/rollover windows is prevented by (a) a generous
 * `dataStaleMs` AND (b) the defect-#3 fix in the feed tier, which keeps real
 * trendbar ticks feeding `recordDataTick()` even when spot bid/ask go null. The
 * sensor itself does not distinguish "broker is quiet" from "feed is broken";
 * that distinction is the #3 fix's job upstream.
 *
 * The supervisor drives `check()` on its own clock tick (the sensor is
 * clock-agnostic: it never owns a timer).
 */
class HealthSensor extends EventEmitter {
    /**
     * @param {Object} [opts]
     * @param {number} [opts.dataStaleMs=60000]   Max age of last data tick before staleness.
     * @param {number} [opts.heartbeatStaleMs=30000] Max age of last heartbeat.
     * @param {Function} [opts.now] Injectable clock, default `Date.now`.
     */
    constructor({
        dataStaleMs = 60000,
        heartbeatStaleMs = 30000,
        now = () => Date.now(),
    } = {}) {
        super();
        this.dataStaleMs = dataStaleMs;
        this.heartbeatStaleMs = heartbeatStaleMs;
        this._now = now;
        this.lastDataTick = null;
        this.lastHeartbeat = null;
        this.startedAt = null;
        this._status = HealthStatus.UNKNOWN;
    }

    /**
     * Begin monitoring. Seeds lastDataTick/lastHeartbeat to the baseline so a
     * feed that NEVER receives data still trips stale once `dataStaleMs` elapses
     * (the never-connected case the old monitor missed).
     * @param {number} [baseline]
     */
    start(baseline) {
        const t = baseline !== undefined ? baseline : this._now();
        this.startedAt = t;
        this.lastDataTick = t;
        this.lastHeartbeat = t;
        this._status = HealthStatus.HEALTHY;
    }

    /** Stop monitoring; further checks return UNKNOWN until restarted. */
    stop() {
        this.startedAt = null;
        this._status = HealthStatus.UNKNOWN;
    }

    /** Record a real data tick (spot/trendbar) — feeds the data-tick clock. */
    recordDataTick() {
        this.lastDataTick = this._now();
    }

    /** Record a transport heartbeat — keeps liveness distinct from data-ness. */
    recordHeartbeat() {
        this.lastHeartbeat = this._now();
    }

    /**
     * Compute current status from timestamps (pure given the clock). Does not emit.
     * @returns {string} HealthStatus
     */
    compute() {
        if (this.startedAt === null) return HealthStatus.UNKNOWN;
        const now = this._now();
        const dataFresh = (now - this.lastDataTick) <= this.dataStaleMs;
        const hbFresh = (now - this.lastHeartbeat) <= this.heartbeatStaleMs;
        if (dataFresh) return HealthStatus.HEALTHY;
        if (hbFresh) return HealthStatus.DEGRADED;
        return HealthStatus.STALE;
    }

    /**
     * Compute status and emit a transition event if it changed:
     *   'degraded' on HEALTHY→DEGRADED, 'stale' on *→STALE, 'resumed' on
     *   DEGRADED/STALE→HEALTHY. Returns the (possibly unchanged) status.
     * @returns {string} HealthStatus
     */
    check() {
        const next = this.compute();
        if (next !== this._status) {
            const prev = this._status;
            this._status = next;
            if (next === HealthStatus.STALE) {
                this.emit('stale', { since: this._now() });
            } else if (next === HealthStatus.DEGRADED) {
                this.emit('degraded', { since: this._now() });
            } else if (next === HealthStatus.HEALTHY && (prev === HealthStatus.DEGRADED || prev === HealthStatus.STALE)) {
                this.emit('resumed', { since: this._now() });
            }
        }
        return next;
    }

    /** @returns {string} last computed status */
    get status() {
        return this._status;
    }
}

module.exports = { HealthSensor, HealthStatus };
