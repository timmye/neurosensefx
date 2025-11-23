/**
 * Keyboard Shortcut Configuration for NeuroSense FX
 *
 * Defines all default shortcuts and provides configuration management
 * following the "Simple, Performant, Maintainable" philosophy.
 */

import { SHORTCUT_CONTEXTS, SHORTCUT_CATEGORIES } from './keyboardShortcutManager.js';

/**
 * Default shortcut definitions for NeuroSense FX
 * Organized by workflow priority and trader needs
 */
export const DEFAULT_SHORTCUTS = {
	// === SYMBOL WORKFLOW (Phase 1 - Highest Priority) ===
	'symbol.focusPalette': {
		key: 'Ctrl+K',
		description: 'Focus symbol palette search',
		category: SHORTCUT_CATEGORIES.SYMBOL,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 1,
		workflow: 'core',
		implemented: true
	},
	'symbol.togglePalette': {
		key: 'Ctrl+Shift+K',
		description: 'Toggle symbol palette visibility',
		category: SHORTCUT_CATEGORIES.SYMBOL,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 1,
		workflow: 'core',
		implemented: true
	},
	'symbol.quickSubscribe': {
		key: 'Ctrl+Enter',
		description: 'Subscribe to highlighted symbol',
		category: SHORTCUT_CATEGORIES.SYMBOL,
		contexts: [SHORTCUT_CONTEXTS.SYMBOL_PALETTE],
		priority: 1,
		workflow: 'core',
		implemented: false
	},
	'symbol.quickSubscribeNew': {
		key: 'Ctrl+Shift+Enter',
		description: 'Subscribe in new display',
		category: SHORTCUT_CATEGORIES.SYMBOL,
		contexts: [SHORTCUT_CONTEXTS.SYMBOL_PALETTE],
		priority: 1,
		workflow: 'core',
		implemented: false
	},
	'symbol.recentCycle': {
		key: 'Ctrl+R',
		description: 'Cycle through recent symbols',
		category: SHORTCUT_CATEGORIES.SYMBOL,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 2,
		workflow: 'enhanced',
		implemented: false
	},
	'symbol.favorites': {
		key: 'Ctrl+,',
		description: 'Show symbol favorites/quick access',
		category: SHORTCUT_CATEGORIES.SYMBOL,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 2,
		workflow: 'enhanced',
		implemented: false
	},

	// === DISPLAY NAVIGATION (Phase 1 - Highest Priority) ===
	'display.switch1': {
		key: 'Ctrl+1',
		description: 'Switch to display 1',
		category: SHORTCUT_CATEGORIES.NAVIGATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 1,
		workflow: 'core',
		implemented: true
	},
	'display.switch2': {
		key: 'Ctrl+2',
		description: 'Switch to display 2',
		category: SHORTCUT_CATEGORIES.NAVIGATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 1,
		workflow: 'core',
		implemented: true
	},
	'display.switch3': {
		key: 'Ctrl+3',
		description: 'Switch to display 3',
		category: SHORTCUT_CATEGORIES.NAVIGATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 1,
		workflow: 'core',
		implemented: true
	},
	'display.switch4': {
		key: 'Ctrl+4',
		description: 'Switch to display 4',
		category: SHORTCUT_CATEGORIES.NAVIGATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 1,
		workflow: 'core'
	},
	'display.switch5': {
		key: 'Ctrl+5',
		description: 'Switch to display 5',
		category: SHORTCUT_CATEGORIES.NAVIGATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 1,
		workflow: 'core'
	},
	'display.switch6': {
		key: 'Ctrl+6',
		description: 'Switch to display 6',
		category: SHORTCUT_CATEGORIES.NAVIGATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 1,
		workflow: 'core'
	},
	'display.switch7': {
		key: 'Ctrl+7',
		description: 'Switch to display 7',
		category: SHORTCUT_CATEGORIES.NAVIGATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 1,
		workflow: 'core'
	},
	'display.switch8': {
		key: 'Ctrl+8',
		description: 'Switch to display 8',
		category: SHORTCUT_CATEGORIES.NAVIGATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 1,
		workflow: 'core'
	},
	'display.switch9': {
		key: 'Ctrl+9',
		description: 'Switch to display 9',
		category: SHORTCUT_CATEGORIES.NAVIGATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 1,
		workflow: 'core'
	},
	'display.next': {
		key: 'Ctrl+Tab',
		description: 'Next display',
		category: SHORTCUT_CATEGORIES.NAVIGATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 1,
		workflow: 'core'
	},
	'display.previous': {
		key: 'Ctrl+Shift+Tab',
		description: 'Previous display',
		category: SHORTCUT_CATEGORIES.NAVIGATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 1,
		workflow: 'core'
	},
	'display.navigateRight': {
		key: 'Alt+ArrowRight',
		description: 'Navigate to display on the right',
		category: SHORTCUT_CATEGORIES.NAVIGATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 2,
		workflow: 'enhanced'
	},
	'display.navigateLeft': {
		key: 'Alt+ArrowLeft',
		description: 'Navigate to display on the left',
		category: SHORTCUT_CATEGORIES.NAVIGATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 2,
		workflow: 'enhanced'
	},
	'display.navigateUp': {
		key: 'Alt+ArrowUp',
		description: 'Navigate to display above',
		category: SHORTCUT_CATEGORIES.NAVIGATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 2,
		workflow: 'enhanced'
	},
	'display.navigateDown': {
		key: 'Alt+ArrowDown',
		description: 'Navigate to display below',
		category: SHORTCUT_CATEGORIES.NAVIGATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 2,
		workflow: 'enhanced'
	},

	// === QUICK ACTIONS (Phase 2) ===
	'quick.contextMenu': {
		key: 'Ctrl+.',
		description: 'Open context menu for focused display',
		category: SHORTCUT_CATEGORIES.CONFIGURATION,
		contexts: [SHORTCUT_CONTEXTS.DISPLAY_FOCUSED],
		priority: 2,
		workflow: 'quick-actions'
	},
	'quick.configPanel': {
		key: 'Ctrl+;',
		description: 'Quick configuration panel',
		category: SHORTCUT_CATEGORIES.CONFIGURATION,
		contexts: [SHORTCUT_CONTEXTS.DISPLAY_FOCUSED],
		priority: 2,
		workflow: 'quick-actions'
	},
	'quick.pauseUpdates': {
		key: 'Space',
		description: 'Pause/resume data updates',
		category: SHORTCUT_CATEGORIES.SYSTEM,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 2,
		workflow: 'quick-actions'
	},
	'quick.fullscreen': {
		key: 'f',
		description: 'Toggle fullscreen for focused display',
		category: SHORTCUT_CATEGORIES.DISPLAY,
		contexts: [SHORTCUT_CONTEXTS.DISPLAY_FOCUSED],
		priority: 2,
		workflow: 'quick-actions'
	},
	'quick.addMarker': {
		key: 'm',
		description: 'Add price marker at current position',
		category: SHORTCUT_CATEGORIES.DISPLAY,
		contexts: [SHORTCUT_CONTEXTS.DISPLAY_FOCUSED],
		priority: 2,
		workflow: 'quick-actions'
	},
	'quick.clearMarkers': {
		key: 'c',
		description: 'Clear temporary markers/analysis',
		category: SHORTCUT_CATEGORIES.DISPLAY,
		contexts: [SHORTCUT_CONTEXTS.DISPLAY_FOCUSED],
		priority: 2,
		workflow: 'quick-actions'
	},

	// === PROFESSIONAL FEATURES (Phase 3) ===
	'pro.layoutPreset1': {
		key: 'Ctrl+Alt+1',
		description: 'Apply layout preset 1',
		category: SHORTCUT_CATEGORIES.CONFIGURATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 3,
		workflow: 'professional'
	},
	'pro.layoutPreset2': {
		key: 'Ctrl+Alt+2',
		description: 'Apply layout preset 2',
		category: SHORTCUT_CATEGORIES.CONFIGURATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 3,
		workflow: 'professional'
	},
	'pro.layoutPreset3': {
		key: 'Ctrl+Alt+3',
		description: 'Apply layout preset 3',
		category: SHORTCUT_CATEGORIES.CONFIGURATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 3,
		workflow: 'professional'
	},
	'pro.groupDisplays': {
		key: 'Ctrl+G',
		description: 'Group selected displays',
		category: SHORTCUT_CATEGORIES.CONFIGURATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 3,
		workflow: 'professional'
	},
	'pro.ungroupDisplays': {
		key: 'Ctrl+Shift+G',
		description: 'Ungroup displays',
		category: SHORTCUT_CATEGORIES.CONFIGURATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 3,
		workflow: 'professional'
	},
	'pro.saveLayout': {
		key: 'Ctrl+Alt+L',
		description: 'Save current layout as preset',
		category: SHORTCUT_CATEGORIES.CONFIGURATION,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 3,
		workflow: 'professional'
	},

	// === SYSTEM & HELP (Phase 4) ===
	'system.help': {
		key: 'Ctrl+/',
		description: 'Show keyboard shortcut help',
		category: SHORTCUT_CATEGORIES.SYSTEM,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 4,
		workflow: 'system',
		implemented: true
	},
	'system.statusPanel': {
		key: 'F1',
		description: 'Toggle status panel expanded/collapsed',
		category: SHORTCUT_CATEGORIES.SYSTEM,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 4,
		workflow: 'system'
	},
	'system.performanceMonitor': {
		key: 'F2',
		description: 'Toggle performance monitor',
		category: SHORTCUT_CATEGORIES.SYSTEM,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 4,
		workflow: 'system'
	},
	'system.screenshot': {
		key: 'Ctrl+Alt+S',
		description: 'Screenshot current workspace',
		category: SHORTCUT_CATEGORIES.SYSTEM,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 4,
		workflow: 'system'
	},
	'system.saveWorkspace': {
		key: 'Ctrl+Shift+S',
		description: 'Save workspace state',
		category: SHORTCUT_CATEGORIES.SYSTEM,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 4,
		workflow: 'system'
	},
	'system.escape': {
		key: 'Escape',
		description: 'Close menus/collapse panels',
		category: SHORTCUT_CATEGORIES.SYSTEM,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 4,
		workflow: 'system',
		implemented: true
	},

	// === EXISTING SHORTCUTS (to be migrated) ===
	'legacy.newDisplay': {
		key: 'Ctrl+N',
		description: 'Create new display',
		category: SHORTCUT_CATEGORIES.DISPLAY,
		contexts: [SHORTCUT_CONTEXTS.GLOBAL],
		priority: 1,
		workflow: 'legacy'
	}
};

