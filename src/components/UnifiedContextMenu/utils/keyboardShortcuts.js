/**
 * Keyboard shortcuts for the unified context menu
 *
 * This module now integrates with the centralized keyboard shortcut system
 * while maintaining compatibility with existing context menu functionality.
 */

// Import centralized shortcut system
import { keyboardManager, SHORTCUT_CONTEXTS } from '../../../utils/keyboardShortcutManager.js';

// Context menu specific shortcuts (now integrated with centralized system)
export const contextMenuShortcuts = {
  // Tab navigation (context menu specific)
  'contextMenu.nextTab': {
    key: 'Ctrl+Tab',
    description: 'Next tab',
    category: 'navigation',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  },
  'contextMenu.prevTab': {
    key: 'Ctrl+Shift+Tab',
    description: 'Previous tab',
    category: 'navigation',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  },
  'contextMenu.goToTab1': {
    key: 'Ctrl+1',
    description: 'Go to Quick Actions tab',
    category: 'navigation',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  },
  'contextMenu.goToTab2': {
    key: 'Ctrl+2',
    description: 'Go to Price Display tab',
    category: 'navigation',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  },
  'contextMenu.goToTab3': {
    key: 'Ctrl+3',
    description: 'Go to Market Profile tab',
    category: 'navigation',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  },
  'contextMenu.goToTab4': {
    key: 'Ctrl+4',
    description: 'Go to Volatility tab',
    category: 'navigation',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  },
  'contextMenu.goToTab5': {
    key: 'Ctrl+5',
    description: 'Go to Layout & Sizing tab',
    category: 'navigation',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  },
  'contextMenu.goToTab6': {
    key: 'Ctrl+6',
    description: 'Go to Advanced tab',
    category: 'navigation',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  },

  // Search functionality (context menu specific)
  'contextMenu.focusSearch': {
    key: 'Ctrl+F',
    description: 'Focus search input',
    category: 'navigation',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  },
  'contextMenu.clearSearch': {
    key: 'Escape',
    description: 'Clear search or close menu',
    category: 'navigation',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  },
  'contextMenu.selectSearchResult': {
    key: 'Enter',
    description: 'Select highlighted search result',
    category: 'navigation',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  },
  'contextMenu.nextSearchResult': {
    key: 'ArrowDown',
    description: 'Next search result',
    category: 'navigation',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  },
  'contextMenu.prevSearchResult': {
    key: 'ArrowUp',
    description: 'Previous search result',
    category: 'navigation',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  },

  // Menu actions (context menu specific)
  'contextMenu.resetToDefaults': {
    key: 'Ctrl+R',
    description: 'Reset to defaults',
    category: 'configuration',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  },
  'contextMenu.applyAndClose': {
    key: 'Ctrl+Enter',
    description: 'Apply changes and close',
    category: 'configuration',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  },
  'contextMenu.closeMenu': {
    key: 'Ctrl+W',
    description: 'Close menu',
    category: 'navigation',
    contexts: [SHORTCUT_CONTEXTS.CONTEXT_MENU]
  }
};

// Legacy default shortcuts (maintained for backward compatibility)
export const defaultShortcuts = {
  // Tab navigation
  'ctrl+tab': { action: 'nextTab', description: 'Next tab' },
  'ctrl+shift+tab': { action: 'prevTab', description: 'Previous tab' },
  'ctrl+1': { action: 'goToTab', params: { tabIndex: 0 }, description: 'Go to Quick Actions tab' },
  'ctrl+2': { action: 'goToTab', params: { tabIndex: 1 }, description: 'Go to Price Display tab' },
  'ctrl+3': { action: 'goToTab', params: { tabIndex: 2 }, description: 'Go to Market Profile tab' },
  'ctrl+4': { action: 'goToTab', params: { tabIndex: 3 }, description: 'Go to Volatility tab' },
  'ctrl+5': { action: 'goToTab', params: { tabIndex: 4 }, description: 'Go to Layout & Sizing tab' },
  'ctrl+6': { action: 'goToTab', params: { tabIndex: 5 }, description: 'Go to Advanced tab' },

  // Search
  'ctrl+f': { action: 'focusSearch', description: 'Focus search input' },
  'escape': { action: 'clearSearch', description: 'Clear search or close menu' },
  'enter': { action: 'selectSearchResult', description: 'Select highlighted search result' },
  'arrowdown': { action: 'nextSearchResult', description: 'Next search result' },
  'arrowup': { action: 'prevSearchResult', description: 'Previous search result' },

  // Menu actions
  'ctrl+r': { action: 'resetToDefaults', description: 'Reset to defaults' },
  'ctrl+enter': { action: 'applyAndClose', description: 'Apply changes and close' },
  'ctrl+w': { action: 'closeMenu', description: 'Close menu' }
};

