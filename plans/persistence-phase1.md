# Plan

## Overview

Workspace export excludes chart drawings stored in IndexedDB, causing data loss on export/import cycles. Users have no visibility that their data is local-only.

**Approach**: Wire drawingStore into exportWorkspace/importWorkspace for full drawing round-trip. Add subtle durability indicator with quick export access. Bump export format to v1.1.0 for forward compatibility.

## Planning Context

### Decision Log

| ID | Decision | Reasoning Chain |
|---|---|---|
| DL-001 | Make exportWorkspace async, collect drawings from IndexedDB per display symbol+resolution | drawingStore.load() returns Promise<Array> -> export must await each load -> exportWorkspace becomes async -> Workspace.svelte caller needs await |
| DL-002 | Import writes drawings to IndexedDB via drawingStore.save() for each drawing in export data | Drawings are keyed by symbol+resolution in IndexedDB -> import iterates drawings array, calls drawingStore.save() for each -> display mount triggers restoreDrawings() which loads from IndexedDB |
| DL-003 | Bump export format version to 1.1.0, import handles both 1.0.0 and 1.1.0 via semver-aware version check | Forward compatibility requirement -> 1.0.0 files have no drawings key -> import checks version via numeric semver comparison (split on dot, compare each numeric part) to avoid lexicographic sort bugs where 1.10.0 < 1.2.0 -> 1.0.0 files skip drawing restore, 1.1.0 files include drawings array -> utility function compareSemver(a, b) returns -1/0/1 used as: if compareSemver(version, 1.1.0) >= 0 |
| DL-004 | Durability indicator as a small persistent banner in Workspace.svelte showing local storage status | Phase 2 requires UX indication -> minimal UI addition -> info-style banner with export button -> no new component file needed, inline in Workspace.svelte |
| DL-005 | Clear existing drawings from IndexedDB before import restore to avoid duplicates; only clears symbol+resolution pairs present in import file; orphaned local drawings for pairs absent from import survive | Import replaces workspace state -> drawings from old workspace must not coexist with imported drawings for same symbol+resolution pair -> clearAll scoped to each imported pair only -> orphaned drawings for symbol+resolution pairs absent from import file survive import -> this is intentional: import is a targeted restore of what the file contains, not a full wipe -> tradeoff: local-only drawings for symbol+resolution pairs present in the import file are permanently destroyed even if they differ from imported drawings (documented as accepted data-destruction tradeoff for consistency) |
| DL-006 | Expose drawingStore on window for test access, matching existing pattern in workspace.js (workspaceStore, workspaceActions, workspacePersistence all on window) | Existing tests use page.evaluate(() => window.workspaceActions) -> drawingStore not on window -> tests cannot seed drawings -> expose drawingStore on window in drawingStore.js following same pattern -> minimal change, already established convention in codebase -> alternative (dynamic import in page.evaluate) is fragile and wordy |

### Rejected Alternatives

| Alternative | Why Rejected |
|---|---|
| Synchronous export with pre-loaded drawings cache | drawingStore is IndexedDB-backed (Dexie.js) -- all operations are async by nature. A cache would add complexity and stale-data risk for no benefit. (ref: DL-001) |
| Separate drawing export file alongside workspace file | Two-file export creates user friction (must keep both files, must import both). Single-file export with embedded drawings is simpler and matches how the workspace is a single conceptual unit. (ref: DL-001) |

### Constraints

- drawingStore.load() returns Promise<Array> -- export must become async
- Export format version bump from 1.0.0 to 1.1.0 -- import must handle both versions
- No new dependencies -- drawingStore and workspace.js have everything needed
- Automated tests via Playwright E2E in testDir ./src/tests

### Known Risks

- **Large drawing sets cause slow export/import**: drawingStore.load() returns all drawings for a symbol+resolution -- typically 1-20KB per pair. Even 20 displays with drawings is under 400KB total.
- **IndexedDB clear+save on import has a window where drawings are lost if browser crashes mid-import, or if clearAll succeeds but save fails**: Pre-clear snapshot rollback: before clearAll, load existing drawings as snapshot. If save throws after clear, attempt to restore snapshot. If browser crashes (unrecoverable), accepted as same risk profile as current workspace import which clears displays first. Drawing restore errors are isolated per pair and do not block display restoration.

## Invisible Knowledge

### System

