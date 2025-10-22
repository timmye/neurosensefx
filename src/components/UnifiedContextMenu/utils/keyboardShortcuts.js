/**
 * Keyboard shortcuts for the unified context menu
 */

// Default keyboard shortcuts configuration
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

// Create keyboard shortcut handler
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