/**
 * Register context menu shortcuts with the centralized system
 * @param {Function} onAction - Action handler function
 * @returns {Function} Cleanup function
 */
export function registerContextMenuShortcuts(onAction = () => {}) {
  const cleanupFunctions = [];

  // Register all context menu shortcuts
  Object.entries(contextMenuShortcuts).forEach(([id, config]) => {
    // Map shortcut ID to action
    const actionMap = {
      'contextMenu.nextTab': () => onAction({ action: 'nextTab', keyCombo: 'ctrl+tab' }),
      'contextMenu.prevTab': () => onAction({ action: 'prevTab', keyCombo: 'ctrl+shift+tab' }),
      'contextMenu.goToTab1': () => onAction({ action: 'goToTab', params: { tabIndex: 0 }, keyCombo: 'ctrl+1' }),
      'contextMenu.goToTab2': () => onAction({ action: 'goToTab', params: { tabIndex: 1 }, keyCombo: 'ctrl+2' }),
      'contextMenu.goToTab3': () => onAction({ action: 'goToTab', params: { tabIndex: 2 }, keyCombo: 'ctrl+3' }),
      'contextMenu.goToTab4': () => onAction({ action: 'goToTab', params: { tabIndex: 3 }, keyCombo: 'ctrl+4' }),
      'contextMenu.goToTab5': () => onAction({ action: 'goToTab', params: { tabIndex: 4 }, keyCombo: 'ctrl+5' }),
      'contextMenu.goToTab6': () => onAction({ action: 'goToTab', params: { tabIndex: 5 }, keyCombo: 'ctrl+6' }),
      'contextMenu.focusSearch': () => onAction({ action: 'focusSearch', keyCombo: 'ctrl+f' }),
      'contextMenu.clearSearch': () => onAction({ action: 'clearSearch', keyCombo: 'escape' }),
      'contextMenu.selectSearchResult': () => onAction({ action: 'selectSearchResult', keyCombo: 'enter' }),
      'contextMenu.nextSearchResult': () => onAction({ action: 'nextSearchResult', keyCombo: 'arrowdown' }),
      'contextMenu.prevSearchResult': () => onAction({ action: 'prevSearchResult', keyCombo: 'arrowup' }),
      'contextMenu.resetToDefaults': () => onAction({ action: 'resetToDefaults', keyCombo: 'ctrl+r' }),
      'contextMenu.applyAndClose': () => onAction({ action: 'applyAndClose', keyCombo: 'ctrl+enter' }),
      'contextMenu.closeMenu': () => onAction({ action: 'closeMenu', keyCombo: 'ctrl+w' })
    };

    const action = actionMap[id];
    if (action) {
      keyboardManager.register(id, {
        ...config,
        action,
        preventDefault: true,
        stopPropagation: true
      });
      cleanupFunctions.push(() => keyboardManager.unregister(id));
    }
  });

  // Return cleanup function
  return function cleanup() {
    cleanupFunctions.forEach(cleanup => cleanup());
  };
}

