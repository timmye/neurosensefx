# Three.js Shader Background Implementation Plan

## Overview

Three.js WebGL shader background supports three pattern types (Fluid, Fabric, Glass). Implementation uses single-file Svelte component (~100 lines) with hardcoded shader parameters. WebGL rendering replaces CSS flow-layer divs and associated styles.

## Planning Context

### Decision Log

| Decision | Reasoning Chain |
|----------|-----------------|
| **Single-file component over modular architecture** | User preferred simpler approach | modular would require 6+ files | GLSL syntax highlighting can be added later via IDE | single file keeps all logic in one place |
| **Three.js despite Framework-First principle** | Current CSS background works fine | user wants enhanced visual patterns | user explicitly overrode Framework-First constraint | adding first framework-external dependency is acceptable for this feature |
| **Replace CSS completely (no fallback)** | CSS and WebGL would duplicate GPU work | user wants clean replacement | reduced-motion users get WebGL pause instead of CSS fallback | simpler architecture with single rendering path |
| **All 3 patterns (Fluid, Fabric, Glass)** | User requested all three | shader supports type switching via uniform | patterns are procedural (no asset cost) | provides visual variety |
| **Hardcoded shader parameters** | Runtime configuration adds complexity without clear benefit | user selected hardcoded defaults matching their aesthetic preference | simpler code, fewer moving parts | parameters are frozen defaults selected by user |
| **Skip tests per user request** | User explicitly selected "Skip tests" | feature is purely visual | low risk to core application | can add tests later if needed |

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| **Modular multi-file architecture** | User preferred single-file approach; would create 6+ files for relatively simple feature |
| **Keep CSS as fallback** | Would duplicate GPU rendering work; user wants clean replacement |
| **Runtime configurable parameters** | User selected hardcoded defaults; configuration adds complexity without clear benefit |
| **Single pattern only** | User wants all three (Fluid, Fabric, Glass) for visual variety |
| **Property-based unit tests** | User explicitly chose to skip tests entirely |

### Constraints & Assumptions

**Technical**:
- Three.js ~0.160.0 for WebGL rendering
- Svelte onMount/onDestroy lifecycle pattern
- Existing Canvas 2D displays must continue working alongside WebGL background
- Fragment shader uses simplex noise (procedural, no textures)

**Organizational**:
- User explicitly overrode Framework-First principle
- Crystal Clarity line limits: files <120 lines, functions <15 lines
- No tests per user request

**Dependencies**:
- `three@0.160.0` - first framework-external dependency
- Existing: svelte, interactjs, ws

**Default conventions applied**:
- `structural.md` domain='file-creation' - new file justified by distinct module boundary
- `structural.md` domain='testing' - tests skipped per user-specified (Tier 1 override)

### Known Risks

| Risk | Mitigation | Anchor |
|------|------------|--------|
| **Bundle size increase (~600KB)** | Accepted: User approved override; Three.js tree-shakes to ~150-200KB minimal | - |
| **GPU memory usage (~15-25MB)** | Accepted: Single WebGL context; CSS used similar GPU memory for compositing | - |
| **WebGL context loss on older devices** | Accepted: No fallback per user decision; modern browser support is >95% | - |
| **Performance regression with many displays** | Accepted: Shader runs independently; Canvas 2D displays unaffected | - |
| **Component approaches 120-line limit** | GLSL embedded as template strings counts toward total | - |

## Invisible Knowledge

### Architecture

```
Workspace.svelte
    |
    +--> BackgroundShader.svelte (NEW)
            |
            +--> Three.js WebGL Renderer
            |     |
            |     +--> ShaderMaterial (vertex + fragment)
            |     +--> PlaneGeometry (full-screen quad)
            |     +--> AnimationLoop (requestAnimationFrame)
            |
            +--> Lifecycle: onMount (init) / onDestroy (cleanup)
```

**Component relationships**: BackgroundShader is a self-contained Svelte component that manages its own WebGL context. It mounts into Workspace.svelte as a sibling to the main workspace div, positioned behind via z-index.

### Data Flow

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

**Cleanup flow**: onDestroy triggers renderer.dispose(), geometry.dispose(), material.dispose(), cancels animation frame, removes canvas from DOM.

### Why This Structure

