// DEBUGGER: Day Range Meter Issues Investigation Test
// TO BE DELETED BEFORE FINAL REPORT
// Investigating: Canvas resize, 125% ADR display, border width issues

const { chromium } = require('playwright');

async function investigateDayRangeIssues() {
  console.log('[DEBUGGER:INVESTIGATION] Starting Day Range Meter issue investigation');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Enhanced console logging
  page.on('console', msg => {
    console.log('[DEBUGGER:BROWSER]', msg.type(), msg.text());
  });

  page.on('pageerror', error => {
    console.log('[DEBUGGER:ERROR]', error.message);
  });

  try {
    console.log('[DEBUGGER:NAVIGATION] Navigating to dev server');
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Create Day Range Meter display
    console.log('[DEBUGGER:DISPLAY_CREATION] Creating Day Range Meter display');
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);

    // Type symbol and create display
    await page.keyboard.type('EUR/USD');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Investigate Issue 4-1: Canvas resizing
    console.log('[DEBUGGER:ISSUE4-1] Testing canvas resize behavior');
    await investigateCanvasResize(page);

    // Investigate Issue 4-2: ADR percentage calculation
    console.log('[DEBUGGER:ISSUE4-2] Testing ADR percentage calculation');
    await investigateAdrCalculation(page);

    // Investigate Issue 4-3: Border rendering
    console.log('[DEBUGGER:ISSUE4-3] Testing border rendering width');
    await investigateBorderRendering(page);

    // Take screenshots for evidence
    await page.screenshot({ path: 'test-debug-dayrange-issues-initial.png' });

  } catch (error) {
    console.log('[DEBUGGER:ERROR]', error.message);
  } finally {
    await browser.close();
  }
}

async function investigateCanvasResize(page) {
  console.log('[DEBUGGER:CANVAS_RESIZE] Checking canvas dimensions vs container');

  // Get canvas element and its container
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const container = canvas?.parentElement;

    if (!canvas || !container) return { error: 'No canvas or container found' };

    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const canvasStyle = window.getComputedStyle(canvas);
    const containerStyle = window.getComputedStyle(container);

    return {
      canvas: {
        width: canvas.width,
        height: canvas.height,
        cssWidth: canvasStyle.width,
        cssHeight: canvasStyle.height,
        rectWidth: canvasRect.width,
        rectHeight: canvasRect.height,
        position: canvasStyle.position,
        top: canvasStyle.top,
        left: canvasStyle.left
      },
      container: {
        cssWidth: containerStyle.width,
        cssHeight: containerStyle.height,
        rectWidth: containerRect.width,
        rectHeight: containerRect.height,
        position: containerStyle.position,
        overflow: containerStyle.overflow
      },
      dpr: window.devicePixelRatio
    };
  });

  console.log('[DEBUGGER:CANVAS_RESIZE] Canvas vs Container dimensions:', JSON.stringify(canvasInfo, null, 2));

  // Test resize behavior
  console.log('[DEBUGGER:CANVAS_RESIZE] Testing container resize...');
  await page.evaluate(() => {
    const container = document.querySelector('.canvas-container');
    if (container) {
      container.style.width = '400px';
      container.style.height = '300px';
    }
  });

  await page.waitForTimeout(1000);

  const resizedInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const container = canvas?.parentElement;

    if (!canvas || !container) return { error: 'No canvas or container found' };

    return {
      canvasRect: canvas.getBoundingClientRect(),
      containerRect: container.getBoundingClientRect(),
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    };
  });

  console.log('[DEBUGGER:CANVAS_RESIZE] After resize:', JSON.stringify(resizedInfo, null, 2));
}

