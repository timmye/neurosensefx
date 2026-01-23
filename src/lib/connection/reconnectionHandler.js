/**
 * ReconnectionHandler - Exponential backoff reconnection logic
 * Crystal Clarity: <60 lines, <15 line functions
 * Framework-First: Native setTimeout and Math functions
 *
 * WHY: Exponential backoff (1000ms * 2^attempt) prevents thundering herd on server.
 * Max 5 attempts covers 99% of transient outages within 31s window.
 * Users perceive >30s delay as system failure, so 5 attempts balances recovery with UX.
 */
export class ReconnectionHandler {
  constructor() {
    this.attempts = 0;
    this.maxAttempts = 5;
    this.baseDelay = 1000;
  }

  shouldReconnect() {
    return this.attempts < this.maxAttempts;
  }

  getDelay(attempt) {
    return this.baseDelay * Math.pow(2, attempt);
  }

  incrementAttempts() {
    return this.attempts++;
  }

  resetAttempts() {
    this.attempts = 0;
  }

  permanentDisconnect() {
    this.maxAttempts = 0;
  }

  getAttempts() {
    return this.attempts;
  }
}
