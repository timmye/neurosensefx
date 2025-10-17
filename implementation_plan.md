# Implementation Plan: Canvas-Centric Frontend Critical Gaps

## Executive Summary

This document outlines a detailed implementation plan to fix three critical gaps in the canvas-centric frontend of NeuroSense FX, with integrated Playwright testing throughout the development process. The plan focuses on systematic fixes with continuous validation to ensure robust, maintainable solutions.

## Critical Gaps Analysis

### Gap 1: Right-Click Context Menu System
**Issue**: Context menu not appearing on canvases
**Root Cause**: 
- FloatingCanvas.svelte has a placeholder context menu (lines 210-225) instead of the actual CanvasContextMenu component
- Missing integration between the right-click handler and the actual context menu component
- Event propagation issues between canvas elements and context menu

### Gap 2: Symbol Selection in Canvas Creation
**Issue**: Canvas creation workflow broken
**Root Cause**:
- `addFloatingCanvas()` function in App.svelte defaults to first available symbol without proper selection UI
- Missing integration with FXSymbolSelector component for canvas creation
- No symbol validation before canvas creation

### Gap 3: Context Menu Configuration Flow
**Issue**: Changes don't propagate to visualizations
**Root Cause**:
- Config changes from context menu update workspace state but don't sync with symbol store
- Missing two-way data binding between canvas config and visualization components
- State management disconnect between canvas-specific and global symbol configurations

## System Architecture Overview

### Current State
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   App.svelte    │───▶│ FloatingCanvas  │───▶│ Container.svelte│
│                 │    │                 │    │                 │
│ - workspaceState│    │ - Placeholder    │    │ - Visualization │
│ - uiState       │    │   Context Menu  │    │   Components    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ workspaceState  │    │ CanvasContextMenu│    │  symbolStore    │
│                 │    │                 │    │                 │
│ - canvas registry│    │ - Config Panel  │    │ - Symbol Data   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Target State
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   App.svelte    │───▶│ FloatingCanvas  │───▶│ Container.svelte│
│                 │    │                 │    │                 │
│ - workspaceState│    │ - Real Context  │    │ - Visualization │
│ - uiState       │    │   Menu          │    │   Components    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ workspaceState  │    │ CanvasContextMenu│    │  symbolStore    │
│                 │    │                 │    │                 │
│ - canvas registry│    │ - Live Config   │    │ - Synced Data   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Implementation Plan

### Phase 1: Right-Click Context Menu System (2-3 days)

#### Step 1.1: Replace Placeholder Context Menu
**Objective**: Integrate real CanvasContextMenu component in FloatingCanvas
**Files to Modify**: 
- `src/components/FloatingCanvas.svelte` (lines 210-225)
**Implementation**:
1. Remove placeholder context menu (lines 210-225)
2. Import CanvasContextMenu component
3. Add conditional rendering with proper event binding

#### Step 1.2: Fix Event Propagation
**Objective**: Ensure right-click events properly trigger context menu
**Files to Modify**:
- `src/components/FloatingCanvas.svelte` (handleRightClick function)
**Implementation**:
1. Refactor handleRightClick to properly set context menu state
2. Ensure proper event bubbling prevention
3. Add z-index management for menu layering

#### Step 1.3: Context Menu Positioning
**Objective**: Fix context menu positioning to stay within viewport
**Files to Modify**:
- `src/components/FloatingCanvas.svelte`
- `src/components/CanvasContextMenu.svelte`
**Implementation**:
1. Add viewport boundary detection
2. Implement smart positioning (flip if necessary)
3. Add position validation

### Phase 2: Symbol Selection in Canvas Creation (2-3 days)

#### Step 2.1: Create Symbol Selection Modal
**Objective**: Build a modal for symbol selection during canvas creation
**Files to Create**:
- `src/components/SymbolSelectionModal.svelte`
**Implementation**:
1. Create modal component with FXSymbolSelector integration
2. Add "Create Canvas" button with validation
3. Include keyboard shortcuts (Enter to confirm, Escape to cancel)

