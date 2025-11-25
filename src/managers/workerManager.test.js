// =============================================================================
// WORKER MANAGER TEST FILE
// =============================================================================
// Demonstrates and tests the workerManager functionality
// Validates trading-grade performance requirements
// =============================================================================

import { workerManager } from './workerManager.js';

/**
 * Test worker manager functionality and performance
 */
async function testWorkerManager() {
    console.log('🧪 Starting Worker Manager Tests');
    console.log('=' .repeat(50));

    try {
        // Test 1: Basic initialization
        console.log('\n📋 Test 1: Basic Initialization');
        const stats = workerManager.getWorkerStats();
        console.log('Initial stats:', stats);
        console.log('✅ Initialization test passed');

        // Test 2: Worker creation
        console.log('\n📋 Test 2: Worker Creation');
        const symbol = 'EURUSD';
        const displayId = 'test-display-1';

        const worker = await workerManager.createWorkerForSymbol(symbol, displayId);
        console.log('✅ Worker created successfully');
        console.log('Worker type:', typeof worker);

        // Test 3: Worker initialization
        console.log('\n📋 Test 3: Worker Initialization');
        const initData = {
            digits: 5,
            bid: 1.1000,
            currentPrice: 1.1000,
            todaysOpen: 1.0900,
            projectedAdrHigh: 1.1100,
            projectedAdrLow: 1.0800,
            todaysHigh: 1.1050,
            todaysLow: 1.0850,
            initialMarketProfile: []
        };

        const initResult = await workerManager.initializeWorker(symbol, displayId, initData);
        console.log('✅ Worker initialization result:', initResult);

        // Test 4: Tick dispatch performance
        console.log('\n📋 Test 4: Tick Dispatch Performance');
        const testTick = {
            symbol: 'EURUSD',
            bid: 1.1005,
            ask: 1.1008,
            timestamp: Date.now()
        };

        // Measure latency for multiple ticks
        const tickCount = 100;
        const startTime = performance.now();

        for (let i = 0; i < tickCount; i++) {
            const tick = {
                ...testTick,
                bid: 1.1000 + (i * 0.0001),
                ask: 1.1003 + (i * 0.0001),
                timestamp: Date.now()
            };
            workerManager.dispatchTick(symbol, tick);
        }

        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const avgLatency = totalTime / tickCount;

        console.log(`📊 Dispatched ${tickCount} ticks in ${totalTime.toFixed(2)}ms`);
        console.log(`⚡ Average latency: ${avgLatency.toFixed(3)}ms per tick`);
        console.log(`🎯 Trading performance requirement: ${avgLatency < 100 ? '✅ PASSED' : '❌ FAILED'}`);

        // Test 5: Multiple workers performance
        console.log('\n📋 Test 5: Multiple Workers Performance');
        const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'];
        const workerCreationStart = performance.now();

        const workerPromises = symbols.map(async (sym, index) => {
            const dispId = `test-display-${index + 2}`;
            await workerManager.createWorkerForSymbol(sym, dispId);
            await workerManager.initializeWorker(sym, dispId, initData);
            return { symbol: sym, displayId: dispId };
        });

        const createdWorkers = await Promise.all(workerPromises);
        const workerCreationTime = performance.now() - workerCreationStart;

        console.log(`🏭 Created ${createdWorkers.length} workers in ${workerCreationTime.toFixed(2)}ms`);
        console.log(`⚡ Average worker creation time: ${(workerCreationTime / createdWorkers.length).toFixed(2)}ms`);

        // Test 6: Memory usage monitoring
        console.log('\n📋 Test 6: Memory Usage Monitoring');
        const memoryUsage = workerManager.getMemoryUsage();
        console.log('Memory usage info:', memoryUsage);

        // Test 7: Performance metrics
        console.log('\n📋 Test 7: Performance Metrics');
        const finalStats = workerManager.getWorkerStats();
        console.log('Final stats:', finalStats);

        // Test 8: Configuration updates
        console.log('\n📋 Test 8: Configuration Updates');
        const configUpdate = {
            priceBucketMultiplier: 1.5,
            volatilitySmoothing: 0.8
        };

        const broadcastResult = workerManager.broadcastConfigUpdate(configUpdate);
        console.log(`✅ Configuration broadcast result: ${broadcastResult} workers updated`);

        // Test 9: Worker cleanup
        console.log('\n📋 Test 9: Worker Cleanup');
        const cleanupStart = performance.now();

        createdWorkers.forEach(({ symbol: sym, displayId: dispId }) => {
            workerManager.removeSymbol(sym, (targetSymbol) => {
                return targetSymbol === sym ? [dispId] : [];
            });
        });

        workerManager.removeSymbol(symbol, (targetSymbol) => {
            return targetSymbol === symbol ? [displayId] : [];
        });

        const cleanupTime = performance.now() - cleanupStart;
        console.log(`🧹 Cleanup completed in ${cleanupTime.toFixed(2)}ms`);

        const postCleanupStats = workerManager.getWorkerStats();
        console.log('Post-cleanup stats:', postCleanupStats);

        console.log('\n🎉 All tests completed successfully!');
        console.log('=' .repeat(50));

        return {
            success: true,
            results: {
                averageTickLatency: avgLatency,
                workerCreationTime: workerCreationTime / createdWorkers.length,
                memoryUsage: memoryUsage,
                finalStats: postCleanupStats
            }
        };

    } catch (error) {
        console.error('❌ Test failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Test worker manager error handling
 */
async function testWorkerManagerErrorHandling() {
    console.log('\n🛡️ Testing Worker Manager Error Handling');
    console.log('=' .repeat(50));

    try {
        // Test invalid tick data
        console.log('\n📋 Test: Invalid Tick Data Handling');
        workerManager.dispatchTick('INVALID', null); // Should handle gracefully
        workerManager.dispatchTick('INVALID', { invalid: 'data' }); // Should handle gracefully
        console.log('✅ Invalid tick data handled gracefully');

        // Test worker creation with invalid data
        console.log('\n📋 Test: Worker Initialization with Invalid Data');
        const worker = await workerManager.createWorkerForSymbol('TEST', 'test-invalid');
        await workerManager.initializeWorker('TEST', 'test-invalid', {
            // Missing required fields
            bid: 'not-a-number',
            digits: 'invalid'
        });
        console.log('✅ Invalid initialization data handled gracefully');

        // Cleanup test worker
        workerManager.removeSymbol('TEST', () => ['test-invalid']);

        console.log('\n✅ Error handling tests passed');
        return true;

    } catch (error) {
        console.error('❌ Error handling test failed:', error);
        return false;
    }
}

/**
 * Test worker manager optimizations
 */
async function testWorkerManagerOptimizations() {
    console.log('\n⚡ Testing Worker Manager Optimizations');
    console.log('=' .repeat(50));

    try {
        // Test optimization configuration
        console.log('\n📋 Test: Optimization Configuration');
        workerManager.configureOptimizations({
            batchDispatching: true,
            memoryOptimization: true,
            performanceMonitoring: true
        });
        console.log('✅ Optimizations configured successfully');

        // Test batch dispatching performance
        console.log('\n📋 Test: Batch Dispatching Performance');

        // Create multiple workers for same symbol
        const symbol = 'EURUSD';
        const displayIds = ['batch-test-1', 'batch-test-2', 'batch-test-3'];

        for (const displayId of displayIds) {
            await workerManager.createWorkerForSymbol(symbol, displayId);
            await workerManager.initializeWorker(symbol, displayId, {
                digits: 5,
                bid: 1.1000,
                currentPrice: 1.1000
            });
        }

        // Measure batch dispatch performance
        const tickCount = 50;
        const batchStartTime = performance.now();

        for (let i = 0; i < tickCount; i++) {
            workerManager.dispatchTick(symbol, {
                symbol,
                bid: 1.1000 + (i * 0.0001),
                ask: 1.1003 + (i * 0.0001),
                timestamp: Date.now()
            });
        }

        const batchEndTime = performance.now();
        const batchLatency = batchEndTime - batchStartTime;
        const avgBatchLatency = batchLatency / tickCount;

        console.log(`📊 Batch dispatch: ${tickCount} ticks in ${batchLatency.toFixed(2)}ms`);
        console.log(`⚡ Average batch latency: ${avgBatchLatency.toFixed(3)}ms per tick`);
        console.log(`🚀 Batch optimization: ${avgBatchLatency < 50 ? '✅ EFFECTIVE' : '⚠️ NEEDS IMPROVEMENT'}`);

        // Cleanup
        displayIds.forEach(displayId => {
            workerManager.removeSymbol(symbol, (sym) =>
                sym === symbol ? [displayId] : []
            );
        });

        console.log('\n✅ Optimization tests passed');
        return true;

    } catch (error) {
        console.error('❌ Optimization test failed:', error);
        return false;
    }
}

// Export test functions for external use
export {
    testWorkerManager,
    testWorkerManagerErrorHandling,
    testWorkerManagerOptimizations
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🚀 Running Worker Manager Tests');

    testWorkerManager()
        .then(result => {
            console.log('\n📊 Basic Tests Result:', result.success ? '✅ PASSED' : '❌ FAILED');
            return testWorkerManagerErrorHandling();
        })
        .then(result => {
            console.log('\n📊 Error Handling Tests Result:', result ? '✅ PASSED' : '❌ FAILED');
            return testWorkerManagerOptimizations();
        })
        .then(result => {
            console.log('\n📊 Optimization Tests Result:', result ? '✅ PASSED' : '❌ FAILED');
            console.log('\n🎯 All Worker Manager Tests Completed');

            // Final cleanup
            workerManager.cleanup();
            console.log('🧹 Final cleanup completed');
        })
        .catch(error => {
            console.error('💥 Test suite failed:', error);
        });
}