# src/

Frontend Svelte application.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `App.svelte` | Main application entry point | Understanding app initialization, routing |
| `index.html` | HTML template with Vite mount | Debugging DOM issues |
| `main.js` | Application bootstrap | Debugging startup issues |
| `README.md` | Frontend architecture overview | Understanding frontend architecture, component relationships |
| `start.sh` | Frontend startup script | Debugging frontend startup process |
| `test_debug_isolate.html` | Debug rendering isolation test | Isolating debug rendering issues |
| `test_debug_tracer.html` | Debug output tracing test | Tracing debug output in isolation |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `components/` | Svelte UI components | Adding/modifying UI elements |
| `lib/` | Visualizers, utilities, calculations | Implementing visualizations, business logic |
| `stores/` | Svelte state management | Working with application state |
| `composables/` | Deprecated — replaced by `stores/marketDataStore.js` | Checking migration status, understanding composable replacements |
| `tests/` | Unit and E2E tests | Writing, running tests |
| `public/` | Static assets | Adding images, fonts, static files |
