// KeyManager — Centralized keyboard event handling
// Single document listener, priority-based resolution, LIFO escape stack

const registrations = [];
const escapeStack = [];
let documentHandler = null;

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

function matchesBinding(event, binding) {
  if (binding.key) {
    if (event.key !== binding.key) return false;
  }
  if (binding.code) {
    if (event.code !== binding.code) return false;
  }
  if (binding.alt !== undefined && binding.alt !== event.altKey) return false;
  if (binding.ctrl !== undefined && binding.ctrl !== event.ctrlKey) return false;
  if (binding.shift !== undefined && binding.shift !== event.shiftKey) return false;
  if (binding.meta !== undefined && binding.meta !== event.metaKey) return false;
  return true;
}

function handleKeydown(event) {
  // Escape stack takes absolute priority
  if (event.key === 'Escape' && escapeStack.length > 0) {
    event.preventDefault();
    event.stopPropagation();
    const handler = escapeStack.pop();
    handler();
    return;
  }

  // Collect matching handlers
  const matching = [];
  for (const reg of registrations) {
    if (!matchesBinding(event, reg.binding)) continue;

    // Input guard: skip unless explicitly allowed
    if (isInputFocused() && !reg.allowInput) continue;

    matching.push(reg);
  }

  if (matching.length === 0) return;

  // Sort by priority descending
  matching.sort((a, b) => b.priority - a.priority);

  // Execute highest priority handler
  const result = matching[0].handler(event);
  if (result === true) {
    // Handler explicitly consumed the event — preventDefault if it hasn't already
    if (!event.defaultPrevented) {
      event.preventDefault();
    }
  }
  // If handler returned false, allow event to continue naturally
}

export const keyManager = {
  init() {
    if (documentHandler) return;
    documentHandler = handleKeydown;
    document.addEventListener('keydown', documentHandler);
  },

  destroy() {
    if (!documentHandler) return;
    document.removeEventListener('keydown', documentHandler);
    documentHandler = null;
    registrations.length = 0;
    escapeStack.length = 0;
  },

  /**
   * Register a key binding handler.
   * @param {Object} binding - Key match criteria: { key?, code?, alt?, ctrl?, shift?, meta? }
   * @param {Function} handler - Called with the event. Return false to allow fallback.
   * @param {Object} options
   * @param {number} options.priority - 0 (global) to 100. Higher wins.
   * @param {boolean} options.allowInput - If true, fires even when text input is focused.
   * @returns {Function} Unsubscribe function.
   */
  register(binding, handler, { priority = 0, allowInput = false } = {}) {
    const reg = { binding, handler, priority, allowInput };
    registrations.push(reg);
    return () => {
      const idx = registrations.indexOf(reg);
      if (idx !== -1) registrations.splice(idx, 1);
    };
  },

  /**
   * Push an escape handler onto the LIFO stack.
   * Escape stack has absolute priority over all registered handlers.
   * @param {Function} handler - Called when Escape is pressed.
   * @returns {Function} Pop function — call to remove this handler.
   */
  pushEscape(handler) {
    escapeStack.push(handler);
    return () => {
      const idx = escapeStack.indexOf(handler);
      if (idx !== -1) escapeStack.splice(idx, 1);
    };
  },

  isInputFocused,
};
