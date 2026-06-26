"use strict";

/**
 * Phase 0.2 characterization tests for `CTraderCommand`.
 *
 * Source: libs/cTrader-Layer/build/src/core/commands/CTraderCommand.js
 * (internal vendored fork, consumed as @neurosensefx/ctrader-layer via file: link).
 *
 * Pins TODAY's pure-logic behavior (no sockets) for non-regression of the
 * upcoming layer fixes. Known defects are asserted as current behavior with a
 * `// TODO(Lxx): ...` marker.
 */

import { describe, it, expect } from "vitest";
const { CTraderCommand } = require("../../../../libs/cTrader-Layer/build/src/core/commands/CTraderCommand");

describe("CTraderCommand (built module)", () => {
  describe("constructor + getters", () => {
    it("exposes clientMsgId and a pending responsePromise", () => {
      // CTraderCommand.js:17-29 — constructor stores clientMsgId and creates a
      // new Promise whose resolve/reject are captured into private fields.
      const cmd = new CTraderCommand({ clientMsgId: "id-1" });
      expect(cmd.clientMsgId).toBe("id-1");
      expect(cmd.responsePromise).toBeInstanceOf(Promise);
      expect(cmd.response).toBeUndefined();
    });
  });

  describe("resolve(payload)", () => {
    it("resolves the promise with the given payload and caches response", async () => {
      // CTraderCommand.js:39-43 — resolve() stores the response then invokes
      // the captured promise resolver with it.
      const cmd = new CTraderCommand({ clientMsgId: "id-2" });
      const payload = { payloadType: 51, data: { ok: true } };
      cmd.resolve(payload);

      await expect(cmd.responsePromise).resolves.toBe(payload);
      expect(cmd.response).toBe(payload);
    });

    it("supports resolving with undefined (explicit)", async () => {
      const cmd = new CTraderCommand({ clientMsgId: "id-3" });
      cmd.resolve(undefined);
      await expect(cmd.responsePromise).resolves.toBeUndefined();
      expect(cmd.response).toBeUndefined();
    });
  });

  describe("reject(payload)", () => {
    it("rejects the promise with the given payload and caches response", async () => {
      // CTraderCommand.js:44-48 — reject() stores the response then invokes the
      // captured promise rejector with it.
      const cmd = new CTraderCommand({ clientMsgId: "id-4" });
      const payload = { payloadType: 2147483648, errorCode: "ERR" };
      cmd.reject(payload);

      await expect(cmd.responsePromise).rejects.toBe(payload);
      // NOTE: reject ALSO writes response (same field as resolve).
      expect(cmd.response).toBe(payload);
    });

    it("reject(payload) forwards the raw payload value — Command level still raw (L8 satisfied above the Command)", async () => {
      // NOTE (L8 status): CTraderCommand.reject() STILL forwards whatever value
      // the caller supplies straight to the promise rejector. This Command-level
      // pin therefore stays raw-object: a direct cmd.reject(rawObject) produces a
      // plain-object rejection, NOT an instanceof Error.
      //
      // L8's intent (callers see a real Error) is now satisfied ONE LEVEL UP:
      //   - CTraderCommandMap.rejectAll() always passes a real `new Error(...)`.
      //   - The L4 TTL path rejects with `new Error("Command <id> timed out...")`.
      // So every rejections that flows through the map/connection (close, TTL)
      // IS an instanceof Error — but a hand-rolled cmd.reject(rawObject) is not
      // normalized at the Command level. This is by design: the Command stays a
      // dumb value-forwarder; the map/connection own Error normalization.
      const cmd = new CTraderCommand({ clientMsgId: "id-5" });
      const rawObject = { errorCode: "PROTO_OA_ERROR", description: "boom" };
      cmd.reject(rawObject);

      let caught;
      try {
        await cmd.responsePromise;
      } catch (e) {
        caught = e;
      }

      expect(caught).toBe(rawObject); // exact same object identity
      expect(caught).not.toBeInstanceOf(Error);
      expect(typeof caught).toBe("object");
    });
  });
});
