import { test, expect } from '@playwright/test';

test('Day Range Progressive Disclosure Test', async ({ page }) => {
  console.log('🧪 Testing Day Range progressive disclosure functionality...');

  await page.goto('http://localhost:5175');
  await page.waitForTimeout(2000);

  console.log('🌐 Creating EUR/USD display to test progressive ADR disclosure...');

  await page.keyboard.press('Control+KeyK');
  await page.waitForTimeout(1000);
  await page.keyboard.type('EUR/USD');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);

  // Capture console output for progressive disclosure verification
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('PROGRESSIVE') || text.includes('Max ADR') || text.includes('Day Range')) {
      consoleMessages.push(text);
      console.log(`📊 Progressive disclosure console: ${text}`);
    }
  });

  // Wait for display to initialize and calculate percentages
  await page.waitForTimeout(3000);

  // Check if progressive disclosure is working
  const progressiveMessages = consoleMessages.filter(msg =>
    msg.includes('PROGRESSIVE') && msg.includes('Max ADR')
  );

  console.log(`📈 Found ${progressiveMessages.length} progressive disclosure messages`);

  // Verify the progressive disclosure functionality is preserved
  expect(progressiveMessages.length).toBeGreaterThan(0);

  if (progressiveMessages.length > 0) {
    const latestMessage = progressiveMessages[progressiveMessages.length - 1];
    console.log(`✅ Latest progressive disclosure: ${latestMessage}`);

    // Verify the message contains expected components
    expect(latestMessage).toContain('Day Range:');
    expect(latestMessage).toContain('Max ADR:');
    expect(latestMessage).toContain('Progressive:');

    console.log('✅ Progressive disclosure functionality preserved');
    console.log('✅ Day Range Meter refactoring successful');
  } else {
    console.log('⚠️ No progressive disclosure messages found - checking display...');

    // Alternative: Check if canvas element exists and is rendered
    const canvasElements = await page.locator('canvas').count();
    console.log(`🖼️ Found ${canvasElements} canvas elements`);

    if (canvasElements > 0) {
      console.log('✅ Day Range Meter display is functional');
    }
  }

  // Cleanup
  await page.keyboard.press('Control+Shift+W');
  await page.waitForTimeout(1000);
});