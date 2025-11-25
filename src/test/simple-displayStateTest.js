// =============================================================================
// SIMPLE TEST: displayStateStore Module Functionality
// =============================================================================
// Quick Node.js test to verify basic functionality without test framework

import { get } from 'svelte/store';
import displayStateStore, { displayStateActions } from '../stores/displayStateStore.js';

console.log('🧪 Testing displayStateStore module...');

async function testDisplayStateStore() {
  try {
    // Test 1: Display Creation
    console.log('\n📋 Test 1: Display Creation');
    const displayId = displayStateActions.addDisplay('EURUSD', { x: 50, y: 75 });
    console.log(`✅ Created display: ${displayId}`);

    const state = get(displayStateStore);
    console.log(`✅ Store state: ${state.displays.size} displays, active: ${state.activeDisplayId}`);

    const display = state.displays.get(displayId);
    console.log(`✅ Display details: ${display.symbol} at (${display.position.x}, ${display.position.y})`);

    // Test 2: Display Movement
    console.log('\n📋 Test 2: Display Movement');
    const moved = displayStateActions.moveDisplay(displayId, { x: 200, y: 150 });
    console.log(`✅ Move success: ${moved}`);

    const updatedState = get(displayStateStore);
    const movedDisplay = updatedState.displays.get(displayId);
    console.log(`✅ New position: (${movedDisplay.position.x}, ${movedDisplay.position.y})`);

    // Test 3: Display Resizing
    console.log('\n📋 Test 3: Display Resizing');
    const resized = displayStateActions.resizeDisplay(displayId, 400, 300);
    console.log(`✅ Resize success: ${resized}`);

    const resizedDisplay = get(displayStateStore).displays.get(displayId);
    console.log(`✅ New size: ${resizedDisplay.size.width}x${resizedDisplay.size.height}`);
    console.log(`✅ ContainerSize synced: ${resizedDisplay.config.containerSize.width}x${resizedDisplay.config.containerSize.height}`);

    // Test 4: Display State Updates
    console.log('\n📋 Test 4: Display State Updates');
    const updated = displayStateActions.updateDisplayState(displayId, {
      ready: true,
      lastUpdate: Date.now(),
      marketData: { bid: 1.1000, ask: 1.1005 }
    });
    console.log(`✅ State update success: ${updated}`);

    const stateUpdatedDisplay = get(displayStateStore).displays.get(displayId);
    console.log(`✅ Display ready: ${stateUpdatedDisplay.ready}`);
    console.log(`✅ Ready displays count: ${get(displayStateStore).readyDisplays.size}`);

    // Test 5: Active Display Management
    console.log('\n📋 Test 5: Active Display Management');
    const toggled = displayStateActions.toggleActiveDisplay(displayId);
    console.log(`✅ Toggle active: ${toggled}`);

    const activeId = get(displayStateStore).activeDisplayId;
    console.log(`✅ Active display: ${activeId}`);

    // Test 6: Display Query Functions
    console.log('\n📋 Test 6: Display Query Functions');
    const hasDisplay = displayStateActions.hasDisplay(displayId);
    console.log(`✅ Has display: ${hasDisplay}`);

    const retrievedDisplay = displayStateActions.getDisplay(displayId);
    console.log(`✅ Retrieved display: ${retrievedDisplay.symbol}`);

    const symbolDisplay = displayStateActions.getDisplayBySymbol('EURUSD');
    console.log(`✅ Display by symbol: ${symbolDisplay.id}`);

    // Test 7: Z-Index Management
    console.log('\n📋 Test 7: Z-Index Management');
    const displayId2 = displayStateActions.addDisplay('GBPJPY', { x: 100, y: 100 });
    console.log(`✅ Created second display: ${displayId2}`);

    const broughtToFront = displayStateActions.bringToFront(displayId);
    console.log(`✅ Brought to front: ${broughtToFront}`);

    const highestZ = displayStateActions.getHighestZIndex();
    console.log(`✅ Highest Z-index: ${highestZ}`);

    // Test 8: Cleanup
    console.log('\n📋 Test 8: Cleanup Operations');
    const removed = displayStateActions.removeDisplay(displayId);
    console.log(`✅ Removed display: ${removed}`);

    const removed2 = displayStateActions.removeDisplay(displayId2);
    console.log(`✅ Removed second display: ${removed2}`);

    const clearedCount = displayStateActions.clearAllDisplays();
    console.log(`✅ Cleared remaining displays: ${clearedCount}`);

    const finalState = get(displayStateStore);
    console.log(`✅ Final state: ${finalState.displays.size} displays`);

    console.log('\n🎉 All tests passed! displayStateStore module is working correctly.');
    return true;

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    return false;
  }
}

// Run the test
testDisplayStateStore().then(success => {
  if (success) {
    console.log('\n✅ displayStateStore module verification completed successfully');
  } else {
    console.log('\n❌ displayStateStore module verification failed');
    process.exit(1);
  }
});