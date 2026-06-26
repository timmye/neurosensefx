"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _CTraderCommandMap_instances, _CTraderCommandMap_openCommands, _CTraderCommandMap_timers, _CTraderCommandMap_send, _CTraderCommandMap_onCommandTimeout, _CTraderCommandMap_commandTtlMs, _CTraderCommandMap_armTimer, _CTraderCommandMap_clearTimer;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CTraderCommandMap = void 0;
const CTraderCommand_1 = require("./CTraderCommand");
const DEFAULT_COMMAND_TTL_MS = 15000;
class CTraderCommandMap {
    constructor({ send, onCommandTimeout, commandTtlMs, }) {
        _CTraderCommandMap_instances.add(this);
        _CTraderCommandMap_openCommands.set(this, void 0);
        _CTraderCommandMap_timers.set(this, void 0);
        _CTraderCommandMap_send.set(this, void 0);
        _CTraderCommandMap_onCommandTimeout.set(this, void 0);
        _CTraderCommandMap_commandTtlMs.set(this, void 0);
        __classPrivateFieldSet(this, _CTraderCommandMap_openCommands, new Map(), "f");
        __classPrivateFieldSet(this, _CTraderCommandMap_timers, new Map(), "f");
        __classPrivateFieldSet(this, _CTraderCommandMap_send, send, "f");
        __classPrivateFieldSet(this, _CTraderCommandMap_onCommandTimeout, onCommandTimeout, "f");
        __classPrivateFieldSet(this, _CTraderCommandMap_commandTtlMs, commandTtlMs !== null && commandTtlMs !== void 0 ? commandTtlMs : DEFAULT_COMMAND_TTL_MS, "f");
    }
    get openCommands() {
        return [...__classPrivateFieldGet(this, _CTraderCommandMap_openCommands, "f").values(),];
    }
    get pendingCommandCount() {
        return __classPrivateFieldGet(this, _CTraderCommandMap_openCommands, "f").size;
    }
    create({ clientMsgId, message, }) {
        const command = new CTraderCommand_1.CTraderCommand({ clientMsgId, });
        __classPrivateFieldGet(this, _CTraderCommandMap_openCommands, "f").set(clientMsgId, command);
        __classPrivateFieldGet(this, _CTraderCommandMap_send, "f").call(this, message);
        __classPrivateFieldGet(this, _CTraderCommandMap_instances, "m", _CTraderCommandMap_armTimer).call(this, clientMsgId);
        return command.responsePromise;
    }
    extractById(clientMsgId) {
        const command = __classPrivateFieldGet(this, _CTraderCommandMap_openCommands, "f").get(clientMsgId);
        if (!command) {
            return undefined;
        }
        __classPrivateFieldGet(this, _CTraderCommandMap_instances, "m", _CTraderCommandMap_clearTimer).call(this, clientMsgId);
        __classPrivateFieldGet(this, _CTraderCommandMap_openCommands, "f").delete(clientMsgId);
        return command;
    }
    rejectAll(error) {
        for (const command of __classPrivateFieldGet(this, _CTraderCommandMap_openCommands, "f").values()) {
            command.reject(error);
        }
        for (const timer of __classPrivateFieldGet(this, _CTraderCommandMap_timers, "f").values()) {
            clearTimeout(timer);
        }
        __classPrivateFieldGet(this, _CTraderCommandMap_timers, "f").clear();
        __classPrivateFieldGet(this, _CTraderCommandMap_openCommands, "f").clear();
    }
}
exports.CTraderCommandMap = CTraderCommandMap;
_CTraderCommandMap_openCommands = new WeakMap(), _CTraderCommandMap_timers = new WeakMap(), _CTraderCommandMap_send = new WeakMap(), _CTraderCommandMap_onCommandTimeout = new WeakMap(), _CTraderCommandMap_commandTtlMs = new WeakMap(), _CTraderCommandMap_instances = new WeakSet(), _CTraderCommandMap_armTimer = function _CTraderCommandMap_armTimer(clientMsgId) {
    if (__classPrivateFieldGet(this, _CTraderCommandMap_commandTtlMs, "f") <= 0) {
        return;
    }
    const timer = setTimeout(() => {
        const command = __classPrivateFieldGet(this, _CTraderCommandMap_openCommands, "f").get(clientMsgId);
        if (command) {
            __classPrivateFieldGet(this, _CTraderCommandMap_instances, "m", _CTraderCommandMap_clearTimer).call(this, clientMsgId);
            __classPrivateFieldGet(this, _CTraderCommandMap_openCommands, "f").delete(clientMsgId);
            command.reject(new Error(`Command ${clientMsgId} timed out after ${__classPrivateFieldGet(this, _CTraderCommandMap_commandTtlMs, "f")}ms`));
            if (__classPrivateFieldGet(this, _CTraderCommandMap_onCommandTimeout, "f")) {
                __classPrivateFieldGet(this, _CTraderCommandMap_onCommandTimeout, "f").call(this);
            }
        }
    }, __classPrivateFieldGet(this, _CTraderCommandMap_commandTtlMs, "f"));
    if (typeof timer === "object" && timer && typeof timer.unref === "function") {
        timer.unref();
    }
    __classPrivateFieldGet(this, _CTraderCommandMap_timers, "f").set(clientMsgId, timer);
}, _CTraderCommandMap_clearTimer = function _CTraderCommandMap_clearTimer(clientMsgId) {
    const timer = __classPrivateFieldGet(this, _CTraderCommandMap_timers, "f").get(clientMsgId);
    if (timer) {
        clearTimeout(timer);
        __classPrivateFieldGet(this, _CTraderCommandMap_timers, "f").delete(clientMsgId);
    }
};
//# sourceMappingURL=CTraderCommandMap.js.map