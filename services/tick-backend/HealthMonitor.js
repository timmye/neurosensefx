const EventEmitter = require('events');

class HealthMonitor extends EventEmitter {
    constructor(sessionName, stalenessMs = 60000, checkIntervalMs = 30000) {
        super();
        this.sessionName = sessionName;
        this.stalenessMs = stalenessMs;
        this.checkIntervalMs = checkIntervalMs;
        this.lastTick = null;
        this.isStale = false;
        this.interval = null;
        this.latencySamples = [];
        this.maxSamples = 100;
    }

    recordLatency(latencyMs) {
        this.latencySamples.push(latencyMs);
        if (this.latencySamples.length > this.maxSamples) {
            this.latencySamples.shift();
        }
    }

    getLatencyStats() {
        if (this.latencySamples.length === 0) return null;
        const sorted = [...this.latencySamples].sort((a, b) => a - b);
        return {
            p50: sorted[Math.floor(sorted.length * 0.5)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            avg: sorted.reduce((a, b) => a + b, 0) / sorted.length
        };
    }

    recordTick() {
        this.lastTick = Date.now();
        this.checkStaleness();
    }

    start() {
        this.stop();
        this.interval = setInterval(() => this.checkStaleness(), this.checkIntervalMs);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isStale = false;
        this.lastTick = null;
    }

    checkStaleness() {
        const isStale = this.lastTick && (Date.now() - this.lastTick) > this.stalenessMs;
        if (isStale && !this.isStale) {
            this.isStale = true;
            this.emit('stale', { session: this.sessionName });
        } else if (!isStale && this.isStale) {
            this.isStale = false;
            this.emit('tick_resumed', { session: this.sessionName });
        }
    }
}

module.exports = { HealthMonitor };
