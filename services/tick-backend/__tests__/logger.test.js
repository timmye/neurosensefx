'use strict';

/**
 * Logger diagnostics tests (Phase 1.1 / Loop-H + Phase 1.2 helper).
 *
 * - Every emitted line, at every level, carries a millisecond ISO-8601 timestamp
 *   prefix (the fix for "backend.log has no timestamps").
 * - describeError() surfaces errorCode/description from raw cTrader payloads
 *   instead of collapsing to "[object Object]" (Loop-D).
 *
 * config.js is a plain writable object and Logger snapshots logLevel/nodeEnv at
 * require time, so we set deterministic values BEFORE requiring Logger.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const config = require('../config');
config.nodeEnv = 'production'; // COLORIZE=false → clean `[Module]` prefix, no ANSI
config.logLevel = 'debug'; // all four levels emit
const { createLogger, describeError } = require('../utils/Logger');

describe('Logger', () => {
    describe('timestamp prefix (Loop-H)', () => {
        // e.g. 2026-06-24T15:03:21.417Z [Mod]
        const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[Mod\]$/;
        let restore;

        beforeEach(() => {
            restore = [
                vi.spyOn(console, 'error').mockImplementation(() => {}),
                vi.spyOn(console, 'warn').mockImplementation(() => {}),
                vi.spyOn(console, 'log').mockImplementation(() => {}),
            ];
        });
        afterEach(() => restore.forEach((s) => s.mockRestore()));

        it('prefixes every level with a millisecond timestamp + [module]', () => {
            const log = createLogger('Mod');
            log.error('e');
            log.warn('w');
            log.info('i');
            log.debug('d');

            expect(console.error.mock.calls[0][0]).toMatch(TS);
            expect(console.warn.mock.calls[0][0]).toMatch(TS);
            // info + debug both route to console.log
            expect(console.log.mock.calls[0][0]).toMatch(TS);
            expect(console.log.mock.calls[1][0]).toMatch(TS);
        });

        it('passes through user args unchanged after the prefix', () => {
            const log = createLogger('Mod');
            const obj = { a: 1 };
            log.info('hello', obj);

            expect(console.log.mock.calls[0][0]).toMatch(TS);
            expect(console.log.mock.calls[0][1]).toBe('hello');
            expect(console.log.mock.calls[0][2]).toBe(obj);
        });
    });

    describe('describeError (Loop-D)', () => {
        it('surfaces errorCode + description from a raw protobuf payload', () => {
            const out = describeError({
                errorCode: 'CH_ALREADY_SUBSCRIBED',
                description: 'Already subscribed',
                payloadType: 2168,
            });
            expect(out).toContain('errorCode=CH_ALREADY_SUBSCRIBED');
            expect(out).toContain('description=Already subscribed');
            expect(out).not.toContain('[object Object]');
        });

        it('renders a native Error by its message', () => {
            expect(describeError(new Error('boom'))).toBe('boom');
        });

        it('renders our SYMBOL_NOT_FOUND errors (message + code + symbol)', () => {
            const e = new Error('Symbol ID not found for AUDCHF');
            e.code = 'SYMBOL_NOT_FOUND';
            e.symbol = 'AUDCHF';
            const out = describeError(e);
            expect(out).toContain('Symbol ID not found for AUDCHF');
            expect(out).toContain('code=SYMBOL_NOT_FOUND');
            expect(out).toContain('symbol=AUDCHF');
        });

        it('handles null/undefined and bare objects without "[object Object]"', () => {
            expect(describeError(undefined)).toBe('undefined');
            expect(describeError(null)).toBe('null');
            expect(describeError({ a: 1 })).toBe('{"a":1}');
        });
    });
});
