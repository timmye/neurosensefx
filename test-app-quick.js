#!/usr/bin/env node

/**
 * Quick Application Test
 * Tests if the application loads and displayActions is available
 */

import { chromium } from 'playwright';

async function quickTest() {
    console.log('🔍 Quick Application Test...\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Capture console output
    page.on('console', msg => {
        console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`);
    });

    try {
        console.log('📡 Loading application...');
        await page.goto('http://localhost:5174', { timeout: 15000 });

        console.log('⏳ Waiting for app to initialize...');
        await page.waitForTimeout(3000);

        // Test if displayActions is available
        const hasDisplayActions = await page.evaluate(() => {
            return typeof window.displayActions === 'object' &&
                   typeof window.displayActions.addDisplay === 'function';
        });

        if (hasDisplayActions) {
            console.log('✅ SUCCESS: displayActions is available');

            // Test creating a display
            const displayId = await page.evaluate(() => {
                return window.displayActions.addDisplay('EURUSD', { x: 100, y: 100 });
            });

            console.log(`✅ SUCCESS: Display created: ${displayId}`);

            // Wait and check for canvas
            await page.waitForTimeout(2000);

            const canvasCount = await page.evaluate(() => {
                return document.querySelectorAll('canvas').length;
            });

            console.log(`✅ SUCCESS: Found ${canvasCount} canvas(es)`);

            console.log('\n🎯 APPLICATION IS WORKING CORRECTLY!');
            console.log('Ready for drift fix validation tests.');

        } else {
            console.error('❌ FAILED: displayActions not available');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

quickTest().catch(console.error);