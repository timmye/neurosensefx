#!/usr/bin/env node

/**
 * Detailed Display Creation Diagnosis
 * Diagnoses why canvas elements aren't appearing after display creation
 */

import { chromium } from 'playwright';

async function diagnoseDisplayCreation() {
    console.log('🔍 Detailed Display Creation Diagnosis...\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 1000
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Enhanced console logging with ALL messages
    const allConsoleMessages = [];
    page.on('console', msg => {
        const text = msg.text();
        allConsoleMessages.push({
            type: msg.type(),
            text: text,
            timestamp: new Date().toISOString()
        });

        // Log all messages for debugging
        console.log(`[${msg.type().toUpperCase()}] ${text}`);
    });

    // Capture JavaScript errors
    page.on('pageerror', error => {
        console.error(`[JS ERROR] ${error.message}`);
        console.error(`[JS ERROR] Stack: ${error.stack}`);
    });

    try {
        console.log('📡 Loading application...');
        await page.goto('http://localhost:5174', { timeout: 15000 });

        console.log('⏳ Waiting for app to initialize...');
        await page.waitForTimeout(3000);

        // Step 1: Check initial state
        console.log('\n🔍 STEP 1: Checking initial state...');
        const initialState = await page.evaluate(() => {
            const appDiv = document.getElementById('app');
            const floatingDisplays = document.querySelectorAll('.enhanced-floating');
            const canvases = document.querySelectorAll('canvas');
            const loadingDivs = document.querySelectorAll('.loading');

            return {
                hasAppDiv: !!appDiv,
                appDivVisible: appDiv ? window.getComputedStyle(appDiv).display !== 'none' : false,
                floatingDisplayCount: floatingDisplays.length,
                canvasCount: canvases.length,
                loadingDivCount: loadingDivs.length,
                displayStoreAvailable: typeof window.displayStore !== 'undefined',
                displayActionsAvailable: typeof window.displayActions !== 'undefined',
                symbolsAvailable: typeof window.symbolService !== 'undefined'
            };
        });

        console.log('Initial state:', initialState);

        // Step 2: Create a display with detailed monitoring
        console.log('\n🎯 STEP 2: Creating display with detailed monitoring...');

        const displayCreationStart = Date.now();
        const displayId = await page.evaluate(() => {
            console.log('Starting display creation...');
            console.log('displayActions available:', typeof window.displayActions);
            console.log('symbolService available:', typeof window.symbolService);

            if (window.displayActions) {
                console.log('displayActions methods:', Object.getOwnPropertyNames(window.displayActions));
                return window.displayActions.addDisplay('EURUSD', { x: 100, y: 100 });
            } else {
                throw new Error('displayActions not available');
            }
        });

        const displayCreationEnd = Date.now();
        console.log(`Display created: ${displayId} (${displayCreationEnd - displayCreationStart}ms)`);

        // Step 3: Wait and monitor for changes
        console.log('\n⏳ STEP 3: Monitoring for DOM changes...');

        let lastCanvasCount = 0;
        let lastDisplayCount = 0;

        for (let i = 0; i < 10; i++) {
            await page.waitForTimeout(1000);

            const currentState = await page.evaluate(() => {
                const floatingDisplays = document.querySelectorAll('.enhanced-floating');
                const canvases = document.querySelectorAll('canvas');
                const loadingDivs = document.querySelectorAll('.loading');

                return {
                    floatingDisplayCount: floatingDisplays.length,
                    canvasCount: canvases.length,
                    loadingDivCount: loadingDivs.length,
                    timestamp: Date.now()
                };
            });

            console.log(`Check ${i + 1}:`, currentState);

            if (currentState.canvasCount > 0) {
                console.log('✅ Canvas elements detected!');
                break;
            }

            lastCanvasCount = currentState.canvasCount;
            lastDisplayCount = currentState.floatingDisplayCount;
        }

        // Step 4: Deep DOM inspection
        console.log('\n🔬 STEP 4: Deep DOM inspection...');

        const detailedDOMState = await page.evaluate(() => {
            const results = {
                appDiv: null,
                floatingDisplays: [],
                allCanvases: [],
                potentialIssues: []
            };

            // Check app div
            const appDiv = document.getElementById('app');
            if (appDiv) {
                results.appDiv = {
                    exists: true,
                    innerHTML: appDiv.innerHTML.substring(0, 1000) + '...',
                    childElementCount: appDiv.childElementCount,
                    computedStyle: {
                        display: window.getComputedStyle(appDiv).display,
                        visibility: window.getComputedStyle(appDiv).visibility,
                        opacity: window.getComputedStyle(appDiv).opacity
                    }
                };
            } else {
                results.potentialIssues.push('App div not found');
            }

            // Check floating displays
            const floatingDisplays = document.querySelectorAll('.enhanced-floating');
            floatingDisplays.forEach((display, index) => {
                const rect = display.getBoundingClientRect();
                const computedStyle = window.getComputedStyle(display);

                results.floatingDisplays.push({
                    index,
                    className: display.className,
                    id: display.id,
                    rect: {
                        width: rect.width,
                        height: rect.height,
                        left: rect.left,
                        top: rect.top,
                        visible: rect.width > 0 && rect.height > 0
                    },
                    computedStyle: {
                        display: computedStyle.display,
                        visibility: computedStyle.visibility,
                        opacity: computedStyle.opacity
                    },
                    hasCanvas: display.querySelectorAll('canvas').length > 0,
                    hasLoading: display.querySelectorAll('.loading').length > 0
                });
            });

            // Check all canvas elements
            const allCanvases = document.querySelectorAll('canvas');
            allCanvases.forEach((canvas, index) => {
                const rect = canvas.getBoundingClientRect();
                const ctx = canvas.getContext('2d');

                results.allCanvases.push({
                    index,
                    width: canvas.width,
                    height: canvas.height,
                    clientWidth: canvas.clientWidth,
                    clientHeight: canvas.clientHeight,
                    rect: {
                        width: rect.width,
                        height: rect.height,
                        left: rect.left,
                        top: rect.top,
                        visible: rect.width > 0 && rect.height > 0
                    },
                    hasContext: !!ctx,
                    parentElement: canvas.parentElement ? canvas.parentElement.className : 'no parent'
                });
            });

            // Check display store
            if (typeof window.displayStore !== 'undefined') {
                try {
                    const store = window.displayStore;
                    const displays = store.displays || store;
                    results.displayStoreInfo = {
                        hasDisplays: !!displays,
                        displayCount: typeof displays.get === 'function' ? displays.get.size :
                                      Array.isArray(displays) ? displays.length : 0,
                        storeType: typeof displays.get === 'function' ? 'Map' :
                                  Array.isArray(displays) ? 'Array' : 'Unknown'
                    };
                } catch (e) {
                    results.potentialIssues.push(`Error accessing display store: ${e.message}`);
                }
            } else {
                results.potentialIssues.push('Display store not available');
            }

            return results;
        });

        console.log('Detailed DOM state:', JSON.stringify(detailedDOMState, null, 2));

        // Step 5: Analyze console messages for issues
        console.log('\n📝 STEP 5: Analyzing console messages...');

        const errorMessages = allConsoleMessages.filter(msg => msg.type === 'error');
        const warningMessages = allConsoleMessages.filter(msg => msg.type === 'warning');
        const relevantMessages = allConsoleMessages.filter(msg =>
            msg.text.includes('canvas') ||
            msg.text.includes('display') ||
            msg.text.includes('render') ||
            msg.text.includes('error') ||
            msg.text.includes('failed')
        );

        console.log(`Found ${errorMessages.length} errors, ${warningMessages.length} warnings, ${relevantMessages.length} relevant messages`);

        if (errorMessages.length > 0) {
            console.log('\n🚨 ERROR MESSAGES:');
            errorMessages.forEach(msg => console.log(`  - ${msg.text}`));
        }

        if (relevantMessages.length > 0) {
            console.log('\n📋 RELEVANT MESSAGES:');
            relevantMessages.slice(-10).forEach(msg => console.log(`  - ${msg.text}`));
        }

        // Final assessment
        console.log('\n🎯 FINAL ASSESSMENT:');

        if (detailedDOMState.allCanvases.length > 0) {
            console.log('✅ SUCCESS: Canvas elements found');
        } else {
            console.log('❌ ISSUE: No canvas elements found');

            if (detailedDOMState.floatingDisplays.length > 0) {
                console.log('⚠️  Floating displays exist but have no canvas');
                detailedDOMState.floatingDisplays.forEach(display => {
                    if (!display.hasCanvas && display.hasLoading) {
                        console.log(`  - Display ${display.index} is still loading...`);
                    } else if (!display.hasCanvas) {
                        console.log(`  - Display ${display.index} has no canvas and is not loading`);
                    }
                });
            } else {
                console.log('⚠️  No floating displays found');
            }
        }

        console.log('\n🔧 Diagnosis complete!');

    } catch (error) {
        console.error('❌ Diagnosis failed:', error);
    } finally {
        console.log('\n🔍 Keeping browser open for manual inspection...');
        console.log('Press Ctrl+C to close');

        // Uncomment to close automatically
        // await browser.close();
    }
}

diagnoseDisplayCreation().catch(console.error);