/**
 * Workflow priorities for organizing shortcuts
 */
export const WORKFLOW_PRIORITIES = {
	CORE: 1,        // Essential trading workflows
	QUICK_ACTIONS: 2, // Common actions during trading
	PROFESSIONAL: 3,  // Advanced features for power users
	SYSTEM: 4        // System and help functions
};

/**
 * Validate shortcut configuration
 * @param {Object} config - Shortcut configuration to validate
 * @returns {Object} Validation result with errors and warnings
 */
export function validateShortcutConfig(config) {
	const errors = [];
	const warnings = [];

	Object.entries(config).forEach(([id, shortcut]) => {
		// Required fields
		if (!shortcut.key) {
			errors.push(`Shortcut ${id}: Missing key combination`);
		}

		if (!shortcut.description) {
			errors.push(`Shortcut ${id}: Missing description`);
		}

		if (!shortcut.category) {
			warnings.push(`Shortcut ${id}: Missing category, using 'general'`);
			shortcut.category = 'general';
		}

		if (!shortcut.contexts || shortcut.contexts.length === 0) {
			warnings.push(`Shortcut ${id}: No contexts specified, using global`);
			shortcut.contexts = [SHORTCUT_CONTEXTS.GLOBAL];
		}

		// Key format validation
		if (shortcut.key && !isValidKeyCombo(shortcut.key)) {
			errors.push(`Shortcut ${id}: Invalid key format: ${shortcut.key}`);
		}

		// Priority validation
		if (shortcut.priority && (shortcut.priority < 1 || shortcut.priority > 10)) {
			warnings.push(`Shortcut ${id}: Priority should be between 1 and 10`);
		}
	});

	return { errors, warnings };
}

