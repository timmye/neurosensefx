/**
 * ReconnectionHandler - Exponential backoff reconnection logic
 * Crystal Clarity: <60 lines, <15 line functions
 * Framework-First: Native setTimeout and Math functions
 *
 * WHY: Exponential backoff (1000ms * 2^attempt) prevents thundering herd on server.
 * Max 10 attempts covers transient outages within 1023s window.
 * Max delay capped at 30s prevents unbounded growth when maxAttempts is Infinity.
 * Users perceive >30s delay as system failure, so configurable attempts balance recovery with UX.
 * Time-based reset (60s window) prevents stale counters from blocking reconnection after extended outages.
 */
export class ReconnectionHandler {
  constructor() {
    this.attempts = 0;
    this.maxAttempts = this.getMaxAttemptsFromEnv();
    this.baseDelay = 500; // Fast initial reconnect
    this.maxDelayMs = 10000; // Cap at 10s for trading
    this.lastFailureTime = null;
    this.resetWindowMs = 60000;
  }

  getMaxAttemptsFromEnv() {
    if (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_MAX_RECONNECT_ATTEMPTS) {
      const parsed = parseInt(import.meta.env.VITE_MAX_RECONNECT_ATTEMPTS, 10);
      return !isNaN(parsed) && parsed > 0 ? parsed : Infinity;
    }
    return Infinity;
  }

  shouldReconnect() {
    if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.resetWindowMs) {
      this.resetAttempts();
    }
    return this.attempts < this.maxAttempts;
  }

  getDelay(attempt) {
    const baseDelay = Math.min(
        this.baseDelay * Math.pow(2, attempt),
        this.maxDelayMs
    );
    // Add jitter to prevent thundering herd (30% variance)
    const jitter = Math.random() * 0.3 * baseDelay;
    return baseDelay + jitter;
  }

  incrementAttempts() {
    this.lastFailureTime = Date.now();
    return this.attempts++;
  }

  resetAttempts() {
    this.attempts = 0;
    this.lastFailureTime = null;
  }

  permanentDisconnect() {
    this.maxAttempts = 0;
  }

  getAttempts() {
    return this.attempts;
  }
}
