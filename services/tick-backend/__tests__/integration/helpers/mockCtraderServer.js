"use strict";

/**
 * Mock cTrader TCP server (loopback TLS, plus a raw-net "hang" variant) for
 * offline integration coverage of the REAL `CTraderConnection`
 * (libs/cTrader-Layer). Speaks the layer's own wire format: 4-byte Int32BE
 * length prefix + protobuf payload.
 *
 * Wire-format correctness is guaranteed by REUSING THE LIB'S OWN CODEC: the
 * built `CTraderEncoderDecoder` (length-prefix framing) and `CTraderProtobufReader`
 * (proto encode/decode), loaded against the same .proto files the real
 * `CTraderConnection` uses (see CTraderConnection.ts:26-30).
 *
 * Command/response correlation: every cTrader frame carries a `clientMsgId`. The
 * server decodes each inbound frame, reads its `clientMsgId`, and — when the
 * inbound payloadType is a request we answer — replies with the matching
 * response payloadType carrying the SAME `clientMsgId`, so the awaiting
 * `CTraderConnection.sendCommand` resolves.
 *
 * TLS gotcha: the real `CTraderSocket` calls `tls.connect(...)` with NO
 * `rejectUnauthorized` override (CTraderSocket.ts:34-39), so a self-signed cert
 * fails the handshake by default. Tests that bring up this server MUST set
 * `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` in `beforeAll` and restore it
 * in `afterAll`. The cert itself is generated ephemerally at server start via
 * the `openssl` CLI — no committed PEM fixtures, no new npm dependencies.
 *
 * Modes:
 *   "happy"          — TLS server; answers ProtoOAApplicationAuthReq with the
 *                      matching Res (echoing clientMsgId), echoes heartbeats.
 *   "hang"           — RAW net server: accepts the TCP connection but never
 *                      speaks TLS, so the client's tls.connect() never fires
 *                      'secureConnect'. Pins L1: open() never resolves/rejects.
 *   "closeOnCommand" — TLS server; answers nothing; on receiving ANY frame it
 *                      destroys the socket. Pins L3/L5 behavior.
 *   "malformed"      — TLS server; on connect writes a length prefix of 0.
 *
 * This file is a TEST HELPER ONLY. It must never be imported by production code.
 */

const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const tls = require("tls");
const { execFileSync } = require("child_process");

const { CTraderEncoderDecoder } = require(
    "../../../../../libs/cTrader-Layer/build/src/core/encoder-decoder/CTraderEncoderDecoder",
);
const { CTraderProtobufReader } = require(
    "../../../../../libs/cTrader-Layer/build/src/core/protobuf/CTraderProtobufReader",
);

const PROTO_DIR = path.resolve(
    __dirname,
    "../../../../../libs/cTrader-Layer/protobuf",
);

// Payload types the server cares about (from ProtoOAPayloadType / ProtoPayloadType).
const PAYLOAD_TYPE = Object.freeze({
    PROTO_HEARTBEAT_EVENT: 51,
    PROTO_OA_APPLICATION_AUTH_REQ: 2100,
    PROTO_OA_APPLICATION_AUTH_RES: 2101,
});

/** Build a shared ProtobufReader + EncoderDecoder mirroring the real connection. */
function buildCodec() {
    const reader = new CTraderProtobufReader([
        { file: path.resolve(PROTO_DIR, "OpenApiCommonMessages.proto") },
        { file: path.resolve(PROTO_DIR, "OpenApiMessages.proto") },
    ]);
    reader.load();
    reader.build();
    const encoderDecoder = new CTraderEncoderDecoder();
    return { reader, encoderDecoder };
}

/** Ephemeral self-signed cert/key via openssl CLI into OS temp dir. */
function generateSelfSignedCert() {
    const base = path.join(os.tmpdir(), `nsfx-mock-ctrader-${process.pid}-${Date.now()}`);
    const keyPath = `${base}.key`;
    const certPath = `${base}.crt`;
    execFileSync("openssl", [
        "req", "-x509", "-newkey", "rsa:2048", "-nodes",
        "-keyout", keyPath, "-out", certPath,
        "-days", "365",
        "-subj", "/CN=localhost",
    ], { stdio: ["ignore", "ignore", "ignore"] });
    const cert = fs.readFileSync(certPath, "utf8");
    const key = fs.readFileSync(keyPath, "utf8");
    try { fs.unlinkSync(keyPath); } catch { /* ignore */ }
    try { fs.unlinkSync(certPath); } catch { /* ignore */ }
    return { cert, key };
}

