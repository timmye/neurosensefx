/**
 * Global teardown for Playwright tests
 * Cleanup after test execution
 */

async function globalTeardown(config) {
  console.log('🧹 Cleaning up Playwright test environment...');

  // Clean up any temporary files or processes if needed
  // In a container environment, most cleanup is handled automatically

  console.log('✅ Playwright global teardown complete');
}

export default globalTeardown;