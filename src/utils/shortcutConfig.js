/**
 * Keyboard Shortcut Configuration for NeuroSense FX
 *
 * Defines all default shortcuts and provides configuration management
 * following the "Simple, Performant, Maintainable" philosophy.
 */

import { SHORTCUT_CONTEXTS, SHORTCUT_CATEGORIES } from '../actions/keyboardAction.js';

// === COMPREHENSIVE DEBUG LOGGING SYSTEM ===
/**
 * Debug logging helper for shortcut configuration system
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
debugLog('🔧 shortcutConfig.js module loading', { timestamp: Date.now() });

/**
 * Default shortcut definitions for NeuroSense FX
 * Organized by workflow priority and trader needs
 * Frozen to prevent runtime modifications
 */
export const DEFAULT_SHORTCUTS = Object.freeze({
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
	'display.close': {
		key: 'Ctrl+Shift+W',
		description: 'Close current/focused display',
		category: SHORTCUT_CATEGORIES.DISPLAY,
		contexts: [SHORTCUT_CONTEXTS.DISPLAY_FOCUSED],
		priority: 1,
		workflow: 'core',
		implemented: true
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
	}

});

debugLog('📋 DEFAULT_SHORTCUTS defined', {
	totalShortcuts: Object.keys(DEFAULT_SHORTCUTS).length,
	categories: [...new Set(Object.values(DEFAULT_SHORTCUTS).map(s => s.category))],
	contexts: [...new Set(Object.values(DEFAULT_SHORTCUTS).flatMap(s => s.contexts))]
});

/**
 * Workflow priorities for organizing shortcuts
 * Frozen to prevent runtime modifications
 */
export const WORKFLOW_PRIORITIES = Object.freeze({
	CORE: 1,        // Essential trading workflows
	QUICK_ACTIONS: 2, // Common actions during trading
	PROFESSIONAL: 3,  // Advanced features for power users
	SYSTEM: 4        // System and help functions
});

debugLog('📊 WORKFLOW_PRIORITIES defined', { priorities: WORKFLOW_PRIORITIES });

/**
 * Validate shortcut configuration
 * @param {Object} config - Shortcut configuration to validate
 * @returns {Object} Validation result with errors and warnings
 */
export function validateShortcutConfig(config) {
	debugLog('🔍 validateShortcutConfig() called', { configType: typeof config, keysCount: config ? Object.keys(config).length : 0 });

	const errors = [];
	const warnings = [];

	if (!config || typeof config !== 'object') {
		errors.push('Configuration must be an object');
		debugLog('❌ Invalid configuration object', { config, errors }, 'ERROR');
		return { errors, warnings };
	}

	debugLog('🔍 Validating shortcuts configuration', { shortcutCount: Object.keys(config).length });

	Object.entries(config).forEach(([id, shortcut]) => {
		debugLog('🔍 Validating shortcut', { id, hasShortcut: !!shortcut });

		// Validate shortcut ID
		if (!id || typeof id !== 'string') {
			errors.push('Invalid shortcut ID');
			debugLog('❌ Invalid shortcut ID', { id }, 'ERROR');
			return;
		}

		// Validate shortcut object
		if (!shortcut || typeof shortcut !== 'object') {
			errors.push(`Shortcut ${id}: Must be an object`);
			debugLog('❌ Shortcut must be an object', { id, shortcut }, 'ERROR');
			return;
		}

		// Required fields
		if (!shortcut.key || typeof shortcut.key !== 'string') {
			errors.push(`Shortcut ${id}: Missing or invalid key combination`);
			debugLog('❌ Missing or invalid key', { id, key: shortcut.key }, 'ERROR');
		}

		if (!shortcut.description || typeof shortcut.description !== 'string') {
			errors.push(`Shortcut ${id}: Missing or invalid description`);
			debugLog('❌ Missing or invalid description', { id, description: shortcut.description }, 'ERROR');
		}

		// Optional fields with defaults
		if (!shortcut.category) {
			warnings.push(`Shortcut ${id}: Missing category, using 'general'`);
			shortcut.category = 'general';
			debugLog('⚠️ Setting default category', { id, category: shortcut.category });
		}

		if (!shortcut.contexts || !Array.isArray(shortcut.contexts) || shortcut.contexts.length === 0) {
			warnings.push(`Shortcut ${id}: No valid contexts specified, using global`);
			shortcut.contexts = [SHORTCUT_CONTEXTS.GLOBAL];
			debugLog('⚠️ Setting default context', { id, contexts: shortcut.contexts });
		}

		// Key format validation
		if (shortcut.key && !isValidKeyCombo(shortcut.key)) {
			errors.push(`Shortcut ${id}: Invalid key format: ${shortcut.key}`);
			debugLog('❌ Invalid key format', { id, key: shortcut.key }, 'ERROR');
		}

		// Priority validation
		if (shortcut.priority !== undefined && (typeof shortcut.priority !== 'number' || shortcut.priority < 1 || shortcut.priority > 10)) {
			warnings.push(`Shortcut ${id}: Priority should be a number between 1 and 10`);
			debugLog('⚠️ Invalid priority', { id, priority: shortcut.priority });
		}

		// Validate contexts are valid
		if (Array.isArray(shortcut.contexts)) {
			shortcut.contexts.forEach(context => {
				if (!Object.values(SHORTCUT_CONTEXTS).includes(context)) {
					warnings.push(`Shortcut ${id}: Invalid context "${context}"`);
					debugLog('⚠️ Invalid context', { id, context });
				}
			});
		}

		// Validate category is valid
		if (shortcut.category && !Object.values(SHORTCUT_CATEGORIES).includes(shortcut.category)) {
			warnings.push(`Shortcut ${id}: Unknown category "${shortcut.category}"`);
			debugLog('⚠️ Unknown category', { id, category: shortcut.category });
		}

		debugLog('✅ Shortcut validation completed', { id, errors: errors.filter(e => e.includes(id)), warnings: warnings.filter(w => w.includes(id)) });
	});

	const result = { errors, warnings };
	debugLog('📊 Configuration validation completed', {
		totalErrors: errors.length,
		totalWarnings: warnings.length,
		isValid: errors.length === 0
	});

	return result;
}

