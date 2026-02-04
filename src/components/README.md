# Components Architecture

## Overview

Components in this directory implement the Workspace UI layer following Framework-First principles. Each component maintains a single responsibility: Svelte handles reactive state and lifecycle, while delegating specialized tasks to framework primitives (interact.js for drag/resize, Three.js for WebGL rendering).

## Architecture

```
Workspace.svelte (container)
    |
    +--> BackgroundShader.svelte (WebGL layer, z-index: -1)
    |       |
    |       +--> Three.js WebGL Renderer
    |       |     |
    |       |     +--> ShaderMaterial (vertex + fragment GLSL)
    |       |     +--> PlaneGeometry (full-screen quad)
    |       |     +--> AnimationLoop (requestAnimationFrame)
    |       |
    |       +--> Lifecycle: onMount (init) / onDestroy (cleanup)
    |
    +--> FloatingDisplay.svelte (interactive layer)
            |
            +--> interact.js (drag, drop, resize)
            +--> Canvas 2D (data visualization)
```

### Component Hierarchy

- **Workspace.svelte**: Top-level container managing display lifecycle and persistence
- **BackgroundShader.svelte**: Independent WebGL background layer, isolated from Canvas 2D displays
- **FloatingDisplay.svelte**: Individual draggable displays with Canvas 2D rendering
- **FxBasketDisplay.svelte**: Specialized FX pair visualization
- **PriceMarkerManager.svelte**: Price marker overlay management
- **WorkspaceModal.svelte**: Configuration UI

## Data Flow: BackgroundShader Lifecycle

```
Svelte onMount
    |
    v
Initialize Three.js Scene, Camera, Renderer
    |
    v
Create ShaderMaterial with embedded GLSL
    |
    v
Mount renderer.domElement to container div
    |
    v
Start AnimationLoop (requestAnimationFrame)
    |
    v
Each frame: Update uTime uniform -> Render scene
```

### Three.js Integration

BackgroundShader uses Three.js as a **framework-external dependency**. This violates Framework-First principles because:
- Svelte has no WebGL abstraction
- Procedural noise patterns require shader programming
- No viable native alternative exists

**User override**: Explicit architectural decision to introduce Three.js for WebGL capabilities only. All other rendering uses Canvas 2D.

## Invariants

### BackgroundShader
- **Single WebGL context**: Background runs independently from Canvas 2D displays (no context sharing)
- **Z-index -1**: Background canvas stays behind all workspace content via CSS fixed positioning
- **Aspect ratio handling**: Shader uses uResolution uniform to correct proportions on window resize
- **Pattern type immutable**: Once set (hardcoded to Fluid=0), pattern type does not change at runtime
- **No user interaction**: Pointer events pass through to workspace layer

### Workspace Displays
- **One Canvas 2D context per display**: Each FloatingDisplay manages its own context
- **State persistence**: Workspace layout saves to localStorage on every mutation
- **Framework-First rendering**: All visualization uses Canvas 2D primitives (no custom rendering engines)

## Design Decisions

### BackgroundShader Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Three.js over enhanced CSS | Richer procedural patterns (simplex noise gradients) | 600KB bundle overhead, WebGL context management |
| Single file over modular | Easier to understand, fewer files to navigate | Inline GLSL loses syntax highlighting |
| No CSS fallback | Simpler architecture, no code duplication | No graceful degradation for unsupported WebGL |
| Hardcoded parameters | Simpler code path, no configuration complexity | Cannot tweak visuals without code change |

### Why This Structure

**Layered isolation**: BackgroundShader runs as independent WebGL layer behind Canvas 2D displays. This prevents context conflicts and allows clean separation between ambient background (procedural shader) and data visualization (Canvas 2D).

**Component autonomy**: Each display manages its own Canvas 2D context and lifecycle. Workspace coordinates only layout and persistence, not rendering details.

**Framework delegation**: Svelte handles UI state and component lifecycle. interact.js handles pointer interactions. Three.js handles WebGL. No custom abstractions duplicate framework capabilities.

## Boundaries

What this system does NOT do:
- **No shared WebGL contexts**: Background and displays are completely isolated
- **No CSS-based animations**: All procedural animation lives in GLSL shaders
- **No runtime pattern switching**: Pattern type is compile-time constant
- **No user controls for background**: Background visuals are not configurable
- **No graceful WebGL fallback**: Assumes WebGL support (logs warning if unavailable)
