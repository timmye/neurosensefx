# libs/cTrader-Layer/

**Internal vendored fork** of Reiryoku's MIT-licensed cTrader-Layer — tracked in this repo (not installed from npm), consumed as `@neurosensefx/ctrader-layer` via a `file:` link in the root and backend `package.json`. Free to modify; see `README.md` for provenance + license attribution.

cTrader Open API TypeScript integration library — protobuf messaging, socket connections, and command encoding.

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