/**
 * Check if key combination format is valid
 * @param {string} keyCombo - Key combination to validate
 * @returns {boolean} Whether the format is valid
 */
function isValidKeyCombo(keyCombo) {
	debugLog('🔍 isValidKeyCombo() called', { keyCombo, type: typeof keyCombo });

	if (typeof keyCombo !== 'string') {
		debugLog('❌ Key combo is not a string', { keyCombo });
		return false;
	}

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
	debugLog('🔍 Analyzing key combo parts', { parts, totalParts: parts.length });

	// Check modifiers
	const modifiers = parts.filter(part => validModifiers.includes(part));
	const mainKey = parts.find(part => !validModifiers.includes(part));

	debugLog('🔍 Key combo analysis', { modifiers, mainKey, validMainKey: validKeys.includes(mainKey) });

	if (!mainKey || !validKeys.includes(mainKey)) {
		debugLog('❌ Invalid main key', { mainKey, isValid: validKeys.includes(mainKey) });
		return false;
	}

	// Single key shortcuts (should be avoided for most cases)
	if (parts.length === 1 && !['escape', 'space', 'tab', 'enter'].includes(mainKey)) {
		debugLog('❌ Single letter key not allowed', { mainKey });
		return false; // Single letters should be avoided
	}

	debugLog('✅ Key combo is valid', { keyCombo, modifiers, mainKey });
	return true;
}

/**
 * Check for conflicts between shortcuts
 * @param {Object} shortcuts - Shortcuts to check for conflicts
 * @returns {Array} Array of conflict descriptions
 */
export function findShortcutConflicts(shortcuts) {
	debugLog('🔍 findShortcutConflicts() called', { shortcutsCount: shortcuts ? Object.keys(shortcuts).length : 0 });

	const conflicts = [];
	const keyMap = new Map();

	if (!shortcuts || typeof shortcuts !== 'object') {
		debugLog('❌ Invalid shortcuts object provided');
		return conflicts;
	}

	debugLog('🔍 Analyzing shortcuts for conflicts');

	Object.entries(shortcuts).forEach(([id, shortcut]) => {
		if (!shortcut || !shortcut.key) {
			debugLog('⚠️ Skipping invalid shortcut', { id, hasShortcut: !!shortcut, hasKey: !!(shortcut?.key) });
			return;
		}

		const normalizedKey = shortcut.key.toLowerCase();
		debugLog('🔍 Checking key for conflicts', { id, key: shortcut.key, normalizedKey });

		if (keyMap.has(normalizedKey)) {
			const existingId = keyMap.get(normalizedKey);
			const conflict = `Key conflict: "${shortcut.key}" used by both "${id}" and "${existingId}"`;
			conflicts.push(conflict);
			debugLog('⚠️ Key conflict detected', {
				key: shortcut.key,
				normalizedKey,
				newId: id,
				existingId,
				conflict
			});
		} else {
			keyMap.set(normalizedKey, id);
			debugLog('✅ Key registered successfully', { id, normalizedKey });
		}
	});

	debugLog('📊 Conflict analysis completed', {
		totalShortcuts: Object.keys(shortcuts).length,
		uniqueKeys: keyMap.size,
		conflictsFound: conflicts.length,
		conflictDetails: conflicts
	});

	return conflicts;
}

/**
 * Get shortcuts by category
 * @param {string} category - Category to filter by
 * @returns {Object} Filtered shortcuts object
 */
export function getShortcutsByCategory(category) {
	debugLog('🔍 getShortcutsByCategory() called', { category });

	const result = {};
	Object.entries(DEFAULT_SHORTCUTS).forEach(([id, shortcut]) => {
		if (shortcut.category === category) {
			result[id] = shortcut;
			debugLog('✅ Found shortcut in category', { id, shortcutKey: shortcut.key });
		}
	});

	debugLog('📊 Category filtering completed', {
		category,
		totalShortcuts: Object.keys(DEFAULT_SHORTCUTS).length,
		matchedShortcuts: Object.keys(result).length,
		matchedIds: Object.keys(result)
	});

	return result;
}

