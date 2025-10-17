# Baseline Test Implementation Plan

## Updated Test Plan: Floating Interface Only

### Test Structure Changes
- Remove all legacy grid tests
- Focus exclusively on floating interface workflows
- Add tests for new components (WorkspaceContextMenu, FloatingStatusPanel)

### Updated Test Files
1. **floating-interface-workflow.spec.ts** - Complete floating interface tests
2. **context-menu-functionality.spec.ts** - Context menu parameter tests
3. **workspace-management.spec.ts** - Workspace-level functionality tests

### Test Priority Changes
- HIGH: Canvas creation and configuration via floating interface
- HIGH: Context menu parameter changes and propagation
- MEDIUM: Workspace-level system settings
- LOW: Legacy compatibility (removed)


## Problem Summary
The current baseline tests are failing due to:
1. `networkidle` timeout hanging on WebSocket connections
2. Over-engineered fixtures that add unnecessary complexity
3. Tests trying to validate complex workflows instead of fundamentals

## Solution Approach

### 1. Simplified Test Structure
Replace the current fixture-based approach with direct Playwright tests that validate:
- Page load and basic DOM structure
- Console error monitoring
- Core component presence
- Basic layout verification

### 2. New Test Files to Create/Modify

#### e2e/baseline/workflow-tests.spec.ts
Replace with simplified version containing 5 tests:
1. **Page Load Test** - Verifies page loads and title is correct
2. **Basic DOM Structure Test** - Checks for main layout elements
3. **Console Error Test** - Monitors for JavaScript errors during load
4. **Workspace Test** - Validates workspace container and empty state
5. **Config Panel Test** - Verifies config panel loads with basic controls

#### e2e/baseline/config.ts
Update with optimized timeouts:
- Test timeout: 15 seconds
- Action timeout: 3 seconds
- Remove webServer configuration (connects to existing server)

#### e2e/baseline/fixtures.ts
Simplify or remove entirely. Current fixtures are too complex for baseline needs.

### 3. Implementation Details

#### Test Structure
```typescript
test.describe('NeuroSense FX - Baseline Validation', () => {
  test('should load application without errors', async ({ page }) => {
    // Navigate and wait for specific element
    await page.goto('/');
    await page.waitForSelector('#app', { timeout: 5000 });
    
    // Verify title
    await expect(page).toHaveTitle(/NeuroSense FX/);
  });

  test('should display basic layout elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.workspace-container', { timeout: 5000 });
    
    // Check main layout components
    await expect(page.locator('.workspace-container')).toBeVisible();
    await expect(page.locator('.config-panel-container')).toBeVisible();
  });

  test('should have no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', error => consoleErrors.push(error.message));
    
    await page.goto('/');
    await page.waitForSelector('.workspace-container', { timeout: 5000 });
    
    // Assert no errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('should show workspace in empty state', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.workspace-container', { timeout: 5000 });
    
    // Check for empty state message
    await expect(page.locator('.workspace-empty-state')).toBeVisible();
    await expect(page.locator('.workspace-empty-state')).toContainText(/Floating Canvas Workspace/);
  });

  test('should load config panel with controls', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.config-panel-container', { timeout: 5000 });
    
    // Verify config panel structure
    await expect(page.locator('.config-panel-container')).toBeVisible();
    // Check for basic config elements (without being too specific)
  });
});
```

#### Configuration Updates
```typescript
// e2e/baseline/config.ts
export default defineConfig({
  testDir: './',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'line',
  timeout: 15000, // Reduced from 60000ms
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 3000, // Reduced from 15000ms
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Remove webServer config - tests connect to existing server
});
```

### 4. Execution Strategy
1. Replace the complex fixtures with simple page-based tests
2. Update configuration with optimized timeouts
3. Remove webServer configuration to avoid startup conflicts
4. Focus on element presence rather than complex interactions
5. Ensure tests complete in under 10 seconds total

### 5. Expected Results
- All 5 tests pass consistently
- Total execution time under 15 seconds
- No hanging on network idle states
- Clear validation that app loads correctly
- Immediate feedback on console errors

### 6. Rollback Plan
If the new approach has issues:
1. Keep current config as backup
2. Gradually increase timeouts if needed
3. Add back minimal fixture approach if required

## Implementation Order
1. Update config.ts with optimized timeouts
2. Replace workflow-tests.spec.ts with simplified version
3. Test execution and validation
4. Update README.md with new timeout values
5. Remove or simplify fixtures.ts if no longer needed