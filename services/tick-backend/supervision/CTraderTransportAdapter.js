const path = require('path');
const tls = require('tls');
const { createLogger } = require('../utils/Logger');
const log = createLogger('CTraderTransportAdapter');

const DEFAULT_COMMAND_TTL_MS = 15000;

// ── Raw cTrader heartbeat (Loop-A / Loop-F fix — Plan Phase 5.2) ───────────
// The library's sendHeartbeat() routes through sendCommand(), which attaches a
// clientMsgId. cTrader treats ProtoHeartbeatEvent as a ONE-WAY event and IGNORES
// any frame carrying a clientMsgId, so the server's ~30s idle timer expires and
// it sends a clean TLS FIN (the "30-second disconnect" reproduced live). The fix
// writes a bare ProtoHeartbeatEvent frame — NO clientMsgId — directly to the TLS
// socket, which the server honors (resets its idle timer) AND bypasses the
// library's command map (so no heartbeat promise ever leaks — Loop-F).
//
// Wire layout (verified empirically against the library's own encoder):
//   00 00 00 04   Int32BE length = 4 (CTraderEncoderDecoder frame prefix)
//   08 33         ProtoMessage.payloadType = 51 (HEARTBEAT_EVENT), field 1 varint
//   12 00         ProtoMessage.payload = empty bytes (empty ProtoHeartbeatEvent), field 2
//   (no field 3 clientMsgId → a valid one-way keepalive)
const PINNED_RAW_HEARTBEAT_FRAME = Buffer.from([0x00, 0x00, 0x00, 0x04, 0x08, 0x33, 0x12, 0x00]);
let _heartbeatFrameCache = null;

/**
 * Build the raw ProtoHeartbeatEvent keepalive frame using the cTrader-Layer
 * library's OWN protobuf encoder — byte-exact to the library format but WITHOUT
 * a clientMsgId. Cached at module scope (the frame is static across connects).
 * Falls back to the PINNED_RAW_HEARTBEAT_FRAME constant if the library internals
 * can't be loaded (e.g. a relocated build); the constant is verified-correct for
 * the pinned proto. HEARTBEAT_EVENT = 51; clientMsgId = undefined → field omitted.
 * @returns {Buffer}
 */
function buildHeartbeatFrame() {
    if (_heartbeatFrameCache) return _heartbeatFrameCache;
    try {
        const libRoot = path.resolve(__dirname, '../../../libs/cTrader-Layer');
        const { CTraderProtobufReader } = require(libRoot + '/build/src/core/protobuf/CTraderProtobufReader');
        const { CTraderEncoderDecoder } = require(libRoot + '/build/src/core/encoder-decoder/CTraderEncoderDecoder');
        const reader = new CTraderProtobufReader([
            { file: path.join(libRoot, 'protobuf/OpenApiCommonMessages.proto') },
            { file: path.join(libRoot, 'protobuf/OpenApiMessages.proto') },
        ]);
        reader.load();
        reader.build();
        const encoder = new CTraderEncoderDecoder();
        _heartbeatFrameCache = encoder.encode(reader.encode(51, {}, undefined));
    } catch (e) {
        log.warn('raw-heartbeat: library encoder unavailable, using pinned frame constant:', e.message);
        _heartbeatFrameCache = PINNED_RAW_HEARTBEAT_FRAME;
    }
    return _heartbeatFrameCache;
}

/**
 * Default factory: build a real cTrader-Layer CTraderConnection. Lazy-required
 * so tests that inject their own factory never touch the (out-of-root) library.
 *
 * We pass the HOSTNAME (not a pre-resolved IP): the library's CTraderSocket
 * primary path does `dns.lookup(host) → tls.connect({ host: ip, servername: host })`
 * itself — it resolves DNS to an IP AND sets the TLS ServerName to the hostname
 * so the *.ctraderapi.com certificate verifies. Pre-resolving to an IP in this
 * adapter would break that (the lib would use the IP as ServerName → cert
 * mismatch). The adapter stays out of DNS; the library's primary path owns it.
 */
function defaultConnectionFactory({ host, port }) {
    // Adapter lives in services/tick-backend/supervision/, so the repo-root lib
    // path is THREE levels up (supervision → tick-backend → services → root),
    // not the two levels CTraderSession.js (one dir shallower) uses.
    const { CTraderConnection } = require('../../../libs/cTrader-Layer/build/entry/node/main');
    return new CTraderConnection({ host, port });
}

