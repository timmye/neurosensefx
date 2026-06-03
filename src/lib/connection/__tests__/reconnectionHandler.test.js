/**
 * ReconnectionHandler Backoff Logic Tests
 *
 * Verifies exponential backoff formula, delay caps, jitter bounds,
 * attempt counting, reset behavior, and edge cases.
 *
 * Run: npm run test:unit -- src/lib/connection/__tests__/reconnectionHandler.test.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReconnectionHandler } from '../reconnectionHandler.js';

// ── Helpers ──

/** Compute the deterministic (jitter-free) base delay for a given attempt */
function baseDelayFor(handler, attempt) {
  return Math.min(handler.baseDelay * Math.pow(2, attempt), handler.maxDelayMs);
}

// ── Test: Exponential backoff formula ──

describe('getDelay — exponential backoff', () => {
  let handler;

  beforeEach(() => {
    handler = new ReconnectionHandler();
  });

  it('attempt 0 returns baseDelay with jitter (1000–1300ms)', () => {
    for (let i = 0; i < 100; i++) {
      const delay = handler.getDelay(0);
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThan(1000 * 1.3);
    }
  });

  it('delay doubles with each attempt before hitting the cap', () => {
    const uncapped = attempt => baseDelayFor(handler, attempt);

    // attempt 0: 1000
    expect(uncapped(0)).toBe(1000);
    // attempt 1: 2000
    expect(uncapped(1)).toBe(2000);
    // attempt 2: 4000
    expect(uncapped(2)).toBe(4000);
    // attempt 3: 8000
    expect(uncapped(3)).toBe(8000);
    // attempt 4: 16000 → capped to 15000
    expect(uncapped(4)).toBe(15000);
  });

  it('delay is capped at maxDelayMs (15000) for high attempts', () => {
    // attempt 10: 1000 * 1024 = 1024000 → capped
    const delay = handler.getDelay(10);
    expect(delay).toBeGreaterThanOrEqual(15000);
    expect(delay).toBeLessThan(15000 * 1.3);
  });

  it('delay is capped at maxDelayMs (15000) for attempt 100', () => {
    const delay = handler.getDelay(100);
    expect(delay).toBeGreaterThanOrEqual(15000);
    expect(delay).toBeLessThan(15000 * 1.3);
  });

  it('jitter never exceeds 30% of base delay', () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const base = baseDelayFor(handler, attempt);
      const maxAllowed = base * 1.3;
      for (let i = 0; i < 200; i++) {
        const delay = handler.getDelay(attempt);
        expect(delay).toBeLessThanOrEqual(maxAllowed);
        expect(delay).toBeGreaterThanOrEqual(base);
      }
    }
  });
});

// ── Test: Minimum and maximum delay ──

describe('delay bounds', () => {
  let handler;

  beforeEach(() => {
    handler = new ReconnectionHandler();
  });

  it('first attempt (0) delay is never below baseDelay', () => {
    for (let i = 0; i < 500; i++) {
      expect(handler.getDelay(0)).toBeGreaterThanOrEqual(handler.baseDelay);
    }
  });

  it('no delay ever exceeds maxDelayMs * 1.3 (cap + jitter)', () => {
    const absoluteMax = handler.maxDelayMs * 1.3;
    for (let attempt = 0; attempt < 20; attempt++) {
      for (let i = 0; i < 100; i++) {
        expect(handler.getDelay(attempt)).toBeLessThanOrEqual(absoluteMax);
      }
    }
  });
});

// ── Test: Attempt counting and increment ──

describe('incrementAttempts', () => {
  let handler;

  beforeEach(() => {
    handler = new ReconnectionHandler();
  });

  it('returns 0 on first call, then increments to 1', () => {
    expect(handler.incrementAttempts()).toBe(0);
    expect(handler.getAttempts()).toBe(1);
  });

  it('increments monotonically', () => {
    for (let i = 0; i < 10; i++) {
      expect(handler.incrementAttempts()).toBe(i);
    }
    expect(handler.getAttempts()).toBe(10);
  });

  it('sets lastFailureTime on each increment', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    handler.incrementAttempts();
    expect(handler.lastFailureTime).toBe(now);
  });
});

// ── Test: Reset after successful connection ──

describe('resetAttempts', () => {
  let handler;

  beforeEach(() => {
    handler = new ReconnectionHandler();
  });

  it('resets attempt counter to 0', () => {
    handler.incrementAttempts();
    handler.incrementAttempts();
    handler.incrementAttempts();
    expect(handler.getAttempts()).toBe(3);

    handler.resetAttempts();
    expect(handler.getAttempts()).toBe(0);
  });

  it('clears lastFailureTime', () => {
    handler.incrementAttempts();
    expect(handler.lastFailureTime).not.toBeNull();

    handler.resetAttempts();
    expect(handler.lastFailureTime).toBeNull();
  });

  it('allows reconnection after reset even if max was previously reached', () => {
    handler.maxAttempts = 3;
    handler.incrementAttempts();
    handler.incrementAttempts();
    handler.incrementAttempts();
    expect(handler.shouldReconnect()).toBe(false);

    handler.resetAttempts();
    expect(handler.shouldReconnect()).toBe(true);
  });
});

