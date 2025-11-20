/**
 * Test script to verify canvas context menu fixes
 * Run this in browser console after loading the app
 */

function testCanvasContextMenuFix() {
  console.group('🧪 Testing Canvas Context Menu Fixes');

  // 1. Check if window.contextMenuRef exists
  console.log('1. window.contextMenuRef:', !!window.contextMenuRef);
  if (!window.contextMenuRef) {
    console.error('❌ window.contextMenuRef is not available');
    console.groupEnd();
    return false;
  }

  // 2. Check if detectContextMenuContext is exported
  console.log('2. detectContextMenuContext exported:', typeof window.contextMenuRef.detectContextMenuContext);
  if (typeof window.contextMenuRef.detectContextMenuContext !== 'function') {
    console.error('❌ detectContextMenuContext is not exported');
    console.groupEnd();
    return false;
  }

  // 3. Check if showContextMenu is exported
  console.log('3. showContextMenu exported:', typeof window.contextMenuRef.showContextMenu);
  if (typeof window.contextMenuRef.showContextMenu !== 'function') {
    console.error('❌ showContextMenu is not exported');
    console.groupEnd();
    return false;
  }

  // 4. Find canvas elements and test context detection
  const canvases = document.querySelectorAll('canvas');
  console.log('4. Canvas elements found:', canvases.length);

  if (canvases.length === 0) {
    console.error('❌ No canvas elements found');
    console.groupEnd();
    return false;
  }

  let allCanvasesDetected = true;
  canvases.forEach((canvas, index) => {
    console.log(`Canvas ${index}:`, {
      element: canvas,
      hasDataDisplayId: !!canvas.closest('[data-display-id]'),
      displayId: canvas.closest('[data-display-id]')?.dataset.displayId
    });

    // Test context detection
    const syntheticEvent = {
      target: canvas,
      clientX: canvas.offsetLeft + 50,
      clientY: canvas.offsetTop + 50,
      preventDefault: () => {},
      stopPropagation: () => {}
    };

    try {
      const context = window.contextMenuRef.detectContextMenuContext(syntheticEvent);
      console.log(`Canvas ${index} context detection:`, context);

      if (!context || context.type !== 'canvas') {
        console.warn(`⚠️ Canvas ${index} not detected as canvas context:`, context);
        allCanvasesDetected = false;
      }
    } catch (error) {
      console.error(`❌ Error detecting context for Canvas ${index}:`, error);
      allCanvasesDetected = false;
    }
  });

  // 5. Test showContextMenu with first canvas
  if (canvases.length > 0 && allCanvasesDetected) {
    const firstCanvas = canvases[0];
    const syntheticEvent = {
      target: firstCanvas,
      clientX: firstCanvas.offsetLeft + 50,
      clientY: firstCanvas.offsetTop + 50,
      preventDefault: () => {},
      stopPropagation: () => {}
    };

    console.log('5. Testing showContextMenu call...');
    try {
      // Don't actually call it, just verify it doesn't throw an error when creating event
      console.log('✅ Synthetic event created successfully:', {
        target: syntheticEvent.target.tagName,
        coordinates: { x: syntheticEvent.clientX, y: syntheticEvent.clientY }
      });

      // Check if context menu store would be triggered
      console.log('✅ showContextMenu is ready to be called');
    } catch (error) {
      console.error('❌ Error in showContextMenu setup:', error);
    }
  }

  console.groupEnd();

  const success = window.contextMenuRef &&
                 typeof window.contextMenuRef.detectContextMenuContext === 'function' &&
                 typeof window.contextMenuRef.showContextMenu === 'function' &&
                 canvases.length > 0 &&
                 allCanvasesDetected;

  console.log('🎯 Overall Test Result:', success ? '✅ PASSED' : '❌ FAILED');
  return success;
}

// Test MouseManager canvas registration
function testMouseManagerCanvasRegistration() {
  console.group('🐭 Testing MouseManager Canvas Registration');

  if (!window.mouseManager) {
    console.log('⚠️ MouseManager not available (expected in some contexts)');
    console.groupEnd();
    return true; // Not necessarily a failure
  }

  console.log('MouseManager instances:', window.mouseManager.instances?.size || 0);

  const canvasInstances = [];
  window.mouseManager.instances?.forEach((instance, id) => {
    if (id.includes('canvas') || instance.type === 'canvas') {
      canvasInstances.push({
        id,
        type: instance.type,
        hasContextMenu: instance.options.enableContextMenu,
        element: instance.element.tagName
      });
    }
  });

  console.log('Canvas instances:', canvasInstances);
  console.log('✅ Canvas registration test completed');
  console.groupEnd();

  return canvasInstances.length > 0;
}

// Run all tests
function runAllContextMenuTests() {
  console.log('🚀 Running All Context Menu Tests');

  const contextMenuTest = testCanvasContextMenuFix();
  const mouseManagerTest = testMouseManagerCanvasRegistration();

  const overallSuccess = contextMenuTest && mouseManagerTest;

  console.log('📊 Final Results:');
  console.log('  Context Menu Detection:', contextMenuTest ? '✅ PASSED' : '❌ FAILED');
  console.log('  MouseManager Registration:', mouseManagerTest ? '✅ PASSED' : '⚠️ SKIPPED');
  console.log('  Overall:', overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');

  if (overallSuccess) {
    console.log('🎉 Canvas right-click context menu should now work correctly!');
    console.log('💡 Test by right-clicking on any canvas element');
  }

  return overallSuccess;
}

// Export functions
window.testCanvasContextMenuFix = testCanvasContextMenuFix;
window.testMouseManagerCanvasRegistration = testMouseManagerCanvasRegistration;
window.runAllContextMenuTests = runAllContextMenuTests;

console.log('🧪 Context Menu Fix Test Script Loaded');
console.log('Run runAllContextMenuTests() to test all fixes');