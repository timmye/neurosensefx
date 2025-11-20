/**
 * Simple context menu test script
 * Run this in the browser console to test canvas right-click functionality
 */

console.log('🧪 Canvas Context Menu Test - Starting...');

function testCanvasContextMenu() {
  // Find canvas elements
  const canvasElements = document.querySelectorAll('canvas');
  console.log(`📊 Found ${canvasElements.length} canvas elements`);

  if (canvasElements.length === 0) {
    console.log('❌ No canvas elements found. Make sure displays are created.');
    return;
  }

  // Test window.contextMenuRef availability
  console.log('🔗 window.contextMenuRef:', typeof window.contextMenuRef);
  if (window.contextMenuRef) {
    console.log('✅ window.contextMenuRef available');
    console.log('🔧 showContextMenu method:', typeof window.contextMenuRef.showContextMenu);
    console.log('🔧 detectContextMenuContext method:', typeof window.contextMenuRef.detectContextMenuContext);
  } else {
    console.log('❌ window.contextMenuRef not available');
  }

  // Test mouse manager
  console.log('🐭 getMouseManager:', typeof window.getMouseManager);
  if (window.getMouseManager) {
    const mouseManager = window.getMouseManager();
    const debugInfo = mouseManager.getDebugInfo();
    console.log('✅ MouseManager active with', debugInfo.instancesCount, 'instances');
    console.log('📝 Registered instances:', debugInfo.registeredInstances);
  } else {
    console.log('❌ getMouseManager not available');
  }

  // Check viz-containers
  const vizContainers = document.querySelectorAll('.viz-container');
  console.log(`📦 Found ${vizContainers.length} .viz-container elements`);

  vizContainers.forEach((container, index) => {
    const canvas = container.querySelector('canvas');
    const displayId = container.dataset.displayId;
    console.log(`Container ${index + 1}:`, {
      displayId,
      hasCanvas: !!canvas,
      canvasId: canvas?.id
    });
  });

  // Create test button for manual testing
  if (!document.getElementById('test-canvas-context-btn')) {
    const testBtn = document.createElement('button');
    testBtn.id = 'test-canvas-context-btn';
    testBtn.textContent = 'Test Canvas Right-Click';
    testBtn.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 99999;
      background: #4f46e5;
      color: white;
      border: none;
      padding: 10px;
      border-radius: 5px;
      cursor: pointer;
    `;

    testBtn.onclick = () => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          button: 2
        });

        console.log('🧪 Triggering synthetic right-click on canvas');
        canvas.dispatchEvent(event);

        // Check if context menu appears
        setTimeout(() => {
          const contextMenu = document.querySelector('.unified-context-menu');
          console.log('🎯 Context menu result:', {
            exists: !!contextMenu,
            open: contextMenu && contextMenu.style.display !== 'none'
          });
        }, 100);
      } else {
        console.log('❌ No canvas found to test');
      }
    };

    document.body.appendChild(testBtn);
    console.log('🎮 Test button added (top-right corner)');
  }

  console.log('✅ Canvas context menu test complete');
  console.log('💡 Right-click on any canvas or use the test button');
}

// Auto-run test
setTimeout(testCanvasContextMenu, 2000);

// Make available globally
window.testCanvasContextMenu = testCanvasContextMenu;