/**
 * CTraderTransportAdapter — our Transport tier over the read-only cTrader-Layer
 * library. Responsibilities:
 *
 *   - Defect #4 (hung command / infinite await): every `sendCommand` is wrapped
 *     in a per-RPC TTL and tracked. On TTL expiry the local promise rejects AND
 *     the transport force-closes (breaking the hang so the supervisor re-arms).
 *     On close, all pending RPCs reject (no unbounded awaits). The library's
 *     own internal command map stays untouched (read-only); our tier no longer
 *     awaits it unbounded.
 *
 *   - Heartbeats use `sendRaw`, which writes a raw `ProtoHeartbeatEvent` frame
 *     WITHOUT a clientMsgId directly to the captured TLS socket (Loop-A/F). The
 *     library's sendHeartbeat()→sendCommand() path attaches a clientMsgId that
 *     cTrader ignores on a one-way event, so the server's ~30s idle timer would
 *     expire and close the connection. The raw frame is honored and bypasses the
 *     library's command map entirely (no leaked heartbeat promise).
 *
 *   - Fallback trap (WSL2 TLS-handshake hang): NOT handled by DNS pre-resolution
 *     here (that would break TLS ServerName matching — see the factory note).
 *     Instead it is mitigated one tier up: the library's fallback
 *     (`tls.connect(hostname)` on a DNS throw) can hang, but the FeedSupervisor's
 *     connect-phase deadline bounds that hang and its never-give-up retry
 *     re-arms until DNS recovers and the primary path succeeds. The original
 *     incident's harm was the permanent GIVE-UP, not the bounded hang — that
 *     give-up is now gone, so the feed self-heals.
 *
 * Everything injectable (`connectionFactory`, `scheduleTimeout`/`cancelTimeout`)
 * for deterministic offline tests.
 */
class CTraderTransportAdapter {
    constructor({
        host,
        port,
        commandTtlMs = DEFAULT_COMMAND_TTL_MS,
        connectionFactory = defaultConnectionFactory,
        scheduleTimeout = (fn, ms) => setTimeout(fn, ms),
        cancelTimeout = (t) => clearTimeout(t),
    } = {}) {
        this.host = host;
        this.port = port;
        this.commandTtlMs = commandTtlMs;
        this.connectionFactory = connectionFactory;
        this._scheduleTimeout = scheduleTimeout;
        this._cancelTimeout = cancelTimeout;
        this.conn = null;
        this._pending = new Map(); // rpcId -> { resolve, reject, timer }
        this._nextRpcId = 1;
        this._closed = false;
        this._opened = false; // idempotent open() guard (see open())
        // Raw-heartbeat seam (Loop-A/F): the captured TLS socket the library
        // opens to the cTrader host, so sendRaw() can write a clientMsgId-free
        // frame directly. Null until captured during open(), cleared on close.
        this._rawSocket = null;
        this._tlsPatched = false;
        this._origTlsConnect = null;
    }

    async open() {
        // Idempotent: the FeedSupervisor opens the transport (so its connect-phase
        // deadline covers open()+handshake, incl. the WSL2 TLS-hang), then calls
        // feed.connect(transport), and CTraderSession.connect() calls open() AGAIN
        // on the same transport. Without this guard the second open() creates a
        // SECOND cTrader-Layer connection/socket, orphaning the first → two live
        // connections for one app/account → cTrader kills the duplicate after ~28s
        // (its documented "at most one connection" rule). Guard so only the first
        // open() creates the connection; later calls reuse it.
        if (this._opened || this._closed) return;
        this._opened = true;
        // Pass the hostname through; the library resolves DNS→IP itself and sets
        // the TLS ServerName to the hostname (see defaultConnectionFactory note).
        this.conn = this.connectionFactory({ host: this.host, port: this.port });

        // Reject every pending RPC when the socket closes (defect #4).
        this.conn.on('close', () => this._rejectAllPending(new Error('cTrader transport closed')));
        this.conn.on('error', (err) => log.warn('connection error:', err?.message || err));

        // Capture the raw TLS socket during open() so sendRaw() can write a
        // clientMsgId-free heartbeat directly (Loop-A/F). Installed only for the
        // duration of open() and restored immediately after — a short, scoped window.
        this._installSocketCapture();
        try {
            await this.conn.open();
        } finally {
            this._uninstallSocketCapture();
        }
    }

