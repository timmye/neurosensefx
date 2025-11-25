// =============================================================================
// MINIMAL TEST: displayStateStore Module Core Functionality
// =============================================================================
// Test core store functionality without dependencies that might cause issues

console.log('🧪 Testing displayStateStore core functionality...');

// Test that the module can be imported and basic exports work
try {
  // Test 1: Import the module
  console.log('\n📋 Test 1: Module Import');

  // This will fail if there are syntax errors or missing dependencies
  import('../stores/displayStateStore.js').then(module => {
    console.log('✅ Module imported successfully');

    // Test 2: Check exports
    console.log('\n📋 Test 2: Export Verification');

    const requiredExports = [
      'displayStateStore',
      'displays',
      'activeDisplayId',
      'activeDisplay',
      'displayStateActions'
    ];

    let missingExports = [];
    requiredExports.forEach(exportName => {
      if (!module[exportName]) {
        missingExports.push(exportName);
      }
    });

    if (missingExports.length > 0) {
      console.log('❌ Missing exports:', missingExports);
      process.exit(1);
    }

    console.log('✅ All required exports present');

    // Test 3: Basic Store Functionality
    console.log('\n📋 Test 3: Basic Store Functionality');

    const { displayStateStore, displayStateActions } = module;

    // Test store subscription
    let unsubscribe = displayStateStore.subscribe(state => {
      console.log('✅ Store subscription working');
      console.log('✅ Initial state:', {
        displayCount: state.displays.size,
        activeDisplayId: state.activeDisplayId,
        nextZIndex: state.nextDisplayZIndex
      });
    });

    unsubscribe();

    // Test 4: Action Function Existence
    console.log('\n📋 Test 4: Action Function Verification');

    const requiredActions = [
      'addDisplay',
      'removeDisplay',
      'moveDisplay',
      'resizeDisplay',
      'setActiveDisplay',
      'updateDisplayState',
      'bringToFront',
      'hasDisplay',
      'getDisplay',
      'clearAllDisplays'
    ];

    let missingActions = [];
    requiredActions.forEach(actionName => {
      if (typeof displayStateActions[actionName] !== 'function') {
        missingActions.push(actionName);
      }
    });

    if (missingActions.length > 0) {
      console.log('❌ Missing actions:', missingActions);
      process.exit(1);
    }

    console.log('✅ All required action functions present');

    console.log('\n🎉 All core tests passed! displayStateStore module structure is correct.');

  }).catch(error => {
    console.error('\n❌ Module import failed:', error);
    process.exit(1);
  });

} catch (error) {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
}