Drawings live in IndexedDB (Dexie.js) keyed by symbol+resolution. The workspace layout lives in localStorage. Export bridges these two storage mechanisms into a single JSON file. Import writes back to both stores. ChartDisplay.svelte calls restoreDrawings(symbol, resolution) on mount which reads from IndexedDB -- so imported drawings appear automatically when displays mount after import.

### Invariants

- Every display with type 'chart' has symbol and resolution fields used to key drawings in IndexedDB
- drawingStore.save() auto-generates id and timestamps -- imported drawings get new ids (original ids are not preserved)
- Export format is a single JSON file -- workspace layout + price markers + drawings are all embedded
- Version field in export JSON determines whether drawing restoration runs on import
- drawingStore.load() returns all drawings for a symbol+resolution pair as an array

### Tradeoffs

- Drawing IDs are not preserved across export/import (Dexie auto-generates new ++id) -- acceptable since overlayIds are also recreated by KLineChart on restore
- Clear-before-save on import means local-only drawings for symbol+resolution pairs present in the import file are permanently destroyed even if they differ from imported drawings -- this is an intentional data-destruction tradeoff accepted for workspace consistency (imported workspace is the canonical state), while drawings for symbol+resolution pairs absent from the import file survive
- Banner UX is minimal (no auto-export prompt, no last-backup timestamp) -- keeps scope tight for Phase 2, can enhance later

## Milestones

### Milestone 1: Async export with drawings

**Files**: src/stores/workspace.js, src/components/Workspace.svelte, src/lib/chart/drawingStore.js, src/tests/e2e/workspace-drawing-persistence.spec.js

**Requirements**:

- exportWorkspace collects drawings from IndexedDB for every chart display
- Export JSON includes new drawings key containing all drawing data
- Export version bumps to 1.1.0
- Workspace.svelte awaits the now-async exportWorkspace
- drawingStore exposed on window for E2E test access (seeding/verifying drawings)

**Acceptance Criteria**:

- Exported JSON contains version: '1.1.0'
- Exported JSON contains drawings key with entries keyed by symbol+resolution
- Each drawings entry contains the full drawing objects from IndexedDB
- No console errors during export with chart displays present

**Tests**:

- Export produces v1.1.0 JSON with drawings from IndexedDB
- Export with partial load failure produces valid JSON with available drawings
- E2E: Export test seeds drawings via page.evaluate(() => window.drawingStore.save(symbol, resolution, drawingObj)), creates chart display, triggers export via page.waitForEvent('download') (pattern: comprehensive-llm-workflow.spec.js:431-444), intercepts download blob, parses JSON, verifies version 1.1.0 and drawings key contains seeded drawing data

#### Code Intent

- **CI-M-001-001** `src/stores/workspace.js::exportWorkspace`: Convert exportWorkspace from sync to async. Import drawingStore at top. Wrap the entire export logic in try/catch. Iterate all displays in workspace state, for each display with symbol and resolution fields call drawingStore.load(symbol, resolution) and await it. If a single load() throws, log a console warning with the symbol+resolution and continue with remaining displays (partial export is better than total failure). Collect successful results into a drawings map keyed by symbol+resolution. Include drawings map in export JSON under new drawings key. Bump version from 1.0.0 to 1.1.0. If the outer try/catch catches, re-throw to let the caller handle it (Workspace.svelte shows user-facing error). (refs: DL-001, DL-003)
- **CI-M-001-002** `src/components/Workspace.svelte::exportWorkspace`: Update exportWorkspace() function to await the now-async workspaceActions.exportWorkspace(). No other changes needed since the function is already called from a click handler. (refs: DL-001)
- **CI-M-001-003** `src/lib/chart/drawingStore.js`: Add window exposure block at end of drawingStore.js: if (typeof window !== undefined) { window.drawingStore = drawingStore; }. This matches the existing pattern in workspace.js:416-419 and enables E2E tests to seed drawings via page.evaluate(() => window.drawingStore.save(...)). (refs: DL-006)

#### Code Changes

**CC-M-001-001** (src/stores/workspace.js) - implements CI-M-001-001

**Code:**

