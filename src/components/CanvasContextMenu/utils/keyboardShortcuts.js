/**
 * Keyboard shortcut utilities for the CanvasContextMenu component
 */

/**
 * Default keyboard shortcuts configuration
 */
export const defaultShortcuts = {
  // Navigation shortcuts
  'ctrl+tab': { action: 'nextTab', description: 'Switch to next tab' },
  'ctrl+shift+tab': { action: 'prevTab', description: 'Switch to previous tab' },
  'ctrl+1': { action: 'goToTab', params: { tabIndex: 0 }, description: 'Go to Quick Actions tab' },
  'ctrl+2': { action: 'goToTab', params: { tabIndex: 1 }, description: 'Go to Price Display tab' },
  'ctrl+3': { action: 'goToTab', params: { tabIndex: 2 }, description: 'Go to Market Profile tab' },
  'ctrl+4': { action: 'goToTab', params: { tabIndex: 3 }, description: 'Go to Volatility tab' },
  'ctrl+5': { action: 'goToTab', params: { tabIndex: 4 }, description: 'Go to Layout & Sizing tab' },
  'ctrl+6': { action: 'goToTab', params: { tabIndex: 5 }, description: 'Go to Advanced tab' },
  
  // Search shortcuts
  'ctrl+f': { action: 'focusSearch', description: 'Focus search input' },
  '/': { action: 'focusSearch', description: 'Focus search input' },
  'escape': { action: 'clearSearch', description: 'Clear search and close context menu' },
  'enter': { action: 'selectSearchResult', description: 'Select highlighted search result' },
  'arrowdown': { action: 'nextSearchResult', description: 'Select next search result' },
  'arrowup': { action: 'prevSearchResult', description: 'Select previous search result' },
  
  // Control shortcuts
  'ctrl+r': { action: 'resetToDefaults', description: 'Reset all settings to defaults' },
  'ctrl+s': { action: 'saveSettings', description: 'Save current settings' },
  'ctrl+z': { action: 'undo', description: 'Undo last change' },
  'ctrl+y': { action: 'redo', description: 'Redo last change' },
  
  // Parameter shortcuts
  'space': { action: 'toggleFocused', description: 'Toggle focused checkbox parameter' },
  'arrowright': { action: 'increaseValue', description: 'Increase focused range value' },
  'arrowleft': { action: 'decreaseValue', description: 'Decrease focused range value' },
  'home': { action: 'minValue', description: 'Set focused range to minimum value' },
  'end': { action: 'maxValue', description: 'Set focused range to maximum value' },
  
  // Menu shortcuts
  'escape': { action: 'closeMenu', description: 'Close context menu' },
  'ctrl+enter': { action: 'applyAndClose', description: 'Apply changes and close menu' }
};

/**
 * Normalize key combination string to a consistent format
 * @param {string} combo - Key combination (e.g., "Ctrl+Shift+A")
 * @returns {string} - Normalized key combination
 */
export const normalizeKeyCombo = (combo) => {
  return combo
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace('ctrl', 'ctrl')
    .replace('alt', 'alt')
    .replace('shift', 'shift')
    .replace('meta', 'meta')
    .replace('command', 'meta')
    .replace('cmd', 'meta');
};

/**
 * Parse keyboard event to create normalized key combination
 * @param {KeyboardEvent} event - Keyboard event
 * @returns {string} - Normalized key combination
 */
export const parseKeyEvent = (event) => {
  const parts = [];
  
  if (event.ctrlKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  if (event.metaKey) parts.push('meta');
  
  // Handle special keys
  let key = event.key.toLowerCase();
  const specialKeys = {
    ' ': 'space',
    'escape': 'escape',
    'enter': 'enter',
    'tab': 'tab',
    'backspace': 'backspace',
    'delete': 'delete',
    'arrowup': 'arrowup',
    'arrowdown': 'arrowdown',
    'arrowleft': 'arrowleft',
    'arrowright': 'arrowright',
    'home': 'home',
    'end': 'end',
    'pageup': 'pageup',
    'pagedown': 'pagedown'
  };
  
  if (specialKeys[key]) {
    parts.push(specialKeys[key]);
  } else if (key.length === 1) {
    parts.push(key);
  }
  
  return parts.join('+');
};

/**
 * Check if a key combination matches a shortcut pattern
 * @param {string} eventCombo - Key combination from event
 * @param {string} shortcutCombo - Shortcut pattern to match
 * @returns {boolean} - True if combinations match
 */
export const matchesShortcut = (eventCombo, shortcutCombo) => {
  return normalizeKeyCombo(eventCombo) === normalizeKeyCombo(shortcutCombo);
};

/**
 * Find matching shortcut for a keyboard event
 * @param {KeyboardEvent} event - Keyboard event
 * @param {Object} shortcuts - Shortcuts configuration (optional)
 * @returns {Object|null} - Matching shortcut or null
 */
export const findMatchingShortcut = (event, shortcuts = defaultShortcuts) => {
  const eventCombo = parseKeyEvent(event);
  
  for (const [combo, config] of Object.entries(shortcuts)) {
    if (matchesShortcut(eventCombo, combo)) {
      return { combo, ...config };
    }
  }
  
  return null;
};

/**
 * Create a keyboard shortcut handler
 * @param {Object} options - Handler options
 * @param {Function} options.onAction - Action callback function
 * @param {Object} options.shortcuts - Custom shortcuts (uses defaults if not provided)
 * @param {HTMLElement} options.target - Target element (document if not provided)
 * @returns {Function} - Cleanup function to remove event listeners
 */
export const createShortcutHandler = ({
  onAction,
  shortcuts = defaultShortcuts,
  target = document
} = {}) => {
  const handleKeyDown = (event) => {
    // Ignore if in input field unless it's specifically allowed
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      const allowedInInput = ['escape', 'enter', 'tab', 'arrowup', 'arrowdown'];
      if (!allowedInInput.includes(event.key.toLowerCase())) {
        return;
      }
    }
    
    const shortcut = findMatchingShortcut(event, shortcuts);
    
    if (shortcut) {
      event.preventDefault();
      event.stopPropagation();
      
      if (onAction && typeof onAction === 'function') {
        onAction({
          action: shortcut.action,
          params: shortcut.params || {},
          event,
          shortcut: shortcut.combo
        });
      }
    }
  };
  
  target.addEventListener('keydown', handleKeyDown);
  
  // Return cleanup function
  return () => {
    target.removeEventListener('keydown', handleKeyDown);
  };
};

