/**
 * Behavioral tests for ReconnectionManager (Phase A: feed recovery & supervision).
 *
 * Covers the "never permanently give up" fix (A1), the reset-before-connect
 * contract (A2, via the manager directly), and timer hygiene. Driven entirely
 * by vitest fake timers and an injected `reconnectFn`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { ReconnectionManager } = require('../utils/ReconnectionManager');

describe('ReconnectionManager (Phase A)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ─── A1 acceptance ───────────────────────────────────────────────────────

    it('keeps scheduling retries well past maxAttempts (never permanently gives up)', async () => {
        const manager = new ReconnectionManager(100, 10, 3);
        const reconnectFn = vi.fn().mockRejectedValue(new Error('still down'));
        manager.scheduleReconnect(reconnectFn);

        // Drive well past maxAttempts (3) — push through 8 retries total.
        for (let i = 0; i < 8; i++) {
            await vi.advanceTimersByTimeAsync(1000);
        }

        // A counter kept climbing and a fresh timer is still pending: the next
        // advance fires the fn again rather than the chain having stopped.
        const callsBefore = reconnectFn.mock.calls.length;
        expect(callsBefore).toBeGreaterThanOrEqual(8);
        await vi.advanceTimersByTimeAsync(1000);
        expect(reconnectFn.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it('resets reconnectAttempts to 0 after a successful reconnectFn', async () => {
        const manager = new ReconnectionManager(100, 10, 3);
        const reconnectFn = vi.fn().mockResolvedValue(undefined);
        manager.scheduleReconnect(reconnectFn);

        expect(manager.reconnectAttempts).toBe(0);
        await vi.advanceTimersByTimeAsync(1000);

        expect(reconnectFn).toHaveBeenCalledTimes(1);
        expect(manager.reconnectAttempts).toBe(0);
    });

    it('reset() zeroes counter/delay and cancels any pending timer', async () => {
        const manager = new ReconnectionManager(100, 10, 3);
        const reconnectFn = vi.fn().mockResolvedValue(undefined);
        manager.scheduleReconnect(reconnectFn);

        // Simulate accumulated attempts, then reset.
        manager.reconnectAttempts = 5;
        manager.reconnectDelay = 9999;
        manager.reset();

        expect(manager.reconnectAttempts).toBe(0);
        expect(manager.reconnectDelay).toBe(10);

        // Advancing time must NOT fire the fn — the timer was cancelled.
        await vi.advanceTimersByTimeAsync(1000);
        expect(reconnectFn).not.toHaveBeenCalled();
    });

    it('two rapid scheduleReconnect calls produce exactly one pending timer', async () => {
        const manager = new ReconnectionManager(100, 10, 3);
        const reconnectFn = vi.fn().mockResolvedValue(undefined);

        manager.scheduleReconnect(reconnectFn);
        manager.scheduleReconnect(reconnectFn);

        await vi.advanceTimersByTimeAsync(1000);

        // Only one chain ran — the second call collapsed onto a single timer.
        expect(reconnectFn).toHaveBeenCalledTimes(1);
    });

    // ─── A2 acceptance (modeled via the manager) ─────────────────────────────

    it('reset() brings reconnectAttempts back to 0 after passing maxAttempts', () => {
        const manager = new ReconnectionManager(100, 10, 3);
        manager.reconnectAttempts = 4; // past maxAttempts (3)
        manager.reset();
        expect(manager.reconnectAttempts).toBe(0);
    });

    it('after reset, a fresh scheduleReconnect restarts the backoff curve from the beginning', async () => {
        const maxDelay = 100;
        const initialDelay = 10;
        const manager = new ReconnectionManager(maxDelay, initialDelay, 3);

        // Run the manager into the plateau so the next naive retry would sit at
        // maxDelay. We do this by bumping the counter directly (mirrors a feed
        // that has failed many times before an operator-initiated reconnect).
        manager.reconnectAttempts = 10;

        // A2's reconnect() calls reset() before connect(); emulate that.
        manager.reset();

        // After reset, a fresh schedule arms from the start of the curve. The
        // armed delay must be back near initialDelay (well under maxDelay), so a
        // short advance fires the fn — proving a full retry schedule re-arms,
        // not a single plateau shot.
        const reconnectFn = vi.fn().mockResolvedValue(undefined);
        manager.scheduleReconnect(reconnectFn);

        // initialDelay (10ms) + up to 30% jitter = <=13ms; 50ms is safely past
        // that but far below the plateau delay (>= maxDelay 100ms).
        await vi.advanceTimersByTimeAsync(50);
        expect(reconnectFn).toHaveBeenCalledTimes(1);
    });
});