```diff
--- a/src/stores/workspace.js
+++ b/src/stores/workspace.js
@@ -1,6 +1,8 @@
 import { writable } from 'svelte/store';
+import { drawingStore } from '../lib/chart/drawingStore.js';

 const initialState = {
   displays: new Map(),
@@ -268,38 +270,56 @@ const actions = {
       console.log(`✅ Workspace imported successfully (${displays.length} displays)`);
     } catch (error) {
       console.error('❌ Failed to import workspace:', error);
     }
   },

-  exportWorkspace: () => {
+  exportWorkspace: async () => {
     try {
       const state = workspaceStore.getState();
       const priceMarkers = {};

       // Collect all price-markers from localStorage
       for (let i = 0; i < localStorage.length; i++) {
         const key = localStorage.key(i);
         if (key.startsWith('price-markers-')) {
           priceMarkers[key] = JSON.parse(localStorage.getItem(key));
         }
       }

+      // Collect drawings from IndexedDB for each chart display
+      const drawings = {};
+      for (const display of state.displays.values()) {
+        if (display.symbol && display.resolution) {
+          try {
+            const displayDrawings = await drawingStore.load(display.symbol, display.resolution);
+            if (displayDrawings.length > 0) {
+              drawings[`${display.symbol}|${display.resolution}`] = displayDrawings;
+            }
+          } catch (err) {
+            // Partial export is better than total failure
+            console.warn(`Failed to load drawings for ${display.symbol}/${display.resolution}:`, err);
+          }
+        }
+      }
+
       const exportData = {
-        version: '1.0.0',
+        version: '1.1.0',
         timestamp: new Date().toISOString(),
         workspace: {
           displays: Array.from(state.displays.entries()),
           nextZIndex: state.nextZIndex
         },
-        priceMarkers
+        priceMarkers,
+        drawings
       };

       const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = `workspace-${new Date().toISOString().split('T')[0]}.json`;
       a.click();
       URL.revokeObjectURL(url);

       console.log('Workspace exported successfully');
     } catch (error) {
       console.error('Failed to export workspace:', error);
-    }
+      throw error;
+    }
   },
```

**Documentation:**

```diff
--- a/src/stores/workspace.js
+++ b/src/stores/workspace.js
@@ -1,6 +1,10 @@
 import { writable } from 'svelte/store';
 import { drawingStore } from '../lib/chart/drawingStore.js';

+// Numeric semver comparison avoiding lexicographic sort bugs (1.10.0 < 1.2.0).
+// Returns -1, 0, or 1. Only three-part versions supported. (ref: DL-003)
+//
 function compareSemver(a, b) {
   const pa = a.split('.').map(Number);
   const pb = b.split('.').map(Number);
@@ -337,6 +341,9 @@
       }

       // Collect drawings from IndexedDB for each chart display
+      // Key format: "symbol|resolution" — matches drawingStore scope.
+      // Per-display try/catch: partial export is better than total failure. (ref: DL-001)
+      //
       const drawings = {};
       for (const display of state.displays.values()) {
         if (display.symbol && display.resolution) {
@@ -353,6 +360,8 @@
         }
       }

+      // Export format v1.1.0 includes `drawings` field. v1.0.0 files have no drawings key. (ref: DL-003)
+      //
       const exportData = {
         version: '1.1.0',
         timestamp: new Date().toISOString(),

```


**CC-M-001-002** (src/components/Workspace.svelte) - implements CI-M-001-002

**Code:**

```diff
--- a/src/components/Workspace.svelte
+++ b/src/components/Workspace.svelte
@@ -34,8 +34,13 @@
     }
   }

-  function exportWorkspace() {
-    workspaceActions.exportWorkspace();
-    console.log('✅ Workspace export initiated');
+  async function exportWorkspace() {
+    try {
+      await workspaceActions.exportWorkspace();
+      console.log('✅ Workspace export initiated');
+    } catch (error) {
+      console.error('❌ Workspace export failed:', error);
+      alert('Export failed. Please try again.');
+    }
   }

   function importWorkspace() {
```

**Documentation:**

```diff
--- a/src/components/Workspace.svelte
+++ b/src/components/Workspace.svelte
@@ -34,6 +34,9 @@
     }
   }

+  // exportWorkspace is async (IndexedDB drawing collection). Surface errors to user
+  // rather than swallowing them silently. (ref: DL-001)
+  //
   async function exportWorkspace() {
     try {
       await workspaceActions.exportWorkspace();

```


**CC-M-001-003** (src/lib/chart/drawingStore.js) - implements CI-M-001-003

