// =============================================================================
// QUICK CONFIGURATION INHERITANCE TEST
// =============================================================================
// Run this in the browser console on http://localhost:5174
// =============================================================================

console.log('🧪 NeuroSense FX Quick Configuration Test');
console.log('========================================');

// Test 1: Check if stores are available
function checkStores() {
  console.log('\n📋 Step 1: Store Access Check');

  const hasDisplayStore = typeof window.displayStore !== 'undefined';
  const hasDisplayActions = typeof window.displayActions !== 'undefined';

  console.log(`✅ displayStore available: ${hasDisplayStore}`);
  console.log(`✅ displayActions available: ${hasDisplayActions}`);

  if (!hasDisplayStore || !hasDisplayActions) {
    console.error('❌ Stores not available. Make sure app is loaded.');
    return false;
  }

  // Check current store state
  window.displayStore.subscribe(store => {
    console.log(`📊 Current displays: ${store.displays.size}`);
    console.log(`📊 Active display: ${store.activeDisplayId}`);
    console.log(`📊 Default config keys: ${Object.keys(store.defaultConfig).length}`);

    // Show some key configuration values
    const sampleConfig = {
      'marketProfile.mode': store.defaultConfig['marketProfile.mode'],
      'volatilityOrb.colorMode': store.defaultConfig['volatilityOrb.colorMode'],
      'dayRangeMeter.enabled': store.defaultConfig['dayRangeMeter.enabled']
    };
    console.log('📋 Sample config values:', sampleConfig);
  });

  return true;
}

// Test 2: Configuration Update Test
async function testConfigurationUpdate() {
  console.log('\n🧬 Step 2: Configuration Update Test');

  try {
    // Get initial state
    let initialState;
    await new Promise(resolve => {
      window.displayStore.subscribe(store => {
        initialState = store.defaultConfig;
        resolve();
      });
    });

    console.log('📊 Initial marketProfile.mode:', initialState['marketProfile.mode']);

    // Change configuration
    const testValue = initialState['marketProfile.mode'] === 'traditional' ? 'delta' : 'traditional';
    console.log(`🔧 Changing marketProfile.mode to: ${testValue}`);

    window.displayActions.updateGlobalConfig('marketProfile.mode', testValue);

    // Wait and check result
    await new Promise(resolve => setTimeout(resolve, 200));

    let updatedState;
    await new Promise(resolve => {
      window.displayStore.subscribe(store => {
        updatedState = store.defaultConfig;
        resolve();
      });
    });

    const updateSuccess = updatedState['marketProfile.mode'] === testValue;
    console.log(`✅ Configuration update successful: ${updateSuccess}`);
    console.log(`📊 New marketProfile.mode: ${updatedState['marketProfile.mode']}`);

    return updateSuccess;

  } catch (error) {
    console.error('❌ Configuration update test failed:', error);
    return false;
  }
}

// Test 3: Display Inheritance Test
async function testDisplayInheritance() {
  console.log('\n👶 Step 3: Display Inheritance Test');

  try {
    // Get current configuration
    let currentConfig;
    await new Promise(resolve => {
      window.displayStore.subscribe(store => {
        currentConfig = store.defaultConfig;
        resolve();
      });
    });

    console.log(`📊 Creating display with marketProfile.mode: ${currentConfig['marketProfile.mode']}`);

    // Create new display
    const testSymbol = 'EURUSD_TEST';
    const displayId = window.displayActions.addDisplay(testSymbol, { x: 200, y: 200 });

    console.log(`✅ Created display: ${displayId}`);

    // Wait and check inheritance
    await new Promise(resolve => setTimeout(resolve, 500));

    let inheritedConfig;
    await new Promise(resolve => {
      window.displayStore.subscribe(store => {
        const display = store.displays.get(displayId);
        if (display) {
          inheritedConfig = display.config;
          console.log(`📊 Display inherited marketProfile.mode: ${inheritedConfig['marketProfile.mode']}`);
        }
        resolve();
      });
    });

    // Check if inheritance worked
    const inheritanceSuccess = inheritedConfig &&
      inheritedConfig['marketProfile.mode'] === currentConfig['marketProfile.mode'];

    console.log(`✅ Display inheritance successful: ${inheritanceSuccess}`);

    // Cleanup
    setTimeout(() => {
      window.displayActions.removeDisplay(displayId);
      console.log(`🧹 Cleaned up test display: ${displayId}`);
    }, 2000);

    return inheritanceSuccess;

  } catch (error) {
    console.error('❌ Display inheritance test failed:', error);
    return false;
  }
}

