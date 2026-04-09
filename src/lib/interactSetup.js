// interact.js configuration factory for FloatingDisplay
// Creates draggable/resizable configuration with snap modifiers
import interact from 'interactjs';

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

export function createInteractConfig(element, callbacks) {
  const { onDragMove, onResizeMove, onTap, resizable = true, ignoreFrom = null } = callbacks;

  // On touch devices, skip interact.js entirely — don't even call interact(element)
  // because it registers global document-level touchmove listeners with passive:false
  // on iOS, which blocks all native scroll regardless of whether draggable is enabled.
  if (isTouchDevice) {
    return null;
  }

  const draggableOpts = {
    modifiers: [
      interact.modifiers.snap({
        targets: [interact.snappers.grid({ x: 10, y: 10, range: 15 })],
        relativePoints: [{ x: 0, y: 0 }]
      })
    ],
    onmove: onDragMove
  };

  if (ignoreFrom) {
    draggableOpts.ignoreFrom = ignoreFrom;
  }

  const interactable = interact(element)
    .draggable(draggableOpts)
    .on('tap', onTap);

  if (resizable && onResizeMove) {
    interactable.resizable({
      edges: { right: true, bottom: true },
      listeners: { move: onResizeMove },
      modifiers: [
        interact.modifiers.restrictSize({ min: { width: 150, height: 80 } }),
        interact.modifiers.snapSize({
          targets: [
            interact.snappers.grid({ width: 10, height: 10, range: 15 })
          ]
        })
      ],
      inertia: true
    });
  }

  return interactable;
}