async function investigateAdrCalculation(page) {
  console.log('[DEBUGGER:ADR_CALC] Checking ADR percentage calculation logic');

  // Get the current display data and configuration
  const displayData = await page.evaluate(() => {
    // Find the active display and get its data
    const displays = document.querySelectorAll('.floating-display');
    if (displays.length === 0) return { error: 'No displays found' };

    const firstDisplay = displays[0];
    const canvas = firstDisplay.querySelector('canvas');
    if (!canvas) return { error: 'No canvas found in display' };

    // Try to get data from store (simplified approach)
    return {
      canvasRect: canvas.getBoundingClientRect(),
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      displayElement: firstDisplay.className
    };
  });

  console.log('[DEBUGGER:ADR_CALC] Display data:', JSON.stringify(displayData, null, 2));

  // Check progressive disclosure logic in calculations
  await page.evaluate(() => {
    // Simulate the calculateMaxAdrPercentage function
    const testData = {
      adrHigh: 1.0750,
      adrLow: 1.0650,
      current: 1.0700,
      high: 1.0730,
      low: 1.0670
    };

    const adrValue = testData.adrHigh - testData.adrLow;
    const midPrice = testData.current;

    console.log('[DEBUGGER:ADR_SIMULATION] Test data:', testData);
    console.log('[DEBUGGER:ADR_SIMULATION] ADR Value:', adrValue);
    console.log('[DEBUGGER:ADR_SIMULATION] Mid Price:', midPrice);

    let maxPercentage = 0.5; // Default 50%

    // Simulate updateMaxPercentage logic
    const highMovement = Math.abs(testData.high - midPrice) / adrValue;
    const lowMovement = Math.abs(testData.low - midPrice) / adrValue;

    maxPercentage = Math.max(maxPercentage, highMovement);
    maxPercentage = Math.max(maxPercentage, lowMovement);

    // Apply progressive disclosure: Math.ceil(maxPercentage * 4) / 4
    const finalPercentage = Math.ceil(maxPercentage * 4) / 4;

    console.log('[DEBUGGER:ADR_SIMULATION] High movement:', highMovement);
    console.log('[DEBUGGER:ADR_SIMULATION] Low movement:', lowMovement);
    console.log('[DEBUGGER:ADR_SIMULATION] Max percentage:', maxPercentage);
    console.log('[DEBUGGER:ADR_SIMULATION] Final percentage (progressive):', finalPercentage);
    console.log('[DEBUGGER:ADR_SIMULATION] Expected behavior: Should start at 50% baseline');
  });
}

async function investigateBorderRendering(page) {
  console.log('[DEBUGGER:BORDER_RENDER] Checking border rendering width');

  const borderInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas found' };

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      rectWidth: rect.width,
      rectHeight: rect.height,
      devicePixelRatio: window.devicePixelRatio
    };
  });

  console.log('[DEBUGGER:BORDER_RENDER] Canvas dimensions for border:', JSON.stringify(borderInfo, null, 2));

  // Test border rendering by examining renderBoundaryLines function
  await page.evaluate(() => {
    console.log('[DEBUGGER:BORDER_RENDER] Testing renderBoundaryLines logic...');

    // Simulate the boundary line rendering
    const width = 400; // Example width
    const height = 300; // Example height
    const padding = 50; // Example padding
    const dpr = window.devicePixelRatio || 1;

    console.log('[DEBUGGER:BORDER_RENDER] Render parameters:');
    console.log('- width:', width);
    console.log('- height:', height);
    console.log('- padding:', padding);
    console.log('- dpr:', dpr);

    // Top boundary: (padding, padding, width - padding, padding)
    const topLine = {
      x1: padding,
      y1: padding,
      x2: width - padding,
      y2: padding,
      length: (width - padding) - padding
    };

    // Bottom boundary: (padding, height - padding, width - padding, height - padding)
    const bottomLine = {
      x1: padding,
      y1: height - padding,
      x2: width - padding,
      y2: height - padding,
      length: (width - padding) - padding
    };

    console.log('[DEBUGGER:BORDER_RENDER] Top boundary line:', topLine);
    console.log('[DEBUGGER:BORDER_RENDER] Bottom boundary line:', bottomLine);
    console.log('[DEBUGGER:BORDER_RENDER] Expected: Lines should span from padding to width-padding');
    console.log('[DEBUGGER:BORDER_RENDER] Line width should be:', topLine.length, 'pixels');
  });
}

investigateDayRangeIssues().catch(console.error);