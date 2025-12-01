const { test, expect } = require('@playwright/test');

test('Debug Console Output', async ({ page }) => {
  console.log('🔍 Capturing all console output...');

  await page.goto('http://localhost:5175');
  await page.waitForTimeout(2000);

  // Capture ALL console messages
  const allMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    allMessages.push({
      type: msg.type(),
      text: text,
      location: msg.location()
    });
    console.log(`[${msg.type()}] ${text}`);
  });

  // Create display
  await page.keyboard.press('Control+KeyK');
  await page.waitForTimeout(1000);
  await page.keyboard.type('EUR/USD');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);

  console.log(`\n📊 Total console messages: ${allMessages.length}`);

  // Look for any error messages
  const errors = allMessages.filter(msg => msg.type === 'error');
  if (errors.length > 0) {
    console.log('❌ Found errors:');
    errors.forEach(err => console.log(`  ${err.text}`));
  }

  // Look for warnings
  const warnings = allMessages.filter(msg => msg.type === 'warning');
  if (warnings.length > 0) {
    console.log('⚠️ Found warnings:');
    warnings.forEach(warn => console.log(`  ${warn.text}`));
  }

  // Check if canvas elements exist
  const canvasElements = await page.locator('canvas').count();
  console.log(`🖼️ Canvas elements: ${canvasElements}`);

  if (canvasElements > 0) {
    console.log('✅ Display is rendering');
  } else {
    console.log('❌ No canvas elements found');
  }

  // Check for any module import errors
  const importErrors = allMessages.filter(msg =>
    msg.text.includes('import') ||
    msg.text.includes('module') ||
    msg.text.includes('export')
  );

  if (importErrors.length > 0) {
    console.log('🔍 Module-related messages:');
    importErrors.forEach(msg => console.log(`  ${msg.text}`));
  }

  await page.keyboard.press('Control+Shift+W');
  await page.waitForTimeout(1000);
});