/**
 * Check if key combination format is valid
 * @param {string} keyCombo - Key combination to validate
 * @returns {boolean} Whether the format is valid
 */
function isValidKeyCombo(keyCombo) {
	if (typeof keyCombo !== 'string') return false;

	const validModifiers = ['ctrl', 'alt', 'shift', 'meta'];
	const validKeys = [
		'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
		'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
		'0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
		'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
		'space', 'tab', 'enter', 'escape',
		'up', 'down', 'left', 'right',
		'backspace', 'delete', 'home', 'end', 'pageup', 'pagedown',
		'insert', 'pause', 'scrolllock', 'numlock'
	];

	const parts = keyCombo.toLowerCase().split('+');

	// Check modifiers
	const modifiers = parts.filter(part => validModifiers.includes(part));
	const mainKey = parts.find(part => !validModifiers.includes(part));

	if (!mainKey || !validKeys.includes(mainKey)) {
		return false;
	}

	// Single key shortcuts (should be avoided for most cases)
	if (parts.length === 1 && !['escape', 'space', 'tab', 'enter'].includes(mainKey)) {
		return false; // Single letters should be avoided
	}

	return true;
}

/**
 * Check for conflicts between shortcuts
 * @param {Object} shortcuts - Shortcuts to check for conflicts
 * @returns {Array} Array of conflict descriptions
 */