/**
 * Create a scriptable mock cTrader server.
 * @param {object} opts
 * @param {string} opts.mode - One of: happy | hang | closeOnCommand | malformed
 */
function createMockCtraderServer({ mode = "happy" } = {}) {
    const { reader, encoderDecoder } = buildCodec();

    // Per-connection decoder so fragmented TCP writes reassemble correctly.
    function newConnectionDecoder(onFrame) {
        const dec = new CTraderEncoderDecoder();
        dec.setDecodeHandler((slice) => {
            try { onFrame(reader.decode(slice)); } catch { /* unparseable */ }
        });
        return dec;
    }

    function buildResponseFrame(payloadType, clientMsgId) {
        // reader.encode returns a protobufjs Writer (has .toBuffer()), which is
        // exactly what CTraderEncoderDecoder.encode invokes.
        return encoderDecoder.encode(reader.encode(payloadType, { payloadType }, clientMsgId));
    }

    // Track every accepted socket so stop() can force-destroy lingering ones
    // (a hung TLS client would otherwise keep server.close() open forever).
    const sockets = new Set();
    const track = (socket) => {
        sockets.add(socket);
        socket.on("close", () => { sockets.delete(socket); });
    };

    let server;

    if (mode === "hang") {
        // RAW net server: accept TCP, never speak TLS. The real client's
        // tls.connect() sits waiting for a ServerHello that never arrives, so
        // 'secureConnect' never fires and open() never settles. (There is no
        // connect/handshake timeout wired to rejectConnectionPromise.)
        server = net.createServer((socket) => {
            track(socket);
            // Intentionally read-and-discard; never write, never upgrade to TLS.
            socket.on("error", () => { /* swallow */ });
        });
    } else {
        const { cert, key } = generateSelfSignedCert();
        server = tls.createServer({ cert, key, rejectUnauthorized: false }, (socket) => {
            track(socket);
            socket.setNoDelay(true);

            if (mode === "malformed") {
                socket.write(Buffer.alloc(4, 0)); // size=0 length prefix
                return;
            }

            const connectionDecoder = newConnectionDecoder((decoded) => {
                const { payloadType, clientMsgId } = decoded || {};

                if (mode === "closeOnCommand") {
                    try { socket.destroy(); } catch { /* ignore */ }
                    return;
                }

                // mode === "happy"
                if (payloadType === PAYLOAD_TYPE.PROTO_OA_APPLICATION_AUTH_REQ) {
                    socket.write(buildResponseFrame(
                        PAYLOAD_TYPE.PROTO_OA_APPLICATION_AUTH_RES, clientMsgId));
                    return;
                }
                if (payloadType === PAYLOAD_TYPE.PROTO_HEARTBEAT_EVENT) {
                    // Heartbeats are fire-and-forget; echo verbatim for realism.
                    try {
                        socket.write(buildResponseFrame(
                            PAYLOAD_TYPE.PROTO_HEARTBEAT_EVENT, clientMsgId));
                    } catch { /* ignore */ }
                    return;
                }
                // Unknown request: ignore (used to strand a command for L3).
            });

            socket.on("data", (chunk) => connectionDecoder.decode(chunk));
            socket.on("error", () => { /* swallow; tests observe client side */ });
        });
    }

    const state = { server, mode, codec: { reader, encoderDecoder }, port: null };

    /** Listen on an ephemeral loopback port. Resolves with the chosen port. */
    function start() {
        return new Promise((resolve, reject) => {
            server.once("error", reject);
            server.listen(0, "127.0.0.1", () => {
                const addr = server.address();
                state.port = addr && addr.port;
                server.removeListener("error", reject);
                resolve(state.port);
            });
        });
    }

    /** Tear down the server + all connections. Always resolves (never hangs). */
    function stop() {
        // Force-destroy every tracked socket FIRST so server.close() can't hang
        // on a lingering (e.g. hung-handshake) client.
        for (const s of sockets) {
            try { s.destroy(); } catch { /* ignore */ }
        }
        sockets.clear();
        return new Promise((resolve) => {
            try { server.close(() => resolve()); } catch { resolve(); }
        });
    }

    state.start = start;
    state.stop = stop;
    return state;
}

module.exports = {
    createMockCtraderServer,
    PAYLOAD_TYPE,
};
