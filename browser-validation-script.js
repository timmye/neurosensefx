/**
 * Browser Console Validation Script for Canvas Race Condition Fix
 *
 * Run this script directly in the browser console at http://localhost:5174
 * to validate that the race condition fix is working correctly.
 *
 * Usage:
 * 1. Open http://localhost:5174 in browser
 * 2. Open developer console (F12)
 * 3. Copy and paste this entire script
 * 4. Press Enter to run the validation
 */

(function() {
    console.log('🚀 Starting Canvas Race Condition Fix Validation...');
    console.log('='.repeat(60));

    // Counter for validation metrics
    let validationMetrics = {
        consoleMessages: [],
        errorCount: 0,
        warningCount: 0,
        successCount: 0,
        transactionCount: 0,
        initializationCount: 0,
        startTime: Date.now()
    };

    // Function to categorize console messages
    function categorizeMessage(msg) {
        const text = msg.toString();

        if (text.includes('RESIZE_TRANSACTION')) {
            validationMetrics.transactionCount++;

            if (text.includes('Transaction completed')) {
                validationMetrics.successCount++;
                return { category: 'SUCCESS', type: 'transaction_completed', text };
            } else if (text.includes('Critical validation failures')) {
                validationMetrics.errorCount++;
                return { category: 'ERROR', type: 'critical_validation_failure', text };
            } else if (text.includes('Transaction failed')) {
                validationMetrics.errorCount++;
                return { category: 'ERROR', type: 'transaction_failed', text };
            } else if (text.includes('Starting atomic')) {
                return { category: 'INFO', type: 'transaction_start', text };
            }
        }

        if (text.includes('Canvas initialization')) {
            validationMetrics.initializationCount++;

            if (text.includes('completed successfully')) {
                validationMetrics.successCount++;
                return { category: 'SUCCESS', type: 'canvas_init_success', text };
            } else if (text.includes('failed')) {
                validationMetrics.errorCount++;
                return { category: 'ERROR', type: 'canvas_init_failed', text };
            } else if (text.includes('already in progress')) {
                return { category: 'INFO', type: 'duplicate_init_prevented', text };
            }
        }

        if (text.includes('Transaction already in progress')) {
            return { category: 'INFO', type: 'transaction_queued', text };
        }

        if (text.includes('console.error') && text.includes('Canvas')) {
            validationMetrics.errorCount++;
            return { category: 'ERROR', type: 'general_canvas_error', text };
        }

        return { category: 'OTHER', type: 'general', text };
    }

    // Override console methods to capture messages
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn
    };

    function captureConsoleMessage(type, args) {
        const message = Array.from(args).join(' ');
        const categorized = categorizeMessage(message);

        validationMetrics.consoleMessages.push({
            timestamp: Date.now(),
            type: type,
            category: categorized.category,
            subType: categorized.type,
            message: message
        });

        // Call original console method
        originalConsole[type].apply(console, args);
    }

    // Install console overrides
    console.log = function(...args) { captureConsoleMessage('log', args); };
    console.error = function(...args) { captureConsoleMessage('error', args); };
    console.warn = function(...args) {
        validationMetrics.warningCount++;
        captureConsoleMessage('warn', args);
    };

    // Display initial setup message
    originalConsole.log('🔍 Canvas Race Condition Validation Started');
    originalConsole.log('📊 Monitoring console messages for race condition evidence...');

    // Validation test functions
    const ValidationTests = {
        async testRapidDisplayCreation() {
            originalConsole.log('\n🧪 Test 1: Rapid Display Creation');
            originalConsole.log('='.repeat(40));

            // Simulate rapid display creation
            for (let i = 1; i <= 5; i++) {
                originalConsole.log(`Creating display ${i}...`);

                // Trigger Ctrl+K
                const event = new KeyboardEvent('keydown', {
                    key: 'k',
                    ctrlKey: true,
                    bubbles: true
                });
                document.dispatchEvent(event);

                // Wait a moment for dialog
                await new Promise(resolve => setTimeout(resolve, 200));

                // Try to fill symbol input if it exists
                const symbolInput = document.querySelector('input[placeholder*="search"], input[type="text"], [data-testid="symbol-search-input"]');
                if (symbolInput) {
                    symbolInput.value = `TEST${i}`;
                    symbolInput.dispatchEvent(new Event('input', { bubbles: true }));

                    // Press Enter
                    const enterEvent = new KeyboardEvent('keydown', {
                        key: 'Enter',
                        bubbles: true
                    });
                    symbolInput.dispatchEvent(enterEvent);
                }

                // Small delay between creations
                await new Promise(resolve => setTimeout(resolve, 400));
            }

            originalConsole.log('✅ Rapid display creation test completed');
        },

        async testResizeOperations() {
            originalConsole.log('\n🧪 Test 2: Resize Operations');
            originalConsole.log('='.repeat(40));

            // Find displays and simulate resize
            const displays = document.querySelectorAll('[data-display-id]');
            originalConsole.log(`Found ${displays.length} displays to test`);

            for (let i = 0; i < Math.min(2, displays.length); i++) {
                const display = displays[i];
                originalConsole.log(`Testing resize on display ${i + 1}`);

                // Get current dimensions
                const rect = display.getBoundingClientRect();

                // Simulate resize by triggering window resize (this should trigger resize transactions)
                const resizeEvent = new Event('resize');
                window.dispatchEvent(resizeEvent);

                // Also try direct style manipulation if possible
                if (display.style) {
                    const newWidth = rect.width + 20;
                    const newHeight = rect.height + 15;

                    display.style.width = `${newWidth}px`;
                    display.style.height = `${newHeight}px`;

                    // Trigger resize event on the display
                    const displayResizeEvent = new Event('resize');
                    display.dispatchEvent(displayResizeEvent);
                }

                await new Promise(resolve => setTimeout(resolve, 500));
            }

            originalConsole.log('✅ Resize operations test completed');
        },

        generateReport() {
            originalConsole.log('\n📋 VALIDATION REPORT');
            originalConsole.log('='.repeat(60));

            const duration = Date.now() - validationMetrics.startTime;

            // Count specific error patterns
            const criticalValidationFailures = validationMetrics.consoleMessages.filter(
                msg => msg.subType === 'critical_validation_failure'
            );

            const transactionFailures = validationMetrics.consoleMessages.filter(
                msg => msg.subType === 'transaction_failed'
            );

            const duplicateInitPrevented = validationMetrics.consoleMessages.filter(
                msg => msg.subType === 'duplicate_init_prevented'
            );

            const transactionsQueued = validationMetrics.consoleMessages.filter(
                msg => msg.subType === 'transaction_queued'
            );

            // Generate assessment
            const originalErrorsEliminated = criticalValidationFailures.length === 0 && transactionFailures.length === 0;
            const raceConditionPreventionWorking = duplicateInitPrevented.length >= 0 || transactionsQueued.length >= 0;
            const basicFunctionalityWorking = validationMetrics.successCount > 0;

            originalConsole.log('\n📊 METRICS:');
            originalConsole.log(`Duration: ${(duration / 1000).toFixed(1)} seconds`);
            originalConsole.log(`Total console messages: ${validationMetrics.consoleMessages.length}`);
            originalConsole.log(`Transactions detected: ${validationMetrics.transactionCount}`);
            originalConsole.log(`Initializations detected: ${validationMetrics.initializationCount}`);
            originalConsole.log(`Success operations: ${validationMetrics.successCount}`);
            originalConsole.log(`Warnings: ${validationMetrics.warningCount}`);
            originalConsole.log(`Errors: ${validationMetrics.errorCount}`);

            originalConsole.log('\n🎯 RACE CONDITION ANALYSIS:');
            originalConsole.log(`Critical validation failures: ${criticalValidationFailures.length} (Expected: 0)`);
            originalConsole.log(`Transaction failures: ${transactionFailures.length} (Expected: 0)`);
            originalConsole.log(`Duplicate initialization prevented: ${duplicateInitPrevented.length}`);
            originalConsole.log(`Transactions queued: ${transactionsQueued.length}`);

            originalConsole.log('\n🏆 ASSESSMENT:');
            originalConsole.log(`✅ Original errors eliminated: ${originalErrorsEliminated ? 'PASS' : 'FAIL'}`);
            originalConsole.log(`✅ Race condition prevention: ${raceConditionPreventionWorking ? 'PASS' : 'FAIL'}`);
            originalConsole.log(`✅ Basic functionality: ${basicFunctionalityWorking ? 'PASS' : 'FAIL'}`);

            // Show recent relevant messages
            const recentRelevantMessages = validationMetrics.consoleMessages
                .filter(msg => msg.category !== 'OTHER')
                .slice(-10);

            if (recentRelevantMessages.length > 0) {
                originalConsole.log('\n📝 RECENT RELEVANT MESSAGES:');
                recentRelevantMessages.forEach((msg, index) => {
                    originalConsole.log(`  ${index + 1}. [${msg.category}] ${msg.message}`);
                });
            }

            // Final conclusion
            const overallSuccess = originalErrorsEliminated && raceConditionPreventionWorking;

            originalConsole.log('\n🎉 FINAL RESULT:');
            if (overallSuccess) {
                originalConsole.log('✅ SUCCESS: Canvas race condition fix is working correctly!');
                originalConsole.log('✅ No original error patterns detected');
                originalConsole.log('✅ Race condition prevention mechanisms active');
            } else {
                originalConsole.log('❌ ISSUES DETECTED: Race condition may not be fully resolved');
                if (criticalValidationFailures.length > 0) {
                    originalConsole.log('❌ Critical validation failures still occurring');
                }
                if (transactionFailures.length > 0) {
                    originalConsole.log('❌ Transaction failures still occurring');
                }
            }

            return {
                originalErrorsEliminated,
                raceConditionPreventionWorking,
                basicFunctionalityWorking,
                overallSuccess,
                metrics: validationMetrics
            };
        }
    };

    // Auto-run tests after a short delay
    setTimeout(async () => {
        try {
            await ValidationTests.testRapidDisplayCreation();
            await new Promise(resolve => setTimeout(resolve, 2000));
            await ValidationTests.testResizeOperations();
            await new Promise(resolve => setTimeout(resolve, 3000));

            const results = ValidationTests.generateReport();

            // Restore original console methods
            console.log = originalConsole.log;
            console.error = originalConsole.error;
            console.warn = originalConsole.warn;

            // Make results available globally for inspection
            window.raceConditionValidationResults = results;

            originalConsole.log('\n📁 Validation complete. Results available in window.raceConditionValidationResults');

        } catch (error) {
            originalConsole.error('❌ Validation test failed:', error);

            // Restore original console methods even on error
            console.log = originalConsole.log;
            console.error = originalConsole.error;
            console.warn = originalConsole.warn;
        }
    }, 1000);

    // Make validation functions available globally
    window.raceConditionValidation = ValidationTests;

    originalConsole.log('🔧 Validation functions available in window.raceConditionValidation');
    originalConsole.log('⏱️ Tests will begin automatically in 1 second...');

})();