**Code:**

```diff
--- a/src/lib/chart/drawingStore.js
+++ b/src/lib/chart/drawingStore.js
@@ -35,3 +35,8 @@ export const drawingStore = {
   async clearAll(symbol, resolution) {
     return db.drawings.where({ symbol, resolution }).delete();
   },
 };

+// Expose to window for E2E test access (seed/verify drawings)
+if (typeof window !== 'undefined') {
+  window.drawingStore = drawingStore;
+}
```

**Documentation:**

```diff
--- a/src/lib/chart/drawingStore.js
+++ b/src/lib/chart/drawingStore.js
@@ -37,5 +37,6 @@
 };

 // Expose to window for E2E test access (seed/verify drawings)
+// window.drawingStore follows same pattern as workspaceStore, workspaceActions, workspacePersistence. (ref: DL-006)
 if (typeof window !== 'undefined') {
   window.drawingStore = drawingStore;

```


**CC-M-001-004** (src/stores/CLAUDE.md)

**Documentation:**

```diff
--- a/src/stores/CLAUDE.md
+++ b/src/stores/CLAUDE.md
@@ -7,7 +7,7 @@
 | `marketDataStore.js` | Centralized market data store with subscription management and market profile integration | Adding data subscriptions, debugging data flow, working with tick/profile data |
 | `chartDataStore.js` | OHLC bar management, IndexedDB caching via Dexie.js, progressive scroll loading | Adding candle subscriptions, debugging chart data flow, implementing resolution switching |
-| `workspace.js` | Workspace state persistence and management | Implementing workspace features, debugging state |
+| `workspace.js` | Workspace state, display management, export/import (displays, price markers, drawings via IndexedDB) | Implementing workspace features, debugging state, export/import |
 | `priceMarkerPersistence.js` | Price marker localStorage handling | Fixing marker persistence issues |

```


**CC-M-001-005** (src/lib/chart/CLAUDE.md)

**Documentation:**

```diff
--- a/src/lib/chart/CLAUDE.md
+++ b/src/lib/chart/CLAUDE.md
@@ -12,7 +12,7 @@
 | `chartThemeLight.js` | Light theme styles for KLineChart (colors, fonts, grid, crosshair) | Changing chart appearance, modifying font metrics for x-axis suppression |
-| `drawingStore.js` | Drawing persistence via IndexedDB (Dexie.js) scoped by symbol+resolution | Adding drawing storage, debugging persistence, schema migration |
+| `drawingStore.js` | Drawing persistence via IndexedDB (Dexie.js) scoped by symbol+resolution. Exposed as `window.drawingStore` for E2E test access | Adding drawing storage, debugging persistence, schema migration, writing E2E tests |
 | `drawingCommands.js` | Command pattern for undo/redo (DrawingCommandStack, CreateDrawingCommand, DeleteDrawingCommand) | Adding new command types, modifying undo behavior, debugging drawing operations |

```


### Milestone 2: Import drawings to IndexedDB

**Files**: src/stores/workspace.js, src/tests/e2e/workspace-drawing-persistence.spec.js

**Requirements**:

- importWorkspace reads drawings from export JSON when version >= 1.1.0
- Import clears existing drawings per symbol+resolution before saving new ones
- Import handles v1.0.0 files without drawings key gracefully (no errors)
- Import handles missing drawings key in v1.1.0 gracefully
- Import error handling: drawing failures do not block display restoration
- Import rollback: if clearAll succeeds but save fails, attempt pre-clear snapshot restore

**Acceptance Criteria**:

- After importing a v1.1.0 file, IndexedDB contains the drawing data accessible via drawingStore.load()
- Importing a v1.0.0 file completes without errors and restores displays correctly
- Importing over an existing workspace replaces (not appends) drawings
- Drawing import errors are logged but do not prevent display restoration

**Tests**:

- Import v1.1.0 with drawings restores them to IndexedDB
- Import v1.0.0 without drawings restores displays only
- Import with save failure rolls back to pre-clear snapshot
- E2E: Import v1.1.0 test constructs JSON workspace file with drawings array, imports via page.evaluate(() => window.workspaceActions.importWorkspace(file)), verifies drawings in IndexedDB via page.evaluate(() => window.drawingStore.load(symbol, resolution)) and chart renders in DOM
- E2E: Import v1.0.0 test imports legacy file without drawings key, verifies no console errors
- E2E: Round-trip test seeds drawings via window.drawingStore.save(), exports via page.waitForEvent('download'), clears state, imports exported file, verifies drawings visible in IndexedDB via window.drawingStore.load() and charts render correctly

