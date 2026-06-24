import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// Manual timer scheduler so the TTL is deterministic without real timers.
function manualTimers() {
    const timers = [];
    return {
        scheduleTimeout: (fn) => { const t = { fn, cancelled: false }; timers.push(t); return t; },
        cancelTimeout: (t) => { if (t) t.cancelled = true; },
        fireAll() { for (const t of [...timers]) if (!t.cancelled) t.fn(); },
        pendingCount: () => timers.filter((t) => !t.cancelled).length,
    };
}

describe('CTraderTransportAdapter (B4)', () => {
    let timers;
    beforeEach(() => { timers = manualTimers(); });

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
            scheduleTimeout: timers.scheduleTimeout,
            cancelTimeout: timers.cancelTimeout,
        });

        await adapter.open();

        expect(constructedOpts).toEqual({ host: 'live.ctraderapi.com', port: 5035 });
        expect(conn.opened).toBe(true);
    });

    it('sendCommand resolves with the connection response', async () => {
        const conn = fakeLibConn({ sendCommandImpl: (name) => Promise.resolve({ name, ok: true }) });
        const adapter = new CTraderTransportAdapter({
            host: 'h', port: 5035, dnsLookup: async () => '1.1.1.1',
            connectionFactory: () => conn,
            scheduleTimeout: timers.scheduleTimeout, cancelTimeout: timers.cancelTimeout,
        });
        await adapter.open();
        await expect(adapter.sendCommand('ProtoOASymbolsListReq', { x: 1 })).resolves.toEqual({ name: 'ProtoOASymbolsListReq', ok: true });
    });

    // #4: a sendCommand whose reply never arrives rejects within the TTL and force-closes.
    it('#4 hung command: rejects within the TTL and closes the transport', async () => {
        const conn = fakeLibConn({ sendCommandImpl: () => new Promise(() => {}) }); // never resolves
        const adapter = new CTraderTransportAdapter({
            host: 'h', port: 5035, commandTtlMs: 5000,
            dnsLookup: async () => '1.1.1.1', connectionFactory: () => conn,
            scheduleTimeout: timers.scheduleTimeout, cancelTimeout: timers.cancelTimeout,
        });
        await adapter.open();

        const p = adapter.sendCommand('ProtoOAAccountAuthReq', {});
        // TTL not yet fired ⇒ still pending.
        expect(timers.pendingCount()).toBe(1);

        timers.fireAll(); // TTL expires
        await expect(p).rejects.toThrow(/timed out/);
        expect(conn.close).toHaveBeenCalled(); // force-close to break the hang
    });

    // #4: pending RPCs reject when the transport closes (no unbounded awaits).
    it('#4 reject-on-close: pending sendCommand rejects when the socket closes', async () => {
        const conn = fakeLibConn({ sendCommandImpl: () => new Promise(() => {}) });
        const adapter = new CTraderTransportAdapter({
            host: 'h', port: 5035, dnsLookup: async () => '1.1.1.1',
            connectionFactory: () => conn,
            scheduleTimeout: timers.scheduleTimeout, cancelTimeout: timers.cancelTimeout,
        });
        await adapter.open();

        const p = adapter.sendCommand('ProtoOASymbolsListReq', {});
        conn.emit('close'); // socket drops mid-RPC
        await expect(p).rejects.toThrow(/closed/);
    });

    it('sendRaw sends a heartbeat fire-and-forget (not awaited/tracked)', async () => {
        const conn = fakeLibConn();
        const adapter = new CTraderTransportAdapter({
            host: 'h', port: 5035, dnsLookup: async () => '1.1.1.1',
            connectionFactory: () => conn,
            scheduleTimeout: timers.scheduleTimeout, cancelTimeout: timers.cancelTimeout,
        });
        await adapter.open();
        adapter.sendRaw();
        expect(conn.sendHeartbeat).toHaveBeenCalledTimes(1);
        expect(timers.pendingCount()).toBe(0); // heartbeat not tracked as an RPC
    });

    it('delegates on/removeListener to the underlying connection', async () => {
        const conn = fakeLibConn();
        const adapter = new CTraderTransportAdapter({
            host: 'h', port: 5035, dnsLookup: async () => '1.1.1.1',
            connectionFactory: () => conn,
            scheduleTimeout: timers.scheduleTimeout, cancelTimeout: timers.cancelTimeout,
        });
        await adapter.open();
        const fn = vi.fn();
        adapter.on('PROTO_OA_SPOT_EVENT', fn);
        conn.emit('PROTO_OA_SPOT_EVENT', { bid: 1 });
        expect(fn).toHaveBeenCalledWith({ bid: 1 });
    });
});
