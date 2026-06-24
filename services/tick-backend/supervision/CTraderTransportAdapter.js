const { createLogger } = require('../utils/Logger');
const log = createLogger('CTraderTransportAdapter');

const DEFAULT_COMMAND_TTL_MS = 15000;

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
 *   - Heartbeats use `sendRaw` (fire-and-forget, not awaited/tracked), so our
 *     tier never holds an unbounded heartbeat promise. (The library still
 *     records them in its internal map; fully raw protobuf frames would require
 *     editing the read-only library and are deferred.)
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
    }

    async open() {
        // Pass the hostname through; the library resolves DNS→IP itself and sets
        // the TLS ServerName to the hostname (see defaultConnectionFactory note).
        this.conn = this.connectionFactory({ host: this.host, port: this.port });

        // Reject every pending RPC when the socket closes (defect #4).
        this.conn.on('close', () => this._rejectAllPending(new Error('cTrader transport closed')));
        this.conn.on('error', (err) => log.warn('connection error:', err?.message || err));

        await this.conn.open();
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
     * Send a no-response frame (heartbeat). Fire-and-forget: never awaited or
     * tracked, so our tier holds no unbounded promise. (Defect #4 leak mitigation.)
     */
    sendRaw(/* payload */) {
        if (!this.conn) return;
        try {
            this.conn.sendHeartbeat();
        } catch (e) {
            /* connection closing — ignore */
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

module.exports = { CTraderTransportAdapter, DEFAULT_COMMAND_TTL_MS };
