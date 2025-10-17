// @ts-check
import { test, expect } from '@playwright/test';

test('application loads without errors', async ({ page }) => {
  // Navigate to the application
  await page.goto('http://localhost:5173');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Check for any console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  // Wait a bit for any async errors to appear
  await page.waitForTimeout(2000);
  
  // Assert no console errors
  expect(errors).toHaveLength(0);
  
  // Check if the main app container is present
  await expect(page.locator('.main-container')).toBeVisible();
  
  // Check if the title is correct
  await expect(page).toHaveTitle(/Vite \+ Svelte/);
});

test('basic application structure is present', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  
  // Check for key elements
  await expect(page.locator('.main-container')).toBeVisible();
  await expect(page.locator('.viz-area')).toBeVisible();
  await expect(page.locator('.config-panel-container')).toBeVisible();
  
  // Check for welcome message
  await expect(page.locator('text=Welcome to NeuroSense FX')).toBeVisible();
});

test('floating canvas workspace is present', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  
  // Check for workspace container
  await expect(page.locator('.workspace-container')).toBeVisible();
  
  // Check for empty state message
  await expect(page.locator('text=Floating Canvas Workspace')).toBeVisible();
  await expect(page.locator('text=Right-click anywhere to add a canvas, or use Ctrl+N')).toBeVisible();
  await expect(page.locator('text=Add First Canvas')).toBeVisible();
});