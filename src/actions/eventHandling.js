/**
 * Svelte Event Handling Actions
 *
 * Replaces manual addEventListener/removeEventListener patterns with
 * declarative Svelte actions for better compliance and performance.
 *
 * Architecture: Framework-First Development
 * - Declarative event management
 * - Automatic cleanup on component destroy
 * - Performance optimized for sub-100ms trading requirements
 * - Keyboard-first interaction support
 */

/**
 * Action for handling document-level click outside events
 * Replaces manual document.addEventListener('click', handleClickOutside)
 * Optimized for sub-100ms trading performance
 *
 * @param {HTMLElement} node - The element to monitor
 * @param {Function} callback - Callback function when click outside occurs
 * @returns {{ update: Function, destroy: Function }} - Action lifecycle
 */
export function clickOutside(node, callback) {
  let rafId = null;

  const handleClick = (event) => {
    // Fast DOM check without contains() for performance
    if (!node || event.target === node) return;

    // Use fast path for common cases
    let target = event.target;
    let depth = 0;
    const maxDepth = 10; // Limit for performance

    while (target && target !== node && depth < maxDepth) {
      target = target.parentNode;
      depth++;
    }

    if (target !== node) {
      // Use requestAnimationFrame for smooth UI updates
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        callback(event);
        rafId = null;
      });
    }
  };

  // Use passive listener for better scroll performance
  document.addEventListener('click', handleClick, { passive: true, capture: true });

  return {
    update(newCallback) {
      callback = newCallback;
    },
    destroy() {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('click', handleClick, true);
    }
  };
}

// REMOVED: keyboardShortcuts function - conflicting system
// This functionality has been consolidated into the unified keyboardAction.js system
// to prevent multiple competing keyboard event handlers that were causing
// complete keyboard shortcut failure in the trading application.

/**
 * Action for handling window resize events with debouncing
 * Replaces manual window.addEventListener('resize', handleResize)
 *
 * @param {HTMLElement} node - The element (not used, but required for action)
 * @param {Function} callback - Callback function when resize occurs
 * @param {number} debounceMs - Debounce delay in milliseconds (default: 100)
 * @returns {{ update: Function, destroy: Function }} - Action lifecycle
 */
export function windowResize(node, callback, debounceMs = 100) {
  let timeoutId;

  const handleResize = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback({
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      });
    }, debounceMs);
  };

  // Use passive listener for better performance
  window.addEventListener('resize', handleResize, { passive: true });

  // Also handle visual viewport for zoom detection
  const handleViewportResize = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback({
        width: window.visualViewport?.width || window.innerWidth,
        height: window.visualViewport?.height || window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        visualViewport: true
      });
    }, debounceMs);
  };

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportResize, { passive: true });
  }

  return {
    update(newCallback, newDebounceMs = debounceMs) {
      callback = newCallback;
      debounceMs = newDebounceMs;
    },
    destroy() {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
      }
    }
  };
}

/**
 * Action for handling focus trap within a component
 * Essential for keyboard accessibility and modal dialogs
 *
 * @param {HTMLElement} node - The container element
 * @param {Object} options - Focus trap configuration
 * @returns {{ update: Function, destroy: Function }} - Action lifecycle
 */
export function focusTrap(node, options = {}) {
  const {
    initialFocus = null,
    restoreFocus = true,
    escapeKey = null
  } = options;

  let previousActiveElement = document.activeElement;
  let focusableElements = [];

  const getFocusableElements = () => {
    return Array.from(node.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => {
      return !el.disabled && !el.getAttribute('aria-hidden');
    });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Tab') {
      focusableElements = getFocusableElements();

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    } else if (event.key === 'Escape' && escapeKey) {
      event.preventDefault();
      escapeKey();
    }
  };

  // Set initial focus
  if (initialFocus) {
    initialFocus.focus();
  } else {
    const firstFocusable = getFocusableElements()[0];
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }

  // Add keyboard listener
  node.addEventListener('keydown', handleKeyDown);

  return {
    update(newOptions = {}) {
      Object.assign(options, newOptions);
    },
    destroy() {
      node.removeEventListener('keydown', handleKeyDown);

      if (restoreFocus && previousActiveElement) {
        previousActiveElement.focus();
      }
    }
  };
}

