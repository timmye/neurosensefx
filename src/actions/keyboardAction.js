/**
 * Enhanced Unified Keyboard Action for NeuroSense FX
 *
 * Complete keyboard system replacing all legacy managers.
 * Follows "Simple, Performant, Maintainable" philosophy with:
 * - Store-based event system replacing CustomEvents
 * - Initialization sequencing guarantees
 * - Sub-100ms trading performance requirements
 * - Comprehensive shortcut coverage
 */

import { writable, derived } from 'svelte/store';

// Export contexts for backward compatibility
export const SHORTCUT_CONTEXTS = {
	GLOBAL: 'global',
	SYMBOL_PALETTE: 'symbol-palette',
	DISPLAY_FOCUSED: 'display-focused',
	CONTEXT_MENU: 'context-menu',
	INPUT: 'input'
};

// Export categories for backward compatibility
export const SHORTCUT_CATEGORIES = {
	NAVIGATION: 'navigation',
	SYMBOL: 'symbol',
	DISPLAY: 'display',
	CONFIGURATION: 'configuration',
	SYSTEM: 'system'
};

// Internal reactive store for backward compatibility
// Note: Main shortcutStore should be imported from shortcutStore.js
export const keyboardActionStore = writable({
	shortcuts: {},
	activeContext: 'global',
	isEnabled: true,
	lastTriggered: null
});

// === STORE-BASED EVENT SYSTEM ===
// Replaces CustomEvents with guaranteed listener availability

/**
 * Centralized keyboard event store
 * Eliminates race conditions from CustomEvent dispatch/listener timing
 */
export const keyboardEventStore = writable(null);

/**
 * Derived store for event history (useful for debugging)
 */
export const eventHistory = derived(keyboardEventStore, ($keyboardEventStore) => {
	// This could be expanded to maintain a full history if needed
	return $keyboardEventStore ? [$keyboardEventStore] : [];
});

// Active shortcuts registry
const shortcuts = new Map();
let activeContext = 'global';
let isEnabled = true;

/**
 * System initialization state tracking
 */
let initializationPromise = null;
let isInitialized = false;

// Note: getKeyCombo and normalizeKeyCombo functions are exported below

/**
 * Check if shortcut is active in current context
 */
function isShortcutActive(shortcut) {
	return shortcut.contexts.includes('global') ||
		   shortcut.contexts.includes(activeContext);
}

/**
 * Update reactive store with current state
 */
function updateStore() {
	const shortcutsObj = {};
	shortcuts.forEach((shortcut, id) => {
		shortcutsObj[id] = {
			key: shortcut.key,
			description: shortcut.description,
			category: shortcut.category,
			contexts: shortcut.contexts
		};
	});

	keyboardActionStore.update(state => ({
		...state,
		shortcuts: shortcutsObj,
		activeContext,
		isEnabled
	}));
}

/**
 * Dispatch store-based event (replaces CustomEvent.dispatchEvent)
 * Guaranteed listener availability - no race conditions
 */
export function dispatchKeyboardEvent(eventType, data = {}) {
	const eventData = {
		type: eventType,
		data,
		timestamp: Date.now(),
		source: 'keyboardAction'
	};

	// Update store - all subscribers will receive this immediately
	keyboardEventStore.set(eventData);

	// Log for debugging (development only)
	if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
		console.debug(`[KEYBOARD_EVENT] ${eventType}:`, data);
	}
}

/**
 * Initialize keyboard system with proper sequencing
 * Guarantees initialization order to prevent race conditions
 */
export async function initializeKeyboardSystem() {
	if (initializationPromise) {
		return initializationPromise;
	}

	initializationPromise = (async () => {
		try {
			console.log('[KEYBOARD] Initializing enhanced keyboard system...');

			// Phase 1: Setup core system
			setupCoreSystem();

			// Phase 2: Setup event communication
			setupEventCommunication();

			// Phase 3: Verify system readiness
			await verifySystemReadiness();

			isInitialized = true;
			console.log('[KEYBOARD] Enhanced keyboard system initialized successfully');

			return 'ready';
		} catch (error) {
			console.error('[KEYBOARD] Initialization failed:', error);
			initializationPromise = null; // Reset to allow retry
			throw error;
		}
	})();

	return initializationPromise;
}

/**
 * Setup core keyboard system components
 */
function setupCoreSystem() {
	// Ensure initial state is properly set
	activeContext = 'global';
	isEnabled = true;

	// Initialize stores with proper state
	keyboardActionStore.update(state => ({
		...state,
		activeContext,
		isEnabled,
		lastTriggered: null
	}));

	keyboardEventStore.set(null); // Clear any previous events
}

/**
 * Setup event communication system
 */
function setupEventCommunication() {
	// Store-based events are inherently ready
	// No additional setup needed for store subscribers

	console.log('[KEYBOARD] Store-based event communication ready');
}

/**
 * Verify system is ready for operation
 */
