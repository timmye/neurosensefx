'use strict';

/**
 * Scriptable fake for the cTrader `CTraderConnection` RPC surface, plus the
 * module-mutation harness that injects it into the real CTraderSession.
 *
 * WHY MODULE MUTATION (not vi.mock): the cTrader lib lives OUTSIDE vitest's
 * project root (services/tick-backend), and in this hybrid import/require test
 * setup vi.mock factories are not reliably hoisted into the require pipeline for
 * these paths. Instead we exploit two facts:
 *   1. The lib entry `build/entry/node/main` is a getter re-export over
 *      `build/src/core/CTraderConnection`, whose `CTraderConnection` export is a
 *      plain writable value. Mutating it flows through the entry getter into
 *      CTraderSession's destructured `const { CTraderConnection } = require(...)`.
 *   2. `config.js` exports a plain writable object; mutating its fields before
 *      `new CTraderSession()` gives deterministic test values without real creds.
 *
 * This keeps the REAL CTraderSession handshake code under test — only the
 * transport and config are faked.
 */

const CTRADER_CORE_PATH =
    '/workspaces/neurosensefx/libs/cTrader-Layer/build/src/core/CTraderConnection.js';
const CONFIG_PATH = '/workspaces/neurosensefx/services/tick-backend/config.js';

/**
 * Build a scriptable fake connection. Each `sendCommand` is answered from a
 * per-command `scripts` map: a value, a `(payload)=>response` function, a thrown
 * error, or `{__reject: err}`. An unscripted command returns a perpetually
 * pending promise (modelling a dead remote — used by the hang baseline).
 *
 * RPC surface mirrored from CTraderSession usage:
 *   open() | sendCommand(name,payload) | sendHeartbeat() | close()
 *   on(event,handler) | removeAllListeners(event) | removeListener(event,handler)
 */
function createFakeConnection({ openResult = true, scripts = {} } = {}) {
    const handlers = new Map();
    const fake = {
        receivedCommands: [],
        removedAllListenersFor: [],
        scripts,

        async open() {
            if (openResult instanceof Error) throw openResult;
            if (openResult === false) throw new Error('fake: open() rejected');
            return true;
        },

        sendCommand(name, payload) {
            fake.receivedCommands.push({ name, payload });
            const script = scripts[name];

            if (script === undefined) {
                return new Promise(() => {}); // never resolves
            }
            if (script instanceof Error) return Promise.reject(script);
            if (script && typeof script === 'object' && script.__reject) {
                return Promise.reject(script.__reject);
            }
            if (typeof script === 'function') {
                try {
                    const res = script(payload);
                    return res && typeof res.then === 'function' ? res : Promise.resolve(res);
                } catch (e) {
                    return Promise.reject(e);
                }
            }
            return Promise.resolve(script);
        },

        sendHeartbeat() {
            fake.receivedCommands.push({ name: '__heartbeat__', payload: undefined });
        },
        // Leak-free raw keepalive (delegates to the layer's sendHeartbeat post-L2).
        sendHeartbeat() {
            fake.receivedCommands.push({ name: '__heartbeat__', payload: undefined });
        },
        close() {},

        on(event, handler) {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(handler);
        },
        removeAllListeners(event) {
            fake.removedAllListenersFor.push(event);
            handlers.delete(event);
        },
        removeListener(event, handler) {
            const arr = handlers.get(event);
            if (arr) {
                const idx = arr.indexOf(handler);
                if (idx >= 0) arr.splice(idx, 1);
            }
        },

        emit(event, ...args) {
            const arr = handlers.get(event);
            if (!arr || arr.length === 0) return false;
            for (const h of arr) {
                const res = h(...args);
                if (res && typeof res.then === 'function') res.catch(() => {});
            }
            return true;
        },
        handlerCount(event) {
            return handlers.has(event) ? handlers.get(event).length : 0;
        },
    };
    return fake;
}

/** Build an auth-style rejection carrying an errorCode (e.g. CH_ACCESS_TOKEN_INVALID). */
function errorRejection(errorCode, message = `fake: ${errorCode}`) {
    const err = new Error(message);
    err.errorCode = errorCode;
    return err;
}

/**
 * Install the fake connection factory into the REAL cTrader core module so the
 * real CTraderSession picks it up. Returns a control object:
 *   { instance, setInstance(fake), reset() }.
 * The factory returns whatever `instance` is currently set to, so each test can
 * swap in a fresh fake.
 */
function installFakeCtraderConnection() {
    const core = require(CTRADER_CORE_PATH);
    const control = { instance: null };
    const Factory = function FakeCTraderConnection(opts) {
        Factory.lastOpts = opts;
        Factory.callCount += 1;
        return control.instance;
    };
    Factory.lastOpts = null;
    Factory.callCount = 0;
    core.CTraderConnection = Factory;
    control.setInstance = (fake) => { control.instance = fake; };
    control.reset = () => {
        Factory.lastOpts = null;
        Factory.callCount = 0;
        control.instance = null;
    };
    control.factory = Factory;
    return control;
}

/**
 * Apply deterministic config values to the REAL config module. Must run before
 * `new CTraderSession()` (the constructor snapshots config fields).
 */
function applyFakeConfig(overrides = {}) {
    const config = require(CONFIG_PATH);
    const defaults = {
        ctraderClientId: 'test-client-id',
        ctraderClientSecret: 'test-client-secret',
        ctraderAccessToken: 'test-access-token',
        ctraderRefreshToken: 'test-refresh-token',
        ctraderAccountId: '12345',
        ctraderHost: 'fake.host.example',
        ctraderPort: '5035',
        maxReconnectAttempts: 3,
        logLevel: 'error',
        nodeEnv: 'test',
    };
    Object.assign(config, defaults, overrides);
    return config;
}

module.exports = {
    createFakeConnection,
    errorRejection,
    installFakeCtraderConnection,
    applyFakeConfig,
};
