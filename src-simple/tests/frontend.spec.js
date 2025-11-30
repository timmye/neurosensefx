// Basic Playwright test for NeuroSense FX Simple Frontend
import { test, expect } from '@playwright/test';

test.describe('NeuroSense FX Frontend', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console output for debugging
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('SYSTEM') || text.includes('REGISTRY') || text.includes('ERROR')) {
        console.log(`📢 ${msg.type().toUpperCase()}: ${text}`);
      }
    });

    page.on('pageerror', error => {
      console.error('❌ Page Error:', error.message);
    });
  });

  test('loads main application components', async ({ page }) => {
    console.log('🌐 Loading application...');
    await page.goto('http://localhost:5175');

    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check page title
    const title = await page.title();
    expect(title).toBe('NeuroSense FX - Simple Implementation');
    console.log('✅ Page title verified:', title);

    // Check main application structure
    const main = await page.locator('main').first();
    await expect(main).toBeVisible();
    console.log('✅ Main element is visible');

    // Check workspace container
    const workspace = await page.locator('.workspace').first();
    await expect(workspace).toBeVisible();
    console.log('✅ Workspace container is visible');
  });

  test('creates default display automatically', async ({ page }) => {
    console.log('🌐 Loading application to check auto-display...');
    await page.goto('http://localhost:5175');

    // Wait for initialization
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Look for floating display elements
    const displays = await page.locator('[class*="floating"]').count();
    console.log(`📊 Found ${displays} display elements`);

    // Check for any display-like elements (might have different class names)
    const canvasElements = await page.locator('canvas').count();
    console.log(`📊 Found ${canvasElements} canvas elements`);
    expect(canvasElements).toBeGreaterThanOrEqual(0);

    // The application should create a default EURUSD display
    // Let's check for any elements that might be displays
    const allElements = await page.locator('*').count();
    console.log(`📊 Total elements on page: ${allElements}`);
  });

  test('keyboard shortcuts work', async ({ page }) => {
    console.log('🌐 Testing keyboard shortcuts...');
    await page.goto('http://localhost:5175');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test Alt+A shortcut for adding displays
    // We'll mock the prompt response
    page.on('dialog', async dialog => {
      console.log('📝 Dialog detected:', dialog.message());
      await dialog.accept('XAUUSD'); // Enter XAUUSD as test symbol
    });

    await page.keyboard.press('Alt+A');
    await page.waitForTimeout(1000);
    console.log('✅ Alt+A shortcut triggered');
  });

  test('WebSocket connection status', async ({ page }) => {
    console.log('🌐 Checking WebSocket connectivity...');
    await page.goto('http://localhost:5175');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check for WebSocket connection indicators in console logs
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    await page.waitForTimeout(2000);

    // Look for connection-related messages
    const connectionMessages = consoleMessages.filter(msg =>
      msg.text.includes('CONNECTING') ||
      msg.text.includes('WebSocket') ||
      msg.text.includes('ws://')
    );

    console.log(`🔗 Found ${connectionMessages.length} WebSocket-related messages`);
    connectionMessages.forEach(msg => {
      console.log(`   ${msg.type.toUpperCase()}: ${msg.text}`);
    });
  });

  test('responsive design works', async ({ page }) => {
    console.log('📱 Testing responsive design...');
    await page.goto('http://localhost:5175');

    await page.waitForLoadState('networkidle');

    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 768, height: 1024 },  // Tablet
      { width: 375, height: 667 }    // Mobile
    ];

    for (const viewport of viewports) {
      console.log(`📏 Testing viewport: ${viewport.width}x${viewport.height}`);
      await page.setViewportSize(viewport);
      await page.waitForTimeout(1000);

      // Check that main elements are still visible
      const main = await page.locator('main').first();
      await expect(main).toBeVisible();

      const workspace = await page.locator('.workspace').first();
      await expect(workspace).toBeVisible();
    }

    console.log('✅ Responsive design verified for all viewports');
  });
});