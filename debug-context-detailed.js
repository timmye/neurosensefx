/**
 * Detailed Context Menu Debug Script
 * Identifies the specific issues with canvas context detection
 */

function debugCanvasContextDetailed() {
  console.group('🔍 Canvas Context Menu - Detailed Analysis');

  // 1. Check window.contextMenuRef existence
  console.log('1. window.contextMenuRef:', !!window.contextMenuRef);
  if (window.contextMenuRef) {
    console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(window.contextMenuRef)));
    console.log('Own methods:', Object.getOwnPropertyNames(window.contextMenuRef));
  }

  // 2. Check detectContextMenuContext availability
  console.log('2. detectContextMenuContext availability:', {
    onWindowRef: typeof window.contextMenuRef?.detectContextMenuContext,
    onWindow: typeof window.detectContextMenuContext,
    inUnifiedContextMenu: 'Function exists but not exported'
  });

  // 3. Check showContextMenu availability
  console.log('3. showContextMenu availability:', {
    onWindowRef: typeof window.contextMenuRef?.showContextMenu,
    exported: 'export function showContextMenu found'
  });

  // 4. Find all canvas elements and their context
  const canvases = document.querySelectorAll('canvas');
  console.log('4. Canvas elements found:', canvases.length);

  canvases.forEach((canvas, i) => {
    const displayElement = canvas.closest('[data-display-id], .floating-display, .viz-container');
    console.log(`Canvas ${i}:`, {
      element: canvas,
      hasDataDisplayId: !!canvas.closest('[data-display-id]'),
      closestDisplayId: canvas.closest('[data-display-id]')?.dataset?.displayId,
      parentDisplayElement: displayElement,
      parentClasses: displayElement?.className,
      isFloatingDisplay: canvas.closest('.enhanced-floating, .floating-display'),
      isVizContainer: canvas.closest('.viz-container')
    });
  });

  // 5. Test DOM detection logic manually
  console.log('5. Testing DOM detection logic:');
  canvases.forEach((canvas, i) => {
    // Simulate the detectContextMenuContext logic
    const target = canvas;

    // Test the canvas detection condition
    const isCanvas = target.tagName === 'CANVAS' || target.closest('canvas');
    console.log(`Canvas ${i} detection:`, {
      tagName: target.tagName,
      isCanvasDirect: target.tagName === 'CANVAS',
      isCanvasClosest: !!target.closest('canvas'),
      passesCanvasCheck: isCanvas
    });

    if (isCanvas) {
      // Test display element finding
      const displayElement = target.closest('[data-display-id], .floating-display, .viz-container');
      const displayId = displayElement?.dataset.displayId ||
                        displayElement?.id?.replace('display-', '') ||
                        displayElement?.id?.replace('container-', '');

      console.log(`Canvas ${i} display detection:`, {
        displayElement: !!displayElement,
        displayElementClasses: displayElement?.className,
        displayId: displayId,
        hasDataDisplayId: !!displayElement?.dataset.displayId,
        elementId: displayElement?.id
      });
    }
  });

  // 6. Check MouseManager registration
  if (window.mouseManager) {
    console.log('6. MouseManager instances:', window.mouseManager.instances?.size || 0);
    const canvasInstances = [];
    window.mouseManager.instances?.forEach((instance, id) => {
      if (id.includes('canvas')) {
        canvasInstances.push({ id, type: instance.type, element: instance.element });
      }
    });
    console.log('Canvas instances in MouseManager:', canvasInstances);
  }

  // 7. Check if synthetic event coordinates are correct
  console.log('7. Testing synthetic event creation:');
  const canvas = document.querySelector('canvas');
  if (canvas) {
    const syntheticEvent = {
      target: canvas,
      clientX: 100,
      clientY: 100,
      preventDefault: () => {},
      stopPropagation: () => {}
    };

    console.log('Synthetic event test:', {
      targetMatches: syntheticEvent.target === canvas,
      hasCorrectProps: ['clientX', 'clientY', 'preventDefault'].every(prop => prop in syntheticEvent),
      coordinates: { x: syntheticEvent.clientX, y: syntheticEvent.clientY }
    });

    // Test what would happen if we call showContextMenu directly
    if (window.contextMenuRef?.showContextMenu) {
      console.log('✅ showContextMenu is available - test with synthetic event');
      // Don't actually call it in debug, just verify it exists
    } else {
      console.log('❌ showContextMenu is not available');
    }
  }

  console.groupEnd();

  return {
    contextMenuRefExists: !!window.contextMenuRef,
    detectContextMenuContextAvailable: !!(window.contextMenuRef?.detectContextMenuContext),
    showContextMenuAvailable: !!(window.contextMenuRef?.showContextMenu),
    canvasCount: canvases.length,
    canvasWithDisplayContext: canvases.length > 0 && canvases.some(canvas =>
      canvas.closest('[data-display-id], .floating-display, .viz-container')
    )
  };
}

// Test the fallback logic from Container.svelte
function testFallbackLogic() {
  console.group('🔄 Testing Fallback Logic');

  const canvas = document.querySelector('canvas');
  if (!canvas) {
    console.log('❌ No canvas found for fallback test');
    return;
  }

  // Simulate the fallback logic from Container.svelte
  const displayId = 'test-display-id';

  const context = {
    type: 'canvas',
    targetId: displayId,
    targetType: 'display'
  };

  console.log('Fallback context created:', context);

  // Check if displayActions.showContextMenu exists
  if (window.displayActions && window.displayActions.showContextMenu) {
    console.log('✅ Fallback displayActions.showContextMenu is available');
  } else {
    console.log('❌ Fallback displayActions.showContextMenu not found');
  }

  console.groupEnd();
}

// Main test function
function runFullContextMenuDebug() {
  console.log('🎯 Starting Full Context Menu Debug');

  const results = debugCanvasContextDetailed();
  testFallbackLogic();

  console.log('📊 Summary:', results);
  console.log('💡 Recommendations based on results:');

  if (!results.contextMenuRefExists) {
    console.log('   - window.contextMenuRef is not set up');
  }

  if (!results.detectContextMenuContextAvailable) {
    console.log('   - detectContextMenuContext is not exported from UnifiedContextMenu');
  }

  if (!results.showContextMenuAvailable) {
    console.log('   - showContextMenu is not available');
  }

  if (results.canvasCount === 0) {
    console.log('   - No canvas elements found');
  }

  if (!results.canvasWithDisplayContext) {
    console.log('   - Canvas elements lack proper DOM context for detection');
  }

  return results;
}

// Export for browser console
window.debugCanvasContextDetailed = debugCanvasContextDetailed;
window.testFallbackLogic = testFallbackLogic;
window.runFullContextMenuDebug = runFullContextMenuDebug;

console.log('🚀 Enhanced Context Menu Debug Script Loaded');
console.log('Run runFullContextMenuDebug() for comprehensive analysis');