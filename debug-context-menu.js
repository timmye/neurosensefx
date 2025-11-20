/**
 * Debug script to test canvas context menu detection
 * Run this in browser console to debug context menu issues
 */

function debugCanvasContextMenu() {
  console.log('🔍 Canvas Context Menu Debug');

  // Check if window.contextMenuRef exists
  console.log('1. window.contextMenuRef:', window.contextMenuRef);

  // Find all canvas elements
  const canvases = document.querySelectorAll('canvas');
  console.log('2. Canvas elements found:', canvases.length);

  canvases.forEach((canvas, index) => {
    console.log(`Canvas ${index}:`, {
      element: canvas,
      tagName: canvas.tagName,
      className: canvas.className,
      id: canvas.id,
      width: canvas.width,
      height: canvas.height,
      // Check for data attributes
      dataAttributes: Array.from(canvas.attributes).filter(attr => attr.name.startsWith('data-')),
      // Check parent elements for display-id
      parentWithDisplayId: canvas.closest('[data-display-id]'),
      closestContainers: {
        floatingDisplay: canvas.closest('.floating-display, .enhanced-floating'),
        vizContainer: canvas.closest('.viz-container'),
        displayId: canvas.closest('[data-display-id]')?.dataset?.displayId
      }
    });
  });

  // Test detectContextMenuContext function
  if (window.contextMenuRef && window.contextMenuRef.detectContextMenuContext) {
    console.log('3. Testing detectContextMenuContext function:');

    canvases.forEach((canvas, index) => {
      // Create synthetic event
      const syntheticEvent = {
        target: canvas,
        clientX: 100,
        clientY: 100,
        preventDefault: () => {}
      };

      const context = window.contextMenuRef.detectContextMenuContext(syntheticEvent);
      console.log(`Canvas ${index} context:`, context);
    });
  } else {
    console.log('3. ❌ detectContextMenuContext function not found');
  }

  // Check FloatingDisplay elements
  const floatingDisplays = document.querySelectorAll('.enhanced-floating, .floating-display');
  console.log('4. Floating display elements:', floatingDisplays.length);

  floatingDisplays.forEach((display, index) => {
    console.log(`Floating Display ${index}:`, {
      element: display,
      className: display.className,
      dataset: display.dataset,
      hasDataDisplayId: display.hasAttribute('data-display-id'),
      displayId: display.dataset.displayId
    });
  });

  // Test synthetic event creation
  console.log('5. Testing synthetic event creation:');
  canvases.forEach((canvas, index) => {
    const syntheticEvent = {
      target: canvas,
      clientX: 100,
      clientY: 100,
      preventDefault: () => {},
      stopPropagation: () => {}
    };

    console.log(`Synthetic event for Canvas ${index}:`, {
      target: syntheticEvent.target,
      targetIsCanvas: syntheticEvent.target.tagName === 'CANVAS',
      targetClosestCanvas: syntheticEvent.target.closest('canvas'),
      parentWithDisplayId: syntheticEvent.target.closest('[data-display-id]'),
      syntheticEventProps: ['clientX', 'clientY', 'preventDefault'].every(prop => prop in syntheticEvent)
    });
  });

  // Check if showContextMenu is available
  console.log('6. showContextMenu availability:', {
    onWindowRef: typeof window.contextMenuRef?.showContextMenu,
    onWindowDirect: typeof window.showContextMenu
  });

  return {
    canvasesFound: canvases.length,
    floatingDisplaysFound: floatingDisplays.length,
    contextMenuRefExists: !!window.contextMenuRef,
    detectContextMenuContextExists: !!(window.contextMenuRef?.detectContextMenuContext),
    showContextMenuExists: !!(window.contextMenuRef?.showContextMenu)
  };
}

// Auto-run when loaded
console.log('🎯 Context Menu Debug Script Loaded');
console.log('Run debugCanvasContextMenu() in console to start debugging');

// Also create a manual context menu test
function testManualContextMenu() {
  const canvas = document.querySelector('canvas');
  if (!canvas) {
    console.error('No canvas found to test');
    return;
  }

  // Create a synthetic right-click event
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: canvas.offsetLeft + 50,
    clientY: canvas.offsetTop + 50,
    button: 2  // Right button
  });

  console.log('🖱️ Triggering manual context menu on canvas:', event);
  canvas.dispatchEvent(event);
}

// Add to window for easy access
window.debugCanvasContextMenu = debugCanvasContextMenu;
window.testManualContextMenu = testManualContextMenu;