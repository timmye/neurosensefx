// Interaction Setup Utilities - Single Responsibility
// Framework-first: Direct interact.js usage with clear separation

import interact from 'interactjs';

export function setupDisplayInteraction(element, display, workspaceActions) {
  const interactable = interact(element).draggable({
    onmove: (e) => workspaceActions.updatePosition(display.id, {x: e.rect.left, y: e.rect.top})
  }).resizable({
    edges: { right: true, bottom: true },
    listeners: {
      move (event) {
        const newSize = { width: event.rect.width, height: event.rect.height };
        workspaceActions.updateSize(display.id, newSize);
        // Return new size for canvas height update
        return newSize;
      }
    },
    modifiers: [interact.modifiers.restrictSize({ min: { width: 150, height: 80 } })],
    inertia: true
  }).on('tap', () => workspaceActions.bringToFront(display.id));

  return interactable;
}

export function setupCanvasHeightCallback(resizeListener, setCanvasHeight) {
  // Setup canvas height update when resize occurs
  const originalListener = resizeListener.listeners?.move;
  if (originalListener) {
    resizeListener.listeners.move = (event) => {
      const result = originalListener(event);
      if (result && result.height) {
        setCanvasHeight(result.height - 40);
      }
    };
  }
}