/**
 * Get shortcuts by workflow
 * @param {string} workflow - Workflow to filter by
 * @returns {Object} Filtered shortcuts object
 */
export function getShortcutsByWorkflow(workflow) {
	debugLog('🔍 getShortcutsByWorkflow() called', { workflow });

	const result = {};
	Object.entries(DEFAULT_SHORTCUTS).forEach(([id, shortcut]) => {
		if (shortcut.workflow === workflow) {
			result[id] = shortcut;
			debugLog('✅ Found shortcut in workflow', { id, shortcutKey: shortcut.key });
		}
	});

	debugLog('📊 Workflow filtering completed', {
		workflow,
		totalShortcuts: Object.keys(DEFAULT_SHORTCUTS).length,
		matchedShortcuts: Object.keys(result).length,
		matchedIds: Object.keys(result)
	});

	return result;
}

/**
 * Sort shortcuts by priority
 * @param {Array} shortcuts - Array of shortcut objects
 * @returns {Array} Sorted shortcuts array
 */
export function sortShortcutsByPriority(shortcuts) {
	debugLog('🔍 sortShortcutsByPriority() called', { shortcutsCount: shortcuts ? shortcuts.length : 0 });

	if (!Array.isArray(shortcuts)) {
		debugLog('❌ Invalid shortcuts array provided');
		return [];
	}

	const sorted = shortcuts.sort((a, b) => (a.priority || 10) - (b.priority || 10));
	debugLog('✅ Shortcuts sorted by priority', {
		beforeSort: shortcuts.map(s => ({ id: s.id, priority: s.priority })),
		afterSort: sorted.map(s => ({ id: s.id, priority: s.priority }))
	});

	return sorted;
}

/**
 * Get user-friendly key display format
 * @param {string} keyCombo - Internal key combination format
 * @returns {string} User-friendly display format
 */
export function formatKeyForDisplay(keyCombo) {
	debugLog('🎨 formatKeyForDisplay() called', { keyCombo, type: typeof keyCombo });

	if (!keyCombo || typeof keyCombo !== 'string') {
		debugLog('⚠️ Invalid key combo provided, returning empty string');
		return '';
	}

	const parts = keyCombo.toLowerCase().split('+');
	debugLog('🔍 Processing key parts', { parts });

	const displayParts = parts.map(part => {
		let displayPart;
		switch (part) {
			case 'ctrl': displayPart = 'Ctrl'; break;
			case 'alt': displayPart = 'Alt'; break;
			case 'shift': displayPart = 'Shift'; break;
			case 'meta': displayPart = '⌘'; break;
			case 'space': displayPart = 'Space'; break;
			case 'escape': displayPart = 'Esc'; break;
			case 'tab': displayPart = 'Tab'; break;
			case 'enter': displayPart = 'Enter'; break;
			case 'backspace': displayPart = 'Backspace'; break;
			case 'delete': displayPart = 'Delete'; break;
			case 'home': displayPart = 'Home'; break;
			case 'end': displayPart = 'End'; break;
			case 'pageup': displayPart = 'Page Up'; break;
			case 'pagedown': displayPart = 'Page Down'; break;
			case 'arrowup': displayPart = '↑'; break;
			case 'arrowdown': displayPart = '↓'; break;
			case 'arrowleft': displayPart = '←'; break;
			case 'arrowright': displayPart = '→'; break;
			case 'insert': displayPart = 'Insert'; break;
			case 'pause': displayPart = 'Pause'; break;
			case 'scrolllock': displayPart = 'Scroll Lock'; break;
			case 'numlock': displayPart = 'Num Lock'; break;
			case 'capslock': displayPart = 'Caps Lock'; break;
			// Function keys
			case 'f1': case 'f2': case 'f3': case 'f4': case 'f5':
			case 'f6': case 'f7': case 'f8': case 'f9': case 'f10':
			case 'f11': case 'f12':
				displayPart = part.toUpperCase();
				break;
			default:
				// Handle single letters and numbers
				if (part.length === 1 && /[a-z0-9]/.test(part)) {
					displayPart = part.toUpperCase();
				} else {
					// Handle other cases
					displayPart = part.charAt(0).toUpperCase() + part.slice(1);
				}
		}
		debugLog('🔤 Key part formatted', { original: part, formatted: displayPart });
		return displayPart;
	});

	const result = displayParts.join(' + ');
	debugLog('✅ Key combo formatted for display', { original: keyCombo, formatted: result });

	return result;
}

/**
 * Export default shortcuts for external use
 */
export default DEFAULT_SHORTCUTS;

// Final module completion log
debugLog('✅ shortcutConfig.js module fully loaded and ready', {
	exportedFunctions: [
		'DEFAULT_SHORTCUTS',
		'WORKFLOW_PRIORITIES',
		'validateShortcutConfig',
		'findShortcutConflicts',
		'getShortcutsByCategory',
		'getShortcutsByWorkflow',
		'sortShortcutsByPriority',
		'formatKeyForDisplay',
		'default export (DEFAULT_SHORTCUTS)'
	],
	totalDefaultShortcuts: Object.keys(DEFAULT_SHORTCUTS).length
});