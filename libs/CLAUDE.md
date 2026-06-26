# libs/

Library wrappers and integrations. `cTrader-Layer/` is an **internal vendored fork** tracked in this repo (not an npm dependency) — consumed via a `file:` link as `@neurosensefx/ctrader-layer`; free to modify. It now **owns transport reliability** (self-heals on connect/heartbeat/close/command-timeout — L1–L4); see `plans/ctrader-layer-hardening.md`. See its README.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `README.md` | External libraries overview | Understanding library integrations |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `cTrader-Layer/` | cTrader Open API integration library | Integrating with cTrader, debugging API calls |