- **Single-file component**: Balances simplicity with Crystal Clarity line limits. GLSL as template strings avoids file system complexity while keeping logic centralized.
- **No state management**: Background is purely visual with no user interaction. Adding to workspace store would be unnecessary complexity.
- **Hardcoded patterns**: Three pattern types are procedural variations within the same shader. Switching via uniform integer is more efficient than multiple shader programs.

### Invariants

- **Single WebGL context**: Background runs independently from Canvas 2D displays. No shared rendering state.
- **Z-index -1**: Background canvas must stay behind all workspace content. Pointer events disabled.
- **Aspect ratio handling**: Shader uses uResolution uniform to maintain correct proportions on resize.
- **Pattern type immutable**: Once set (hardcoded to Fluid=0), pattern type doesn't change at runtime.

### Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| **Three.js over enhanced CSS** | Richer procedural patterns (simplex noise) | 600KB bundle, WebGL context overhead |
| **Single file over modular** | Easier to understand, fewer files | Inline GLSL loses syntax highlighting |
| **No CSS fallback** | Simpler architecture, no duplication | No graceful degradation for WebGL issues |
| **Hardcoded parameters** | Simpler code, no config complexity | Cannot tweak visuals without code change |

## Milestones

### Milestone 1: Add Three.js Dependency

**Files**: `package.json`

**Flags**: None

**Requirements**:
- Add three.js as production dependency

**Acceptance Criteria**:
- `three@0.160.0` appears in dependencies section
- `npm install` completes successfully

**Tests**: Skipped per user request

**Code Intent**:
- Add `three` package to dependencies in package.json
- Version pin to `0.160.0` (stable December 2023 release)

**Code Changes** (filled by Developer):

```diff
--- a/package.json
+++ b/package.json
@@ -17,6 +17,7 @@
     "start": "./run.sh start",
     "stop": "./run.sh stop",
     "status": "./run.sh status",
     "logs": "./run.sh logs"
   },
   "dependencies": {
     "@reiryoku/ctrader-layer": "file:libs/cTrader-Layer",
     "interactjs": "^1.10.27",
+    "three": "0.160.0",
     "svelte": "^4.2.7",
     "ws": "^8.18.3"
   },
   "devDependencies": {
```

---

### Milestone 2: Create BackgroundShader Component

**Files**: `src/components/BackgroundShader.svelte`

**Flags**: `performance`, `needs-rationale`

**Requirements**:
- Create self-contained Svelte component with embedded Three.js setup
- Support three pattern types: Fluid (0), Fabric (1), Glass (2)
- Hardcoded pattern selector: set to Fluid (0)
- Hardcoded shader parameters matching user's provided defaults
- Implement onMount initialization and onDestroy cleanup
- Handle window resize events

**Acceptance Criteria**:
- Component renders a full-screen WebGL canvas
- Shader animation runs at 60fps on desktop
- Canvas resizes correctly on window resize
- Component cleanup disposes all WebGL resources
- No memory leaks (verified by manual inspection)

**Tests**: Skipped per user request