#### Step 2.2: Integrate Modal with Canvas Creation
**Objective**: Connect symbol selection modal to canvas creation workflow
**Files to Modify**:
- `src/App.svelte` (addFloatingCanvas function)
**Implementation**:
1. Replace direct canvas creation with modal trigger
2. Add modal state management
3. Update canvas creation to use selected symbol

#### Step 2.3: Keyboard Shortcuts Enhancement
**Objective**: Improve keyboard navigation for canvas creation
**Files to Modify**:
- `src/App.svelte` (handleKeyDown function)
**Implementation**:
1. Add Ctrl+N to trigger symbol selection modal
2. Add context-aware keyboard shortcuts
3. Implement focus management

### Phase 3: Context Menu Configuration Flow (3-4 days)

#### Step 3.1: Sync Config Changes
**Objective**: Ensure context menu config changes propagate to visualizations
**Files to Modify**:
- `src/App.svelte` (handleCanvasConfigChange function)
- `src/stores/workspaceState.js`
**Implementation**:
1. Update handleCanvasConfigChange to sync with symbol store
2. Add two-way data binding between canvas and symbol configs
3. Implement config change validation

#### Step 3.2: State Management Refactoring
**Objective**: Create unified state management for configurations
**Files to Modify**:
- `src/stores/configStore.js`
- `src/stores/workspaceState.js`
**Implementation**:
1. Create config synchronization utilities
2. Add config change event system
3. Implement conflict resolution for concurrent changes

#### Step 3.3: Visual Feedback System
**Objective**: Add visual feedback for configuration changes
**Files to Modify**:
- `src/components/Container.svelte`
- `src/components/viz/` (visualization components)
**Implementation**:
1. Add change detection for config updates
2. Implement smooth transitions for config changes
3. Add visual indicators for modified settings

## Playwright Testing Strategy

### Test Structure
```
e2e/
├── canvas-context-menu.spec.js
├── symbol-selection.spec.js
├── config-propagation.spec.js
├── integration/
│   ├── canvas-workflow.spec.js
│   └── keyboard-shortcuts.spec.js
└── utils/
    ├── test-helpers.js
    └── canvas-test-utils.js
```

### Phase 1 Tests: Context Menu System

#### Test 1.1: Basic Context Menu Functionality
```javascript
// e2e/canvas-context-menu.spec.js
test('context menu appears on right-click', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Create a canvas first
  await page.locator('.primary-btn').click();
  await page.waitForSelector('.floating-canvas');
  
  // Right-click on canvas
  const canvas = page.locator('.floating-canvas').first();
  await canvas.click({ button: 'right' });
  
  // Verify context menu appears
  await expect(page.locator('.context-menu')).toBeVisible();
  await expect(page.locator('text=Canvas Controls')).toBeVisible();
});

test('context menu closes on escape', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.locator('.primary-btn').click();
  
  const canvas = page.locator('.floating-canvas').first();
  await canvas.click({ button: 'right' });
  
  // Press escape
  await page.keyboard.press('Escape');
  
  // Verify context menu disappears
  await expect(page.locator('.context-menu')).not.toBeVisible();
});
```

#### Test 1.2: Context Menu Positioning
```javascript
test('context menu stays within viewport', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.locator('.primary-btn').click();
  
  // Get viewport dimensions
  const viewport = page.viewportSize();
  
  // Right-click near bottom-right corner
  const canvas = page.locator('.floating-canvas').first();
  await canvas.hover();
  await page.mouse.click(viewport.width - 50, viewport.height - 50, { button: 'right' });
  
  // Verify menu is visible and positioned correctly
  const menu = page.locator('.context-menu');
  await expect(menu).toBeVisible();
  
  const menuBox = await menu.boundingBox();
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);
});
```

### Phase 2 Tests: Symbol Selection

#### Test 2.1: Symbol Selection Modal
```javascript
// e2e/symbol-selection.spec.js
test('symbol selection modal appears on canvas creation', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Trigger canvas creation
  await page.keyboard.press('Control+N');
  
  // Verify modal appears
  await expect(page.locator('.symbol-selection-modal')).toBeVisible();
  await expect(page.locator('text=Select a symbol')).toBeVisible();
  await expect(page.locator('.fx-symbol-selector')).toBeVisible();
});
```

