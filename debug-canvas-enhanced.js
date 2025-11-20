/**
 * Enhanced Canvas Context Menu Debug Script
 * Identifies why canvas context detection is not working properly
 */

console.log('🎨 Enhanced Canvas Context Menu Debug - Loading...');

// Global function to run comprehensive tests
window.debugCanvasContextMenu = function() {
  console.log('\n🚀 Starting comprehensive canvas context menu debug...\n');

  // Test 1: Check if window.contextMenuRef is available
  console.log('📋 Test 1: window.contextMenuRef availability');
  if (window.contextMenuRef) {
    console.log('✅ window.contextMenuRef exists:', typeof window.contextMenuRef);

    if (window.contextMenuRef.showContextMenu) {
      console.log('✅ showContextMenu method available');
    } else {
      console.log('❌ showContextMenu method NOT available');
    }

    // Check if detectContextMenuContext is available directly on the ref
    if (window.contextMenuRef.detectContextMenuContext) {
      console.log('✅ detectContextMenuContext available on ref');
    } else {
      console.log('❌ detectContextMenuContext NOT available on ref');
    }
  } else {
    console.log('❌ window.contextMenuRef NOT available');
  }

  // Test 2: Check DOM for canvas elements and their structure
  console.log('\n📋 Test 2: Canvas element analysis');
  const canvasElements = document.querySelectorAll('canvas');
  console.log(`Found ${canvasElements.length} canvas elements:`);

  canvasElements.forEach((canvas, index) => {
    console.log(`Canvas ${index + 1}:`, {
      tagName: canvas.tagName,
      className: canvas.className,
      id: canvas.id,
      hasDataMouseId: canvas.hasAttribute('data-mouse-id'),
      dataMouseId: canvas.getAttribute('data-mouse-id'),
      closestVizContainer: !!canvas.closest('.viz-container'),
      closestDisplayId: canvas.closest('.viz-container')?.dataset?.displayId,
      style: canvas.style.cssText.substring(0, 100) + '...'
    });
  });

  // Test 3: Check .viz-container elements
  console.log('\n📋 Test 3: Viz-container analysis');
  const vizContainers = document.querySelectorAll('.viz-container');
  console.log(`Found ${vizContainers.length} .viz-container elements:`);

  vizContainers.forEach((container, index) => {
    const canvas = container.querySelector('canvas');
    console.log(`Container ${index + 1}:`, {
      className: container.className,
      dataset: container.dataset,
      hasCanvas: !!canvas,
      canvasId: canvas?.id,
      canvasDataMouseId: canvas?.getAttribute('data-mouse-id'),
      hasDataDisplayId: container.hasAttribute('data-display-id'),
      dataDisplayId: container.dataset.displayId
    });
  });

  // Test 4: Test detectContextMenuContext function directly
  console.log('\n📋 Test 4: Context detection function test');
  if (canvasElements.length > 0) {
    const testCanvas = canvasElements[0];
    const mockEvent = {
      target: testCanvas,
      clientX: 100,
      clientY: 100,
      preventDefault: () => {},
      stopPropagation: () => {}
    };

    console.log('Testing with canvas element:', testCanvas);

    // Try to get the function from window.contextMenuRef if available
    if (window.contextMenuRef && window.contextMenuRef.detectContextMenuContext) {
      try {
        const context = window.contextMenuRef.detectContextMenuContext(mockEvent);
        console.log('✅ Context detection result:', context);

        if (context.type === 'canvas') {
          console.log('✅ Canvas correctly detected as canvas context');
        } else {
          console.log('❌ Canvas detected as:', context.type, '(expected: canvas)');
        }
      } catch (error) {
        console.error('❌ Error in context detection:', error);
      }
    } else {
      console.log('❌ Cannot test context detection - function not available');
    }
  }

  // Test 5: Check MouseManager status
  console.log('\n📋 Test 5: MouseManager status');
  if (window.getMouseManager) {
    try {
      const mouseManager = window.getMouseManager();
      const debugInfo = mouseManager.getDebugInfo();
      console.log('✅ MouseManager available:', {
        instancesCount: debugInfo.instancesCount,
        registeredInstances: debugInfo.registeredInstances,
        activeElement: debugInfo.activeElement
      });

      // Check if any canvas instances are registered
      const canvasInstances = debugInfo.registeredInstances.filter(id => id.includes('canvas'));
      if (canvasInstances.length > 0) {
        console.log('✅ Canvas instances registered:', canvasInstances);
      } else {
        console.log('❌ No canvas instances registered with MouseManager');
      }
    } catch (error) {
      console.error('❌ Error getting MouseManager info:', error);
    }
  } else {
    console.log('❌ getMouseManager not available on window');
  }

  // Test 6: Create a synthetic right-click event to test the flow
  console.log('\n📋 Test 6: Event flow simulation');
  if (canvasElements.length > 0) {
    const testCanvas = canvasElements[0];
    const rect = testCanvas.getBoundingClientRect();

    // Create a real contextmenu event
    const contextMenuEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      button: 2 // Right mouse button
    });

    console.log('Simulating right-click on canvas at coordinates:', {
      x: contextMenuEvent.clientX,
      y: contextMenuEvent.clientY,
      target: testCanvas
    });

    // Listen for any context menu that appears
    const originalPreventDefault = contextMenuEvent.preventDefault;
    let wasPrevented = false;
    contextMenuEvent.preventDefault = function() {
      wasPrevented = true;
      originalPreventDefault.call(this);
    };

    // Dispatch the event
    testCanvas.dispatchEvent(contextMenuEvent);

    setTimeout(() => {
      console.log('Event simulation results:', {
        wasPrevented,
        contextMenuOpen: document.querySelector('.unified-context-menu') !== null
      });
    }, 100);
  }

  console.log('\n🏁 Comprehensive debug completed');
  console.log('📝 Check the results above to identify the specific issue');
};

// Enhanced test function to create canvas elements if needed
window.testCanvasCreation = function() {
  console.log('\n🔧 Testing canvas creation...');

  const vizContainer = document.querySelector('.viz-container');
  if (vizContainer) {
    const existingCanvas = vizContainer.querySelector('canvas');
    if (existingCanvas) {
      console.log('✅ Canvas already exists in viz-container');
    } else {
      console.log('❌ No canvas found in viz-container - this might be the issue');
    }
  } else {
    console.log('❌ No viz-container found - components may not be mounted yet');
  }
};

// Wait for page load and run tests
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
      window.debugCanvasContextMenu();
    }, 2000); // Wait 2 seconds for components to mount
  });
} else {
  setTimeout(() => {
    window.debugCanvasContextMenu();
  }, 2000);
}

console.log('🎯 Canvas context menu debug script loaded. Run debugCanvasContextMenu() in console to start testing.');