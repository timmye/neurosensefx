import { test, expect } from '@playwright/test';

test('Check browser console for errors', async ({ page }) => {
  const consoleMessages = [];
  const errors = [];
  
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', err => {
    errors.push(`Page error: ${err.message}`);
  });
  
  await page.goto('http://localhost:5174');
  await page.waitForTimeout(5000); // Wait for app to initialize
  
  console.log('\n=== Console Messages ===');
  consoleMessages.forEach(msg => {
    console.log(`[${msg.type}] ${msg.text}`);
  });
  
  console.log('\n=== Errors ===');
  if (errors.length === 0) {
    console.log('No errors found!');
  } else {
    errors.forEach(err => console.log(err));
  }
  
  // Print validation messages specifically
  const validationMessages = consoleMessages.filter(m => 
    m.text.includes('Validation') || 
    m.text.includes('validation') ||
    m.text.includes('dataContracts')
  );
  console.log('\n=== Validation Messages ===');
  if (validationMessages.length === 0) {
    console.log('No validation messages found');
  } else {
    validationMessages.forEach(msg => console.log(`[${msg.type}] ${msg.text}`));
  }
  
  expect(errors.length).toBe(0);
});
