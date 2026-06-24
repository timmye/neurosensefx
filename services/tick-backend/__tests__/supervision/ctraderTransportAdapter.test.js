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
            scheduleTimeout: timers.scheduleTimeout, cancelTimeout: timers.cancelTimeout,
        });
        await adapter.open();       // supervisor open
        await adapter.open();       // session.connect() open (must be a no-op)
        expect(factoryCalls).toBe(1); // exactly ONE library connection — no duplicate socket
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

    it('sendRaw falls back to the library heartbeat when no raw socket is captured (e.g. fakes)', async () => {
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

    // Loop-A/F: the raw keepalive frame is a bare ProtoHeartbeatEvent with NO
    // clientMsgId (re-derived from the library's own encoder; drift guard).
    it('raw heartbeat frame is a clientMsgId-free ProtoHeartbeatEvent (Loop-A/F)', () => {
        const { buildHeartbeatFrame, PINNED_RAW_HEARTBEAT_FRAME } = require('../../supervision/CTraderTransportAdapter');
        const frame = buildHeartbeatFrame();
        // Verified-empirically bytes: Int32BE(4) + payloadType=51 + empty payload, NO clientMsgId.
        expect(frame.toString('hex')).toBe(PINNED_RAW_HEARTBEAT_FRAME.toString('hex'));
        expect(frame.toString('hex')).toBe('000000040833' + '1200'); // 0a.. never appears (no clientMsgId)
        expect(frame.toString('hex')).not.toMatch(/1a/); // field-3 clientMsgId tag absent
    });

    // Loop-A/F: with a captured raw socket, sendRaw writes the frame directly and
    // does NOT route through the library command map (no leak / no clientMsgId).
    it('sendRaw writes the raw frame to the captured socket, bypassing the command map', async () => {
        const conn = fakeLibConn();
        const adapter = new CTraderTransportAdapter({
            host: 'h', port: 5035, dnsLookup: async () => '1.1.1.1',
            connectionFactory: () => conn,
            scheduleTimeout: timers.scheduleTimeout, cancelTimeout: timers.cancelTimeout,
        });
        await adapter.open();
        const writes = [];
        // Inject a fake captured socket (as the tls.connect capture would).
        adapter._rawSocket = { destroyed: false, writable: true, write: (b) => writes.push(b) };
        adapter.sendRaw();
        expect(writes).toHaveLength(1);
        expect(writes[0].toString('hex')).toBe('000000040833' + '1200');
        expect(conn.sendHeartbeat).not.toHaveBeenCalled(); // command map NOT touched
        expect(timers.pendingCount()).toBe(0);
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
