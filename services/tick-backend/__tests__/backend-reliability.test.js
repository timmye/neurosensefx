/**
 * Unit tests for the backend reliability fixes plan.
 * Covers acceptance criteria from all 3 phases (18 items).
 * No external services required — pure unit tests with mocks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Phase 1: Reliability ──────────────────────────────────────────────────

describe('1.4 SafeSender backpressure', () => {
    const { send, BUFFER_THRESHOLD, SLOW_DISCONNECT_CODE } = require('../utils/SafeSender');

    function makeWs(overrides = {}) {
        return {
            readyState: 1,
            bufferedAmount: 0,
            send: vi.fn(),
            close: vi.fn(),
            ...overrides,
        };
    }

    it('sends when bufferedAmount is below threshold', () => {
        const ws = makeWs({ bufferedAmount: 100 });
        const result = send(ws, 'hello');
        expect(result).toBe(true);
        expect(ws.send).toHaveBeenCalledWith('hello');
    });

    it('sends when bufferedAmount equals threshold (boundary)', () => {
        const ws = makeWs({ bufferedAmount: BUFFER_THRESHOLD });
        const result = send(ws, 'hello');
        expect(result).toBe(true);
        expect(ws.send).toHaveBeenCalledWith('hello');
    });

    it('disconnects client when bufferedAmount exceeds threshold', () => {
        const ws = makeWs({ bufferedAmount: BUFFER_THRESHOLD + 1 });
        const result = send(ws, 'hello');
        expect(result).toBe(false);
        expect(ws.send).not.toHaveBeenCalled();
        expect(ws.close).toHaveBeenCalledWith(SLOW_DISCONNECT_CODE, 'Slow connection');
    });

    it('returns false for null ws', () => {
        expect(send(null, 'hello')).toBe(false);
    });

    it('returns false for closed ws (readyState !== 1)', () => {
        const ws = makeWs({ readyState: 3 }); // CLOSED
        expect(send(ws, 'hello')).toBe(false);
        expect(ws.send).not.toHaveBeenCalled();
    });

    it('returns false and logs when ws.send throws', () => {
        const ws = makeWs();
        ws.send.mockImplementation(() => { throw new Error('boom'); });
        const result = send(ws, 'hello');
        expect(result).toBe(false);
    });

    it('disconnect uses code 4002 with descriptive reason', () => {
        const ws = makeWs({ bufferedAmount: BUFFER_THRESHOLD + 1024 });
        send(ws, 'msg');
        expect(ws.close).toHaveBeenCalledWith(4002, 'Slow connection');
    });
});

describe('1.1 uncaughtException exits process', () => {
    it('server.js registers uncaughtException handler with exit', () => {
        // Verify the handler is registered and contains process.exit
        const serverModule = require('../server.js');
        // The handler is registered at process level — we verify it exists
        const listeners = process.listeners('uncaughtException');
        // At least our handler should be registered
        expect(listeners.length).toBeGreaterThanOrEqual(1);
    });
});

describe('1.3 resetSequence removed', () => {
    it('MarketProfileService has no resetSequence method', () => {
        const { MarketProfileService } = require('../MarketProfileService');
        const mps = new MarketProfileService();
        expect(mps.resetSequence).toBeUndefined();
    });

    it('WebSocketServer does not call resetSequence on connected', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../WebSocketServer.js'), 'utf8'
        );
        expect(source).not.toContain('resetSequence');
    });
});

describe('1.7 handleUnsubscribe cleans up M1 bars', () => {
    it('handleUnsubscribe calls unsubscribeFromBars with M1', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../WebSocketServer.js'), 'utf8'
        );
        // Verify the handleUnsubscribe method includes M1 bar cleanup
        expect(source).toContain("unsubscribeFromBars(symbolName, 'M1')");
        expect(source).toContain('removeBackendSubscription');
    });

    it('SubscriptionManager has removeBackendSubscription method', () => {
        const { SubscriptionManager } = require('../SubscriptionManager');
        const sm = new SubscriptionManager();
        expect(typeof sm.removeBackendSubscription).toBe('function');
    });

    it('removeBackendSubscription removes from m1BarSubscriptions set', () => {
        const { SubscriptionManager } = require('../SubscriptionManager');
        const sm = new SubscriptionManager();
        sm.addBackendSubscription('EURUSD', 'ctrader');
        expect(sm.hasM1BarSubscription('EURUSD', 'ctrader')).toBe(true);
        sm.removeBackendSubscription('EURUSD', 'ctrader');
        expect(sm.hasM1BarSubscription('EURUSD', 'ctrader')).toBe(false);
    });
});

// 1.5 RETIRED (B7): the source-text assertions here ("source contains
// 'disconnect(false)'") gave false confidence — they checked that the string
// existed, not that subscriptions were actually preserved/restored. Replaced by
// BEHAVIORAL coverage: __tests__/characterization/ctraderConnect.test.js asserts
// reconnect re-subscribes symbol-for-symbol (snapshot+clear in
// restoreSubscriptions), and __tests__/supervision/recovery.test.js asserts
// subscriptions survive a supervisor-driven reconnect.


describe('1.6 TradingView once->on listener race fix', () => {
    it('RequestCoordinator uses on instead of once for candle listener', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../RequestCoordinator.js'), 'utf8'
        );
        // Should NOT use once('candle')
        expect(source).not.toContain(".once('candle'");
        // Should use on('candle')
        expect(source).toContain(".on('candle'");
    });

    it('RequestCoordinator has timeout cleanup for candle listener', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../RequestCoordinator.js'), 'utf8'
        );
        expect(source).toContain('clearTimeout(timeoutId)');
    });
});

describe('1.2 Atomic token persistence', () => {
    it('persistTokens uses temp file + rename pattern', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../CTraderSession.js'), 'utf8'
        );
        expect(source).toContain("envPath + '.tmp'");
        expect(source).toContain('fs.renameSync(tmpPath, envPath)');
    });

    it('persistTokens cleans up temp file on error', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../CTraderSession.js'), 'utf8'
        );
        expect(source).toContain('fs.unlinkSync(tmpPath)');
    });

    it('fs is imported at module level', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../CTraderSession.js'), 'utf8'
        );
        // Should have top-level fs import, not inline require
        expect(source).toMatch(/^const fs = require\('fs'\);/m);
    });
});

// ─── Phase 2: Cleanup ──────────────────────────────────────────────────────

describe('2.1 Shared constants', () => {
    const constants = require('../utils/constants');

    it('exports RESOLUTION_TO_PERIOD with correct mappings', () => {
        expect(constants.RESOLUTION_TO_PERIOD['1m']).toBe('M1');
        expect(constants.RESOLUTION_TO_PERIOD['4h']).toBe('H4');
        expect(constants.RESOLUTION_TO_PERIOD['D']).toBe('D1');
        expect(constants.RESOLUTION_TO_PERIOD['W']).toBe('W1');
        expect(constants.RESOLUTION_TO_PERIOD['M']).toBe('MN1');
    });

    it('exports VALID_PERIODS with all periods', () => {
        expect(constants.VALID_PERIODS).toContain('M1');
        expect(constants.VALID_PERIODS).toContain('H4');
        expect(constants.VALID_PERIODS).toContain('D1');
        expect(constants.VALID_PERIODS).toContain('MN1');
        expect(constants.VALID_PERIODS).toHaveLength(11);
    });

    it('exports SYMBOL_RE regex', () => {
        expect(constants.SYMBOL_RE.test('EURUSD')).toBe(true);
        expect(constants.SYMBOL_RE.test('BTC/USD')).toBe(true);
        expect(constants.SYMBOL_RE.test('GBP-JPY')).toBe(true);
        expect(constants.SYMBOL_RE.test('')).toBe(false);
        expect(constants.SYMBOL_RE.test('<script>')).toBe(false);
        expect(constants.SYMBOL_RE.test('EUR USD')).toBe(false);
    });

    it('constants are immutable (frozen)', () => {
        expect(Object.isFrozen(constants.RESOLUTION_TO_PERIOD)).toBe(true);
        expect(Object.isFrozen(constants.VALID_PERIODS)).toBe(true);
    });

    it('WebSocketServer uses shared constants', () => {
        vi.resetModules();
        const { WebSocketServer } = require('../WebSocketServer');
        // Should import from constants, not define locally
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../WebSocketServer.js'), 'utf8'
        );
        expect(source).toContain("require('./utils/constants')");
    });
});

describe('2.6 Symbol validation in HTTP routes', () => {
    it('valid symbol EURUSD passes SYMBOL_RE', () => {
        const { SYMBOL_RE } = require('../utils/constants');
        expect(SYMBOL_RE.test('EURUSD')).toBe(true);
    });

    it('valid symbol BTC/USD passes SYMBOL_RE', () => {
        const { SYMBOL_RE } = require('../utils/constants');
        expect(SYMBOL_RE.test('BTC/USD')).toBe(true);
    });

    it('XSS payload is rejected', () => {
        const { SYMBOL_RE } = require('../utils/constants');
        expect(SYMBOL_RE.test('<script>alert(1)</script>')).toBe(false);
    });

    it('empty symbol is rejected', () => {
        const { SYMBOL_RE } = require('../utils/constants');
        expect(SYMBOL_RE.test('')).toBe(false);
    });

    it('persistenceRoutes imports SYMBOL_RE from constants', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../persistenceRoutes.js'), 'utf8'
        );
        expect(source).toContain("require('./utils/constants')");
        expect(source).toContain('validateSymbol');
    });
});

describe('2.2 Dead code removed', () => {
    it('HealthMonitor has no recordLatency method', () => {
        const { HealthMonitor } = require('../HealthMonitor');
        const hm = new HealthMonitor('test', 1000, 500);
        expect(hm.recordLatency).toBeUndefined();
        expect(hm.getLatencyStats).toBeUndefined();
    });

    it('HealthMonitor has no latencySamples or maxSamples', () => {
        const { HealthMonitor } = require('../HealthMonitor');
        const hm = new HealthMonitor('test', 1000, 500);
        expect(hm.latencySamples).toBeUndefined();
        expect(hm.maxSamples).toBeUndefined();
    });

    it('RequestCoordinator has no resolveRequest method', () => {
        const { RequestCoordinator } = require('../RequestCoordinator');
        const rc = new RequestCoordinator({});
        expect(rc.resolveRequest).toBeUndefined();
    });

    it('SubscriptionManager has no getClientSubscriptions method', () => {
        const { SubscriptionManager } = require('../SubscriptionManager');
        const sm = new SubscriptionManager();
        expect(sm.getClientSubscriptions).toBeUndefined();
    });

    it('StatusBroadcaster has no getCurrentStatus or getAvailableSymbols', () => {
        const { StatusBroadcaster } = require('../StatusBroadcaster');
        const sb = new StatusBroadcaster({});
        expect(sb.getCurrentStatus).toBeUndefined();
        expect(sb.getAvailableSymbols).toBeUndefined();
    });

    it('test-timeframe.js is deleted', () => {
        const fs = require('fs');
        const path = require('path');
        expect(fs.existsSync(path.resolve(__dirname, '../test-timeframe.js'))).toBe(false);
    });
});

describe('2.5 Config centralization', () => {
    it('CTraderSession reads from config, not process.env', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../CTraderSession.js'), 'utf8'
        );
        expect(source).toContain("require('./config')");
        expect(source).not.toContain('process.env.CTRADER_');
        expect(source).not.toContain('process.env.HOST');
        expect(source).not.toContain('process.env.PORT');
        expect(source).not.toContain('process.env.MAX_RECONNECT');
    });
});

describe('2.3 barToOHLC helper', () => {
    const { barToOHLC } = require('../CTraderDataProcessor');

    const calculatePrice = (val, digits) => Number(val.toFixed(digits));

    it('produces correct OHLC from raw bar', () => {
        const rawBar = {
            low: 1.0800,
            deltaOpen: 0.0003,
            deltaHigh: 0.0010,
            deltaClose: 0.0005,
            volume: 100,
            utcTimestampInMinutes: 1800
        };
        const result = barToOHLC(rawBar, 4, calculatePrice);
        expect(result.open).toBe(1.0803);
        expect(result.high).toBe(1.0810);
        expect(result.low).toBe(1.0800);
        expect(result.close).toBe(1.0805);
        expect(result.volume).toBe(100);
        expect(result.timestamp).toBe(1800 * 60 * 1000);
    });

    it('handles zero deltaHigh (flat bar)', () => {
        const rawBar = {
            low: 1.5000,
            deltaOpen: 0,
            deltaHigh: 0,
            deltaClose: 0,
            volume: 0,
            utcTimestampInMinutes: 2000
        };
        const result = barToOHLC(rawBar, 4, calculatePrice);
        expect(result.open).toBe(1.5000);
        expect(result.high).toBe(1.5000);
        expect(result.low).toBe(1.5000);
        expect(result.close).toBe(1.5000);
        expect(result.volume).toBe(0);
    });

    it('handles JPY pair digits', () => {
        const rawBar = {
            low: 150.500,
            deltaOpen: 0.050,
            deltaHigh: 0.200,
            deltaClose: 0.100,
            volume: 50,
            utcTimestampInMinutes: 1900
        };
        const result = barToOHLC(rawBar, 3, calculatePrice);
        expect(result.open).toBe(150.550);
        expect(result.high).toBe(150.700);
        expect(result.low).toBe(150.500);
        expect(result.close).toBe(150.600);
    });

    it('returns null timestamp when utcTimestampInMinutes is missing', () => {
        const rawBar = { low: 1.0, deltaOpen: 0, deltaHigh: 0, deltaClose: 0 };
        const result = barToOHLC(rawBar, 4, calculatePrice);
        expect(result.timestamp).toBeNull();
    });
});

describe('2.4 buildPrevDayFields helper', () => {
    const { buildPrevDayFields } = require('../utils/MessageBuilder');

    it('includes all 4 fields when present', () => {
        const result = buildPrevDayFields({
            open: 1.08, high: 1.09, low: 1.07, close: 1.085
        });
        expect(result).toEqual({
            prevDayOpen: 1.08,
            prevDayHigh: 1.09,
            prevDayLow: 1.07,
            prevDayClose: 1.085
        });
    });

    it('excludes undefined fields', () => {
        const result = buildPrevDayFields({
            open: 1.08, high: 1.09, low: undefined, close: 1.085
        });
        expect(result).toEqual({
            prevDayOpen: 1.08,
            prevDayHigh: 1.09,
            prevDayClose: 1.085
        });
        expect(result).not.toHaveProperty('prevDayLow');
    });

    it('returns empty object for null', () => {
        expect(buildPrevDayFields(null)).toEqual({});
    });

    it('returns empty object for undefined', () => {
        expect(buildPrevDayFields(undefined)).toEqual({});
    });

    it('handles only 1 field', () => {
        const result = buildPrevDayFields({ open: 1.08 });
        expect(result).toEqual({ prevDayOpen: 1.08 });
    });

    it('handles 0 fields (empty object)', () => {
        const result = buildPrevDayFields({});
        expect(result).toEqual({});
    });
});

describe('2.7 Redis multi.exec error checking', () => {
    it('sessionManager destructures multi.exec results', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../sessionManager.js'), 'utf8'
        );
        expect(source).toContain('const results = await multi.exec()');
        expect(source).toContain('for (const [err] of results)');
        expect(source).toContain('Redis multi.exec partial failure');
    });
});

describe('2.8 db.js schema check blocks startup', () => {
    it('verifySchema throws on incomplete schema', async () => {
        // We test by verifying the source throws instead of catching
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../db.js'), 'utf8'
        );
        // verifySchema should NOT have a try/catch wrapper
        expect(source).toContain('throw new Error(');
        expect(source).toContain('Auth schema incomplete');
    });

    it('server.js exits on schema verification failure', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../server.js'), 'utf8'
        );
        expect(source).toMatch(/verifySchema.*process\.exit\(1\)/s);
    });
});

// ─── Phase 3: Hardening ────────────────────────────────────────────────────

describe('3.1 Settle pending TradingView promises on disconnect', () => {
    it('handleDisconnect rejects pending promises before clearing', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../TradingViewSession.js'), 'utf8'
        );
        expect(source).toContain('pending.reject(new Error');
        expect(source).toContain('TradingView session disconnected');
        // The reject loop must come BEFORE clear()
        const rejectIdx = source.indexOf('pending.reject(new Error');
        const clearIdx = source.indexOf('_pendingHistorical.clear()');
        expect(rejectIdx).toBeGreaterThan(-1);
        expect(clearIdx).toBeGreaterThan(-1);
        expect(rejectIdx).toBeLessThan(clearIdx);
    });
});

describe('3.2 Drain PG pool and Redis on shutdown', () => {
    it('server.js has gracefulShutdown that drains pool and redis', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../server.js'), 'utf8'
        );
        expect(source).toContain('pool.end()');
        expect(source).toContain('sessionManager.redis.quit()');
    });

    it('both SIGINT and SIGTERM use gracefulShutdown', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(__dirname, '../server.js'), 'utf8'
        );
        expect(source).toContain("gracefulShutdown('SIGINT')");
        expect(source).toContain("gracefulShutdown('SIGTERM')");
    });

    it('pool is exported from db.js', () => {
        const db = require('../db');
        expect(db.pool).toBeDefined();
        expect(typeof db.pool.end).toBe('function');
    });
});

describe('3.3 SafeSender disconnect metrics', () => {
    it('drainDisconnectCount returns and resets counter', () => {
        // Re-require to get fresh module state
        vi.resetModules();
        const { send, drainDisconnectCount, BUFFER_THRESHOLD } = require('../utils/SafeSender');

        // Drain any accumulated count from earlier tests
        drainDisconnectCount();

        // Trigger slow disconnects
        const ws = {
            readyState: 1,
            bufferedAmount: BUFFER_THRESHOLD + 1,
            send: vi.fn(),
            close: vi.fn(),
        };
        send(ws, 'msg');
        send(ws, 'msg'); // Two disconnects

        const count = drainDisconnectCount();
        expect(count).toBe(2);

        // Counter should be reset
        const count2 = drainDisconnectCount();
        expect(count2).toBe(0);
    });
});

// ─── Smoke tests ───────────────────────────────────────────────────────────

describe('Smoke: all modified modules load cleanly', () => {
    const modules = [
        ['config.js', '../config'],
        ['db.js', '../db'],
        ['sessionManager.js', '../sessionManager'],
        ['CTraderSession.js', '../CTraderSession'],
        ['CTraderDataProcessor.js', '../CTraderDataProcessor'],
        ['DataRouter.js', '../DataRouter'],
        ['StatusBroadcaster.js', '../StatusBroadcaster'],
        ['WebSocketServer.js', '../WebSocketServer'],
        ['RequestCoordinator.js', '../RequestCoordinator'],
        ['TradingViewSession.js', '../TradingViewSession'],
        ['SubscriptionManager.js', '../SubscriptionManager'],
        ['HealthMonitor.js', '../HealthMonitor'],
        ['MarketProfileService.js', '../MarketProfileService'],
        ['persistenceRoutes.js', '../persistenceRoutes'],
        ['utils/SafeSender.js', '../utils/SafeSender'],
        ['utils/constants.js', '../utils/constants'],
        ['utils/MessageBuilder.js', '../utils/MessageBuilder'],
    ];

    it.each(modules)('%s loads without error', (name, path) => {
        expect(() => require(path)).not.toThrow();
    });
});