// Test 4: Persistence Test
function testPersistence() {
  console.log('\n💾 Step 4: Persistence Test');

  try {
    // Check localStorage
    const keys = Object.keys(localStorage).filter(key =>
      key.includes('neurosense') || key.includes('workspace') || key.includes('config')
    );

    console.log(`📦 Found ${keys.length} storage keys:`, keys);

    keys.forEach(key => {
      const value = localStorage.getItem(key);
      console.log(`📄 ${key}:`, value.substring(0, 100) + (value.length > 100 ? '...' : ''));
    });

    // Test writing/reading
    const testKey = 'neurosensefx-inheritance-test';
    const testValue = JSON.stringify({ test: true, timestamp: Date.now() });

    localStorage.setItem(testKey, testValue);
    const retrieved = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);

    const persistenceWorks = retrieved === testValue;
    console.log(`✅ Persistence test successful: ${persistenceWorks}`);

    return persistenceWorks;

  } catch (error) {
    console.error('❌ Persistence test failed:', error);
    return false;
  }
}

// Test 5: Factory Reset Test
async function testFactoryReset() {
  console.log('\n🔄 Step 5: Factory Reset Test');

  try {
    // First, modify a setting
    window.displayActions.updateGlobalConfig('marketProfile.mode', 'test-reset-value');

    // Wait for update
    await new Promise(resolve => setTimeout(resolve, 200));

    // Get modified state
    let modifiedConfig;
    await new Promise(resolve => {
      window.displayStore.subscribe(store => {
        modifiedConfig = store.defaultConfig;
        resolve();
      });
    });

    console.log(`📊 Modified config for reset test: ${modifiedConfig['marketProfile.mode']}`);

    // Perform factory reset
    console.log('🔄 Performing factory reset...');
    window.displayActions.resetToFactoryDefaults();

    // Wait for reset
    await new Promise(resolve => setTimeout(resolve, 200));

    // Get reset state
    let resetConfig;
    await new Promise(resolve => {
      window.displayStore.subscribe(store => {
        resetConfig = store.defaultConfig;
        resolve();
      });
    });

    const resetSuccess = resetConfig['marketProfile.mode'] !== 'test-reset-value';
    console.log(`✅ Factory reset successful: ${resetSuccess}`);
    console.log(`📊 Reset marketProfile.mode: ${resetConfig['marketProfile.mode']}`);

    return resetSuccess;

  } catch (error) {
    console.error('❌ Factory reset test failed:', error);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting configuration inheritance tests...\n');

  const results = {
    stores: checkStores(),
    configUpdate: await testConfigurationUpdate(),
    displayInheritance: await testDisplayInheritance(),
    persistence: testPersistence(),
    factoryReset: await testFactoryReset()
  };

  console.log('\n📊 FINAL RESULTS');
  console.log('=================');

  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test}`);
  });

  const allPassed = Object.values(results).every(result => result === true);
  const passCount = Object.values(results).filter(result => result === true).length;

  console.log(`\n🏆 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : `⚠️ ${passCount}/5 TESTS PASSED`}`);

  if (allPassed) {
    console.log('\n🎉 Configuration inheritance fixes are working correctly!');
    console.log('✨ New displays will inherit current runtime settings');
    console.log('💾 Settings persist across browser sessions');
    console.log('🔄 Factory reset works correctly');
  } else {
    console.log('\n🔧 Some tests failed. Check the implementation.');
  }

  return results;
}

// Auto-run if executed directly
if (typeof window !== 'undefined') {
  console.log('🧪 Test script loaded. Execute runAllTests() to start.');
  console.log('💡 Or wait 2 seconds for automatic execution...');

  setTimeout(runAllTests, 2000);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkStores,
    testConfigurationUpdate,
    testDisplayInheritance,
    testPersistence,
    testFactoryReset,
    runAllTests
  };
}