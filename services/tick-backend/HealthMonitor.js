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
