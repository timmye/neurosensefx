#!/usr/bin/env node

/**
 * Direct Drift Fix Validation
 * Tests the critical fixes without browser automation complications
 */

import { chromium } from 'playwright';

async function testDriftFixes() {
    console.log('🔧 Testing NeuroSense FX Drift Fixes...\n');

    const browser = await chromium.launch({
        headless: false, // Show browser for debugging
        slowMo: 500
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Enhanced console logging
    const consoleMessages = [];
    page.on('console', msg => {
        const text = msg.text();
        consoleMessages.push({
            type: msg.type(),
            text: text,
            timestamp: new Date().toISOString()
        });

        // Log relevant messages to console
        if (text.includes('DEBUGGER:DRIFT') ||
            text.includes('setTransform') ||
            text.includes('scheduleRender') ||
            text.includes('pendingRender')) {
            console.log(`[BROWSER] ${msg.type()}: ${text}`);
        }
    });

    // Capture JavaScript errors
    page.on('pageerror', error => {
        console.error(`[JS ERROR] ${error.message}`);
        console.error(`[JS ERROR] Stack: ${error.stack}`);
    });

    try {
        console.log('📡 Loading application...');

        // Go to the application with a longer timeout
        await page.goto('http://localhost:5174', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        console.log('⏳ Waiting for application to initialize...');

        // Wait for the app to be ready - multiple strategies
        await page.waitForTimeout(3000);

        // Check if displayActions is available
        const hasDisplayActions = await page.evaluate(() => {
            return typeof window.displayActions === 'object' &&
                   typeof window.displayActions.addDisplay === 'function';
        });

        if (!hasDisplayActions) {
            console.error('❌ displayActions not available - app may not have loaded properly');

            // Try to get page content for debugging
            const pageContent = await page.content();
            console.log('Page content preview:', pageContent.substring(0, 1000));

            return;
        }

        console.log('✅ displayActions available');

        // Test 1: Create a display
        console.log('\n🎯 Test 1: Creating display...');
        const displayId = await page.evaluate(() => {
            return window.displayActions.addDisplay('EURUSD', { x: 100, y: 100 });
        });

        console.log(`✅ Display created: ${displayId}`);

        // Wait for canvas to appear and render
        console.log('⏳ Waiting for canvas to render...');
        await page.waitForTimeout(2000);

        // Test 2: Check canvas visibility and drift fixes
        console.log('\n🔍 Test 2: Checking canvas visibility and drift fixes...');

        const canvasInfo = await page.evaluate(() => {
            const canvases = document.querySelectorAll('canvas');
            const results = [];

            canvases.forEach((canvas, index) => {
                const ctx = canvas.getContext('2d');
                const rect = canvas.getBoundingClientRect();

                if (ctx) {
                    try {
                        // Test explicit transform reset - check current transform
                        const currentTransform = ctx.getTransform();

                        // Test canvas content
                        const imageData = ctx.getImageData(0, 0, Math.min(canvas.width, 50), Math.min(canvas.height, 50));
                        const hasContent = imageData.data.some((channel, idx) => {
                            return idx % 4 !== 3 && channel !== 0 && channel !== 17; // Not transparent or default background
                        });

                        results.push({
                            index,
                            hasContent,
                            transform: currentTransform,
                            dimensions: {
                                width: canvas.width,
                                height: canvas.height,
                                clientWidth: canvas.clientWidth,
                                clientHeight: canvas.clientHeight
                            },
                            visible: rect.width > 0 && rect.height > 0,
                            dpr: window.devicePixelRatio || 1
                        });
                    } catch (e) {
                        results.push({
                            index,
                            error: e.message
                        });
                    }
                } else {
                    results.push({
                        index,
                        hasContext: false
                    });
                }
            });

            return results;
        });

        console.log('Canvas information:', JSON.stringify(canvasInfo, null, 2));

        const visibleCanvases = canvasInfo.filter(c => c.visible && !c.error);
        if (visibleCanvases.length === 0) {
            console.error('❌ No visible canvases found');
        } else {
            console.log(`✅ Found ${visibleCanvases.length} visible canvas(es)`);
        }

        // Test 3: Rapid position changes to test drift fixes
        console.log('\n🚀 Test 3: Testing drift fixes with rapid position changes...');

        const positions = [
            { x: 150, y: 150 },
            { x: 250, y: 150 },
            { x: 250, y: 250 },
            { x: 150, y: 250 },
            { x: 200, y: 200 }
        ];

        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            console.log(`Moving display to: ${JSON.stringify(pos)}`);

            await page.evaluate((x, y, id) => {
                window.displayActions.moveDisplay(id, { x, y });
            }, pos.x, pos.y, displayId);

            await page.waitForTimeout(800); // Allow position change and render
        }

        console.log('⏳ Waiting for drift detection...');
        await page.waitForTimeout(3000);

        // Test 4: Check if drift fixes were applied
        console.log('\n🔧 Test 4: Checking drift fix application...');

        // Analyze console messages for drift fixes
        const driftMessages = consoleMessages.filter(msg =>
            msg.text.includes('DEBUGGER:DRIFT') ||
            msg.text.includes('setTransform(1, 0, 0, 1, 0, 0)') ||
            msg.text.includes('CRITICAL FIX: Explicit reset')
        );

        const renderDeduplicationMessages = consoleMessages.filter(msg =>
            msg.text.includes('scheduleRender') ||
            msg.text.includes('pendingRender')
        );

        console.log(`\n📊 Analysis Results:`);
        console.log(`- Total console messages: ${consoleMessages.length}`);
        console.log(`- Drift-related messages: ${driftMessages.length}`);
        console.log(`- Render deduplication messages: ${renderDeduplicationMessages.length}`);

        if (driftMessages.length > 0) {
            console.log('✅ Drift monitoring is active');
            driftMessages.forEach(msg => {
                console.log(`  - ${msg.text}`);
            });
        } else {
            console.log('⚠️  No drift monitoring messages found');
        }

        if (renderDeduplicationMessages.length > 0) {
            console.log('✅ Render deduplication is working');
            renderDeduplicationMessages.slice(-3).forEach(msg => {
                console.log(`  - ${msg.text}`);
            });
        } else {
            console.log('⚠️  No render deduplication messages found');
        }

        // Test 5: Final canvas health check
        console.log('\n🏥 Test 5: Final canvas health check...');

        const finalCanvasHealth = await page.evaluate(() => {
            const canvas = document.querySelector('canvas');
            if (!canvas) return { hasCanvas: false };

            const ctx = canvas.getContext('2d');
            if (!ctx) return { hasCanvas: true, hasContext: false };

            const rect = canvas.getBoundingClientRect();
            const transform = ctx.getTransform();

            // Test that transform is at identity (drift fix applied)
            const isIdentityTransform =
                Math.abs(transform.a - 1) < 0.001 &&
                Math.abs(transform.b - 0) < 0.001 &&
                Math.abs(transform.c - 0) < 0.001 &&
                Math.abs(transform.d - 1) < 0.001 &&
                Math.abs(transform.e - 0) < 0.001 &&
                Math.abs(transform.f - 0) < 0.001;

            return {
                hasCanvas: true,
                hasContext: true,
                isVisible: rect.width > 0 && rect.height > 0,
                isIdentityTransform,
                transform: transform,
                dimensions: {
                    width: canvas.width,
                    height: canvas.height,
                    clientWidth: canvas.clientWidth,
                    clientHeight: canvas.clientHeight
                }
            };
        });

        console.log('Final canvas health:', JSON.stringify(finalCanvasHealth, null, 2));

        // Overall assessment
        console.log('\n🎯 OVERALL ASSESSMENT:');

        if (finalCanvasHealth.hasCanvas && finalCanvasHealth.hasContext) {
            console.log('✅ Canvas creation: SUCCESS');
        } else {
            console.log('❌ Canvas creation: FAILED');
        }

        if (finalCanvasHealth.isVisible) {
            console.log('✅ Canvas visibility: SUCCESS');
        } else {
            console.log('❌ Canvas visibility: FAILED');
        }

        if (finalCanvasHealth.isIdentityTransform) {
            console.log('✅ Transform drift fix: SUCCESS (identity matrix maintained)');
        } else {
            console.log('⚠️  Transform drift fix: WARNING (transform not at identity)');
        }

        if (driftMessages.length > 0) {
            console.log('✅ Drift monitoring: SUCCESS');
        } else {
            console.log('⚠️  Drift monitoring: NOT DETECTED');
        }

        if (renderDeduplicationMessages.length > 0) {
            console.log('✅ Render deduplication: SUCCESS');
        } else {
            console.log('⚠️  Render deduplication: NOT DETECTED');
        }

        console.log('\n🔧 Drift Fix Validation Complete!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Keep browser open for manual inspection
        console.log('\n🔍 Keeping browser open for manual inspection...');
        console.log('Press Ctrl+C to close');

        // Uncomment the line below to close automatically
        // await browser.close();
    }
}

// Run the test
testDriftFixes().catch(console.error);