/**
 * Get a list of all shortcuts with descriptions
 * @param {Object} shortcuts - Shortcuts configuration
 * @returns {Array} - Array of shortcut information
 */
export const getShortcutList = (shortcuts = defaultShortcuts) => {
  return Object.entries(shortcuts).map(([combo, config]) => ({
    combo: combo.replace(/\+/g, ' + ').replace(/\b\w/g, l => l.toUpperCase()),
    action: config.action,
    description: config.description,
    params: config.params
  })).sort((a, b) => a.action.localeCompare(b.action));
};

/**
 * Group shortcuts by action category
 * @param {Object} shortcuts - Shortcuts configuration
 * @returns {Object} - Grouped shortcuts
 */
export const getGroupedShortcuts = (shortcuts = defaultShortcuts) => {
  const groups = {
    navigation: [],
    search: [],
    control: [],
    parameter: [],
    menu: []
  };
  
  Object.entries(shortcuts).forEach(([combo, config]) => {
    const shortcutInfo = {
      combo: combo.replace(/\+/g, ' + ').replace(/\b\w/g, l => l.toUpperCase()),
      action: config.action,
      description: config.description,
      params: config.params
    };
    
    // Categorize by action
    if (config.action.includes('Tab') || config.action.includes('goTo')) {
      groups.navigation.push(shortcutInfo);
    } else if (config.action.includes('Search')) {
      groups.search.push(shortcutInfo);
    } else if (['resetToDefaults', 'saveSettings', 'undo', 'redo'].includes(config.action)) {
      groups.control.push(shortcutInfo);
    } else if (config.action.includes('Value') || config.action === 'toggleFocused') {
      groups.parameter.push(shortcutInfo);
    } else {
      groups.menu.push(shortcutInfo);
    }
  });
  
  return groups;
};

/**
 * Validate shortcuts configuration
 * @param {Object} shortcuts - Shortcuts to validate
 * @returns {Object} - Validation result
 */
export const validateShortcuts = (shortcuts) => {
  const errors = [];
  const warnings = [];
  const combos = new Set();
  
  Object.entries(shortcuts).forEach(([combo, config]) => {
    // Check for invalid combos
    if (!combo || typeof combo !== 'string') {
      errors.push(`Invalid key combination: ${combo}`);
      return;
    }
    
    // Check for duplicate combos
    const normalizedCombo = normalizeKeyCombo(combo);
    if (combos.has(normalizedCombo)) {
      errors.push(`Duplicate key combination: ${combo}`);
    } else {
      combos.add(normalizedCombo);
    }
    
    // Check config structure
    if (!config || typeof config !== 'object') {
      errors.push(`Invalid config for combo: ${combo}`);
      return;
    }
    
    if (!config.action || typeof config.action !== 'string') {
      errors.push(`Missing or invalid action for combo: ${combo}`);
    }
    
    if (!config.description || typeof config.description !== 'string') {
      warnings.push(`Missing description for combo: ${combo}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalShortcuts: Object.keys(shortcuts).length
  };
};

/**
 * Create a customizable shortcuts manager
 * @param {Object} options - Manager options
 * @returns {Object} - Shortcuts manager instance
 */
export const createShortcutsManager = (options = {}) => {
  const shortcuts = { ...defaultShortcuts, ...options.customShortcuts };
  const listeners = new Set();
  let cleanupHandler = null;
  
  const addActionListener = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  
  const removeActionListener = (listener) => {
    listeners.delete(listener);
  };
  
  const notifyListeners = (actionData) => {
    listeners.forEach(listener => {
      try {
        listener(actionData);
      } catch (error) {
        console.error('Error in shortcut listener:', error);
      }
    });
  };
  
  const start = (target = document) => {
    if (cleanupHandler) {
      cleanupHandler();
    }
    
    cleanupHandler = createShortcutHandler({
      onAction: notifyListeners,
      shortcuts,
      target
    });
  };
  
  const stop = () => {
    if (cleanupHandler) {
      cleanupHandler();
      cleanupHandler = null;
    }
  };
  
  const updateShortcuts = (newShortcuts) => {
    Object.assign(shortcuts, newShortcuts);
  };
  
  const resetToDefaults = () => {
    Object.keys(shortcuts).forEach(key => delete shortcuts[key]);
    Object.assign(shortcuts, defaultShortcuts);
  };
  
  const getValidation = () => validateShortcuts(shortcuts);
  
  return {
    addActionListener,
    removeActionListener,
    start,
    stop,
    updateShortcuts,
    resetToDefaults,
    getValidation,
    getShortcuts: () => ({ ...shortcuts }),
    getShortcutList: () => getShortcutList(shortcuts),
    getGroupedShortcuts: () => getGroupedShortcuts(shortcuts)
  };
};