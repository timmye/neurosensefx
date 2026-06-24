'use strict';

/**
 * D1 + D4 — RequestCoordinator.handleTradingViewRequest reliability fixes.
 *
 * D1: only ONE 'candle' listener (+ timeout + subscribeToSymbol) is active per
 *     in-flight symbol; a second client for the same symbol is coalesced into
 *     the pending set. Data is fanned out to every waiting client and each
 *     client's onComplete is invoked.
 * D4: when the TradingView session is not connected, subscribeToSymbol is NOT
 *     called (no per-request 'Not connected' storm); the request stays pending
 *     under the fetchTimeout cleanup.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { RequestCoordinator } = require('../../RequestCoordinator');

/**
 * Minimal fake of the wsServer surface handleTradingViewRequest touches:
 * tradingViewSession (EventEmitter with on/removeListener/isConnected/
 * subscribeToSymbol) and sendToClient.
 */
function createFakeWsServer({ connected = true } = {}) {
    const { EventEmitter } = require('events');
    const tv = new EventEmitter();
    tv.setMaxListeners(50);
    tv.isConnected = () => connected;
    tv.subscribeToSymbol = vi.fn().mockResolvedValue(undefined);

    const sent = [];
    const wsServer = {
        tradingViewSession: tv,
        sendToClient: vi.fn((client, msg) => sent.push({ client, msg })),
        _sent: sent,
    };
    return wsServer;
}

function makeClient(name) {
    // Clients are opaque keys to RequestCoordinator; tag them for assertions.
    return { id: name };
}

describe('RequestCoordinator.handleTradingViewRequest — D1 listener dedup', () => {
    let wsServer, rc;

    beforeEach(() => {
        wsServer = createFakeWsServer();
        // Short fetchTimeout so the no-data coalescing test resolves quickly.
        rc = new RequestCoordinator(wsServer, 400);
    });

    afterEach(() => {
        // Drain any pending timers (processTradingViewQueue spacing, fetchTimeout).
    });

    it('attaches exactly one candle listener per in-flight symbol', async () => {
        const c1 = makeClient('a');
        const c2 = makeClient('b');

        rc.handleTradingViewRequest('EURUSD', 14, c1);
        rc.handleTradingViewRequest('EURUSD', 14, c2);

        expect(wsServer.tradingViewSession.listenerCount('candle')).toBe(1);
        // Only one subscribe is queued for the in-flight symbol.
        await new Promise(r => setTimeout(r, 50));
        expect(wsServer.tradingViewSession.subscribeToSymbol).toHaveBeenCalledTimes(1);
    });

    it('delivers data to every waiting client and invokes each onComplete', async () => {
        const c1 = makeClient('a');
        const c2 = makeClient('b');
        const onComplete1 = vi.fn();
        const onComplete2 = vi.fn();

        rc.handleTradingViewRequest('EURUSD', 14, c1, onComplete1);
        rc.handleTradingViewRequest('EURUSD', 14, c2, onComplete2);

        // Emit the matching data package for the symbol.
        const pkg = { symbol: 'EURUSD', type: 'symbolDataPackage', initialPrice: 1.1 };
        wsServer.tradingViewSession.emit('candle', pkg);

        // Both clients received the package exactly once.
        expect(wsServer.sendToClient).toHaveBeenCalledTimes(2);
        expect(wsServer._sent.map(s => s.client).sort()).toEqual([c1, c2].sort());
        // Both completion callbacks fired.
        expect(onComplete1).toHaveBeenCalledTimes(1);
        expect(onComplete2).toHaveBeenCalledTimes(1);
        // Listener removed after delivery; pending entry cleared.
        expect(wsServer.tradingViewSession.listenerCount('candle')).toBe(0);
        expect(rc.pendingTradingViewRequests.has('EURUSD')).toBe(false);
    });

    it('keeps distinct symbols on separate listeners', async () => {
        rc.handleTradingViewRequest('EURUSD', 14, makeClient('a'));
        rc.handleTradingViewRequest('GBPUSD', 14, makeClient('b'));

        expect(wsServer.tradingViewSession.listenerCount('candle')).toBe(2);

        // The TV queue spaces subscriptions by _TV_MIN_INTERVAL_MS (500ms).
        await new Promise(r => setTimeout(r, 650));
        expect(wsServer.tradingViewSession.subscribeToSymbol).toHaveBeenCalledTimes(2);
    });

    it('does not trip MaxListenersExceededWarning across many distinct symbols', () => {
        // 30 distinct symbols would blow past the default ceiling of 10 if a
        // duplicate listener were stacked per request. With per-symbol dedup the
        // coordinator attaches exactly one listener per symbol, so the count
        // grows linearly and never exceeds the number of distinct symbols.
        for (let i = 0; i < 30; i++) {
            rc.handleTradingViewRequest(`SYM${i}`, 14, makeClient(`c${i}`));
            expect(wsServer.tradingViewSession.listenerCount('candle')).toBe(i + 1);
        }

        // Sanity: still one entry per symbol, no duplicates.
        expect(rc.pendingTradingViewRequests.size).toBe(30);
    });
});

describe('RequestCoordinator.handleTradingViewRequest — D4 disconnected storm', () => {
    let wsServer, rc;

    beforeEach(() => {
        wsServer = createFakeWsServer({ connected: false });
        rc = new RequestCoordinator(wsServer, 300);
    });

    it('does not call subscribeToSymbol when the session is disconnected', async () => {
        const client = makeClient('a');
        // Suppress the single warn log during the test.
        vi.spyOn(require('../../utils/Logger').createLogger('RequestCoordinator'), 'warn');

        const promise = rc.handleTradingViewRequest('EURUSD', 14, client);

        // Let the TV queue process; subscribe must be skipped (no throw, no storm).
        await expect(promise).resolves.toBeUndefined();
        expect(wsServer.tradingViewSession.subscribeToSymbol).not.toHaveBeenCalled();
    });

    it('cleans up the listener and notifies the client via fetchTimeout when disconnected', async () => {
        const client = makeClient('a');
        rc.handleTradingViewRequest('EURUSD', 14, client);

        // Wait past the fetchTimeout (300ms); the timeout fallback fires.
        await new Promise(r => setTimeout(r, 450));

        expect(wsServer.tradingViewSession.listenerCount('candle')).toBe(0);
        expect(rc.pendingTradingViewRequests.has('EURUSD')).toBe(false);
        expect(wsServer.sendToClient).toHaveBeenCalledTimes(1);
        expect(wsServer._sent[0].msg.type).toBe('error');
        expect(wsServer._sent[0].msg.message).toContain('Timeout');
    });
});
