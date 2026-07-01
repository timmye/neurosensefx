# src/components/displays/

Specialized display component subtypes.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `DisplayCanvas.svelte` | Canvas-based display rendering container | Implementing canvas displays |
| `DisplayFrame.svelte` | Shared floating-display chrome — positioning, frame bg/border, selection ring (`--select`), focus glow, optional flash, resize handle, interact.js setup. Adopted by FloatingDisplay/FxBasketDisplay/HeadlinesWidget | Adding floating display types, modifying drag/resize/selection |
| `DisplayHeader.svelte` | Display header with status and controls (full mode + `minimal` symbol-only mode) | Adding header features |
