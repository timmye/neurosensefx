# libs/cTrader-Layer/

**Internal vendored fork** of Reiryoku's MIT-licensed cTrader-Layer — tracked in this repo (not installed from npm), consumed as `@neurosensefx/ctrader-layer` via a `file:` link in the root and backend `package.json`. Free to modify; see `README.md` for provenance + license attribution.

cTrader Open API TypeScript integration library — protobuf messaging, socket connections, and command encoding.

> **Self-healing transport (since `plans/ctrader-layer-hardening.md`, 2026-06-26).** This layer is
> no longer a passive read-only transport — it now **owns transport reliability**:
> **L1** `open()` rejects on error/timeout (no more open-hang); **L2** `sendHeartbeat()` writes a
> raw leak-free frame via `encode(51, {}, undefined)` (replaces the old external `tls.connect`
> monkey-patch); **L3** `close()` rejects all in-flight commands; **L4** per-RPC command TTL
> (default 15 s) with `onCommandTimeout → reject + close()`. Retires the "library read-only"
> guardrail; supervision-tier core unchanged.
>
> **Rebuild workflow** (the backend `require`s compiled `build/`, not `src/`): edit
> `src/*.ts` → `cd libs/cTrader-Layer && npx ttsc` (the **ttypescript** compiler, **not**
> standard `tsc` — it chokes on the `typescript-transform-paths` plugin) → `git add build/` →
> commit the compiled output (34 files) alongside the source change.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `README.md` | cTrader-Layer documentation | Onboarding to cTrader API wrapper, checking supported features |
| `LICENSE` | Library license terms | Checking usage permissions |
| `package.json` | Library dependencies | Updating cTrader dependencies |
| `CHANGELOG.md` | Version history | Checking release history, version compatibility |
| `tsconfig.json` | TypeScript compiler config | Modifying TypeScript settings, debugging compilation errors |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `src/core/` | Core protobuf and utility modules | Debugging protobuf encoding, adding command handlers, modifying socket connections |
| `protobuf/` | Protobuf schema definitions | Adding message types, debugging serialization |
| `entry/` | Library entry points | Understanding library bootstrap, modifying entry points |
| `src/` | Source code root with core modules | Navigating source structure, debugging cTrader protocol handling |
| `build/` | Compiled output | Cleaning builds, verifying compiled output |
