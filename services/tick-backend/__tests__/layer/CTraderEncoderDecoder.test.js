"use strict";

/**
 * Phase 0.2 characterization tests for `CTraderEncoderDecoder`.
 *
 * Source: libs/cTrader-Layer/build/src/core/encoder-decoder/CTraderEncoderDecoder.js
 * (internal vendored fork, consumed as @neurosensefx/ctrader-layer via file: link).
 *
 * Pins TODAY's framing behavior (no sockets): Int32BE length-prefix on encode,
 * single-frame decode, coalesced multi-frame decode, and the size=0 defect.
 * Known defects carry a `// TODO(Lxx): ...` marker.
 */

import { describe, it, expect, vi } from "vitest";
const { CTraderEncoderDecoder } = require("../../../../libs/cTrader-Layer/build/src/core/encoder-decoder/CTraderEncoderDecoder");
const { buildReader } = require("./_protobufReader");

/**
 * Build a well-formed framed heartbeat exactly as the live path does:
 * inner ProtoMessage from CTraderProtobufReader.encode(), then framed by
 * CTraderEncoderDecoder.encode() (prepends Int32BE length).
 */
function makeFramedHeartbeat() {
  const reader = buildReader();
  const enc = new CTraderEncoderDecoder();
  const inner = reader.encode(51, {}, undefined); // protobufjs Writer
  return enc.encode(inner); // Buffer: Int32BE(4) + inner
}

/** Build a synthetic well-formed frame: Int32BE(len) + len bytes of body. */
function makeFrame(bodyBytes) {
  const header = Buffer.alloc(4);
  header.writeInt32BE(bodyBytes.length, 0);
  return Buffer.concat([header, Buffer.from(bodyBytes)]);
}