// Create keyboard shortcut handler (legacy - maintained for compatibility)
export function createShortcutHandler(options = {}) {
  const {
    onAction = () => {},
    shortcuts = defaultShortcuts,
    target = document
  } = options;

  let isActive = true;

  // Parse key combination
  function parseKeyCombo(keyCombo) {
    const parts = keyCombo.toLowerCase().split('+');
    const result = {
      ctrl: false,
      shift: false,
      alt: false,
      meta: false,
      key: ''
    };

    parts.forEach(part => {
      switch (part) {
        case 'ctrl':
        case 'control':
          result.ctrl = true;
          break;
        case 'shift':
          result.shift = true;
          break;
        case 'alt':
          result.alt = true;
          break;
        case 'meta':
        case 'cmd':
        case 'command':
          result.meta = true;
          break;
        default:
          result.key = part;
          break;
      }
    });

    return result;
  }

  // Check if event matches key combination
  function matchesKeyCombo(event, keyCombo) {
    const combo = parseKeyCombo(keyCombo);

    return (
      event.ctrlKey === combo.ctrl &&
      event.shiftKey === combo.shift &&
      event.altKey === combo.alt &&
      event.metaKey === combo.meta &&
      event.key.toLowerCase() === combo.key
    );
  }

  // Handle keyboard event
  function handleKeyDown(event) {
    if (!isActive) return;

    // Don't handle shortcuts when typing in input fields (except for specific shortcuts)
    const target = event.target;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';

    // Allow certain shortcuts even when typing in inputs
    const allowedInInputs = ['escape', 'enter', 'arrowdown', 'arrowup', 'ctrl+f', 'ctrl+w'];

    if (isInput) {
      const isAllowed = allowedInInputs.some(shortcut => {
        const combo = parseKeyCombo(shortcut);
        return matchesKeyCombo(event, shortcut);
      });

      if (!isAllowed) return;
    }

    // Find matching shortcut
    for (const [keyCombo, shortcut] of Object.entries(shortcuts)) {
      if (matchesKeyCombo(event, keyCombo)) {
        event.preventDefault();
        event.stopPropagation();

        onAction({
          action: shortcut.action,
          params: shortcut.params || {},
          event,
          keyCombo
        });

        return;
      }
    }
  }

  // Add event listener
  if (target.addEventListener) {
    target.addEventListener('keydown', handleKeyDown, true);
  }

  // Return cleanup function
  return function cleanup() {
    if (target.removeEventListener) {
      target.removeEventListener('keydown', handleKeyDown, true);
    }
    isActive = false;
  };
}

// Get shortcut description
export function getShortcutDescription(action) {
  for (const [keyCombo, shortcut] of Object.entries(defaultShortcuts)) {
    if (shortcut.action === action) {
      return {
        keyCombo,
        description: shortcut.description
      };
    }
  }
  return null;
}

// Format key combo for display
export function formatKeyCombo(keyCombo) {
  const parts = keyCombo.split('+').map(part => {
    switch (part.toLowerCase()) {
      case 'ctrl':
      case 'control':
        return 'Ctrl';
      case 'shift':
        return 'Shift';
      case 'alt':
        return 'Alt';
      case 'meta':
      case 'cmd':
      case 'command':
        return 'Cmd';
      default:
        return part.charAt(0).toUpperCase() + part.slice(1);
    }
  });
  
  return parts.join(' + ');
}

// Get all shortcuts for display
export function getAllShortcuts() {
  return Object.entries(defaultShortcuts).map(([keyCombo, shortcut]) => ({
    keyCombo: formatKeyCombo(keyCombo),
    action: shortcut.action,
    description: shortcut.description,
    params: shortcut.params
  }));
}

// Validate shortcut configuration
export function validateShortcuts(shortcuts) {
  const errors = [];
  const warnings = [];
  
  Object.entries(shortcuts).forEach(([keyCombo, shortcut]) => {
    // Check if shortcut has required properties
    if (!shortcut.action) {
      errors.push(`Shortcut "${keyCombo}" missing action`);
    }
    
    // Check if key combo is valid
    try {
      parseKeyCombo(keyCombo);
    } catch (error) {
      errors.push(`Invalid key combo "${keyCombo}": ${error.message}`);
    }
    
    // Check for potential conflicts
    if (keyCombo.toLowerCase().includes('ctrl+c') || 
        keyCombo.toLowerCase().includes('ctrl+v') ||
        keyCombo.toLowerCase().includes('ctrl+x')) {
      warnings.push(`Shortcut "${keyCombo}" may conflict with system clipboard shortcuts`);
    }
  });
  
  return { errors, warnings };
}

// Merge custom shortcuts with defaults
export function mergeShortcuts(customShortcuts = {}) {
  const merged = { ...defaultShortcuts };
  
  Object.entries(customShortcuts).forEach(([keyCombo, shortcut]) => {
    if (shortcut && shortcut.action) {
      merged[keyCombo] = shortcut;
    }
  });
  
  return merged;
}