#### Code Intent

- **CI-M-002-001** `src/stores/workspace.js::importWorkspace`: In importWorkspace(), after restoring price markers and before adding displays, check data.version using semver-aware comparison (split on dot, compare numeric parts — avoids lexicographic bug where 1.10.0 < 1.2.0). If compareSemver(version, 1.1.0) >= 0 and data.drawings exists, iterate drawings map entries. For each symbol+resolution pair: (1) read existing local drawings via drawingStore.load(symbol, resolution) as a pre-clear snapshot, (2) call drawingStore.clearAll(symbol, resolution), (3) iterate imported drawings and call drawingStore.save(symbol, resolution, drawing) for each. If clearAll succeeds but a save throws: log error, abort remaining saves for that pair, attempt to restore the pre-clear snapshot as rollback, continue with next pair. If clearAll itself throws: log error, skip that pair entirely, continue with next. Handle version 1.0.0 files gracefully by skipping drawing restoration. Wrap all drawing restore logic in its own try/catch so drawing failures do not block display restoration. (refs: DL-002, DL-003, DL-005)

#### Code Changes

**CC-M-002-001** (src/stores/workspace.js) - implements CI-M-002-001

**Code:**

```diff
--- a/src/stores/workspace.js
+++ b/src/stores/workspace.js
@@ -1,8 +1,16 @@
 import { writable } from 'svelte/store';
 import { drawingStore } from '../lib/chart/drawingStore.js';

+function compareSemver(a, b) {
+  const pa = a.split('.').map(Number);
+  const pb = b.split('.').map(Number);
+  for (let i = 0; i < 3; i++) {
+    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
+    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
+  }
+  return 0;
+}
+
 const initialState = {
   displays: new Map(),
@@ -246,6 +254,45 @@ const actions = {
         }
       }

+      // Restore drawings from export data (v1.1.0+)
+      try {
+        const version = data.version || '1.0.0';
+        if (compareSemver(version, '1.1.0') >= 0 && data.drawings) {
+          for (const [key, drawings] of Object.entries(data.drawings)) {
+            const [symbol, resolution] = key.split('|');
+            if (!symbol || !resolution) continue;
+
+            try {
+              // Snapshot existing drawings for rollback on save failure
+              const snapshot = await drawingStore.load(symbol, resolution);
+
+              await drawingStore.clearAll(symbol, resolution);
+
+              for (const drawing of drawings) {
+                try {
+                  // Omit id/createdAt/updatedAt so Dexie auto-generates fresh values
+                  const { id, createdAt, updatedAt, ...rest } = drawing;
+                  await drawingStore.save(symbol, resolution, rest);
+                } catch (saveErr) {
+                  console.error(`Failed to save drawing for ${symbol}/${resolution}:`, saveErr);
+                  // Abort remaining saves for this pair, attempt rollback
+                  try {
+                    for (const s of snapshot) {
+                      // Preserve original ids during rollback for exact state restoration
+                      await drawingStore.save(symbol, resolution, s);
+                    }
+                  } catch (rollbackErr) {
+                    console.error(`Rollback failed for ${symbol}/${resolution}:`, rollbackErr);
+                  }
+                  break;
+                }
+              }
+            } catch (clearErr) {
+              console.error(`Failed to clear drawings for ${symbol}/${resolution}:`, clearErr);
+              continue;
+            }
+          }
+        }
+      } catch (drawingErr) {
+        // Drawing restore failures do not block display restoration
+        console.error('Drawing restoration error (non-fatal):', drawingErr);
+      }
+
       // Add displays in batches to avoid rate limiting
       for (let i = 0; i < displays.length; i += batchSize) {
         const batch = displays.slice(i, i + batchSize);
```

**Documentation:**

