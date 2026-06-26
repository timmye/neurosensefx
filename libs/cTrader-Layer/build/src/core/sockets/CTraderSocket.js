"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
var _CTraderSocket_host, _CTraderSocket_port, _CTraderSocket_socket;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CTraderSocket = void 0;
const tls = require("tls");
const dns = require("dns");
const util_1 = require("util");
const lookupAsync = (0, util_1.promisify)(dns.lookup);
class CTraderSocket {
    constructor({ host, port, }) {
        _CTraderSocket_host.set(this, void 0);
        _CTraderSocket_port.set(this, void 0);
        _CTraderSocket_socket.set(this, void 0);
        __classPrivateFieldSet(this, _CTraderSocket_host, host, "f");
        __classPrivateFieldSet(this, _CTraderSocket_port, port, "f");
        __classPrivateFieldSet(this, _CTraderSocket_socket, undefined, "f");
    }
    get host() {
        return __classPrivateFieldGet(this, _CTraderSocket_host, "f");
    }
    get port() {
        return __classPrivateFieldGet(this, _CTraderSocket_port, "f");
    }
    connect() {
        const resolveAndConnect = () => __awaiter(this, void 0, void 0, function* () {
            try {
                const resolved = yield lookupAsync(__classPrivateFieldGet(this, _CTraderSocket_host, "f"), { family: 4 });
                const socket = tls.connect({
                    host: resolved.address,
                    port: __classPrivateFieldGet(this, _CTraderSocket_port, "f"),
                    servername: __classPrivateFieldGet(this, _CTraderSocket_host, "f"),
                    timeout: 10000
                });
                socket.on("timeout", () => socket.destroy());
                socket.on("secureConnect", () => {
                    if (this.onOpen && typeof this.onOpen === 'function') {
                        this.onOpen();
                    }
                });
                socket.on("data", this.onData);
                socket.on("end", this.onClose);
                socket.on("close", this.onClose);
                socket.on("error", this.onError);
                __classPrivateFieldSet(this, _CTraderSocket_socket, socket, "f");
                return;
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.warn(`[CTraderSocket] DNS resolution failed (${__classPrivateFieldGet(this, _CTraderSocket_host, "f")}), falling back to direct connect: ${msg}`);
            }
            const socket = tls.connect({
                host: __classPrivateFieldGet(this, _CTraderSocket_host, "f"),
                port: __classPrivateFieldGet(this, _CTraderSocket_port, "f"),
                servername: __classPrivateFieldGet(this, _CTraderSocket_host, "f"),
                timeout: 10000
            });
            socket.on("timeout", () => socket.destroy());
            socket.on("secureConnect", () => {
                if (this.onOpen && typeof this.onOpen === 'function') {
                    this.onOpen();
                }
            });
            socket.on("data", this.onData);
            socket.on("end", this.onClose);
            socket.on("close", this.onClose);
            socket.on("error", this.onError);
            __classPrivateFieldSet(this, _CTraderSocket_socket, socket, "f");
        });
        resolveAndConnect();
    }
    send(buffer) {
        var _a;
        (_a = __classPrivateFieldGet(this, _CTraderSocket_socket, "f")) === null || _a === void 0 ? void 0 : _a.write(buffer);
    }
    onOpen() {
    }
    onData(...parameters) {
    }
    onClose() {
    }
    onError(error) {
    }
    close() {
        if (__classPrivateFieldGet(this, _CTraderSocket_socket, "f")) {
            __classPrivateFieldGet(this, _CTraderSocket_socket, "f").destroy();
            __classPrivateFieldSet(this, _CTraderSocket_socket, undefined, "f");
        }
    }
}
exports.CTraderSocket = CTraderSocket;
_CTraderSocket_host = new WeakMap(), _CTraderSocket_port = new WeakMap(), _CTraderSocket_socket = new WeakMap();
//# sourceMappingURL=CTraderSocket.js.map