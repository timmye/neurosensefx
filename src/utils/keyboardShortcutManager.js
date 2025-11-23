/**
 * Centralized Keyboard Shortcut Manager for NeuroSense FX
 *
 * Provides unified keyboard shortcut handling following Svelte-first patterns
 * and the "Simple, Performant, Maintainable" technical philosophy.
 */

import { writable, derived } from 'svelte/store';

// Event management for keyboard shortcuts
export class KeyboardShortcutManager {
	constructor() {
		this.shortcuts = new Map();
		this.contexts = new Map();
		this.activeContext = 'global';
		this.isEnabled = true;
		this.eventListeners = new Set();

		// Store for reactive shortcut state
		this.store = writable({
			shortcuts: {},
			activeContext: 'global',
			isEnabled: true,
			lastTriggered: null
		});
	}

	/**
	 * Register a new keyboard shortcut
	 * @param {string} id - Unique identifier for the shortcut
	 * @param {Object} config - Shortcut configuration
	 * @param {string} config.key - Key combination (e.g., 'Ctrl+K')
	 * @param {Function} config.action - Action to execute
	 * @param {string} config.description - Human readable description
	 * @param {string} config.category - Category for organization (e.g., 'navigation', 'symbol')
	 * @param {Array<string>} config.contexts - Contexts where shortcut is active
	 * @param {Function} config.condition - Optional condition function
	 */
	register(id, config) {
		const normalizedKey = this.normalizeKeyCombo(config.key);

		const shortcut = {
			id,
			key: normalizedKey,
			action: config.action,
			description: config.description || id,
			category: config.category || 'general',
			contexts: config.contexts || ['global'],
			condition: config.condition || (() => true),
			preventDefault: config.preventDefault !== false,
			stopPropagation: config.stopPropagation !== false
		};

		this.shortcuts.set(id, shortcut);
		this.updateStore();
	}

	/**
	 * Unregister a keyboard shortcut
	 * @param {string} id - Shortcut identifier to remove
	 */
	unregister(id) {
		this.shortcuts.delete(id);
		this.updateStore();
	}

	/**
	 * Set active context for shortcuts
	 * @param {string} context - Context name (e.g., 'symbol-palette', 'display-focused')
	 */
	setContext(context) {
		this.activeContext = context;
		this.store.update(state => ({ ...state, activeContext: context }));
	}

	/**
	 * Enable/disable keyboard shortcuts
	 * @param {boolean} enabled - Whether shortcuts should be active
	 */
	setEnabled(enabled) {
		this.isEnabled = enabled;
		this.store.update(state => ({ ...state, isEnabled: enabled }));
	}

	/**
	 * Handle keyboard events and trigger appropriate shortcuts
	 * @param {KeyboardEvent} event - Keyboard event to process
	 */
	handleKeyDown(event) {
		if (!this.isEnabled) return;

		// Ignore when typing in input fields unless context allows it
		const activeElement = document.activeElement;
		const isInputElement = activeElement && (
			activeElement.tagName === 'INPUT' ||
			activeElement.tagName === 'TEXTAREA' ||
			activeElement.contentEditable === 'true'
		);

		if (isInputElement && this.activeContext !== 'input') return;

		const keyCombo = this.getKeyCombo(event);
		const triggeredShortcuts = this.findMatchingShortcuts(keyCombo);

		for (const shortcut of triggeredShortcuts) {
			if (this.isShortcutActive(shortcut) && shortcut.condition()) {
				event.preventDefault();
				event.stopPropagation();

				try {
					shortcut.action(event);
					this.updateLastTriggered(shortcut);
				} catch (error) {
					console.error(`Error executing shortcut ${shortcut.id}:`, error);
				}

				break; // Execute only the first matching shortcut
			}
		}
	}

	/**
	 * Get all registered shortcuts for help/reference
	 * @param {string} category - Optional category filter
	 * @returns {Array} Array of shortcut objects
	 */
	getShortcuts(category = null) {
		const shortcuts = Array.from(this.shortcuts.values());
		return category
			? shortcuts.filter(s => s.category === category)
			: shortcuts;
	}

	/**
	 * Get shortcuts available in current context
	 * @returns {Array} Array of currently active shortcuts
	 */
	getActiveShortcuts() {
		return this.getShortcuts().filter(shortcut =>
			this.isShortcutActive(shortcut)
		);
	}

	/**
	 * Normalize key combination string to consistent format
	 * @param {string} keyCombo - Raw key combination
	 * @returns {string} Normalized key combination
	 */
	normalizeKeyCombo(keyCombo) {
		return keyCombo
			.toLowerCase()
			.replace(/\s+/g, '')
			.replace('ctrl', 'ctrl')
			.replace('cmd', 'meta')
			.replace('command', 'meta')
			.replace('alt', 'alt')
			.replace('shift', 'shift')
			.replace('meta', 'meta');
	}

