'use strict';

const EventEmitter = require('events');

/**
 * FakeFeed — a scriptable Feed for FeedSupervisor tests.
 *
 * Implements the Feed contract (see supervision/interfaces.js): the supervisor
 * calls `connect(transport)` after `transport.open()`. connect() simulates the
 * domain handshake (auth + symbols + subscribe restore) and emits 'connected'
 * on success.
 *
 * Per-attempt scenario, in order:
 *   - first `hangAttempts`        connect() never resolves (hang-after-open, #4),
 *                                 but rejects if the transport closes (deadline
 *                                 force-close) — modelling the reject-on-close
 *                                 the #4 fix adds.
 *   - next `handshakeFailures`     connect() rejects.
 *   - thereafter                   connect() emits 'connected' and resolves.
 *
 * Ticks/heartbeats are simulated by the test via `feed.emit('tick'|'heartbeat')`;
 * the supervisor wires those to its HealthSensor.
 */
class FakeFeed extends EventEmitter {
    constructor({ hangAttempts = 0, handshakeFailures = 0 } = {}) {
        super();
        this.hangAttempts = hangAttempts;
        this.handshakeFailures = handshakeFailures;
        this.connectAttempts = 0;
        this.lastTransport = null;
        this.activeSubscriptions = new Set();
    }

    async connect(transport) {
        this.connectAttempts += 1;
        this.lastTransport = transport;

        if (this.connectAttempts <= this.hangAttempts) {
            // Hang — but reject on transport close so a deadline force-close releases us.
            return new Promise((resolve, reject) => {
                const onClose = () => {
                    transport.removeListener('close', onClose);
                    reject(new Error('transport closed during handshake'));
                };
                transport.on('close', onClose);
            });
        }

        if (this.connectAttempts <= this.hangAttempts + this.handshakeFailures) {
            throw new Error(`fake: handshake failure #${this.connectAttempts}`);
        }

        this.emit('connected');
    }

    // ── Feed contract stubs (supervisor calls these; not exercised in B3) ──
    async stop() {}
    async restoreSubscriptions(/* transport */) {}
    async subscribeToTicks(name) { this.activeSubscriptions.add(name); }
    async subscribeToM1Bars(name) { this.activeSubscriptions.add(name); }
    async subscribeToBars(name /* , period */) { this.activeSubscriptions.add(name); }
    getActiveSubscriptions() { return new Set(this.activeSubscriptions); }
    disconnect() { this.emit('disconnected'); }
}

module.exports = { FakeFeed };