    /**
     * Temporarily wrap tls.connect to capture the raw TLS socket the library
     * opens to THIS adapter's cTrader host (Loop-A/F raw-heartbeat seam — Plan
     * Phase 5.2: "wrap tls.connect keyed to the cTrader host"). Scoped: only
     * sockets whose TLS servername matches this host are captured; every other
     * connection passes through untouched. Restored by _uninstallSocketCapture()
     * as soon as open() settles.
     * @private
     */
    _installSocketCapture() {
        if (this._tlsPatched) return;
        const adapter = this;
        const original = tls.connect;
        this._origTlsConnect = original;
        this._tlsPatched = true;
        tls.connect = function patchedTlsConnect(...args) {
            const socket = original.apply(tls, args);
            try {
                const opts = (typeof args[0] === 'object' && args[0]) ? args[0] : {};
                const servername = opts.servername || opts.host;
                if (servername && String(servername).toLowerCase() === String(adapter.host).toLowerCase()) {
                    adapter._rawSocket = socket;
                    socket.on('close', () => { if (adapter._rawSocket === socket) adapter._rawSocket = null; });
                }
            } catch (e) { /* never let capture logic break a real connection */ }
            return socket;
        };
    }

    /** Restore the original tls.connect. @private */
    _uninstallSocketCapture() {
        if (!this._tlsPatched) return;
        try { tls.connect = this._origTlsConnect; } catch (e) { /* ignore */ }
        this._tlsPatched = false;
        this._origTlsConnect = null;
    }

    /**
     * Send a request command, bounded by a per-RPC TTL. On expiry the promise
     * rejects and the transport force-closes. Tracked so close can reject it.
     * @param {string} name - payload type name (e.g. 'ProtoOAApplicationAuthReq')
     * @param {object} [payload]
     * @returns {Promise<object>} response payload
     */
    sendCommand(name, payload) {
        if (!this.conn) return Promise.reject(new Error('cTrader transport not open'));
        const rpcId = this._nextRpcId++;
        return new Promise((resolve, reject) => {
            const timer = this._scheduleTimeout(() => {
                if (this._pending.has(rpcId)) {
                    this._pending.delete(rpcId);
                    log.warn(`command timed out: ${name} (>${this.commandTtlMs}ms) — closing transport`);
                    reject(new Error(`cTrader command timed out: ${name} (>${this.commandTtlMs}ms)`));
                    // Force-close to break the hang and re-arm the supervisor.
                    this._forceClose();
                }
            }, this.commandTtlMs);

            this._pending.set(rpcId, { resolve, reject, timer });
            this.conn.sendCommand(name, payload).then(
                (res) => { this._cancelTimeout(timer); this._pending.delete(rpcId); resolve(res); },
                (err) => { this._cancelTimeout(timer); this._pending.delete(rpcId); reject(err); }
            );
        });
    }

    /**
     * Send a raw ProtoHeartbeatEvent keepalive WITHOUT a clientMsgId (Loop-A/F).
     * cTrader ignores heartbeats that carry a clientMsgId and closes idle
     * connections after ~30s; writing this bare frame directly to the captured
     * TLS socket keeps the server's idle timer warm AND bypasses the library's
     * command map (no leaked/awaited heartbeat promise — Loop-F). Falls back to
     * the library's sendHeartbeat() only when no socket was captured (e.g. a fake
     * transport in tests) — a leaked promise is better than a dropped keepalive.
     */
    sendRaw(/* payload */) {
        const frame = buildHeartbeatFrame();
        const socket = this._rawSocket;
        if (frame && socket && !socket.destroyed && socket.writable) {
            try {
                socket.write(frame);
                return;
            } catch (e) { /* fall through to the legacy path */ }
        }
        if (this.conn) {
            try { this.conn.sendHeartbeat(); } catch (e) { /* connection closing */ }
        }
    }

    on(event, fn) {
        if (this.conn) this.conn.on(event, fn);
    }

    removeListener(event, fn) {
        if (this.conn) this.conn.removeListener(event, fn);
    }

    removeAllListeners(event) {
        if (this.conn) this.conn.removeAllListeners(event);
    }

    close() {
        this._forceClose();
    }

    _forceClose() {
        if (this._closed) return;
        this._closed = true;
        this._rejectAllPending(new Error('cTrader transport closed'));
        this._rawSocket = null; // release the captured raw-heartbeat socket
        if (this.conn) {
            try { this.conn.close(); } catch (e) { /* ignore */ }
        }
    }

    _rejectAllPending(err) {
        for (const [, entry] of this._pending) {
            this._cancelTimeout(entry.timer);
            try { entry.reject(err); } catch (e) { /* ignore */ }
        }
        this._pending.clear();
    }
}

module.exports = { CTraderTransportAdapter, DEFAULT_COMMAND_TTL_MS, buildHeartbeatFrame, PINNED_RAW_HEARTBEAT_FRAME };
