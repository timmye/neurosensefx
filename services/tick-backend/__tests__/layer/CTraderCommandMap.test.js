"use strict";

/**
 * Phase 0.2 characterization tests for `CTraderCommandMap`.
 *
 * Source: libs/cTrader-Layer/build/src/core/commands/CTraderCommandMap.js
 * (internal vendored fork, consumed as @neurosensefx/ctrader-layer via file: link).
 *
 * These tests pin TODAY's pure-logic behavior (no sockets) so upcoming layer
 * fixes (L3/L4/L6/L8/L9/L10) are provably non-regressing. Where today's
 * behavior is a known defect, the current-defect behavior is asserted AND a
 * `// TODO(Lxx): ...` marker is left for the fix that will change it.
 */

import { describe, it, expect, vi } from "vitest";
const { CTraderCommandMap } = require("../../../../libs/cTrader-Layer/build/src/core/commands/CTraderCommandMap");

describe("CTraderCommandMap (built module)", () => {
  function makeMap() {
    const send = vi.fn();
    const map = new CTraderCommandMap({ send });
    return { map, send };
  }

  describe("create()", () => {
    it("inserts a command into openCommands and returns a pending responsePromise", async () => {
      // CTraderCommandMap.js:27-32 — create() builds a CTraderCommand, stores it
      // under clientMsgId in the private openCommands map, invokes send(message),
      // and returns command.responsePromise.
      const { map, send } = makeMap();

      const promise = map.create({
        clientMsgId: "cmd-1",
        message: { kind: "ProtoPing" },
      });

      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith({ kind: "ProtoPing" });

      // The command is now registered and visible via the openCommands snapshot.
      expect(map.openCommands).toHaveLength(1);
      expect(map.openCommands[0].clientMsgId).toBe("cmd-1");

      // responsePromise is a real Promise that stays pending until the command
      // is extracted and settled (see the L3 leak test below for the pending
      // proof, and the extractById end-to-end test for the settle path).
      expect(promise).toBeInstanceOf(Promise);
    });

    it("registers multiple distinct commands keyed by clientMsgId", () => {
      const { map } = makeMap();
      map.create({ clientMsgId: "a", message: {} });
      map.create({ clientMsgId: "b", message: {} });

      const ids = map.openCommands.map((c) => c.clientMsgId).sort();
      expect(ids).toEqual(["a", "b"]);
    });
  });

  describe("extractById()", () => {
    it("removes and returns the command for a known clientMsgId", () => {
      // CTraderCommandMap.js:33-40 — extractById() looks up by clientMsgId,
      // deletes the entry, and returns the CTraderCommand.
      const { map } = makeMap();
      map.create({ clientMsgId: "cmd-x", message: {} });

      const command = map.extractById("cmd-x");
      expect(command).toBeDefined();
      expect(command.clientMsgId).toBe("cmd-x");

      // Extraction removed it from the map.
      expect(map.openCommands).toHaveLength(0);
    });

    it("returns undefined for an unknown clientMsgId", () => {
      // CTraderCommandMap.js:35-37 — unknown id returns undefined.
      const { map } = makeMap();
      expect(map.extractById("does-not-exist")).toBeUndefined();
    });

    it("is idempotent-empty: a second extract of the same id returns undefined", () => {
      const { map } = makeMap();
      map.create({ clientMsgId: "once", message: {} });
      expect(map.extractById("once")).toBeDefined();
      expect(map.extractById("once")).toBeUndefined();
    });

    it("end-to-end: extract + resolve settles the promise from create()", async () => {
      const { map } = makeMap();
      const promise = map.create({ clientMsgId: "e2e", message: {} });
      const command = map.extractById("e2e");
      command.resolve({ ok: true });
      await expect(promise).resolves.toEqual({ ok: true });
    });
  });

  describe("openCommands getter", () => {
    it("returns a snapshot array (spread copy), not the live internal map", () => {
      // CTraderCommandMap.js:24-26 — getter returns [...openCommands.values()],
      // i.e. a fresh array each call.
      const { map } = makeMap();
      map.create({ clientMsgId: "s1", message: {} });

      const snap1 = map.openCommands;
      const snap2 = map.openCommands;
      expect(snap1).not.toBe(snap2); // distinct array instances
      expect(snap1).toHaveLength(1);
    });

    it("returns an empty array when nothing has been created", () => {
      const { map } = makeMap();
      expect(map.openCommands).toEqual([]);
    });
  });

  describe("rejectAll() — L3 settle-on-teardown", () => {
    it("rejects every pending command with the supplied Error and clears the map", async () => {
      const { map } = makeMap();
      const p1 = map.create({ clientMsgId: "a", message: {} });
      const p2 = map.create({ clientMsgId: "b", message: {} });
      expect(map.pendingCommandCount).toBe(2);

      const err = new Error("cTrader connection closed");
      map.rejectAll(err);

      // Each pending command rejects with the SAME Error instance (instanceof Error).
      await expect(p1).rejects.toBe(err);
      await expect(p2).rejects.toBe(err);
      // And the map is cleared.
      expect(map.pendingCommandCount).toBe(0);
      expect(map.openCommands).toHaveLength(0);
    });

    it("is a no-op-safe double-settle: a command already resolved is not re-rejected", async () => {
      // CTraderCommand guards against double-settle; rejectAll after resolve must
      // not change the settled value and must still clear the map.
      const { map } = makeMap();
      const promise = map.create({ clientMsgId: "once", message: {} });
      const command = map.extractById("once");
      command.resolve({ ok: true });
      await expect(promise).resolves.toEqual({ ok: true });

      // rejectAll on an already-cleared map is harmless.
      map.rejectAll(new Error("late"));
      await expect(promise).resolves.toEqual({ ok: true });
      expect(map.pendingCommandCount).toBe(0);
    });
  });

  describe("command TTL — L4 timeout rejects + triggers onCommandTimeout", () => {
    it("rejects the command and invokes onCommandTimeout when the timer fires (fake timer)", async () => {
      vi.useFakeTimers();
      try {
        const onCommandTimeout = vi.fn();
        const send = vi.fn();
        const map = new CTraderCommandMap({ send, onCommandTimeout, commandTtlMs: 1000 });

        const promise = map.create({ clientMsgId: "ttl-1", message: {} });
        expect(map.pendingCommandCount).toBe(1);
        expect(onCommandTimeout).not.toHaveBeenCalled();

        // Advance past the TTL.
        vi.advanceTimersByTime(1000);

        await expect(promise).rejects.toBeInstanceOf(Error);
        // The map entry was removed on timeout.
        expect(map.pendingCommandCount).toBe(0);
        // And the timeout fired the injected callback (CTraderConnection uses this
        // to close() the transport — timeout -> reject + close semantics).
        expect(onCommandTimeout).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("does NOT leak a timer: a normally-extracted command never times out", async () => {
      vi.useFakeTimers();
      try {
        const onCommandTimeout = vi.fn();
        const send = vi.fn();
        const map = new CTraderCommandMap({ send, onCommandTimeout, commandTtlMs: 50 });

        const promise = map.create({ clientMsgId: "extracted", message: {} });
        // Extract + resolve before the TTL.
        const command = map.extractById("extracted");
        command.resolve({ ok: true });
        await expect(promise).resolves.toEqual({ ok: true });

        // Advancing well past the TTL must NOT fire onCommandTimeout (timer cleared).
        vi.advanceTimersByTime(200);
        expect(onCommandTimeout).not.toHaveBeenCalled();
        expect(map.pendingCommandCount).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("rejectAll clears pending TTL timers (no leaked timer, no late onCommandTimeout)", async () => {
      vi.useFakeTimers();
      try {
        const onCommandTimeout = vi.fn();
        const send = vi.fn();
        const map = new CTraderCommandMap({ send, onCommandTimeout, commandTtlMs: 1000 });
        // Attach a catch immediately so the rejection from rejectAll is handled
        // (no unhandled-rejection noise under fake timers).
        const promise = map.create({ clientMsgId: "x", message: {} }).catch(() => {});

        map.rejectAll(new Error("closing"));
        expect(map.pendingCommandCount).toBe(0);

        // Advancing past the TTL after rejectAll must NOT fire onCommandTimeout
        // (rejectAll cleared the timer) and must not double-reject.
        vi.advanceTimersByTime(2000);
        expect(onCommandTimeout).not.toHaveBeenCalled();
        await promise;
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