export function findShortcutConflicts(shortcuts) {
	const conflicts = [];
	const keyMap = new Map();

	Object.entries(shortcuts).forEach(([id, shortcut]) => {
		const normalizedKey = shortcut.key.toLowerCase();
		if (keyMap.has(normalizedKey)) {
			const existingId = keyMap.get(normalizedKey);
			conflicts.push(
				`Key conflict: "${shortcut.key}" used by both "${id}" and "${existingId}"`
			);
		} else {
			keyMap.set(normalizedKey, id);
		}
	});

	return conflicts;
}

/**
 * Get shortcuts by category
 * @param {string} category - Category to filter by
 * @returns {Object} Filtered shortcuts object
 */
export function getShortcutsByCategory(category) {
	const result = {};
	Object.entries(DEFAULT_SHORTCUTS).forEach(([id, shortcut]) => {
		if (shortcut.category === category) {
			result[id] = shortcut;
		}
	});
	return result;
}

/**
 * Get shortcuts by workflow
 * @param {string} workflow - Workflow to filter by
 * @returns {Object} Filtered shortcuts object
 */
export function getShortcutsByWorkflow(workflow) {
	const result = {};
	Object.entries(DEFAULT_SHORTCUTS).forEach(([id, shortcut]) => {
		if (shortcut.workflow === workflow) {
			result[id] = shortcut;
		}
	});
	return result;
}

/**
 * Sort shortcuts by priority
 * @param {Array} shortcuts - Array of shortcut objects
 * @returns {Array} Sorted shortcuts array
 */
export function sortShortcutsByPriority(shortcuts) {
	return shortcuts.sort((a, b) => (a.priority || 10) - (b.priority || 10));
}

/**
 * Get user-friendly key display format
 * @param {string} keyCombo - Internal key combination format
 * @returns {string} User-friendly display format
 */
export function formatKeyForDisplay(keyCombo) {
	const parts = keyCombo.toLowerCase().split('+');
	const displayParts = parts.map(part => {
		switch (part) {
			case 'ctrl': return 'Ctrl';
			case 'alt': return 'Alt';
			case 'shift': return 'Shift';
			case 'meta': return 'Cmd';
			case 'space': return 'Space';
			case 'escape': return 'Esc';
			case 'arrowup': return '↑';
			case 'arrowdown': return '↓';
			case 'arrowleft': return '←';
			case 'arrowright': return '→';
			default: return part.toUpperCase();
		}
	});

	return displayParts.join(' + ');
}

/**
 * Export default shortcuts for external use
 */
export default DEFAULT_SHORTCUTS;