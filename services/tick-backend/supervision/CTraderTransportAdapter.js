const { createLogger } = require('../utils/Logger');
const log = createLogger('CTraderTransportAdapter');

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
 * CTraderTransportAdapter — a THIN pass-through over the cTrader-Layer library.
 *
 * After Plan Phase 1 (L1–L4, live-validated), the layer owns every transport
 * lifecycle concern the adapter used to compensate for externally:
 *   - L1: open() rejects on failure (no more hang).
 *   - L2: sendHeartbeat() writes a leak-free raw frame (no monkey-patch).
 *   - L3: close() rejects all in-flight commands (no adapter reject-on-close).
 *   - L4: per-RPC command TTL (no external _pending Map / force-close-on-timeout).
 *
 * What remains here is glue: an idempotent open() guard (so the supervisor's
 * open and CTraderSession.connect()'s open share one library connection), a
 * connection factory seam (testability), and event pass-throughs so the
 * FeedSupervisor still observes conn 'close'/'error' (its mid-stream re-arm
 * path: layer L4 timeout → close() → 'close' event → this.on pass-through →
 * FeedSupervisor._onTransportClosed).
 *
 * @param {object} opts
 * @param {string} opts.host  cTrader host (passed through; lib resolves DNS+TLS).
 * @param {number} opts.port  cTrader port.
 * @param {function} [opts.connectionFactory]  Injectable factory (testability).
 */
class CTraderTransportAdapter {
    constructor({
        host,
        port,
        connectionFactory = defaultConnectionFactory,
    } = {}) {
        this.host = host;
        this.port = port;
        this.connectionFactory = connectionFactory;
        this.conn = null;
        this._closed = false;
        this._opened = false; // idempotent open() guard (see open())
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
        await this.conn.open();
    }

    /**
     * Thin delegate to the layer. The per-RPC TTL (L4) and reject-on-close (L3)
     * are now owned by the layer; this adapter no longer tracks pending RPCs or
     * arms timeouts. A hung command still re-arms the supervisor: the layer's L4
     * timer fires → rejects the promise AND closes the transport → the 'close'
     * event flows through this adapter's `on` pass-through to FeedSupervisor.
     * @param {string} name    payload type name (e.g. 'ProtoOAApplicationAuthReq')
     * @param {object} [payload]
     * @returns {Promise<object>} response payload
     */
    sendCommand(name, payload) {
        if (!this.conn) return Promise.reject(new Error('cTrader transport not open'));
        return this.conn.sendCommand(name, payload);
    }

    /**
     * Send a ProtoHeartbeatEvent keepalive. Delegates to the layer's
     * `sendHeartbeat()`, which (after Plan Phase 1 / L2) writes a leak-free raw
     * frame without a clientMsgId — no command-map entry, no awaited promise.
     */
    sendHeartbeat() {
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
        if (this._closed) return;
        this._closed = true;
        if (this.conn) {
            try { this.conn.close(); } catch (e) { /* ignore */ }
        }
    }
}

module.exports = { CTraderTransportAdapter };
