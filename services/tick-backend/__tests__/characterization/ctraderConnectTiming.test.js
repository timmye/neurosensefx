'use strict';

/**
 * Connect-cycle timing markers (Phase 1.3 / Loop-B diagnosis).
 *
 * Asserts CTraderSession.connect() emits an ordered timeline — connect-start,
 * open / authenticate / loadAllSymbols step timings, restore-start, restore-end,
 * connect-end — so backend.log alone reconstructs whether the connect-phase
 * deadline fires and how long restore takes. Uses the REAL CTraderSession with a
 * faked transport (same pattern as ctraderConnect.test.js B0).
 *
 * Two test-mechanics notes:
 *  - Logger emits at `info`, but the characterization suite pins `logLevel:
 *    'error'` via applyFakeConfig. This file overrides to 'info' and lives in its
 *    own file, so per-file module isolation keeps that local.
 *  - Logger binds `console.log` at module-eval time, so the spy must be installed
 *    BEFORE CTraderSession (→ Logger) is required.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const { createFakeConnection, applyFakeConfig } = require('./helpers/ctraderFake');

applyFakeConfig({ logLevel: 'info' }); // connect markers emit at info
// Logger binds console.log at require time — spy must precede the require.
const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const { CTraderSession } = require('../../CTraderSession');

describe('connect-cycle timing markers (Phase 1.3)', () => {
    let session;

    beforeEach(() => {
        logSpy.mockClear();
        session = new CTraderSession();
    });

    afterEach(() => {
        try { if (session) session.stopHeartbeat(); } catch (e) { /* ignore */ }
        try { if (session && session.healthMonitor) session.healthMonitor.stop(); } catch (e) { /* ignore */ }
        try { if (session && session.reconnection) session.reconnection.cancelReconnect(); } catch (e) { /* ignore */ }
    });

    it('emits connect/restore markers in order with a non-negative total', async () => {
        const fake = createFakeConnection({
            openResult: true,
            scripts: {
                ProtoOAApplicationAuthReq: {},
                ProtoOAAccountAuthReq: {},
                // loadAllSymbols() populates the freshly-created loader's map.
                ProtoOASymbolsListReq: { symbol: [{ symbolName: 'EURUSD', symbolId: 1 }] },
                ProtoOASubscribeSpotsReq: {},
                ProtoOASubscribeLiveTrendbarReq: {},
            },
        });

        // Seed one tick + one M1 bar so restore runs and emits restore-start/end.
        session.activeSubscriptions = new Set(['EURUSD']);
        session.activeBarSubscriptions = new Map([['EURUSD:M1', true]]);

        await session.connect(fake);

        // Phase 2.2: restore is now POST-connect. connect() resolves once the
        // FAST handshake is done (connect-end), and the detached restore emits
        // restore-start/restore-end afterwards. Await restorePromise so the
        // restore-end marker has been logged before we scan the timeline.
        if (session.restorePromise) {
            await session.restorePromise;
        }

        // Each console.log call is (prefix, message, ...rest); join all args so
        // the marker text (2nd arg) is searchable alongside the timestamp prefix.
        const lines = logSpy.mock.calls.map((c) => c.map(String).join(' '));
        const idx = (marker) => lines.findIndex((l) => l.includes(marker));

        const connectStart = idx('connect-start');
        const open = idx('connect-step open');
        const auth = idx('connect-step authenticate');
        const symbols = idx('connect-step loadAllSymbols');
        const restoreStart = idx('restore-start');
        const restoreEnd = idx('restore-end');
        const connectEnd = idx('connect-end');

        // Every marker present. Handshake order: start → open → auth → symbols.
        expect(connectStart).toBeGreaterThanOrEqual(0);
        expect(open).toBeGreaterThan(connectStart);
        expect(auth).toBeGreaterThan(open);
        expect(symbols).toBeGreaterThan(auth);

        // connect-end (handshake total) now comes BEFORE restore: the deadline
        // only covers the sub-second handshake; restore is deferred. The
        // "restore deferred" note distinguishes the new connect-end line.
        expect(connectEnd).toBeGreaterThan(symbols);

        // Restore runs POST-connect, so its markers land after connect-end.
        expect(restoreStart).toBeGreaterThan(connectEnd);
        expect(restoreEnd).toBeGreaterThan(restoreStart);

        // connect-start reports the restore set we seeded (1 tick + 1 bar).
        expect(lines[connectStart]).toContain('1 tick');
        expect(lines[connectStart]).toContain('1 bar');

        // connect-end reports a non-negative total elapsed.
        const totalMatch = lines[connectEnd].match(/connect-end: (\d+)ms total/);
        expect(totalMatch).not.toBeNull();
        expect(Number(totalMatch[1])).toBeGreaterThanOrEqual(0);
    });
});