async function verifySystemReadiness() {
	// Verify stores are responsive
	const testEvent = {
		type: 'system-test',
		data: { test: true },
		timestamp: Date.now()
	};

	// Test store dispatch
	keyboardEventStore.set(testEvent);

	// Small delay to ensure state propagation
	await new Promise(resolve => setTimeout(resolve, 10));

	// Verify we can read back the test event
	const currentEvent = new Promise(resolve => {
		let unsubscribe;
		unsubscribe = keyboardEventStore.subscribe(value => {
			if (unsubscribe) {
				unsubscribe(); // Only call if unsubscribe is defined
			}
			resolve(value);
		});
	});

	const eventResult = await currentEvent;
	if (eventResult?.type !== 'system-test') {
		throw new Error('Store-based event system not responding correctly');
	}

	// Clear test event
	keyboardEventStore.set(null);

	console.log('[KEYBOARD] System verification completed');
}

/**
 * Register a keyboard shortcut (backward compatibility)
 */
export function registerShortcut(id, config) {
	console.log('[KEYBOARD] Registering shortcut:', id, 'with key:', config.key);
	const shortcut = {
		id,
		key: normalizeKeyCombo(config.key),
		action: config.action,
		description: config.description || id,
		category: config.category || 'general',
		contexts: config.contexts || ['global'],
		condition: config.condition || (() => true),
		preventDefault: config.preventDefault !== false,
		stopPropagation: config.stopPropagation !== false
	};

	shortcuts.set(id, shortcut);
	updateStore();
	console.log('[KEYBOARD] Shortcut registered. Total shortcuts:', shortcuts.size);

	return () => {
		shortcuts.delete(id);
		updateStore();
	};
}

/**
 * Set active context for shortcuts
 */
export function setContext(context) {
	activeContext = context;
	keyboardActionStore.update(state => ({ ...state, activeContext: context }));
}

/**
 * Enable/disable keyboard shortcuts
 */
export function setEnabled(enabled) {
	isEnabled = enabled;
	keyboardActionStore.update(state => ({ ...state, isEnabled: enabled }));
}

/**
 * Main Svelte action for keyboard handling
 */
export function keyboardAction(node, config = {}) {
	function handleKeyDown(event) {
		if (!isEnabled) return;

		// CRITICAL FIX: Immediate preventDefault for browser-native shortcuts
		// This overrides browser search (Ctrl+F, Ctrl+K) before they execute
		const keyCombo = getKeyCombo(event);
		const criticalBrowserShortcuts = ['ctrl+f', 'ctrl+k', 'ctrl+shift+k'];

		if (criticalBrowserShortcuts.includes(keyCombo)) {
			event.preventDefault();
			event.stopPropagation();
			console.log('[KEYBOARD] Overriding browser shortcut:', keyCombo);
		}

		// Ignore when typing in input fields unless context allows it
		const activeElement = document.activeElement;
		const isInputElement = activeElement && (
			activeElement.tagName === 'INPUT' ||
			activeElement.tagName === 'TEXTAREA' ||
			activeElement.contentEditable === 'true'
		);

		if (isInputElement && activeContext !== 'input') return;
		const triggeredShortcuts = Array.from(shortcuts.values())
			.filter(shortcut => shortcut.key === keyCombo);

		for (const shortcut of triggeredShortcuts) {
			if (isShortcutActive(shortcut) && shortcut.condition()) {
				if (shortcut.preventDefault) {
					event.preventDefault();
				}
				if (shortcut.stopPropagation) {
					event.stopPropagation();
				}

				try {
					shortcut.action(event);
					keyboardActionStore.update(state => ({
						...state,
						lastTriggered: {
							id: shortcut.id,
							description: shortcut.description,
							timestamp: Date.now()
						}
					}));
				} catch (error) {
					console.error(`Error executing shortcut ${shortcut.id}:`, error);
				}

				break; // Execute only the first matching shortcut
			}
		}
	}

	// Use Svelte's declarative event system with CAPTURE phase for priority
	// This ensures our handlers run before browser defaults (fixes Ctrl+K browser search issue)
	node.addEventListener('keydown', handleKeyDown, { capture: true });

	return {
		update(newConfig) {
			// Handle configuration updates if needed
		},
		destroy() {
			node.removeEventListener('keydown', handleKeyDown, { capture: true }); // Use same parameter format for removal
		}
	};
}

// Export the remaining functions for backward compatibility
export function getKeyCombo(event) {
	const parts = [];
	if (event.ctrlKey) parts.push('ctrl');
	if (event.metaKey) parts.push('meta');
	if (event.altKey) parts.push('alt');
	if (event.shiftKey) parts.push('shift');

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

export function normalizeKeyCombo(keyCombo) {
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

// Export shortcuts for backward compatibility
export { shortcuts as registeredShortcuts };

/**
 * Get initialization status
 */
export function getInitializationStatus() {
	return {
		isInitialized,
		initializationPromise: initializationPromise ? 'pending' : 'none'
	};
}

/**
 * Reset system (for testing/debugging)
 */
export function resetKeyboardSystem() {
	shortcuts.clear();
	activeContext = 'global';
	isEnabled = true;
	isInitialized = false;
	initializationPromise = null;

	// Reset stores
	keyboardActionStore.update(state => ({
		...state,
		shortcuts: {},
		activeContext: 'global',
		isEnabled: true,
		lastTriggered: null
	}));

	keyboardEventStore.set(null);

	console.log('[KEYBOARD] System reset to initial state');
}