```diff
--- a/src/stores/workspace.js
+++ b/src/stores/workspace.js
@@ -256,6 +256,15 @@
       }

+      // Drawing restore strategy (v1.1.0+): (ref: DL-002, DL-005, R-002)
+      //   Per-drawing save via drawingStore.save() writes each drawing to IndexedDB
+      //   individually (ref: DL-002). No bulk/batch API exists in Dexie for this schema.
+      //
+      //   1. Snapshot existing drawings per symbol+resolution pair
+      //   2. clearAll for that pair
+      //   3. Save each imported drawing (stripping auto-generated fields)
+      //   4. On save failure: abort remaining saves, rollback from snapshot
+      //   5. Drawing errors are non-fatal — display restoration proceeds regardless
+      //
+      // Only clears pairs present in the import file. Orphaned local drawings
+      // for absent pairs survive import. Import restores what the file
+      // contains, not a full wipe.
+      //
       // Restore drawings from export data (v1.1.0+)
       try {
         const version = data.version || '1.0.0';
@@ -272,6 +281,7 @@
             await drawingStore.clearAll(symbol, resolution);

             for (const drawing of drawings) {
+              // Strip id/createdAt/updatedAt: Dexie auto-generates these on save
               try {
                 const { id, createdAt, updatedAt, ...rest } = drawing;
                 await drawingStore.save(symbol, resolution, rest);

```


### Milestone 3: Durability UX indicator

**Files**: src/components/Workspace.svelte

**Requirements**:

- Persistent indicator visible at all times showing data is stored locally
- Quick Export button accessible from the indicator
- Indicator is non-intrusive and does not obstruct chart interaction

**Acceptance Criteria**:

- A banner or indicator is visible in the workspace showing local storage message
- Clicking Quick Export triggers the export download
- Indicator does not overlap or obstruct chart display areas

**Tests**:

- Durability banner is visible with local storage text
- Quick Export button triggers download without errors

#### Code Intent

- **CI-M-003-001** `src/components/Workspace.svelte`: Add a small persistent info banner below the workspace container that reads: Data is stored locally in your browser. with a Quick Export button that calls exportWorkspace(). The banner is subtle, non-intrusive, uses existing dark theme colors. Positioned as a fixed bottom-right overlay or similar unobtrusive location. (refs: DL-004)

#### Code Changes

**CC-M-003-001** (src/components/Workspace.svelte) - implements CI-M-003-001

**Code:**

```diff
--- a/src/components/Workspace.svelte
+++ b/src/components/Workspace.svelte
@@ -246,4 +246,18 @@
   on:cancel={handleModalCancel}
 />

 <KeyboardShortcutsHelp bind:show={showKeyboardHelp} />
+
+<div class="durability-banner">
+  <span class="durability-text">Data is stored locally in your browser.</span>
+  <button class="durability-export-btn" on:click={exportWorkspace}>Quick Export</button>
+</div>
+
+<style>
+  .durability-banner {
+    position: fixed;
+    bottom: 8px;
+    right: 8px;
+    display: flex;
+    align-items: center;
+    gap: 8px;
+    padding: 4px 10px;
+    background: rgba(255, 255, 255, 0.06);
+    border: 1px solid rgba(255, 255, 255, 0.1);
+    border-radius: 4px;
+    font-size: 11px;
+    color: rgba(255, 255, 255, 0.45);
+    z-index: 50;
+    pointer-events: auto;
+  }
+
+  .durability-export-btn {
+    background: rgba(255, 255, 255, 0.1);
+    border: 1px solid rgba(255, 255, 255, 0.15);
+    border-radius: 3px;
+    color: rgba(255, 255, 255, 0.55);
+    padding: 2px 8px;
+    font-size: 11px;
+    cursor: pointer;
+  }
+
+  .durability-export-btn:hover {
+    background: rgba(255, 255, 255, 0.18);
+    color: rgba(255, 255, 255, 0.75);
+  }
+</style>
```

**Documentation:**

```diff
--- a/src/components/Workspace.svelte
+++ b/src/components/Workspace.svelte
@@ -255,6 +255,9 @@

 <KeyboardShortcutsHelp bind:show={showKeyboardHelp} />

+// Phase 2 durability indicator: reminds users data is browser-local only,
+// provides quick export access. Fixed position, minimal footprint. (ref: DL-004)
+//
 <div class="durability-banner">
   <span class="durability-text">Data is stored locally in your browser.</span>
   <button class="durability-export-btn" on:click={exportWorkspace}>Quick Export</button>

```


## Execution Waves

- W-001: M-001, M-002
- W-002: M-003
