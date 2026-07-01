# src/

Frontend Svelte application.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `App.svelte` | Main application entry point | Understanding app initialization, routing |
| `index.html` | HTML template with Vite mount | Debugging DOM issues |
| `main.js` | Application bootstrap | Debugging startup issues |
| `README.md` | Frontend architecture overview | Understanding frontend architecture, component relationships |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `components/` | Svelte UI components | Adding/modifying UI elements |
| `styles/` | Design tokens — `tokens.css` (2-tier role-locked CSS custom properties, primitive→semantic; themed via `[data-theme]`). Imported once in `main.js` | Adding/changing design tokens, theming |
| `lib/` | Visualizers, utilities, calculations | Implementing visualizations, business logic |
| `stores/` | Svelte state management | Working with application state |
| `tests/` | Unit and E2E tests | Writing, running tests |
| `public/` | Static assets | Adding images, fonts, static files |