	/**
	 * Extract key combination from keyboard event
	 * @param {KeyboardEvent} event - Keyboard event
	 * @returns {string} Normalized key combination
	 */
	getKeyCombo(event) {
		const parts = [];

		if (event.ctrlKey) parts.push('ctrl');
		if (event.metaKey) parts.push('meta'); // Cmd key on Mac
		if (event.altKey) parts.push('alt');
		if (event.shiftKey) parts.push('shift');

		// Handle special keys
		const key = event.key.toLowerCase();
		const specialKeys = {
			' ': 'space',
			'escape': 'escape',
			'tab': 'tab',
			'enter': 'enter',
			'backspace': 'backspace',
			'delete': 'delete',
			'arrowup': 'up',
			'arrowdown': 'down',
			'arrowleft': 'left',
			'arrowright': 'right'
		};

		parts.push(specialKeys[key] || key);

		return parts.join('+');
	}

	/**
	 * Find shortcuts matching the key combination
	 * @param {string} keyCombo - Key combination to match
	 * @returns {Array} Array of matching shortcuts
	 */
	findMatchingShortcuts(keyCombo) {
		const normalized = this.normalizeKeyCombo(keyCombo);
		return Array.from(this.shortcuts.values()).filter(shortcut =>
			shortcut.key === normalized
		);
	}

	/**
	 * Check if shortcut is active in current context
	 * @param {Object} shortcut - Shortcut object
	 * @returns {boolean} Whether shortcut should be active
	 */
	isShortcutActive(shortcut) {
		return shortcut.contexts.includes('global') ||
			   shortcut.contexts.includes(this.activeContext);
	}

	/**
	 * Update the reactive store with current shortcut state
	 */
	updateStore() {
		const shortcutsObj = {};
		this.shortcuts.forEach((shortcut, id) => {
			shortcutsObj[id] = {
				key: shortcut.key,
				description: shortcut.description,
				category: shortcut.category,
				contexts: shortcut.contexts
			};
		});

		this.store.update(state => ({
			...state,
			shortcuts: shortcutsObj
		}));
	}

	/**
	 * Update last triggered shortcut for analytics/feedback
	 * @param {Object} shortcut - Shortcut that was triggered
	 */
	updateLastTriggered(shortcut) {
		this.store.update(state => ({
			...state,
			lastTriggered: {
				id: shortcut.id,
				description: shortcut.description,
				timestamp: Date.now()
			}
		}));
	}

	/**
	 * Setup global keyboard event listener
	 * @param {HTMLElement} target - Element to bind events to (default: document)
	 */
	bindToElement(target = document) {
		const handler = (event) => this.handleKeyDown(event);
		target.addEventListener('keydown', handler);
		this.eventListeners.add({ target, handler });
	}

	/**
	 * Cleanup event listeners and reset manager
	 */
	destroy() {
		this.eventListeners.forEach(({ target, handler }) => {
			target.removeEventListener('keydown', handler);
		});
		this.eventListeners.clear();
		this.shortcuts.clear();
		this.contexts.clear();
	}

	/**
	 * Export shortcuts configuration for backup/sharing
	 * @returns {Object} Exportable configuration
	 */
	export() {
		const config = {};
		this.shortcuts.forEach((shortcut, id) => {
			config[id] = {
				key: shortcut.key,
				description: shortcut.description,
				category: shortcut.category,
				contexts: shortcut.contexts
			};
		});
		return config;
	}

	/**
	 * Import shortcuts configuration
	 * @param {Object} config - Configuration to import
	 * @param {Function} actionResolver - Function to resolve actions for imported shortcuts
	 */
	import(config, actionResolver) {
		Object.entries(config).forEach(([id, shortcutConfig]) => {
			if (shortcutConfig.key && actionResolver(id)) {
				this.register(id, {
					...shortcutConfig,
					action: actionResolver(id)
				});
			}
		});
	}
}

// Create singleton instance for application-wide use
export const keyboardManager = new KeyboardShortcutManager();

// Export reactive store for components to subscribe to
export const shortcutStore = derived(keyboardManager.store, $store => $store);

// Export common contexts for consistency
export const SHORTCUT_CONTEXTS = {
	GLOBAL: 'global',
	SYMBOL_PALETTE: 'symbol-palette',
	DISPLAY_FOCUSED: 'display-focused',
	CONTEXT_MENU: 'context-menu',
	INPUT: 'input'
};

// Export categories for organization
export const SHORTCUT_CATEGORIES = {
	NAVIGATION: 'navigation',
	SYMBOL: 'symbol',
	DISPLAY: 'display',
	CONFIGURATION: 'configuration',
	SYSTEM: 'system'
};

// Auto-bind to document when imported in browser environment
if (typeof document !== 'undefined') {
	keyboardManager.bindToElement();
}