#### Test 2.2: Canvas Creation with Selected Symbol
```javascript
test('canvas created with selected symbol', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Open symbol selection
  await page.keyboard.press('Control+N');
  
  // Select a symbol
  await page.locator('.fx-symbol-selector input').fill('EUR');
  await page.locator('.dropdown-item').first().click();
  
  // Create canvas
  await page.locator('button', { hasText: 'Create Canvas' }).click();
  
  // Verify canvas with correct symbol
  await expect(page.locator('.floating-canvas')).toBeVisible();
  await expect(page.locator('.symbol-label')).toHaveText('EURUSD');
});
```

### Phase 3 Tests: Configuration Propagation

#### Test 3.1: Config Change Propagation
```javascript
// e2e/config-propagation.spec.js
test('context menu config changes propagate to visualization', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Create canvas and open context menu
  await page.locator('.primary-btn').click();
  const canvas = page.locator('.floating-canvas').first();
  await canvas.click({ button: 'right' });
  
  // Change a config setting
  await page.locator('input[type="checkbox"][id*="showMarketProfile"]').click();
  
  // Close context menu
  await page.keyboard.press('Escape');
  
  // Verify change is applied (check for market profile visibility)
  const marketProfile = page.locator('.market-profile');
  await expect(marketProfile).toBeVisible();
});
```

#### Test 3.2: Config Persistence
```javascript
test('config changes persist across canvas interactions', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Create and configure canvas
  await page.locator('.primary-btn').click();
  const canvas = page.locator('.floating-canvas').first();
  await canvas.click({ button: 'right' });
  await page.locator('input[type="color"][id*="priceFloatColor"]').fill('#FF0000');
  await page.keyboard.press('Escape');
  
  // Reopen context menu
  await canvas.click({ button: 'right' });
  
  // Verify setting is preserved
  const colorInput = page.locator('input[type="color"][id*="priceFloatColor"]');
  await expect(colorInput).toHaveValue('#FF0000');
});
```

### Integration Tests

#### Test: Complete Canvas Workflow
```javascript
// e2e/integration/canvas-workflow.spec.js
test('complete canvas creation and configuration workflow', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // 1. Create canvas with symbol selection
  await page.keyboard.press('Control+N');
  await page.locator('.fx-symbol-selector input').fill('GBP');
  await page.locator('.dropdown-item').first().click();
  await page.locator('button', { hasText: 'Create Canvas' }).click();
  
  // 2. Configure via context menu
  const canvas = page.locator('.floating-canvas').first();
  await canvas.click({ button: 'right' });
  await page.locator('input[type="checkbox"][id*="showVolatilityOrb"]').click();
  await page.locator('select[id*="volatilityColorMode"]').selectOption('intensity');
  await page.keyboard.press('Escape');
  
  // 3. Verify visualization updates
  await expect(page.locator('.volatility-orb')).toBeVisible();
  
  // 4. Test persistence
  await page.reload();
  await expect(page.locator('.volatility-orb')).toBeVisible();
});
```

## Development Workflow

### Code-Test-Debug Cycle

#### Before Each Implementation Step:
1. **Run Baseline Tests**: Ensure existing functionality works
   ```bash
   npm run test:e2e
   ```

2. **Create Feature Branch**:
   ```bash
   git checkout -b fix/context-menu-system
   ```

#### During Implementation:
1. **Write Test First**: Create failing test for the functionality
2. **Implement Fix**: Write minimum code to make test pass
3. **Run Targeted Test**:
   ```bash
   npm run test:e2e -- --grep "context menu appears"
   ```

4. **Run Regression Tests**:
   ```bash
   npm run test:e2e
   ```

#### After Each Step:
1. **Manual Verification**: Test manually in browser
2. **Performance Check**: Ensure no performance degradation
3. **Code Review**: Self-review for quality and consistency

### Test Execution Commands

