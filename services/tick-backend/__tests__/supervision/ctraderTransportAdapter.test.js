import { describe, it, expect, vi } from 'vitest';
const fs = require('fs');
const path = require('path');
const { CTraderTransportAdapter } = require('../../supervision/CTraderTransportAdapter');

// Regression guard: the default factory requires the cTrader-Layer lib with a
// depth-relative path. The adapter is one directory deeper than CTraderSession,
// so the path must be THREE levels up. Offline tests inject a fake factory and
// never exercised the real path — this asserts it resolves to a real file.
// (Caught in the first live run: the path was one level too shallow.)
describe('CTraderTransportAdapter default lib path', () => {
    it('resolves the real cTrader-Layer entry relative to the adapter module', () => {
        const adapterPath = require.resolve('../../supervision/CTraderTransportAdapter');
        const libEntry = path.resolve(
            path.dirname(adapterPath),
            '../../../libs/cTrader-Layer/build/entry/node/main.js'
        );
        expect(fs.existsSync(libEntry)).toBe(true);
    });
});

// Minimal fake of the cTrader-Layer CTraderConnection surface the adapter uses.
function fakeLibConn({ openResolves = true, sendCommandImpl } = {}) {
    const handlers = new Map();
    const conn = {
        opened: false,
        ctorOpts: null,
        async open() { conn.opened = true; if (!openResolves) throw new Error('open failed'); },
        sendCommand: sendCommandImpl || (() => new Promise(() => {})), // hang by default
        sendHeartbeat: vi.fn(),
        on(e, fn) { if (!handlers.has(e)) handlers.set(e, []); handlers.get(e).push(fn); },
        removeListener(e, fn) { const a = handlers.get(e); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
        removeAllListeners(e) { handlers.delete(e); },
        close: vi.fn(),
        emit(e, ...args) { const a = handlers.get(e); if (a) for (const f of [...a]) f(...args); },
    };
    return conn;
}

describe('CTraderTransportAdapter (thin pass-through — post B1/B2)', () => {
    it('passes the HOSTNAME (not a pre-resolved IP) to the library — lets the lib do DNS+TLS ServerName', async () => {
        // The library's primary path resolves DNS→IP AND sets the TLS ServerName
        // to the hostname, so the *.ctraderapi.com cert verifies. Pre-resolving to
        // an IP here would break ServerName matching (cert mismatch). The adapter
        // must hand the hostname straight through.
        let constructedOpts = null;
        const conn = fakeLibConn();
        const adapter = new CTraderTransportAdapter({
            host: 'live.ctraderapi.com', port: 5035,
            connectionFactory: (opts) => { constructedOpts = opts; return conn; },
        });

        await adapter.open();

        expect(constructedOpts).toEqual({ host: 'live.ctraderapi.com', port: 5035 });
        expect(conn.opened).toBe(true);
    });

    // Runtime-loop root cause (found live): the FeedSupervisor opens the transport,
    // then CTraderSession.connect() calls open() AGAIN on the same transport. Without
    // the idempotent guard the second open() creates a SECOND library connection,
    // orphaning the first → two live cTrader connections for one app/account →
    // cTrader kills the duplicate after ~28s (its "at most one connection" rule).
    it('open() is idempotent — a second open() does not create a second connection', async () => {
        let factoryCalls = 0;
        const conn = fakeLibConn();
        const adapter = new CTraderTransportAdapter({
            host: 'live.ctraderapi.com', port: 5035,
            connectionFactory: () => { factoryCalls++; return conn; },
        });
        await adapter.open();       // supervisor open
        await adapter.open();       // session.connect() open (must be a no-op)
        expect(factoryCalls).toBe(1); // exactly ONE library connection — no duplicate socket
        expect(conn.opened).toBe(true);
    });

    // sendCommand is now a thin delegate to conn.sendCommand (the per-RPC TTL and
    // reject-on-close are layer-owned — L4/L3 — and proven in
    // __tests__/layer/CTraderCommandMap.test.js). The adapter just passes through.
    it('sendCommand delegates to the underlying connection and resolves with its result', async () => {
        const conn = fakeLibConn({ sendCommandImpl: (name) => Promise.resolve({ name, ok: true }) });
        const adapter = new CTraderTransportAdapter({
            host: 'h', port: 5035,
            connectionFactory: () => conn,
        });
        await adapter.open();
        await expect(adapter.sendCommand('ProtoOASymbolsListReq', { x: 1 })).resolves.toEqual({ name: 'ProtoOASymbolsListReq', ok: true });
    });

    it('sendCommand rejects if the underlying connection rejects', async () => {
        const conn = fakeLibConn({ sendCommandImpl: () => Promise.reject(new Error('CH_ACCESS_DENIED')) });
        const adapter = new CTraderTransportAdapter({
            host: 'h', port: 5035,
            connectionFactory: () => conn,
        });
        await adapter.open();
        await expect(adapter.sendCommand('ProtoOAAccountAuthReq', {})).rejects.toThrow('CH_ACCESS_DENIED');
    });

    it('sendCommand rejects before open() is called', () => {
        const adapter = new CTraderTransportAdapter({ host: 'h', port: 5035, connectionFactory: () => fakeLibConn() });
        return expect(adapter.sendCommand('X', {})).rejects.toThrow(/not open/);
    });

    // Heartbeats delegate straight to the layer's leak-free sendHeartbeat()
    // (Plan Phase 1 / L2). The byte-frame correctness of the raw keepalive is
    // proven in __tests__/layer/CTraderProtobufReader.test.js — not duplicated here.
    it('sendHeartbeat delegates to the layer connection (leak-free raw frame)', async () => {
        const conn = fakeLibConn();
        const adapter = new CTraderTransportAdapter({
            host: 'h', port: 5035,
            connectionFactory: () => conn,
        });
        await adapter.open();
        adapter.sendHeartbeat();
        expect(conn.sendHeartbeat).toHaveBeenCalledTimes(1);
    });

    it('delegates on/removeListener to the underlying connection', async () => {
        const conn = fakeLibConn();
        const adapter = new CTraderTransportAdapter({
            host: 'h', port: 5035,
            connectionFactory: () => conn,
        });
        await adapter.open();
        const fn = vi.fn();
        adapter.on('PROTO_OA_SPOT_EVENT', fn);
        conn.emit('PROTO_OA_SPOT_EVENT', { bid: 1 });
        expect(fn).toHaveBeenCalledWith({ bid: 1 });
    });

    // The supervisor's mid-stream re-arm depends on this: a layer close flows
    // through the adapter's `on` pass-through to FeedSupervisor._onTransportClosed.
    it('passes the conn "close" event through to a registered listener (supervisor re-arm path)', async () => {
        const conn = fakeLibConn();
        const adapter = new CTraderTransportAdapter({
            host: 'h', port: 5035,
            connectionFactory: () => conn,
        });
        await adapter.open();
        const onClose = vi.fn();
        adapter.on('close', onClose);
        conn.emit('close');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('close() closes the underlying connection and is idempotent', async () => {
        const conn = fakeLibConn();
        const adapter = new CTraderTransportAdapter({
            host: 'h', port: 5035,
            connectionFactory: () => conn,
        });
        await adapter.open();
        adapter.close();
        adapter.close(); // idempotent — conn.close called exactly once
        expect(conn.close).toHaveBeenCalledTimes(1);
    });
});