// ── Test: shouldReconnect ──

describe('shouldReconnect', () => {
  let handler;

  beforeEach(() => {
    handler = new ReconnectionHandler();
    handler.maxAttempts = 3;
  });

  it('returns true when attempts below max', () => {
    expect(handler.shouldReconnect()).toBe(true);
    handler.incrementAttempts();
    expect(handler.shouldReconnect()).toBe(true);
  });

  it('returns false when attempts reach max', () => {
    handler.incrementAttempts();
    handler.incrementAttempts();
    handler.incrementAttempts();
    expect(handler.shouldReconnect()).toBe(false);
  });

  it('auto-resets after resetWindowMs (60s) since last failure', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    handler.incrementAttempts();
    handler.incrementAttempts();
    handler.incrementAttempts();
    expect(handler.shouldReconnect()).toBe(false);

    // Advance past resetWindowMs
    vi.spyOn(Date, 'now').mockReturnValue(now + 61000);
    expect(handler.shouldReconnect()).toBe(true);
    expect(handler.getAttempts()).toBe(0);
  });

  it('does not auto-reset before resetWindowMs', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    handler.incrementAttempts();
    handler.incrementAttempts();
    handler.incrementAttempts();
    expect(handler.shouldReconnect()).toBe(false);

    // Advance within reset window
    vi.spyOn(Date, 'now').mockReturnValue(now + 50000);
    expect(handler.shouldReconnect()).toBe(false);
    expect(handler.getAttempts()).toBe(3);
  });
});

// ── Test: permanentDisconnect ──

describe('permanentDisconnect', () => {
  let handler;

  beforeEach(() => {
    handler = new ReconnectionHandler();
  });

  it('sets maxAttempts to 0, blocking all reconnection', () => {
    handler.permanentDisconnect();
    expect(handler.shouldReconnect()).toBe(false);
  });
});

// ── Test: resetMaxAttempts ──

describe('resetMaxAttempts', () => {
  let handler;

  beforeEach(() => {
    handler = new ReconnectionHandler();
  });

  it('restores maxAttempts to original value', () => {
    handler.permanentDisconnect();
    expect(handler.shouldReconnect()).toBe(false);

    handler.resetMaxAttempts();
    expect(handler.shouldReconnect()).toBe(true);
  });

  it('also resets attempt counter and failure time', () => {
    handler.incrementAttempts();
    handler.incrementAttempts();
    handler.resetMaxAttempts();

    expect(handler.getAttempts()).toBe(0);
    expect(handler.lastFailureTime).toBeNull();
  });
});

// ── Test: Edge cases ──

describe('edge cases', () => {
  it('getDelay with attempt 0 does not produce NaN or negative', () => {
    const handler = new ReconnectionHandler();
    const delay = handler.getDelay(0);
    expect(delay).not.toBeNaN();
    expect(delay).toBeGreaterThan(0);
  });

  it('getDelay with very high attempt (999) stays within bounds', () => {
    const handler = new ReconnectionHandler();
    const delay = handler.getDelay(999);
    expect(delay).toBeGreaterThanOrEqual(handler.maxDelayMs);
    expect(delay).toBeLessThan(handler.maxDelayMs * 1.3);
    expect(delay).not.toBeNaN();
  });

  it('getDelay with negative attempt treats as attempt 0 (2^negative = fraction)', () => {
    const handler = new ReconnectionHandler();
    const delay = handler.getDelay(-1);
    // 1000 * 2^-1 = 500, plus jitter → 500–650
    expect(delay).toBeGreaterThanOrEqual(500);
    expect(delay).toBeLessThan(650);
  });

  it('getDelay with negative attempt (-10) produces very small delay', () => {
    const handler = new ReconnectionHandler();
    const delay = handler.getDelay(-10);
    // 1000 * 2^-10 ≈ 0.977, plus jitter → ~0.977–1.27
    expect(delay).toBeGreaterThanOrEqual(0.977);
    expect(delay).toBeLessThan(1.3);
  });

  it('default maxAttempts is Infinity', () => {
    const handler = new ReconnectionHandler();
    expect(handler.maxAttempts).toBe(Infinity);
  });

  it('shouldReconnect returns true infinitely by default', () => {
    const handler = new ReconnectionHandler();
    for (let i = 0; i < 10000; i++) {
      handler.incrementAttempts();
    }
    expect(handler.shouldReconnect()).toBe(true);
  });
});
