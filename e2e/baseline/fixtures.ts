// DEPRECATED: This file has been replaced by workflow-based fixtures
// See: e2e/baseline/fixtures/workflowFixtures.js for new workflow test utilities
// This file is kept for reference only and will be removed in future updates

console.log('WARNING: This fixtures file is deprecated. Please use workflow-based fixtures in e2e/baseline/fixtures/workflowFixtures.js');

// Re-export from new fixtures for backward compatibility
export { test, expect, TEST_SYMBOLS as mockSymbols, WAIT_TIMES, SELECTORS } from './fixtures/workflowFixtures.js';