#!/usr/bin/env node
/**
 * Fix for profileUpdate dispatch issue
 *
 * Root cause: Frontend subscribes with source='tradingview' (default),
 * but backend emits with source='ctrader'. Subscription key mismatch.
 *
 * This script applies Solution 1: Flip the default to 'ctrader'
 */

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '../../../src/components/PriceTicker.svelte');

console.log('[ProfileUpdate Fix] Applying Solution 1: Flip default source to ctrader\n');

// Read the file
const content = fs.readFileSync(FILE_PATH, 'utf8');

// Check if already fixed
if (content.includes("ticker.source || 'ctrader'")) {
  console.log('✓ Already fixed! Default source is already set to ctrader.');
  process.exit(0);
}

// Apply the fix
const oldLine = "webSocketSub.subscribe(formattedSymbol, ticker.source || 'tradingview', async (data) => {";
const newLine = "webSocketSub.subscribe(formattedSymbol, ticker.source || 'ctrader', async (data) => {";

if (!content.includes(oldLine)) {
  console.error('✗ Could not find the target line. File may have been modified.');
  process.exit(1);
}

const newContent = content.replace(oldLine, newLine);

// Write back
fs.writeFileSync(FILE_PATH, newContent, 'utf8');

console.log('✓ Fixed! Changed:');
console.log('  - ticker.source || \\'tradingview\\'');
console.log('  + ticker.source || \\'ctrader\\'\n');
console.log('The profileUpdate messages should now be routed correctly.');
console.log('Refresh your browser to see the mini market profile update automatically.\n');
console.log('File modified:', FILE_PATH);
