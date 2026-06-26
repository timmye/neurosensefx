"use strict";

/**
 * Phase 2.2 / 2.3 characterization + fix tests for `CTraderConnection`'s
 * pure-logic event-normalization (L6) and trySendCommand error-logging (L7).
 *
 * Source: libs/cTrader-Layer/build/src/core/CTraderConnection.js
 * (internal vendored fork, consumed as @neurosensefx/ctrader-layer via file: link).
 *
 * These surfaces need NO socket: on()/removeListener()/removeAllListeners()
 * operate on the underlying EventEmitter, and trySendCommand's failure path is
 * reachable by sending an unknown payload type (resolveIdentifierToPayloadType
 * returns undefined -> sendCommand throws). The connection is never opened.
 */

import { describe, it, expect, vi } from "vitest";
const { CTraderConnection } = require(
    "../../../../libs/cTrader-Layer/build/src/core/CTraderConnection",
);

// Construct without opening: host/port are inert until open() is called.
function makeConnection() {
    return new CTraderConnection({
        host: "127.0.0.1",
        port: 0,
        commandTtlMs: 0, // never arm a timer (no real command will resolve)
    });
}

describe("CTraderConnection event normalization (built module)", () => {
  describe("L6 — removeListener / removeAllListeners / off normalize proto names", () => {
    it("on('ProtoHeartbeatEvent', f) then removeListener('ProtoHeartbeatEvent', f) actually removes the listener", () => {
      // L6 (FIXED): on() resolves proto message names -> numeric payload types,
      // but removeListener/removeAllListeners/off used to be inherited raw, so
      // removeListener('ProtoHeartbeatEvent', f) was a silent no-op (the listener
      // was registered under '51', not 'ProtoHeartbeatEvent'). All three removal
      // methods now share on()'s normalization helper.
      const conn = makeConnection();
      const listener = vi.fn();

      conn.on("ProtoHeartbeatEvent", listener);
      // Emit under the normalized numeric key the connection uses internally.
      conn.emit("51", "payload");
      expect(listener).toHaveBeenCalledTimes(1);

      // Removing by NAME must now remove the listener registered under '51'.
      conn.removeListener("ProtoHeartbeatEvent", listener);
      conn.emit("51", "payload");
      expect(listener).toHaveBeenCalledTimes(1); // no second invocation
    });

    it("removeAllListeners('ProtoHeartbeatEvent') removes all listeners registered via the name", () => {
      const conn = makeConnection();
      const a = vi.fn();
      const b = vi.fn();

      conn.on("ProtoHeartbeatEvent", a);
      conn.on("ProtoHeartbeatEvent", b);
      conn.removeAllListeners("ProtoHeartbeatEvent");

      conn.emit("51", "payload");
      expect(a).not.toHaveBeenCalled();
      expect(b).not.toHaveBeenCalled();
    });

    it("off('ProtoHeartbeatEvent', f) is an alias that also normalizes", () => {
      const conn = makeConnection();
      const listener = vi.fn();

      conn.on("ProtoHeartbeatEvent", listener);
      conn.off("ProtoHeartbeatEvent", listener);
      conn.emit("51", "payload");
      expect(listener).not.toHaveBeenCalled();
    });

    it("a numeric-string type still works through the removal methods (no normalization needed)", () => {
      const conn = makeConnection();
      const listener = vi.fn();

      conn.on("51", listener);
      conn.removeListener("51", listener);
      conn.emit("51", "payload");
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("L7 — trySendCommand logs failures instead of bare catch {}", () => {
    it("a failing trySendCommand emits a visible [CTraderConnection] warning and resolves undefined", async () => {
      // L7 (FIXED): trySendCommand's bare `catch {}` returned undefined with zero
      // logging. It now console.warn's with a [CTraderConnection] prefix, the
      // payloadType, and the error message — while STILL returning undefined
      // (preserving the "try" semantics).
      const conn = makeConnection();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      let result;
      let warnCalls;
      try {
        // An unknown payload type makes sendCommand throw
        // ("Unknown payload type or identifier"), which trySendCommand swallows.
        result = await conn.trySendCommand("ThisPayloadTypeDoesNotExist", { x: 1 });
        // Capture calls BEFORE mockRestore() clears them.
        warnCalls = [...warnSpy.mock.calls];
      } finally {
        warnSpy.mockRestore();
      }

      expect(result).toBeUndefined();
      const warned = warnCalls.some((c) =>
        typeof c[0] === "string" &&
        c[0].includes("[CTraderConnection]") &&
        c[0].includes("trySendCommand") &&
        c[0].includes("ThisPayloadTypeDoesNotExist"));
      expect(warned).toBe(true);
    });
  });
});
