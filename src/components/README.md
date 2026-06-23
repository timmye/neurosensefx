# Components Architecture

## Overview

Components in this directory implement the Workspace UI layer following Framework-First principles. Each component maintains a single responsibility: Svelte handles reactive state and lifecycle, while delegating specialized tasks to framework primitives (interact.js for drag/resize, Canvas 2D for data visualization).

## Architecture

```
Workspace.svelte (container)
    |
    +--> FloatingDisplay.svelte (interactive layer)
            |
            +--> interact.js (drag, drop, resize)
            +--> Canvas 2D (data visualization)
```

### Component Hierarchy

- **Workspace.svelte**: Top-level container managing display lifecycle and persistence
- **FloatingDisplay.svelte**: Individual draggable displays with Canvas 2D rendering
- **FxBasketDisplay.svelte**: Specialized FX pair visualization
- **PriceMarkerManager.svelte**: Price marker overlay management
- **WorkspaceModal.svelte**: Configuration UI

## Invariants

### Workspace Displays
- **One Canvas 2D context per display**: Each FloatingDisplay manages its own context
- **State persistence**: Workspace layout saves to localStorage on every mutation
- **Framework-First rendering**: All visualization uses Canvas 2D primitives (no custom rendering engines)

## Design Decisions

### Why This Structure

**Component autonomy**: Each display manages its own Canvas 2D context and lifecycle. Workspace coordinates only layout and persistence, not rendering details.

**Framework delegation**: Svelte handles UI state and component lifecycle. interact.js handles pointer interactions. No custom abstractions duplicate framework capabilities.

## Boundaries

What this system does NOT do:
- **No shared rendering contexts**: Each display renders independently to its own Canvas 2D context
- **No background animation layer**: The workspace has no ambient/background rendering component; the canvas is transparent to the page background