/**
 * Action for handling context menu triggers with keyboard support
 * Replaces manual contextmenu event listeners
 *
 * @param {HTMLElement} node - The trigger element
 * @param {Function} callback - Callback function when context menu should show
 * @param {Object} options - Context menu options
 * @returns {{ update: Function, destroy: Function }} - Action lifecycle
 */
export function contextMenu(node, callback, options = {}) {
  const {
    keyboardTrigger = 'Enter', // Keyboard key to trigger context menu
    preventDefault = true
  } = options;

  const handleContextMenu = (event) => {
    if (preventDefault) {
      event.preventDefault();
    }
    callback(event);
  };

  const handleKeyDown = (event) => {
    if (event.key === keyboardTrigger) {
      event.preventDefault();
      // Create synthetic mouse event for consistency
      const syntheticEvent = {
        type: 'keyboard',
        clientX: node.offsetLeft + node.offsetWidth / 2,
        clientY: node.offsetTop + node.offsetHeight / 2,
        target: node,
        preventDefault: () => {},
        stopPropagation: () => {}
      };
      callback(syntheticEvent);
    }
  };

  node.addEventListener('contextmenu', handleContextMenu);
  node.addEventListener('keydown', handleKeyDown);

  return {
    update(newCallback, newOptions = {}) {
      callback = newCallback;
      Object.assign(options, newOptions);
    },
    destroy() {
      node.removeEventListener('contextmenu', handleContextMenu);
      node.removeEventListener('keydown', handleKeyDown);
    }
  };
}

/**
 * Action for handling online/offline status changes
 * Replaces manual window.addEventListener('online/offline')
 *
 * @param {HTMLElement} node - The element (not used, but required)
 * @param {Function} onOnline - Callback when connection is restored
 * @param {Function} onOffline - Callback when connection is lost
 * @returns {{ update: Function, destroy: Function }} - Action lifecycle
 */
export function connectionStatus(node, onOnline, onOffline) {
  const handleOnline = () => {
    if (onOnline) onOnline();
  };

  const handleOffline = () => {
    if (onOffline) onOffline();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return {
    update(newOnOnline, newOnOffline) {
      onOnline = newOnOnline;
      onOffline = newOnOffline;
    },
    destroy() {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  };
}

/**
 * Comprehensive action that combines multiple event handling patterns
 * Ideal for complex components like modals, context menus, and panels
 *
 * @param {HTMLElement} node - The target element
 * @param {Object} config - Configuration object
 * @returns {{ update: Function, destroy: Function }} - Action lifecycle
 */
export function interactiveElement(node, config = {}) {
  const {
    onClickOutside = null,
    onEscape = null,
    shortcuts = {},
    focusTrap = false,
    resizeHandler = null,
    contextMenu = null
  } = config;

  const actions = [];

  // Setup click outside handling
  if (onClickOutside) {
    const clickOutsideAction = clickOutside(node, onClickOutside);
    actions.push(clickOutsideAction);
  }

  // REMOVED: Setup keyboard shortcuts - conflicting system
  // Keyboard shortcuts are now handled by the unified keyboardAction.js system
  // to prevent multiple competing event handlers that were causing failures

  // Setup focus trap
  if (focusTrap) {
    const focusTrapAction = focusTrap(node, { escapeKey: onEscape });
    actions.push(focusTrapAction);
  }

  // Setup resize handler
  if (resizeHandler) {
    const resizeAction = windowResize(node, resizeHandler);
    actions.push(resizeAction);
  }

  // Setup context menu
  if (contextMenu) {
    const contextMenuAction = contextMenu(node, contextMenu);
    actions.push(contextMenuAction);
  }

  return {
    update(newConfig = {}) {
      Object.assign(config, newConfig);
      actions.forEach(action => action.update?.());
    },
    destroy() {
      actions.forEach(action => action.destroy?.());
    }
  };
}