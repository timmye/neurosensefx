'use strict';

/**
 * FakeTransport — a scriptable Transport for FeedSupervisor tests.
 *
 * Mirrors the Transport contract (see supervision/interfaces.js): open /
 * sendCommand / sendHeartbeat / close / on / removeListener. Behaviors are
 * configurable per instance so the supervisor's recovery paths can be driven
 * deterministically:
 *
 *   - `openFailures: N`   open() rejects the first N times, then succeeds.
 *   - `commandScripts`    map of command name → response (value | fn | Error |
 *                         `{__reject}`); an UNSCRIPTED command returns a
 *                         perpetually-pending promise (models a hung RPC — #4).
 *   - inbound frames can be pushed via `emit(event, ...)` to simulate spot
 *                         events / heartbeats / closes.
 *
 * Records every command and raw send for assertions.
 */
class FakeTransport {
    constructor({
        openFailures = 0,
        commandScripts = {},
        hangCommands = [],
    } = {}) {
        this.openFailures = openFailures;
        this.commandScripts = commandScripts;
        this.hangCommands = new Set(hangCommands);
        this.openAttempts = 0;
        this.commands = [];
        this.rawSent = [];
        this.closed = false;
        this._handlers = new Map();
    }

    async open() {
        this.openAttempts += 1;
        if (this.openAttempts <= this.openFailures) {
            throw new Error(`fake: open() failure #${this.openAttempts}`);
        }
        return true;
    }

    sendCommand(name, payload) {
        this.commands.push({ name, payload });

        if (this.hangCommands.includes(name)) {
            return new Promise(() => {}); // never resolves (hung RPC — defect #4)
        }
        const script = this.commandScripts[name];
        if (script === undefined) {
            return new Promise(() => {}); // unscripted ⇒ hang
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
    }

    sendHeartbeat(payload) {
        this.rawSent.push(payload);
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        this._emit('close');
    }

    on(event, fn) {
        if (!this._handlers.has(event)) this._handlers.set(event, []);
        this._handlers.get(event).push(fn);
    }

    removeListener(event, fn) {
        const arr = this._handlers.get(event);
        if (!arr) return;
        const i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
    }

    removeAllListeners(event) {
        if (event === undefined) this._handlers.clear();
        else this._handlers.delete(event);
    }

    /** Simulate an inbound frame / event from the remote. */
    emit(event, ...args) {
        this._emit(event, ...args);
    }

    _emit(event, ...args) {
        const arr = this._handlers.get(event);
        if (!arr) return false;
        for (const fn of [...arr]) {
            const res = fn(...args);
            if (res && typeof res.then === 'function') res.catch(() => {});
        }
        return true;
    }

    handlerCount(event) {
        return this._handlers.has(event) ? this._handlers.get(event).length : 0;
    }
}

module.exports = { FakeTransport };
