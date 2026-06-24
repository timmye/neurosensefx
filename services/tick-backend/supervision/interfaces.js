/**
 * Interface contracts for the supervision tier.
 *
 * These are DOCUMENTATION ONLY (JSDoc typedefs) — JavaScript has no interfaces.
 * They anchor the contracts that `FeedSupervisor` (B3) depends on and that the
 * concrete adapters (`CTraderTransportAdapter`, `CTraderFeed`, `TradingViewFeed`
 * — B4) implement. Keeping the contracts written down here lets the supervisor
 * and the fakes (`FakeTransport` — B2) be built against a stable spec.
 */

/**
 * A transport is the raw connection primitive: open/close the socket, send
 * framed commands, and emit connection-level events. It does NOT know about
 * auth, symbols, or subscriptions — that's the Feed layer above it.
 *
 * The defect-#4 fixes live at this layer (implemented by CTraderTransportAdapter):
 *   - `sendCommand` MUST respect a per-call TTL and reject on `close`, so a
 *     reply that never arrives cannot hang the connect/handshake forever.
 *   - heartbeats use `sendRaw` (NOT `sendCommand`) so they never leak into the
 *     command-response map (`#openCommands`).
 *
 * @typedef {Object} Transport
 * @property {() => Promise<void>} open             Open the socket; rejects on failure.
 * @property {(name: string, payload: object) => Promise<object>} sendCommand
 *           Send a request command; resolves with the framed response, rejects
 *           on error, on close, or after the per-call TTL (defect #4).
 * @property {(payload: *) => void} sendRaw         Send a frame that expects no
 *           response (e.g. a heartbeat) — bypasses the command map.
 * @property {() => void} close                     Close the socket.
 * @property {(event: string, handler: Function) => void} on
 *           Subscribe to: feed-specific data frames, 'close', 'error'.
 * @property {(event: string, handler: Function) => void} removeListener
 */

/**
 * A feed drives the domain handshake on top of a Transport: authenticate, load
 * symbols, restore subscriptions, decode frames into domain events, and feed a
 * HealthSensor. The supervisor calls `start()`/`stop()` and listens for events.
 *
 * The defect-#3 fix lives at this layer (implemented by CTraderFeed): a spot
 * event that decodes to null during a quiet window must NOT clobber a valid
 * trendbar-derived tick or suppress `recordDataTick()`.
 *
 * @typedef {Object} Feed
 * @property {(transport: Transport) => Promise<void>} start
 *           Auth + symbol load + subscription restore on the given transport.
 *           Resolves once subscribed; the supervisor moves HANDSHAKING→CONNECTED.
 * @property {() => Promise<void>} stop              Tear down listeners/subscriptions.
 * @property {() => void} disconnect                 Signal an external disconnect.
 * @property {(symbolName: string) => Promise<void>} subscribeToTicks
 * @property {(symbolName: string) => Promise<void>} subscribeToM1Bars
 * @property {(symbolName: string, period: string) => Promise<void>} subscribeToBars
 * @property {() => Set<string>} getActiveSubscriptions
 *           Snapshot of subscriptions to restore after a reconnect.
 * @property {(transport: Transport) => Promise<void>} restoreSubscriptions
 *           Re-establish the active set on a NEW transport (fixes the reconnect
 *           no-op: must send symbol-for-symbol regardless of in-memory tracking).
 * @property {() => void} on    Subscribe to domain events: 'connected',
 *           'disconnected', 'tick', 'm1Bar', 'barUpdate'.
 */

/**
 * Clock abstraction. The supervisor schedules ALL timers through the injected
 * clock so recovery is deterministic under FakeClock (B2). RealClock delegates
 * to global setTimeout/clearTimeout.
 *
 * @typedef {Object} Clock
 * @property {(fn: Function, ms: number) => Timer} setTimeout
 * @property {(timer: Timer) => void} clearTimeout
 * @property {() => number} now
 */

module.exports = {};