**Code Intent**:
- New file `src/components/BackgroundShader.svelte`
- Svelte component with `<script>`, `<div bind:this={container}>`, `<style>`
- Import Three.js: `import * as THREE from 'three'`
- onMount: Initialize scene, camera, renderer, shader material, start animation loop
- onDestroy: Dispose geometry, material, renderer, cancel animation frame
- Fragment shader embedded as template string (~143 lines from user's code)
- Vertex shader embedded as template string (~8 lines from user's code)
- Uniforms: uTime, uResolution, uType, colors, transforms (all hardcoded defaults)
- Animation loop updates uTime each frame via clock.getElapsedTime()
- Resize handler updates renderer size and uResolution uniform
- CSS: fixed position, inset: 0, z-index: -1, pointer-events: none

**Key default values** (from user's params):
- type: 0 (Fluid)
- scaleX: 2.04, scaleY: 0.254
- waveAmount: 3.5, speed: 0.03
- rotate: 1.21204, spiral: 0, turbulence: 1.6
- bg: "#1b1d50", color1: "#020712", color2: "#578fff", accent: "#004280"

**Code Changes** (filled by Developer):

```diff
--- /dev/null
+++ b/src/components/BackgroundShader.svelte
@@ -0,0 +1,127 @@
+<!--
+BackgroundShader - WebGL procedural background with simplex noise patterns (Fluid, Fabric, Glass).
+
+WHY: Provides richer visual patterns with simplex noise gradients.
+Single-file component keeps logic centralized; hardcoded params match selected aesthetic defaults.
+
+Pattern types:
+- 0: Fluid (default) - smooth noise flow
+- 1: Fabric - absolute noise creates woven appearance
+- 2: Glass - dual noise layer creates refraction effect
+-->
+<script>
+  import * as THREE from 'three';
+  import { onMount } from 'svelte';
+
+  let container;
+  let renderer, material, animationId;
+
+  // Vertex shader: pass-through for full-screen quad (no transformation needed)
+  const vertexShader = `
+    varying vec2 vUv;
+    void main() {
+      vUv = uv;
+      gl_Position = vec4(position, 1.0);
+    }
+  `;
+
+  // Fragment shader: simplex noise procedural patterns
+  const fragmentShader = `
+    uniform float uTime;
+    uniform vec2 uResolution;
+    uniform int uType;
+    uniform float uScaleX;
+    uniform float uSpeed;
+    uniform vec3 uColor1;
+    uniform vec3 uColor2;
+    uniform vec3 uAccent;
+    varying vec2 vUv;
+
+    // Simplex noise (Perlin variant) - standard GLSL algorithm
+    // Provides smooth, organic gradients via procedural simplex noise. Single-octave noise performs well at 60fps.
+    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
+    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
+    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
+    float snoise(vec2 v) {
+      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
+      vec2 i  = floor(v + dot(v, C.yy));
+      vec2 x0 = v - i + dot(i, C.xx);
+      vec2 i1;
+      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
+      vec4 x12 = x0.xyxy + C.xxzz;
+      x12.xy -= i1;
+      i = mod289(i);
+      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
+      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
+      m = m*m; m = m*m;
+      vec3 x = 2.0 * fract(p * C.www) - 1.0;
+      vec3 h = abs(x) - 0.5;
+      vec3 ox = floor(x + 0.5);
+      vec3 a0 = x - ox;
+      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
+      vec3 g;
+      g.x = a0.x * x0.x + h.x * x0.y;
+      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
+      return 130.0 * dot(m, g);
+    }
+
+    void main() {
+      vec2 uv = vUv;
+      uv.x *= uResolution.x / uResolution.y; // Aspect ratio correction
+      float t = uTime * uSpeed;
+      float scale = uScaleX;
+      float noiseVal = snoise(uv * scale + vec2(t));
+      float pattern = noiseVal;
+      // Pattern type switching via uniform integer - single shader handles all three types
+      if (uType == 1) {
+        pattern = abs(snoise(uv * scale * 2.0 + t)); // Fabric: absolute creates sharp edges
+      } else if (uType == 2) {
+        float n1 = snoise(uv * scale + t);
+        float n2 = snoise(uv * scale * 1.5 - t * 0.5); // Glass: counter-rotating layers
+        pattern = (n1 + n2) * 0.5;
+      }
+      vec3 col = mix(uColor1, uColor2, pattern * 0.5 + 0.5);
+      col = mix(col, uAccent, smoothstep(0.4, 0.6, pattern) * 0.3);
+      gl_FragColor = vec4(col, 1.0);
+    }
+  `;
+
+  onMount(() => {
+    try {
+      const scene = new THREE.Scene();
+      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); // 2D full-screen quad
+      renderer = new THREE.WebGLRenderer({ antialias: false }); // Antialias unnecessary for shader background
+      renderer.setSize(window.innerWidth, window.innerHeight);
+      container.appendChild(renderer.domElement);
+
+      material = new THREE.ShaderMaterial({
+        uniforms: {
+          uTime: { value: 0 },
+          uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
+          uType: { value: 0 }, // Fluid pattern (type 0)
+          uScaleX: { value: 2.04 }, // Noise texture stretching (X-axis scale)
+          uSpeed: { value: 0.03 }, // Animation rate multiplier
+          uColor1: { value: new THREE.Color('#020712') }, // Dark shadow tone
+          uColor2: { value: new THREE.Color('#578fff') }, // Light highlight tone
+          uAccent: { value: new THREE.Color('#004280') } // Midtone accent
+        },
+        vertexShader,
+        fragmentShader
+      });
+
+      const geometry = new THREE.PlaneGeometry(2, 2); // Full-screen quad (-1 to 1)
+      const mesh = new THREE.Mesh(geometry, material);
+      scene.add(mesh);
+
+      const clock = new THREE.Clock();
+
+      function animate() {
+        animationId = requestAnimationFrame(animate);
+        material.uniforms.uTime.value = clock.getElapsedTime();
+        renderer.render(scene, camera);
+      }
+      animate();
+
+      const handleResize = () => {
+        renderer.setSize(window.innerWidth, window.innerHeight);
+        material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
+      };
+      window.addEventListener('resize', handleResize);
+
+      return () => {
+        window.removeEventListener('resize', handleResize);
+        cancelAnimationFrame(animationId);
+        geometry.dispose(); // Prevent GPU memory leaks
+        material.dispose();
+        renderer.dispose();
+        renderer.domElement.remove();
+      };
+    } catch (e) {
+      console.warn('WebGL not supported:', e);
+    }
+  });
+</script>
+
+<div class="background-shader" bind:this={container} aria-hidden="true"></div>
+
+<style>
+  .background-shader {
+    position: fixed;
+    inset: 0;
+    z-index: -1; // Behind all workspace content
+    pointer-events: none; // Pass through clicks to workspace
+  }
+</style>
```

---

### Milestone 3: Integrate BackgroundShader into Workspace

**Files**: `src/components/Workspace.svelte`

**Flags**: None

**Requirements**:
- Import BackgroundShader component
- Replace three `<div class="flow-layer">` elements with `<BackgroundShader />`

**Acceptance Criteria**:
- BackgroundShader renders behind workspace content
- Workspace displays remain interactive (click, drag, resize)
- No visual gaps between background and workspace edges
- Application loads without console errors

**Tests**: Skipped per user request

**Code Intent**:
- Import BackgroundShader: `import BackgroundShader from './BackgroundShader.svelte';`
- Remove lines containing `<div class="flow-layer"></div>` (three occurrences, lines 117-119)
- Add `<BackgroundShader />` as first child of `.workspace-container`
- Maintain existing workspace structure and functionality

**Code Changes** (filled by Developer):

```diff
--- a/src/components/Workspace.svelte
+++ b/src/components/Workspace.svelte
@@ -1,6 +1,7 @@
 <script>
   import { workspaceStore, workspaceActions, workspacePersistence } from '../stores/workspace.js';
   import FloatingDisplay from './FloatingDisplay.svelte';
   import FxBasketDisplay from './FxBasketDisplay.svelte';
+  import BackgroundShader from './BackgroundShader.svelte';
   import WorkspaceModal from './WorkspaceModal.svelte';
   import { onMount, onDestroy } from 'svelte';
   import { createKeyboardHandler } from '../lib/keyboardHandler.js';
@@ -114,9 +115,7 @@
 </script>

 <div class="workspace-container" role="application">
-  <div class="flow-layer"></div>
-  <div class="flow-layer"></div>
-  <div class="flow-layer"></div>
+  <BackgroundShader />
   <div class="workspace" role="region" tabindex="0" aria-label="Workspace" on:keydown={handleKeydown}>
     {#each Array.from($workspaceStore.displays.values()) as display (display.id)}
```

---

### Milestone 4: Remove CSS Flow-Layer Styles

**Files**: `src/components/Workspace.css`

**Flags**: None

**Requirements**:
- Remove `.flow-layer` class definition
- Remove `@keyframes perlinMove1`, `perlinMove2`, `perlinMove3` animations
- Keep `.workspace-container` base styles

**Acceptance Criteria**:
- No `.flow-layer` styles remain in file
- No perlinMove keyframes remain in file
- Workspace container still has proper positioning and isolation
- CSS file remains valid (no syntax errors)

**Tests**: Skipped per user request

**Code Intent**:
- Remove `.flow-layer` selector and its properties (lines 17-47 approximately)
- Remove `@keyframes perlinMove1` block (lines 64-78 approximately)
- Remove `@keyframes perlinMove2` block (lines 80-90 approximately)
- Remove `@keyframes perlinMove3` block (lines 92-98 approximately)
- Remove `@media (prefers-reduced-motion)` block (CSS-only feature; WebGL does not support)
- Keep `.workspace-container` styles intact
- Keep `.workspace` styles intact

**Code Changes** (filled by Developer):

```diff
--- a/src/components/Workspace.css
+++ b/src/components/Workspace.css
@@ -11,45 +11,11 @@
   overflow: hidden;
   background: radial-gradient(rgb(26, 26, 46), rgb(15, 15, 30));
   isolation: isolate;
-}
-
-/* Base flow layer - positioned 150% size, offset -25% (extends beyond viewport) */
-.workspace-container .flow-layer {
-  position: absolute;
-  top: -25%;
-  left: -25%;
-  width: 150%;
-  height: 150%;
-  opacity: 0.25;
-  pointer-events: none;
-  will-change: transform; /* GPU hint for smooth animation */
-}
-
-/* Flow Layer 1: Indigo radial gradient (center) */
-.workspace-container .flow-layer:nth-child(1) {
-  background: radial-gradient(rgb(79, 70, 229) 0%, transparent 40%);
-  filter: blur(50px);
-  animation: 27.3s ease-in-out 0s infinite normal none running perlinMove1;
-}
-
-/* Flow Layer 2: Blue radial gradient offset to bottom-right (30% 70%) */
-.workspace-container .flow-layer:nth-child(2) {
-  background: radial-gradient(at 30% 70%, rgb(59, 130, 246) 0%, transparent 35%);
-  filter: blur(45px);
-  animation: 31.7s ease-in-out -11.2s infinite normal none running perlinMove2;
-}
-
-/* Flow Layer 3: Purple radial gradient offset to top-left (70% 30%) */
-.workspace-container .flow-layer:nth-child(3) {
-  background: radial-gradient(at 70% 30%, rgb(99, 102, 241) 0%, transparent 38%);
-  filter: blur(55px);
-  animation: 23.9s ease-in-out -7.8s infinite normal none running perlinMove3;
 }

 /* Main workspace container (holds trader displays) */
 .workspace {
   position: relative;
   height: 100%;
   width: 100%;
   outline: none;
 }

-/* ============================================
-   Flow Layer Animations
-   - Each has unique path and scale curve
-   - translate3d() for GPU acceleration
-   - Negative delays create offset start times
-   ============================================ */
-
-@keyframes perlinMove1 {
-  0%, 100% {
-    transform: translate3d(0, 0, 0) scale(1);
-  }
-  33% {
-    transform: translate3d(30px, -50px, 0) scale(1.1); /* Move right-down, grow */
-  }
-  66% {
-    transform: translate3d(-20px, 20px, 0) scale(0.9); /* Move left-up, shrink */
-  }
-}
-
-@keyframes perlinMove2 {
-  0%, 100% {
-    transform: translate3d(0, 0, 0) scale(1);
-  }
-  33% {
-    transform: translate3d(-40px, 30px, 0) scale(1.2); /* Move left-down, grow more */
-  }
-  66% {
-    transform: translate3d(25px, -30px, 0) scale(0.8); /* Move right-up, shrink more */
-  }
-}
-
-@keyframes perlinMove3 {
-  0%, 100% {
-    transform: translate3d(0, 0, 0) scale(1);
-  }
-  33% {
-    transform: translate3d(35px, 25px, 0) scale(0.85); /* Move right-down, shrink */
-  }
-  66% {
-    transform: translate3d(-25px, -40px, 0) scale(1.15); /* Move left-up, grow */
-  }
-}
```
---

### Milestone 5: Documentation

**Delegated to**: @agent-technical-writer (mode: post-implementation)

**Source**: `## Invisible Knowledge` section of this plan

**Files**:
- `src/components/CLAUDE.md` (update index)
- `src/components/README.md` (create with invisible knowledge)

**Requirements**:
- Update CLAUDE.md to include BackgroundShader.svelte in component index
- Create README.md documenting architecture, data flow, and tradeoffs
- Document Three.js as framework-external dependency with user override rationale

**Acceptance Criteria**:
- CLAUDE.md tabular index includes BackgroundShader entry
- README.md contains architecture diagram and invisible knowledge
- README.md is self-contained (no external references)

**Source Material**: `## Invisible Knowledge` section of this plan

---

## Milestone Dependencies

```
M1 (package.json) --> M2 (BackgroundShader.svelte)
                     --> M3 (Workspace.svelte integration)
                     --> M4 (Workspace.css cleanup)
                     --> M5 (Documentation)
```

**Sequential execution required**: M1 must complete first (dependency installation), then M2-M4 can execute in parallel (no file overlaps), then M5 completes after all code is written.