describe("CTraderEncoderDecoder (built module)", () => {
  describe("encode(data)", () => {
    it("prepends an Int32BE length prefix and returns a single concatenated Buffer", () => {
      // CTraderEncoderDecoder.js:31-38 — encode() calls data.toBuffer(), writes
      // its length as Int32BE into a 4-byte header, and returns concat([header, body]).
      const ed = new CTraderEncoderDecoder();
      // Fake "encodable": anything with a toBuffer() (protobufjs Writer shape).
      const fakeEncodable = { toBuffer: () => Buffer.from([0xaa, 0xbb, 0xcc]) };
      const out = ed.encode(fakeEncodable);

      expect(Buffer.isBuffer(out)).toBe(true);
      expect(out.length).toBe(4 + 3); // header + body
      // Int32BE length prefix == 3.
      expect(out.readInt32BE(0)).toBe(3);
      // Body follows verbatim.
      expect(Array.from(out.slice(4))).toEqual([0xaa, 0xbb, 0xcc]);
    });

    it("THE KEY DERIVATION PROOF (L2, framed): framing the heartbeat yields EXACTLY 00 00 00 04 08 33 12 00", () => {
      // The full 8-byte on-the-wire heartbeat = Int32BE(4) prefix + the 4-byte
      // inner ProtoMessage body (08 33 12 00) derived in CTraderProtobufReader.test.js.
      // This is the byte-for-byte proof of the complete encode path.
      const framed = makeFramedHeartbeat();
      expect(Array.from(framed)).toEqual([
        0x00, 0x00, 0x00, 0x04, // Int32BE length prefix (4)
        0x08, 0x33, 0x12, 0x00, // inner ProtoMessage body
      ]);
      expect(framed.length).toBe(8);
    });
  });

  describe("decode(buffer) — single well-formed frame", () => {
    it("invokes the decode-handler exactly once with the frame body (no length prefix)", () => {
      // CTraderEncoderDecoder.js:39-68 — decode() reads the Int32BE prefix,
      // slices the body, invokes the handler with the body buffer, then resets.
      const ed = new CTraderEncoderDecoder();
      const handler = vi.fn();
      ed.setDecodeHandler(handler);

      const framed = makeFrame([0x01, 0x02, 0x03]);
      ed.decode(framed);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(Buffer.isBuffer(handler.mock.calls[0][0])).toBe(true);
      expect(Array.from(handler.mock.calls[0][0])).toEqual([0x01, 0x02, 0x03]);
    });

    it("round-trips a real framed heartbeat through encode then decode", () => {
      const ed = new CTraderEncoderDecoder();
      const handler = vi.fn();
      ed.setDecodeHandler(handler);
      const framed = makeFramedHeartbeat();

      ed.decode(framed);

      expect(handler).toHaveBeenCalledTimes(1);
      // Handler receives the inner ProtoMessage body (08 33 12 00).
      expect(Array.from(handler.mock.calls[0][0])).toEqual([0x08, 0x33, 0x12, 0x00]);
    });
  });

  describe("decode(buffer) — coalesced MULTIPLE frames", () => {
    it("invokes the handler once per frame when frames are concatenated in one buffer", () => {
      // CTraderEncoderDecoder.js:46-56 — after handling one frame, if the
      // buffer holds more bytes, decode() recurses on the remainder, so each
      // coalesced frame produces one handler invocation.
      const ed = new CTraderEncoderDecoder();
      const handler = vi.fn();
      ed.setDecodeHandler(handler);

      const twoFrames = Buffer.concat([makeFrame([0xa1]), makeFrame([0xb1, 0xb2])]);
      ed.decode(twoFrames);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(Array.from(handler.mock.calls[0][0])).toEqual([0xa1]);
      expect(Array.from(handler.mock.calls[1][0])).toEqual([0xb1, 0xb2]);
    });

    it("handles three coalesced frames of differing lengths", () => {
      const ed = new CTraderEncoderDecoder();
      const handler = vi.fn();
      ed.setDecodeHandler(handler);

      const three = Buffer.concat([
        makeFrame([0x10]),
        makeFrame([0x20, 0x21]),
        makeFrame([0x30, 0x31, 0x32, 0x33]),
      ]);
      ed.decode(three);

      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler.mock.calls[2][0].length).toBe(4);
    });
  });

  describe("decode(buffer) — partial / buffered frames", () => {
    it("buffers a partial frame across two decode() calls (tail reassembly)", () => {
      // CTraderEncoderDecoder.js:42-45 + 67 — a short buffer is stashed as
      // `tail` and prepended to the next incoming buffer.
      const ed = new CTraderEncoderDecoder();
      const handler = vi.fn();
      ed.setDecodeHandler(handler);

      const framed = makeFrame([0xc1, 0xc2]);
      // Split the frame: first call = header(4) + 1 body byte (incomplete),
      // second call = remaining 1 body byte.
      ed.decode(framed.slice(0, 5));
      expect(handler).toHaveBeenCalledTimes(0);

      ed.decode(framed.slice(5));
      expect(handler).toHaveBeenCalledTimes(1);
      expect(Array.from(handler.mock.calls[0][0])).toEqual([0xc1, 0xc2]);
    });
  });

  describe("size === 0 frame (L10 — FIXED: drop + reset, no state poisoning)", () => {
    // L10 (FIXED): CTraderEncoderDecoder.decode() now guards the length prefix.
    // A zero-length frame header (`00 00 00 00`) is dropped with a warning and
    // framing state is reset to undefined, so a malformed frame can no longer
    // poison the NEXT frame's decode. Before the fix, internal `size` was left
    // at 0 (falsy but set), mis-decoding the following frame.
    //
    // NOTE on the plan's original hypothesis: the plan suggested size=0 caused
    // "unbounded recursion / stack overflow". Phase-0 characterization REFUTED
    // that — a lone `00 00 00 00` returned normally. The real defect was silent
    // frame drop + poisoned `size` state, which L10 now fixes.

    it("a lone size=0 header does NOT throw and does NOT hang (returns normally)", async () => {
      const ed = new CTraderEncoderDecoder();
      const handler = vi.fn();
      ed.setDecodeHandler(handler);

      // Wrap in a Promise.race timeout so a future regression that DID
      // introduce unbounded recursion cannot hang the test runner.
      const sentinel = Symbol("returned");
      const result = await Promise.race([
        new Promise((resolve) => {
          ed.decode(Buffer.from([0x00, 0x00, 0x00, 0x00])); // size = 0
          resolve(sentinel);
        }),
        new Promise((resolve) => setTimeout(() => resolve("hung-after-300ms"), 300)),
      ]);

      expect(result).toBe(sentinel); // did not hang
      expect(handler).toHaveBeenCalledTimes(0); // zero-length frame contributes no body
    });

    it("coalesced [size=0][real frame]: the real frame body is still delivered (size=0 frame dropped)", () => {
      const ed = new CTraderEncoderDecoder();
      const handler = vi.fn();
      ed.setDecodeHandler(handler);

      const realFrame = makeFrame([0xde, 0xad]);
      ed.decode(Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x00]), realFrame]));

      // The zero-length header is dropped; the well-formed frame following it is
      // decoded intact as a single clean handler call.
      expect(handler).toHaveBeenCalledTimes(1);
      expect(Array.from(handler.mock.calls[0][0])).toEqual([0xde, 0xad]);
    });

    it("L10 FIX: a lone size=0 header no longer poisons the NEXT frame (frame arrives intact in a separate call)", () => {
      // Before the fix: feeding size=0 alone left internal `size === 0`, so a
      // fresh real frame in a SEPARATE call was mis-decoded. After L10, size is
      // reset to undefined on a zero-length frame, so the next frame arrives
      // clean.
      const ed = new CTraderEncoderDecoder();
      const handler = vi.fn();
      ed.setDecodeHandler(handler);

      // Call 1: zero-length frame — dropped, state reset.
      ed.decode(Buffer.from([0x00, 0x00, 0x00, 0x00]));
      expect(handler).toHaveBeenCalledTimes(0);

      // Call 2: a well-formed frame arrives in a fresh buffer.
      const realFrame = makeFrame([0xbe, 0xef]);
      ed.decode(realFrame);

      // The real frame now arrives INTACT as a single clean call (this assertion
      // FLIPPED from the Phase-0 "poisoned state" pin when L10 landed).
      expect(handler).toHaveBeenCalledTimes(1);
      expect(Array.from(handler.mock.calls[0][0])).toEqual([0xbe, 0xef]);
    });

    it("L10 emits a warning when a zero-length frame is dropped", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const ed = new CTraderEncoderDecoder();
      ed.setDecodeHandler(vi.fn());

      let warned = false;
      try {
        ed.decode(Buffer.from([0x00, 0x00, 0x00, 0x00]));
        // Capture the assertion BEFORE mockRestore() clears the calls.
        warned = warnSpy.mock.calls.some((c) =>
          typeof c[0] === "string" && c[0].includes("zero-length frame"));
      } finally {
        warnSpy.mockRestore();
      }
      expect(warned).toBe(true);
    });
  });
});
