'use strict';

/**
 * B0 — TradingViewSession connect/disconnect characterization tests.
 *
 * TradingView is the control feed. These tests drive the real TradingViewSession
 * connect/disconnect paths with a faked `tradingview-ws` client (no live
 * network). They establish the baseline behavior the B4 extraction must not
 * regress: 'connected' on success, 'disconnected' (via handleDisconnect) on
 * failure, and the stale → disconnect/reconnect path through the health monitor.
 *
 * I/O isolation: like the cTrader suite, vi.mock cannot reliably reach these
 * requires in this hybrid setup, so we mutate the real `tradingview-ws` `connect`
 * export and the real `config` module in place before loading TradingViewSession.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const TRADINGVIEW_PATH = '/workspaces/neurosensefx/services/tick-backend/node_modules/tradingview-ws/dist/index.js';
const CONFIG_PATH = '/workspaces/neurosensefx/services/tick-backend/config.js';

// Deterministic config (must run before TradingViewSession construction).
const config = require(CONFIG_PATH);
Object.assign(config, {
    tradingViewSession: undefined,
    maxReconnectAttempts: 3,
    logLevel: 'error',
    nodeEnv: 'test',
    // D2: short, deterministic connect-phase deadline for the deadline test.
    tvConnectTimeoutMs: 150,
});

// Replace the real `connect` with a swappable stub. TradingViewSession captures
// `{ connect } = require('tradingview-ws')` at load time.
const tvModule = require(TRADINGVIEW_PATH);
const tvControl = { connectImpl: async () => null };
tvModule.connect = (...args) => tvControl.connectImpl(...args);

const { TradingViewSession } = require('../../TradingViewSession');

/**
 * Fake tradingview-ws client exposing the surface TradingViewSession uses:
 * subscribe(fn) → unsubscribe, send(name, params), on(event, fn),
 * removeListener, close.
 */
function createFakeTvClient() {
    const handlers = { close: [], error: [] };
    const client = {
        _handler: null,
        subscribe(fn) {
            this._handler = fn;
            return () => { this._handler = null; };
        },
        send() {},
        on(event, fn) {
            if (handlers[event]) handlers[event].push(fn);
        },
        removeListener(event, fn) {
            if (handlers[event]) {
                const idx = handlers[event].indexOf(fn);
                if (idx >= 0) handlers[event].splice(idx, 1);
            }
        },
        close() {},
    };
    return client;
}

describe('TradingViewSession connect/disconnect characterization (B0)', () => {
    let session;

    beforeEach(() => {
        tvControl.connectImpl = async () => null;
        session = new TradingViewSession(null, null);
    });

    afterEach(() => {
        try { if (session && session.healthMonitor) session.healthMonitor.stop(); } catch (e) {}
        try { if (session && session.reconnection) session.reconnection.cancelReconnect(); } catch (e) {}
    });

    // ─── 1. Happy path ───────────────────────────────────────────────────────
    it('happy path: connect resolves, emits connected, resets reconnect counter', async () => {
        const fakeClient = createFakeTvClient();
        tvControl.connectImpl = async () => fakeClient;

        const connected = vi.fn();
        session.on('connected', connected);

        // A previous failure path may have left attempts > 0; confirm connect resets.
        session.reconnection.reconnectAttempts = 5;

        await session.connect('test-session-id');

        expect(connected).toHaveBeenCalledTimes(1);
        expect(session.client).toBe(fakeClient);
        expect(session.sessionId).toBe('test-session-id');
        // Successful connect resets the reconnect counter.
        expect(session.reconnection.reconnectAttempts).toBe(0);
        // subscribe() returned an unsubscribe fn the session stored.
        expect(typeof session.unsubscribe).toBe('function');
    });

    // ─── 2. connect failure → handleDisconnect ───────────────────────────────
    it('connect failure: rejected connect() runs the disconnect path and emits disconnected', async () => {
        const boom = new Error('tradingview down');
        tvControl.connectImpl = async () => { throw boom; };

        const disconnected = vi.fn();
        session.on('disconnected', disconnected);

        // connect() rethrows the underlying error after running handleDisconnect.
        await expect(session.connect()).rejects.toThrow('tradingview down');

        // handleDisconnect fired: 'disconnected' emitted and client left null.
        expect(disconnected).toHaveBeenCalledTimes(1);
        expect(session.client).toBeNull();
    });

    // ─── 3. stale path → disconnect/reconnect is scheduled ───────────────────
    it('stale health event triggers handleDisconnect (→ disconnected + scheduled reconnect)', async () => {
        const fakeClient = createFakeTvClient();
        tvControl.connectImpl = async () => fakeClient;

        const disconnected = vi.fn();
        session.on('disconnected', disconnected);

        await session.connect();

        // Drive the health monitor's stale path directly. setupEventListeners
        // registered a 'stale' handler that calls handleDisconnect(err, true).
        expect(session.healthMonitor.listenerCount('stale')).toBeGreaterThan(0);
        session.healthMonitor.emit('stale', { session: 'tradingview' });

        // Stale → handleDisconnect → 'disconnected' emitted, client torn down.
        expect(disconnected).toHaveBeenCalledTimes(1);
        expect(session.client).toBeNull();

        // shouldScheduleReconnect=true → a reconnect timer was armed.
        expect(session.reconnection.reconnectTimeout).not.toBeNull();
    });

    // ─── 4. connect-phase deadline (D2) ─────────────────────────────────────
    it('connect-phase deadline: a hanging connect() rejects within tvConnectTimeoutMs', async () => {
        // Fake connect that never resolves — simulates a DNS/network hang.
        tvControl.connectImpl = () => new Promise(() => {});

        const disconnected = vi.fn();
        session.on('disconnected', disconnected);

        const start = Date.now();
        await expect(session.connect()).rejects.toThrow('TradingView connect-phase deadline exceeded');
        const elapsed = Date.now() - start;

        // Honors the configured deadline (150ms in this suite) with slack.
        expect(elapsed).toBeLessThan(1500);
        // Deadline rejection routes through handleDisconnect → 'disconnected'.
        expect(disconnected).toHaveBeenCalledTimes(1);
        expect(session.client).toBeNull();
    });
});

// ─── 5. isConnected accessor (D4) ─────────────────────────────────────────
describe('TradingViewSession isConnected (D4)', () => {
    let session;

    beforeEach(() => {
        tvControl.connectImpl = async () => null;
        session = new TradingViewSession(null, null);
    });

    afterEach(() => {
        try { if (session && session.healthMonitor) session.healthMonitor.stop(); } catch (e) {}
        try { if (session && session.reconnection) session.reconnection.cancelReconnect(); } catch (e) {}
    });

    it('isConnected() is false before connect and true after a successful connect', async () => {
        expect(session.isConnected()).toBe(false);

        const fakeClient = createFakeTvClient();
        tvControl.connectImpl = async () => fakeClient;
        await session.connect();

        expect(session.isConnected()).toBe(true);
        expect(session.client).toBe(fakeClient);
    });

    it('isConnected() returns false after disconnect', async () => {
        const fakeClient = createFakeTvClient();
        tvControl.connectImpl = async () => fakeClient;
        await session.connect();

        session.disconnect();
        expect(session.isConnected()).toBe(false);
    });
});
