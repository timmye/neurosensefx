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
export const SHORTCUT_CONTEXTS = Object.freeze({
	GLOBAL: 'global',
	SYMBOL_PALETTE: 'symbol-palette',
	DISPLAY_FOCUSED: 'display-focused',
	CONTEXT_MENU: 'context-menu',
	INPUT: 'input'
});

// Export categories for backward compatibility
export const SHORTCUT_CATEGORIES = Object.freeze({
	NAVIGATION: 'navigation',
	SYMBOL: 'symbol',
	DISPLAY: 'display',
	CONFIGURATION: 'configuration',
	SYSTEM: 'system'
});

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

// === DUAL-LAYER EVENT INTERCEPTION SYSTEM ===
// Critical browser shortcuts that MUST be intercepted at document level
const CRITICAL_BROWSER_SHORTCUTS = Object.freeze(['ctrl+k', 'ctrl+f', 'ctrl+shift+k']);

// Document backup system state
let documentBackupInstalled = false;
let mainElementInstance = null;

/**
 * Document-level backup handler for critical browser shortcuts ONLY
 * This is our emergency override that prevents browser search hijacking
 */
function handleDocumentBackup(event) {
	const keyCombo = getKeyCombo(event);

	// ONLY handle critical browser shortcuts - minimal footprint
	if (CRITICAL_BROWSER_SHORTCUTS.includes(keyCombo)) {
		// CRITICAL: Stop browser native behavior immediately
		event.preventDefault();
		event.stopPropagation();

	
		// Forward to main system for actual processing
		// This maintains context and proper event flow
		keyboardEventStore.set({
			type: 'critical-shortcut',
			keyCombo,
			event: { ...event }, // Clone event for safety
			source: 'document-backup',
			timestamp: Date.now()
		});

		// Dispatch to unified system for proper handling
		dispatchKeyboardEvent('criticalShortcut', { keyCombo, event });
	}
}

/**
 * Install document-level backup listener
 * Only installs once per application lifecycle
 */
function installDocumentBackup() {
	if (documentBackupInstalled) {
		return;
	}

	document.addEventListener('keydown', handleDocumentBackup, { capture: true });
	documentBackupInstalled = true;

	}

/**
 * Remove document backup listener (for cleanup)
 */
function removeDocumentBackup() {
	if (documentBackupInstalled) {
		document.removeEventListener('keydown', handleDocumentBackup, { capture: true });
		documentBackupInstalled = false;
		}
}

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
			// Phase 1: Setup core system
			setupCoreSystem();

			// Phase 2: Setup event communication
			setupEventCommunication();

			// Phase 3: Verify system readiness
			await verifySystemReadiness();

			isInitialized = true;

			return 'ready';
		} catch (error) {
			console.error('Keyboard system initialization failed:', error);
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

	// CRITICAL: Install document-level backup for critical browser shortcuts
	installDocumentBackup();
}

/**
 * Setup event communication system
 */
function setupEventCommunication() {
	// Store-based events are inherently ready
	// No additional setup needed for store subscribers

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

	}

/**
 * Register a keyboard shortcut (backward compatibility)
 */
export function registerShortcut(id, config) {
	const shortcut = {
		id,
		key: normalizeKeyCombo(config.key), // Normalize key for consistent comparison
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
 * Enhanced with dual-layer event interception coordination
 */
export function keyboardAction(node, config = {}) {
	// Track main element instance for coordination with document backup
	mainElementInstance = node;

	function handleKeyDown(event) {
		if (!isEnabled) return;

		const keyCombo = getKeyCombo(event);

		// Skip critical browser shortcuts - document backup handles them
		// This prevents double-prevention and maintains proper event flow
		if (CRITICAL_BROWSER_SHORTCUTS.includes(keyCombo)) {
			// Document backup already handled this, but we still need to process it
			// through our main system to trigger the actual actions
		}

		// Ignore when typing in input fields unless context allows it
		const activeElement = document.activeElement;
		const isInputElement = activeElement && (
			activeElement.tagName === 'INPUT' ||
			activeElement.tagName === 'TEXTAREA' ||
			activeElement.contentEditable === 'true'
		);

		if (isInputElement && activeContext !== 'input') return;

		// CRITICAL FIX: Normalize keyCombo for comparison to handle case sensitivity
		// The issue: shortcuts can be registered with "Ctrl+K" (uppercase) but getKeyCombo() returns "ctrl+k" (lowercase)
		const normalizedKeyCombo = keyCombo.toLowerCase();
		const triggeredShortcuts = Array.from(shortcuts.values())
			.filter(shortcut => shortcut.key.toLowerCase() === normalizedKeyCombo);

		for (const shortcut of triggeredShortcuts) {
			if (isShortcutActive(shortcut) && shortcut.condition()) {
				// For critical shortcuts, document backup already prevented default
				// For others, prevent default as needed
				if (!CRITICAL_BROWSER_SHORTCUTS.includes(keyCombo)) {
					if (shortcut.preventDefault) {
						event.preventDefault();
					}
					if (shortcut.stopPropagation) {
						event.stopPropagation();
					}
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
					// Ensure errors don't break the keyboard system
					console.error(`Shortcut execution failed [${shortcut.id}]:`, error);
				}

				break; // Execute only the first matching shortcut
			}
		}
	}

	// Use Svelte's declarative event system with CAPTURE phase for priority
	// Document backup runs first, then main element handler processes actions
	node.addEventListener('keydown', handleKeyDown, { capture: true });

	return {
		update(newConfig) {
			// Handle configuration updates if needed
		},
		destroy() {
			node.removeEventListener('keydown', handleKeyDown, { capture: true });

			// Clear main element instance if this was the last one
			if (mainElementInstance === node) {
				mainElementInstance = null;
			}
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
	if (!keyCombo || typeof keyCombo !== 'string') {
		return '';
	}

	return keyCombo
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '')
		.replace(/\bcmd\b|\bcommand\b/g, 'meta')
		.replace(/\bcontrol\b/g, 'ctrl');
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
	mainElementInstance = null;

	// Remove document backup
	removeDocumentBackup();

	// Reset stores
	keyboardActionStore.update(state => ({
		...state,
		shortcuts: {},
		activeContext: 'global',
		isEnabled: true,
		lastTriggered: null
	}));

	keyboardEventStore.set(null);

	}