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

// === COMPREHENSIVE DEBUG LOGGING SYSTEM ===
/**
 * Debug logging helper for event handling system
 */
function debugLog(message, data = null, level = 'INFO') {
	const timestamp = new Date().toISOString();
	const prefix = `[KEYBOARD-DEBUG] [${level}] ${timestamp}`;

	if (data) {
		console.log(`${prefix} ${message}`, data);
	} else {
		console.log(`${prefix} ${message}`);
	}
}

// Log module import immediately
debugLog('🔧 eventHandling.js module loading', { timestamp: Date.now() });

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
  debugLog('🎯 clickOutside() action initialized', {
    nodeTagName: node.tagName,
    nodeId: node.id,
    nodeClass: node.className,
    hasCallback: typeof callback === 'function'
  });

  let rafId = null;

  const handleClick = (event) => {
    debugLog('🖱️ clickOutside event detected', {
      targetTagName: event.target.tagName,
      targetId: event.target.id,
      targetIsNode: event.target === node,
      button: event.button,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey
    });

    // Fast DOM check without contains() for performance
    if (!node || event.target === node) {
      debugLog('⚠️ Ignoring click - target is node or node is null');
      return;
    }

    // Use fast path for common cases
    let target = event.target;
    let depth = 0;
    const maxDepth = 10; // Limit for performance

    while (target && target !== node && depth < maxDepth) {
      target = target.parentNode;
      depth++;
    }

    const isOutside = target !== node;
    debugLog('🔍 DOM traversal completed', {
      depth,
      maxDepth,
      isOutside,
      reachedMaxDepth: depth >= maxDepth
    });

    if (isOutside) {
      debugLog('⚡ Click outside detected, scheduling callback');
      // Use requestAnimationFrame for smooth UI updates
      if (rafId) {
        debugLog('🔄 Canceling previous RAF callback');
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        debugLog('📞 Executing clickOutside callback');
        callback(event);
        rafId = null;
      });
    } else {
      debugLog('⚠️ Click was inside element, ignoring');
    }
  };

  debugLog('📡 Adding clickOutside event listener', { passive: true, capture: true });
  // Use passive listener for better scroll performance
  document.addEventListener('click', handleClick, { passive: true, capture: true });

  return {
    update(newCallback) {
      debugLog('🔄 clickOutside update called', {
        nodeTagName: node.tagName,
        hasNewCallback: typeof newCallback === 'function'
      });
      callback = newCallback;
    },
    destroy() {
      debugLog('🗑️ clickOutside destroy called', { nodeTagName: node.tagName, hasRafId: !!rafId });
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('click', handleClick, true);
      debugLog('✅ clickOutside cleanup completed');
    }
  };
}

// Keyboard shortcuts functionality has been consolidated into the unified keyboardAction.js system
// to prevent multiple competing keyboard event handlers that were causing failures.

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
 * Updated to work with unified keyboard system - no competing handlers
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

  // UNIFIED SYSTEM: Focus trap Tab navigation now handled by unified keyboard shortcuts
  // This removes competing addEventListener('keydown') calls
  // The keyboardAction system handles Tab trapping through registered actions

  // Set initial focus
  if (initialFocus) {
    initialFocus.focus();
  } else {
    const firstFocusable = getFocusableElements()[0];
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }

  // Export focus trap functionality for unified keyboard system
  node.focusTrap = {
    getFocusableElements,
    handleTabKey: (event) => {
      focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return false;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
          return true;
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
          return true;
        }
      }
      return false;
    },
    handleEscape: (event) => {
      if (escapeKey) {
        event.preventDefault();
        escapeKey();
        return true;
      }
      return false;
    },
    focusFirst: () => {
      const firstFocusable = getFocusableElements()[0];
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }
  };

  return {
    update(newOptions = {}) {
      Object.assign(options, newOptions);
    },
    destroy() {
      delete node.focusTrap;

      if (restoreFocus && previousActiveElement) {
        previousActiveElement.focus();
      }
    }
  };
}

/**
 * Action for handling context menu triggers with keyboard support
 * Updated to work with unified keyboard system - no competing handlers
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

  // UNIFIED SYSTEM: Context menu keyboard triggers now handled by unified keyboard shortcuts
  // This removes competing addEventListener('keydown') calls
  // The keyboardAction system handles context menu triggers through registered actions

  node.addEventListener('contextmenu', handleContextMenu);

  // Export context menu functionality for unified keyboard system
  node.contextMenu = {
    trigger: (eventType = 'keyboard') => {
      // Create synthetic event for consistency
      const syntheticEvent = {
        type: eventType,
        clientX: node.offsetLeft + node.offsetWidth / 2,
        clientY: node.offsetTop + node.offsetHeight / 2,
        target: node,
        preventDefault: () => {},
        stopPropagation: () => {}
      };
      callback(syntheticEvent);
    },
    getKeyboardTrigger: () => keyboardTrigger
  };

  return {
    update(newCallback, newOptions = {}) {
      callback = newCallback;
      Object.assign(options, newOptions);
    },
    destroy() {
      node.removeEventListener('contextmenu', handleContextMenu);
      delete node.contextMenu;
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

// Final module completion log
debugLog('✅ eventHandling.js module fully loaded and ready', {
	exportedFunctions: [
		'clickOutside',
		'windowResize',
		'focusTrap',
		'contextMenu',
		'connectionStatus',
		'interactiveElement'
	],
	eventHandlingPhilosophy: 'Framework-First Development',
	optimizations: [
		'Declarative event management',
		'Automatic cleanup',
		'Sub-100ms performance',
		'Passive listeners',
		'RequestAnimationFrame optimization',
		'Keyboard-first support'
	]
});