```bash
# Run all tests
npm run test:e2e

# Run specific test file
npm run test:e2e canvas-context-menu.spec.js

# Run tests with GUI
npm run test:e2e -- --headed

# Run tests with debugging
npm run test:e2e -- --debug

# Generate HTML report
npm run test:e2e -- --reporter=html
```

## Success Criteria

### Phase 1 Success Metrics:
- [ ] Context menu appears on right-click within 100ms
- [ ] Menu positioning stays within viewport boundaries
- [ ] Menu closes properly on Escape or outside click
- [ ] No JavaScript errors during menu operations
- [ ] Menu z-index properly layered above other elements

### Phase 2 Success Metrics:
- [ ] Symbol selection modal appears on Ctrl+N or button click
- [ ] Symbol search and selection works smoothly
- [ ] Canvas creation completes within 200ms of symbol selection
- [ ] Keyboard navigation works throughout the flow
- [ ] Empty state handling for no available symbols

### Phase 3 Success Metrics:
- [ ] Config changes propagate to visualizations within 50ms
- [ ] Config changes persist across page reloads
- [ ] No state conflicts between multiple canvases
- [ ] Validation prevents invalid config values
- [ ] Visual feedback confirms changes are applied

## Timeline and Milestones

### Week 1: Context Menu System
- **Day 1**: Phase 1.1 - Replace placeholder context menu
- **Day 2**: Phase 1.2 - Fix event propagation
- **Day 3**: Phase 1.3 - Context menu positioning + testing

### Week 2: Symbol Selection
- **Day 4**: Phase 2.1 - Create symbol selection modal
- **Day 5**: Phase 2.2 - Integrate modal with canvas creation
- **Day 6**: Phase 2.3 - Keyboard shortcuts + testing

### Week 3: Configuration Flow
- **Day 7**: Phase 3.1 - Sync config changes
- **Day 8**: Phase 3.2 - State management refactoring
- **Day 9**: Phase 3.3 - Visual feedback system + testing

### Week 4: Integration and Polish
- **Day 10**: Integration testing and bug fixes
- **Day 11**: Performance optimization
- **Day 12**: Documentation and final review

## Risk Mitigation Strategies

### Technical Risks:
1. **State Management Complexity**
   - **Mitigation**: Implement comprehensive logging and state debugging tools
   - **Fallback**: Simplify state model if issues arise

2. **Performance Degradation**
   - **Mitigation**: Implement performance benchmarks in tests
   - **Fallback**: Optimize or defer non-critical features

3. **Browser Compatibility Issues**
   - **Mitigation**: Cross-browser testing matrix
   - **Fallback**: Graceful degradation for older browsers

### Project Risks:
1. **Scope Creep**
   - **Mitigation**: Strict adherence to defined scope
   - **Fallback**: Defer additional features to future phases

2. **Integration Issues**
   - **Mitigation**: Incremental integration with continuous validation
   - **Fallback**: Rollback to last known good state

3. **Testing Gaps**
   - **Mitigation**: Comprehensive test coverage requirements
   - **Fallback**: Additional testing phases before release

## Business Impact Assessment

### User Impact:
- **Improved Usability**: Right-click context menus provide intuitive access to controls
- **Better Workflow**: Symbol selection modal makes canvas creation more deliberate
- **Visual Feedback**: Config changes immediately visible reduces confusion

### Development Impact:
- **Reduced Bug Reports**: Proper testing and validation prevent common issues
- **Easier Maintenance**: Well-structured state management simplifies future changes
- **Better Developer Experience**: Comprehensive test suite enables confident refactoring

### Timeline Sensitivity:
- **High Priority**: Core functionality gaps impact basic usability
- **Flexibility**: Implementation can be phased if timeline constraints arise
- **Dependencies**: Minimal external dependencies reduce risk factors

## Conclusion

This implementation plan provides a systematic approach to fixing the three critical gaps in the canvas-centric frontend, with integrated Playwright testing ensuring robust validation at each step. The phased approach allows for incremental progress with continuous feedback, while the comprehensive test suite ensures reliability and maintainability.

The plan balances technical excellence with practical considerations, providing clear success criteria and risk mitigation strategies. Following this approach will result in a more polished, user-friendly interface that properly supports the canvas-centric design vision.
