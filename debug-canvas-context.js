/**
 * Canvas Context Menu Debug Script
 * Tests if canvas right-click context detection is working properly
 */

console.log('🎨 Canvas Context Menu Debug Script');

// Test if we can access the exported function
function testContextDetectionExport() {
  try {
    // Try to import and use the detectContextMenuContext function
    import('./src/components/UnifiedContextMenu.svelte').then(module => {
      if (module.detectContextMenuContext) {
        console.log('✅ detectContextMenuContext function is exported');

        // Create a mock canvas event
        const mockCanvas = document.createElement('canvas');
        const mockEvent = {
          target: mockCanvas,
          clientX: 100,
          clientY: 100,
          preventDefault: () => {}
        };

        const context = module.detectContextMenuContext(mockEvent);
        console.log('🧪 Mock canvas detection result:', context);

        if (context.type === 'canvas') {
          console.log('✅ Canvas context detection working correctly');
        } else {
          console.log('❌ Canvas context detection failed. Expected "canvas", got:', context.type);
        }
      } else {
        console.log('❌ detectContextMenuContext function not exported');
      }
    }).catch(error => {
      console.error('❌ Error importing UnifiedContextMenu:', error);
    });
  } catch (error) {
    console.error('❌ Error testing context detection export:', error);
  }
}

// Test if window.contextMenuRef is available
function testContextMenuRef() {
  if (typeof window !== 'undefined') {
    if (window.contextMenuRef) {
      console.log('✅ window.contextMenuRef is available');

      if (window.contextMenuRef.showContextMenu) {
        console.log('✅ showContextMenu method is available');
      } else {
        console.log('❌ showContextMenu method not available');
      }
    } else {
      console.log('❌ window.contextMenuRef not available');
    }
  }
}

// Test DOM structure
function testDOMStructure() {
  const canvasElements = document.querySelectorAll('canvas');
  console.log(`📊 Found ${canvasElements.length} canvas elements`);

  // Also check for .viz-container elements (might not have canvas yet)
  const vizContainers = document.querySelectorAll('.viz-container');
  console.log(`📊 Found ${vizContainers.length} .viz-container elements`);

  vizContainers.forEach((container, index) => {
    const displayId = container.dataset.displayId;
    const canvas = container.querySelector('canvas');
    console.log(`VizContainer ${index + 1}: data-display-id: ${displayId}, has canvas: ${!!canvas}`);
  });

  if (canvasElements.length === 0 && vizContainers.length > 0) {
    console.log('🔄 Canvas elements not loaded yet, but containers found. Try running tests again in 2 seconds.');
  }

  canvasElements.forEach((canvas, index) => {
    const container = canvas.closest('.viz-container');
    if (container) {
      const displayId = container.dataset.displayId;
      console.log(`Canvas ${index + 1}: Found in .viz-container with data-display-id: ${displayId}`);
    } else {
      console.log(`Canvas ${index + 1}: Not in .viz-container`);
    }
  });
}

// Run all tests
function runCanvasContextTests() {
  console.log('🚀 Starting canvas context menu tests...\n');

  testContextMenuRef();
  testDOMStructure();
  testContextDetectionExport();

  console.log('\n🏁 Canvas context menu tests completed');
}

// Auto-run with delay to ensure components are loaded
if (typeof window !== 'undefined') {
  setTimeout(() => {
    runCanvasContextTests();
  }, 1000); // Delay 1 second to allow components to mount
}

// Export for manual testing
window.runCanvasContextTests = runCanvasContextTests;