/**
 * Layer A — symbol-subscription error `code` on the wire.
 *
 * Covers:
 *   - deriveClientCode(): the 4 derivation branches (SYMBOL_NOT_FOUND / RATE_LIMIT
 *     / TIMEOUT / unknown→undefined).
 *   - notifyClientsError() attaches the derived `code` to the sent frame, and
 *     omits a wrong code (undefined → the frame omits it).
 *
 * Offline, no network/creds/PG/Redis.
 */
import { describe, it, expect } from 'vitest';

const { deriveClientCode, RequestCoordinator } = require('../RequestCoordinator');

// Minimal wsServer double: record the last frame sent to each client.
function makeWsServer() {
    const sent = [];
    return {
        sent,
        sendToClient(client, frame) { sent.push({ client, frame }); },
    };
}

describe('deriveClientCode', () => {
    it('returns SYMBOL_NOT_FOUND when the error carries that .code', () => {
        const err = new Error('Symbol not found in map: EURUSD');
        err.code = 'SYMBOL_NOT_FOUND';
        expect(deriveClientCode(err)).toBe('SYMBOL_NOT_FOUND');
    });

    it('returns RATE_LIMIT for a cTrader rate-limit errorCode payload', () => {
        // Raw protobuf rejection payload shape (carries .errorCode, no .message).
        expect(deriveClientCode({ errorCode: 'REQUEST_FREQUENCY_EXCEEDED' })).toBe('RATE_LIMIT');
        expect(deriveClientCode({ errorCode: 'SPEED_OVERLIMIT' })).toBe('RATE_LIMIT');
        expect(deriveClientCode({ errorCode: 'BLOCKED_PAYLOAD_TYPE' })).toBe('RATE_LIMIT');
        expect(deriveClientCode({ errorCode: 'TOO_MANY_REQUESTS' })).toBe('RATE_LIMIT');
        expect(deriveClientCode({ errorCode: 'CH_TOO_MANY_REQUESTS' })).toBe('RATE_LIMIT');
    });

    it('returns TIMEOUT for the Promise.race fetchTimeout message', () => {
        const err = new Error('Request timed out');
        expect(deriveClientCode(err)).toBe('TIMEOUT');
    });

    it('returns undefined for an unknown / non-rate-limit error (no wrong code)', () => {
        expect(deriveClientCode(new Error('Some other failure'))).toBeUndefined();
        // A permanent cTrader rejection (e.g. auth) is PERMANENT, not rate-limit.
        expect(deriveClientCode({ errorCode: 'NOT_AUTHORIZED' })).toBeUndefined();
        expect(deriveClientCode(null)).toBeUndefined();
        expect(deriveClientCode(undefined)).toBeUndefined();
    });

    it('prefers SYMBOL_NOT_FOUND over RATE_LIMIT (derivation order)', () => {
        // A tagged not-found error wins even if it coincidentally carried an
        // errorCode field — the explicit .code is the strongest signal.
        const err = new Error('Symbol not found in map: EURUSD');
        err.code = 'SYMBOL_NOT_FOUND';
        err.errorCode = 'REQUEST_FREQUENCY_EXCEEDED';
        expect(deriveClientCode(err)).toBe('SYMBOL_NOT_FOUND');
    });
});

describe('RequestCoordinator.notifyClientsError — frame carries derived code', () => {
    it('attaches SYMBOL_NOT_FOUND to the error frame', () => {
        const wsServer = makeWsServer();
        const rc = new RequestCoordinator(wsServer);
        const client = { id: 1 };
        const err = new Error('Symbol not found in map: EURUSD');
        err.code = 'SYMBOL_NOT_FOUND';

        rc.notifyClientsError([client], 'EURUSD', err, 'ctrader');

        expect(wsServer.sent).toHaveLength(1);
        const { frame } = wsServer.sent[0];
        expect(frame.type).toBe('error');
        expect(frame.code).toBe('SYMBOL_NOT_FOUND');
        expect(frame.symbol).toBe('EURUSD');
        expect(frame.source).toBe('ctrader');
        expect(frame.message).toContain('EURUSD');
    });

    it('attaches RATE_LIMIT to the error frame', () => {
        const wsServer = makeWsServer();
        const rc = new RequestCoordinator(wsServer);
        rc.notifyClientsError([{ id: 1 }], 'EURUSD', { errorCode: 'REQUEST_FREQUENCY_EXCEEDED' }, 'ctrader');

        expect(wsServer.sent[0].frame.code).toBe('RATE_LIMIT');
    });

    it('attaches TIMEOUT to the error frame', () => {
        const wsServer = makeWsServer();
        const rc = new RequestCoordinator(wsServer);
        rc.notifyClientsError([{ id: 1 }], 'EURUSD', new Error('Request timed out'), 'ctrader');

        expect(wsServer.sent[0].frame.code).toBe('TIMEOUT');
    });

    it('omits code (undefined) for an unrecognized error — generic on the client', () => {
        const wsServer = makeWsServer();
        const rc = new RequestCoordinator(wsServer);
        rc.notifyClientsError([{ id: 1 }], 'EURUSD', new Error('Unexpected boom'), 'ctrader');

        const { frame } = wsServer.sent[0];
        expect(frame.type).toBe('error');
        // code is undefined (JSON-serialized away) so an older client sees no new
        // field and falls back to generic — backward compatible.
        expect(frame.code).toBeUndefined();
        // Existing fields are untouched (additive only).
        expect(frame.message).toBeDefined();
        expect(frame.symbol).toBe('EURUSD');
        expect(frame.source).toBe('ctrader');
    });
});
