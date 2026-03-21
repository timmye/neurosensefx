// interact.js configuration factory for FloatingDisplay
// Creates draggable/resizable configuration with snap modifiers
import interact from 'interactjs';

export function createInteractConfig(element, callbacks) {
  const { onDragMove, onResizeMove, onTap, resizable = true } = callbacks;

  const interactable = interact(element)
    .draggable({
      modifiers: [
        interact.modifiers.snap({
          targets: [interact.snappers.grid({ x: 10, y: 10, range: 15 })],
          relativePoints: [{ x: 0, y: 0 }]
        })
      ],
      onmove: onDragMove
    })
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
