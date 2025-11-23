// DEBUGGER: Test script to verify canvas visibility and drift fixes
// TO BE DELETED BEFORE FINAL REPORT

const puppeteer = require('puppeteer');
const fs = require('fs');

async function testCanvasCreation() {
  console.log('[DEBUGGER:TEST] Starting canvas creation test...');

  const browser = await puppeteer.launch({
    headless: false, // Show browser for visual inspection
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Enable console logging from the page
    page.on('console', msg => {
      console.log(`[PAGE CONSOLE] ${msg.text()}`);
    });

    // Go to the application
    console.log('[DEBUGGER:TEST] Navigating to application...');
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle2' });

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Check if window.createTestCanvas exists
    const testCanvasExists = await page.evaluate(() => {
      return typeof window.createTestCanvas === 'function';
    });

    console.log(`[DEBUGGER:TEST] window.createTestCanvas exists: ${testCanvasExists}`);

    if (testCanvasExists) {
      // Create a test canvas
      console.log('[DEBUGGER:TEST] Creating test canvas...');
      const displayId = await page.evaluate(() => {
        return window.createTestCanvas('EURUSD', 300, 300);
      });

      console.log(`[DEBUGGER:TEST] Created display with ID: ${displayId}`);

      // Wait for rendering
      await page.waitForTimeout(3000);

      // Check for canvas elements in DOM
      const canvasElements = await page.evaluate(() => {
        const canvases = document.querySelectorAll('canvas');
        return Array.from(canvases).map(canvas => ({
          width: canvas.width,
          height: canvas.height,
          style: {
            display: getComputedStyle(canvas).display,
            visibility: getComputedStyle(canvas).visibility,
            opacity: getComputedStyle(canvas).opacity,
            zIndex: getComputedStyle(canvas).zIndex
          },
          rect: canvas.getBoundingClientRect(),
          hasContent: canvas.getContext('2d') ?
            !!canvas.getContext('2d').getImageData(0, 0, 1, 1).data[3] : false
        }));
      });

      console.log(`[DEBUGGER:TEST] Found ${canvasElements.length} canvas elements:`);
      canvasElements.forEach((canvas, i) => {
        console.log(`[DEBUGGER:TEST] Canvas ${i + 1}:`, {
          dimensions: `${canvas.width}x${canvas.height}`,
          position: `(${Math.round(canvas.rect.left)}, ${Math.round(canvas.rect.top)})`,
          size: `${Math.round(canvas.rect.width)}x${Math.round(canvas.rect.height)}`,
          visible: canvas.style.display !== 'none' && canvas.style.visibility !== 'hidden',
          hasContent: canvas.hasContent
        });
      });

      // Check for display containers
      const displayContainers = await page.evaluate(() => {
        const containers = document.querySelectorAll('[class*="display"], [class*="container"], [class*="floating"]');
        return Array.from(containers).map(container => ({
          tagName: container.tagName,
          className: container.className,
          rect: container.getBoundingClientRect(),
          hasCanvas: !!container.querySelector('canvas')
        }));
      });

      console.log(`[DEBUGGER:TEST] Found ${displayContainers.length} display containers:`);
      displayContainers.forEach((container, i) => {
        console.log(`[DEBUGGER:TEST] Container ${i + 1}:`, {
          tag: container.tagName,
          class: container.className,
          position: `(${Math.round(container.rect.left)}, ${Math.round(container.rect.top)})`,
          size: `${Math.round(container.rect.width)}x${Math.round(container.rect.height)}`,
          hasCanvas: container.hasCanvas
        });
      });

      // Look for any drift monitoring messages
      console.log('[DEBUGGER:TEST] Checking for drift monitoring in console...');

    } else {
      console.error('[DEBUGGER:TEST] window.createTestCanvas not found - fixes may not be loaded');
    }

  } catch (error) {
    console.error('[DEBUGGER:TEST] Error during test:', error);
  } finally {
    // Keep browser open for inspection
    console.log('[DEBUGGER:TEST] Test completed. Browser will remain open for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    await browser.close();
  }
}

testCanvasCreation().catch(console.error);