"use strict";

/**
 * Phase 0.2 characterization tests for `CTraderProtobufReader`.
 *
 * Source: libs/cTrader-Layer/build/src/core/protobuf/CTraderProtobufReader.js
 * (internal vendored fork, consumed as @neurosensefx/ctrader-layer via file: link).
 *
 * The reader is constructed exactly as CTraderConnection constructs it (see
 * _protobufReader.js). These tests pin the pure protobuf logic (no sockets):
 * payloadType lookup, encode framing of a heartbeat, clientMsgId derivation,
 * and the unknown-payloadType decode path. Known defects carry a
 * `// TODO(Lxx): ...` marker.
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
const { buildReader } = require("./_protobufReader");

describe("CTraderProtobufReader (built module)", () => {
  // Shared reader — load()+build() is expensive (parses the OpenApi .proto
  // schemas), so it is built once for the whole file.
  let reader;
  beforeAll(() => {
    reader = buildReader();
  });

  describe("getPayloadTypeByName()", () => {
    it("resolves 'ProtoHeartbeatEvent' to payloadType 51", () => {
      // CTraderProtobufReader.js:113-116 — looks up the message name and
      // returns its payloadType, which is derived from the proto default value
      // during build() (findPayloadType, lines 91-104).
      expect(reader.getPayloadTypeByName("ProtoHeartbeatEvent")).toBe(51);
    });

    it("returns undefined for an unknown message name", () => {
      expect(reader.getPayloadTypeByName("DoesNotExistEvent")).toBeUndefined();
    });
  });

  describe("encode(payloadType, params, clientMsgId)", () => {
    it("encode() returns a protobufjs Writer-like with toBuffer(), not a Buffer", () => {
      // CTraderProtobufReader.js:33-40 + 144-150 — encode() wraps the message
      // in a ProtoMessage and returns the result of ProtoMessage.encode(),
      // which is a protobufjs Writer (has .toBuffer()), NOT a Buffer.
      const out = reader.encode(51, {}, undefined);
      expect(typeof out).toBe("object");
      expect(typeof out.toBuffer).toBe("function");
      expect(Buffer.isBuffer(out)).toBe(false);
    });

    it("THE KEY DERIVATION PROOF (L2): encode(51, {}, undefined) -> inner bytes 08 33 12 00", () => {
      // CTraderProtobufReader.js:144-150 — _wrap() builds a ProtoMessage with
      //   payloadType: 51, payload: <heartbeat msg toBuffer()>, clientMsgId: undefined
      // Encoded with protobuf tag semantics:
      //   08 = field 1 (payloadType), varint -> 0x33 = 51
      //   12 = field 2 (payload),   length-delimited -> length 0x00 (empty heartbeat)
      // No field-3 (clientMsgId) tag because clientMsgId is undefined.
      //
      // NOTE: this is the INNER (unframed) ProtoMessage body. The 8-byte framed
      // form `00 00 00 04 08 33 12 00` is produced when CTraderEncoderDecoder
      // prepends the Int32BE length prefix (see CTraderEncoderDecoder.test.js).
      // L2 pins BOTH: the inner derivation here, and the framed 8 bytes there.
      const buf = reader.encode(51, {}, undefined).toBuffer();
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(Array.from(buf)).toEqual([0x08, 0x33, 0x12, 0x00]);
    });

    it("encode(51, {}, <uuid>) produces a LONGER buffer that includes the clientMsgId field (field-3)", () => {
      // TODO(L2): presence of clientMsgId appends a field-3 tag (0x1a) +
      // length-prefixed UTF-8 of the uuid string. This proves the
      // clientMsgId-derivation path used to correlate request/response frames.
      const uuid = "11111111-2222-3333-4444-555555555555";
      const noId = reader.encode(51, {}, undefined).toBuffer();
      const withId = reader.encode(51, {}, uuid).toBuffer();

      expect(withId.length).toBeGreaterThan(noId.length);
      // Field-3 wire tag for clientMsgId is 0x1a (field 3, length-delimited).
      expect(withId.includes(0x1a, 3)).toBe(true);
      // The uuid's ASCII bytes appear verbatim in the encoded buffer.
      expect(withId.includes(Buffer.from(uuid, "utf8"))).toBe(true);
    });
  });

  describe("decode(buffer)", () => {
    it("decodes a known payloadType (heartbeat) and returns the payload", () => {
      // CTraderProtobufReader.js:41-57 — decode() parses a ProtoMessage, looks
      // up the message decoder by payloadType, and returns {payload, payloadType, clientMsgId}.
      const encoded = reader.encode(51, {}, undefined).toBuffer();
      const decoded = reader.decode(encoded);

      expect(decoded.payloadType).toBe(51);
      expect(decoded.clientMsgId).toBe(null); // protobuf default for omitted string
      expect(decoded.payload).not.toBe(null);
    });

    it("L9 (FIXED): decode of an unknown payloadType returns { payload: null, ... } AND emits a warning", () => {
      // L9 (FIXED): CTraderProtobufReader.decode() previously returned a stub
      // object with payload:null and NO logging on the unknown-type path, so
      // dropped/undecodable frames were invisible to operators. decode() now
      // emits a console.warn naming the unknown payloadType before returning.
      // Build a synthetic ProtoMessage: field-1 (payloadType) varint = 9999 (unknown).
      // 0x08 = field1 tag; 9999 varint = 0x8f 0x4e. No payload, no clientMsgId.
      const unknown = Buffer.from([0x08, 0x8f, 0x4e]);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      let decoded;
      let warnCalls;
      try {
        decoded = reader.decode(unknown);
        // Capture calls BEFORE mockRestore() clears them.
        warnCalls = [...warnSpy.mock.calls];
      } finally {
        warnSpy.mockRestore();
      }

      expect(decoded).toEqual({
        payload: null,
        payloadType: 9999,
        clientMsgId: null,
      });
      // The unknown payloadType is genuinely unregistered.
      expect(reader.getMessageByPayloadType(9999)).toBeUndefined();
      // L9: a warning was emitted naming the unknown payloadType.
      const warned = warnCalls.some((c) =>
        typeof c[0] === "string" && c[0].includes("9999") && c[0].includes("CTraderProtobufReader"));
      expect(warned).toBe(true);
    });
  });
});
