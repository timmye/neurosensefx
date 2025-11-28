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
import { debug, DebugCategories, DebugLevels } from '../utils/debugConfig.js';

// Only log module loading at detailed trace level
debug.trace(DebugCategories.INTERACTION, 'keyboardAction.js module loading', { timestamp: Date.now() });

// Export contexts for backward compatibility
export const SHORTCUT_CONTEXTS = Object.freeze({
	GLOBAL: 'global',
	SYMBOL_PALETTE: 'symbol-palette',
	DISPLAY_FOCUSED: 'display-focused',
	CONTEXT_MENU: 'context-menu',
	INPUT: 'input'
});

debug.trace(DebugCategories.INTERACTION, 'SHORTCUT_CONTEXTS defined', { contexts: Object.values(SHORTCUT_CONTEXTS) });

// Export categories for backward compatibility
export const SHORTCUT_CATEGORIES = Object.freeze({
	NAVIGATION: 'navigation',
	SYMBOL: 'symbol',
	DISPLAY: 'display',
	CONFIGURATION: 'configuration',
	SYSTEM: 'system'
});

debug.trace(DebugCategories.INTERACTION, 'SHORTCUT_CATEGORIES defined', { categories: Object.values(SHORTCUT_CATEGORIES) });

// Internal reactive store for backward compatibility
// Note: Main shortcutStore should be imported from shortcutStore.js
export const keyboardActionStore = writable({
	shortcuts: {},
	activeContext: 'global',
	isEnabled: true,
	lastTriggered: null
});

debug.trace(DebugCategories.INTERACTION, 'keyboardActionStore initialized', { initialState: { shortcuts: {}, activeContext: 'global', isEnabled: true } });

// === STORE-BASED EVENT SYSTEM ===
// Replaces CustomEvents with guaranteed listener availability

/**
 * Centralized keyboard event store
 * Eliminates race conditions from CustomEvent dispatch/listener timing
 */
export const keyboardEventStore = writable(null);

debug.trace(DebugCategories.INTERACTION, 'keyboardEventStore initialized for centralized event handling');

/**
 * Derived store for event history (useful for debugging)
 */
export const eventHistory = derived(keyboardEventStore, ($keyboardEventStore) => {
	// This could be expanded to maintain a full history if needed
	return $keyboardEventStore ? [$keyboardEventStore] : [];
});

debug.trace(DebugCategories.INTERACTION, 'eventHistory derived store created');

// Active shortcuts registry
const shortcuts = new Map();
let activeContext = 'global';
let isEnabled = true;

debug.trace(DebugCategories.INTERACTION, 'Core system state initialized', { shortcutsCount: 0, activeContext, isEnabled });

/**
 * System initialization state tracking
 */
let initializationPromise = null;
let isInitialized = false;

debug.trace(DebugCategories.INTERACTION, 'Initialization tracking variables created', { isInitialized, hasPromise: false });

// === DUAL-LAYER EVENT INTERCEPTION SYSTEM ===
// Critical browser shortcuts that MUST be intercepted at document level
const CRITICAL_BROWSER_SHORTCUTS = Object.freeze(['ctrl+k', 'ctrl+f', 'ctrl+shift+k']);

debug.debug(DebugCategories.INTERACTION, '🛡️ Critical browser shortcuts defined', { shortcuts: CRITICAL_BROWSER_SHORTCUTS });

// Document backup system state
let documentBackupInstalled = false;
let mainElementInstance = null;

debug.debug(DebugCategories.INTERACTION, '🔧 Document backup system state initialized', { documentBackupInstalled, hasMainElement: false });

/**
 * Document-level backup handler for critical browser shortcuts ONLY
 * This is our emergency override that prevents browser search hijacking
 */
function handleDocumentBackup(event) {
	debug.debug(DebugCategories.INTERACTION, '🛡️ Document backup handler triggered', { key: event.key, code: event.code, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey, metaKey: event.metaKey });

	const keyCombo = getKeyCombo(event);
	debug.debug(DebugCategories.INTERACTION, '🔑 Key combo calculated', { keyCombo, originalKey: event.key });

	// CRITICAL: Ignore empty key combos (modifier keys only)
	if (!keyCombo) {
		debug.debug(DebugCategories.INTERACTION, '🚫 Empty key combo ignored', { originalKey: event.key, reason: 'Modifier key events should not be processed' });
		return;
	}

	// ONLY handle critical browser shortcuts - minimal footprint
	if (CRITICAL_BROWSER_SHORTCUTS.includes(keyCombo)) {
		debug.debug(DebugCategories.INTERACTION, '⚡ Critical shortcut intercepted by document backup', { keyCombo, action: 'PREVENTING DEFAULT BEHAVIOR' });

		// CRITICAL: Stop browser native behavior immediately
		event.preventDefault();
		event.stopPropagation();

		debug.debug(DebugCategories.INTERACTION, '📡 Forwarding to main system for processing', { keyCombo, source: 'document-backup' });

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
	} else {
		debug.debug(DebugCategories.INTERACTION, '↩️ Non-critical shortcut ignored by document backup', { keyCombo });
	}
}

/**
 * Install document-level backup listener
 * Only installs once per application lifecycle
 */
function installDocumentBackup() {
	debug.debug(DebugCategories.INTERACTION, '🔧 installDocumentBackup() called', { documentBackupInstalled });

	if (documentBackupInstalled) {
		debug.warn(DebugCategories.INTERACTION, 'Document backup already installed, skipping', { documentBackupInstalled });
		return;
	}

	debug.debug(DebugCategories.INTERACTION, '📡 Installing document-level backup listener', { phase: 'capture', shortcuts: CRITICAL_BROWSER_SHORTCUTS });

	try {
		document.addEventListener('keydown', handleDocumentBackup, { capture: true });
		documentBackupInstalled = true;
		debug.debug(DebugCategories.INTERACTION, '✅ Document backup listener installed successfully', { documentBackupInstalled });
	} catch (error) {
		debug.error(DebugCategories.INTERACTION, 'Failed to install document backup listener', { error: error.message });
	}
}

/**
 * Remove document backup listener (for cleanup)
 */
function removeDocumentBackup() {
	debug.debug(DebugCategories.INTERACTION, '🗑️ removeDocumentBackup() called', { documentBackupInstalled });

	if (documentBackupInstalled) {
		try {
			document.removeEventListener('keydown', handleDocumentBackup, { capture: true });
			documentBackupInstalled = false;
			debug.debug(DebugCategories.INTERACTION, '✅ Document backup listener removed successfully', { documentBackupInstalled });
		} catch (error) {
			debug.error(DebugCategories.INTERACTION, 'Failed to remove document backup listener', { error: error.message });
		}
	} else {
		debug.warn(DebugCategories.INTERACTION, 'Document backup not installed, nothing to remove', { documentBackupInstalled });
	}
}

debug.debug(DebugCategories.INTERACTION, '🔧 Document backup management functions defined');

// Note: getKeyCombo and normalizeKeyCombo functions are exported below

/**
 * Check if shortcut is active in current context
 */
function isShortcutActive(shortcut) {
	const isActive = shortcut.contexts.includes('global') ||
					 shortcut.contexts.includes(activeContext);

	debug.debug(DebugCategories.INTERACTION, 'Checking shortcut activity', { id: shortcut.id, key: shortcut.key, contexts: shortcut.contexts });

	return isActive;
}

/**
 * Update reactive store with current state
 */
function updateStore() {
	debug.debug(DebugCategories.INTERACTION, '📝 updateStore() called', { shortcutsCount: shortcuts.size, activeContext, isEnabled });

	try {
		const shortcutsObj = {};
		shortcuts.forEach((shortcut, id) => {
			shortcutsObj[id] = {
				key: shortcut.key,
				description: shortcut.description,
				category: shortcut.category,
				contexts: shortcut.contexts
			};
		});

		debug.debug(DebugCategories.INTERACTION, 'Updating keyboardActionStore with current state', { shortcutsCount: shortcuts.size, activeContext, isEnabled });

		keyboardActionStore.update(state => ({
			...state,
			shortcuts: shortcutsObj,
			activeContext,
			isEnabled
		}));

		debug.debug(DebugCategories.INTERACTION, '✅ keyboardActionStore updated successfully');
	} catch (error) {
		debug.error(DebugCategories.INTERACTION, 'Failed to update keyboardActionStore', { error: error.message });
	}
}

/**
 * Dispatch store-based event (replaces CustomEvent.dispatchEvent)
 * Guaranteed listener availability - no race conditions
 */
export function dispatchKeyboardEvent(eventType, data = {}) {
	debug.debug(DebugCategories.INTERACTION, '📡 dispatchKeyboardEvent() called', { eventType, dataKeys: Object.keys(data) });

	try {
		const eventData = {
			type: eventType,
			data,
			timestamp: Date.now(),
			source: 'keyboardAction'
		};

		debug.debug(DebugCategories.INTERACTION, 'Dispatching keyboard event', { eventType, dataKeys: Object.keys(data) });

		// Update store - all subscribers will receive this immediately
		keyboardEventStore.set(eventData);

		debug.debug(DebugCategories.INTERACTION, '✅ Keyboard event dispatched successfully', { eventType });
	} catch (error) {
		debug.error(DebugCategories.INTERACTION, 'Failed to dispatch keyboard event', { eventType, error: error.message });
	}
}

/**
 * Initialize keyboard system with proper sequencing
 * Guarantees initialization order to prevent race conditions
 */
export async function initializeKeyboardSystem() {
	debug.debug(DebugCategories.INTERACTION, '🚀 initializeKeyboardSystem() called', { isInitialized, hasPromise: !!initializationPromise });

	if (initializationPromise) {
		debug.debug(DebugCategories.INTERACTION, '⏳ Initialization already in progress, returning existing promise');
		return initializationPromise;
	}

	debug.debug(DebugCategories.INTERACTION, '🔄 Starting keyboard system initialization');

	initializationPromise = (async () => {
		try {
			debug.debug(DebugCategories.INTERACTION, '📋 Phase 1: Setting up core system');
			// Phase 1: Setup core system
			setupCoreSystem();

			debug.debug(DebugCategories.INTERACTION, '📡 Phase 2: Setting up event communication');
			// Phase 2: Setup event communication
			setupEventCommunication();

			debug.debug(DebugCategories.INTERACTION, '✅ Phase 3: Verifying system readiness');
			// Phase 3: Verify system readiness
			await verifySystemReadiness();

			isInitialized = true;
			debug.debug(DebugCategories.INTERACTION, '🎉 Keyboard system initialization completed successfully', { isInitialized });

			return 'ready';
		} catch (error) {
			debug.error(DebugCategories.INTERACTION, 'Keyboard system initialization failed', {
				error: error.message,
				stack: error.stack
			});

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
	debug.debug(DebugCategories.INTERACTION, '🔧 setupCoreSystem() starting');

	try {
		// Ensure initial state is properly set
		activeContext = 'global';
		isEnabled = true;

		debug.debug(DebugCategories.INTERACTION, '📊 Setting initial core state', { activeContext, isEnabled });

		// Initialize stores with proper state
		const newState = {
			...keyboardActionStore,
			activeContext,
			isEnabled,
			lastTriggered: null
		};

		debug.debug(DebugCategories.INTERACTION, 'Updating keyboardActionStore with initial state', newState);
		keyboardActionStore.set(newState);

		debug.debug(DebugCategories.INTERACTION, '🧹 Clearing keyboardEventStore');
		keyboardEventStore.set(null); // Clear any previous events

		// CRITICAL: Install document-level backup for critical browser shortcuts
		debug.debug(DebugCategories.INTERACTION, '🛡️ Installing document-level backup for critical shortcuts');
		installDocumentBackup();

		debug.debug(DebugCategories.INTERACTION, '✅ Core system setup completed successfully');
	} catch (error) {
		debug.error(DebugCategories.INTERACTION, 'Core system setup failed', { error: error.message });
		throw error;
	}
}

/**
 * Setup event communication system
 */
function setupEventCommunication() {
	debug.debug(DebugCategories.INTERACTION, '📡 setupEventCommunication() starting');

	try {
		// Store-based events are inherently ready
		// No additional setup needed for store subscribers
		debug.debug(DebugCategories.INTERACTION, '✅ Store-based event communication ready (no additional setup needed)');
	} catch (error) {
		debug.error(DebugCategories.INTERACTION, 'Event communication setup failed', { error: error.message });
		throw error;
	}
}

/**
 * Verify system is ready for operation
 */
async function verifySystemReadiness() {
	debug.debug(DebugCategories.INTERACTION, '🔍 verifySystemReadiness() starting');

	try {
		// Verify stores are responsive
		const testEvent = {
			type: 'system-test',
			data: { test: true },
			timestamp: Date.now()
		};

		debug.debug(DebugCategories.INTERACTION, 'Testing store dispatch with test event', testEvent);

		// Test store dispatch
		keyboardEventStore.set(testEvent);

		debug.debug(DebugCategories.INTERACTION, '⏳ Waiting for state propagation...');
		// Small delay to ensure state propagation
		await new Promise(resolve => setTimeout(resolve, 10));

		debug.debug(DebugCategories.INTERACTION, '🔍 Verifying test event can be read back');

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
		debug.debug(DebugCategories.INTERACTION, 'Test event verification result', { eventFound: !!eventResult, expectedType: 'system-test', eventMatches: eventResult?.type === 'system-test' });

		if (eventResult?.type !== 'system-test') {
			throw new Error('Store-based event system not responding correctly');
		}

		debug.debug(DebugCategories.INTERACTION, '🧹 Clearing test event');
		// Clear test event
		keyboardEventStore.set(null);

		debug.debug(DebugCategories.INTERACTION, '✅ System readiness verification completed successfully');
	} catch (error) {
		debug.error(DebugCategories.INTERACTION, 'System readiness verification failed', { error: error.message });
		throw error;
	}
}

/**
 * Register a keyboard shortcut (backward compatibility)
 */
export function registerShortcut(id, config) {
	debug.debug(DebugCategories.INTERACTION, '📝 registerShortcut() called', { id, configKeys: Object.keys(config) });

	try {
		const normalizedKey = normalizeKeyCombo(config.key);
		debug.debug(DebugCategories.INTERACTION, 'Key normalized for registration', { originalKey: config.key, normalizedKey });

		const shortcut = {
			id,
			key: normalizedKey, // Normalize key for consistent comparison
			action: config.action,
			description: config.description || id,
			category: config.category || 'general',
			contexts: config.contexts || ['global'],
			condition: config.condition || (() => true),
			preventDefault: config.preventDefault !== false,
			stopPropagation: config.stopPropagation !== false
		};

		debug.debug(DebugCategories.INTERACTION, 'Creating shortcut object', { id, key: shortcut.key, description: shortcut.description, category: shortcut.category, contexts: shortcut.contexts, hasAction: !!shortcut.action });

		shortcuts.set(id, shortcut);
		debug.debug(DebugCategories.INTERACTION, '💾 Shortcut registered in memory', { totalShortcuts: shortcuts.size });

		updateStore();

		debug.debug(DebugCategories.INTERACTION, '✅ Shortcut registration completed', { id, key: shortcut.key });

		return () => {
			debug.debug(DebugCategories.INTERACTION, '🗑️ Unregistering shortcut', { id });
			shortcuts.delete(id);
			updateStore();
			debug.debug(DebugCategories.INTERACTION, '✅ Shortcut unregistered', { id, remainingShortcuts: shortcuts.size });
		};
	} catch (error) {
		debug.error(DebugCategories.INTERACTION, 'Failed to register shortcut', { id, error: error.message });
		throw error;
	}
}

/**
 * Set active context for shortcuts
 */
export function setContext(context) {
	debug.debug(DebugCategories.INTERACTION, '🎯 setContext() called', { newContext: context, previousContext: activeContext });

	try {
		activeContext = context;
		keyboardActionStore.update(state => ({ ...state, activeContext: context }));

		debug.debug(DebugCategories.INTERACTION, '✅ Active context updated successfully', { activeContext: context });
	} catch (error) {
		debug.error(DebugCategories.INTERACTION, 'Failed to set context', { context, error: error.message });
		throw error;
	}
}

/**
 * Enable/disable keyboard shortcuts
 */
export function setEnabled(enabled) {
	debug.debug(DebugCategories.INTERACTION, '🔛 setEnabled() called', { enabled, previousState: isEnabled });

	try {
		isEnabled = enabled;
		keyboardActionStore.update(state => ({ ...state, isEnabled: enabled }));

		debug.debug(DebugCategories.INTERACTION, '✅ Keyboard system enabled/disabled successfully', { isEnabled: enabled });
	} catch (error) {
		debug.error(DebugCategories.INTERACTION, 'Failed to set enabled state', { enabled, error: error.message });
		throw error;
	}
}

/**
 * Main Svelte action for keyboard handling
 * Enhanced with dual-layer event interception coordination
 */
export function keyboardAction(node, config = {}) {
	debug.info(DebugCategories.INTERACTION, 'keyboardAction() Svelte action initialized', { nodeId: node.id, nodeClass: node.className, configKeys: Object.keys(config) });

	try {
		// Track main element instance for coordination with document backup
		mainElementInstance = node;
		debug.debug(DebugCategories.INTERACTION, '📍 Main element instance tracked', { nodeTagName: node.tagName });

		function handleKeyDown(event) {
			debug.trace(DebugCategories.INTERACTION, 'KeyDown event captured', {});

			if (!isEnabled) {
				debug.debug(DebugCategories.INTERACTION, '🚫 Keyboard system disabled, ignoring event');
				return;
			}

			const keyCombo = getKeyCombo(event);
			debug.debug(DebugCategories.INTERACTION, '🔑 Key combo calculated', { keyCombo });

			// CRITICAL: Ignore empty key combos (modifier keys only)
			if (!keyCombo) {
				debug.debug(DebugCategories.INTERACTION, '🚫 Empty key combo ignored in main handler', { originalKey: event.key, reason: 'Modifier key events should not be processed' });
				return;
			}

			// Skip critical browser shortcuts - document backup handles them
			// This prevents double-prevention and maintains proper event flow
			if (CRITICAL_BROWSER_SHORTCUTS.includes(keyCombo)) {
				debug.debug(DebugCategories.INTERACTION, '⚡ Critical shortcut detected, skipping main processing (document backup handles it)', { keyCombo });
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

			debug.debug(DebugCategories.INTERACTION, 'Input field check', { activeElementTagName: activeElement?.tagName, isInputElement, activeContext, shouldIgnore: isInputElement && activeContext !== 'input' });

			if (isInputElement && activeContext !== 'input') {
				debug.debug(DebugCategories.INTERACTION, '🚫 Ignoring keyboard event in input field');
				return;
			}

			// CRITICAL FIX: Normalize keyCombo for comparison to handle case sensitivity
			// The issue: shortcuts can be registered with "Ctrl+K" (uppercase) but getKeyCombo() returns "ctrl+k" (lowercase)
			const normalizedKeyCombo = keyCombo.toLowerCase();
			debug.debug(DebugCategories.INTERACTION, 'Searching for matching shortcuts', { normalizedKeyCombo, totalShortcuts: shortcuts.size });

			const triggeredShortcuts = Array.from(shortcuts.values())
				.filter(shortcut => shortcut.key.toLowerCase() === normalizedKeyCombo);

			debug.debug(DebugCategories.INTERACTION, 'Found matching shortcuts', { count: triggeredShortcuts.length, shortcuts: triggeredShortcuts.map(s => s.id) });

			for (const shortcut of triggeredShortcuts) {
				debug.debug(DebugCategories.INTERACTION, 'Evaluating shortcut', {});

				const isActive = isShortcutActive(shortcut);
				const conditionMet = shortcut.condition();

				debug.debug(DebugCategories.INTERACTION, 'Shortcut evaluation result', {});

				if (isActive && conditionMet) {
					debug.debug(DebugCategories.INTERACTION, '⚡ Executing shortcut action', { id: shortcut.id, description: shortcut.description });

					// For critical shortcuts, document backup already prevented default
					// For others, prevent default as needed
					if (!CRITICAL_BROWSER_SHORTCUTS.includes(keyCombo)) {
						if (shortcut.preventDefault) {
							event.preventDefault();
							debug.debug(DebugCategories.INTERACTION, '🛑 Event default prevented');
						}
						if (shortcut.stopPropagation) {
							event.stopPropagation();
							debug.debug(DebugCategories.INTERACTION, '🛑 Event propagation stopped');
						}
					} else {
						debug.debug(DebugCategories.INTERACTION, '⚡ Critical shortcut - document backup already prevented default');
					}

					try {
						debug.debug(DebugCategories.INTERACTION, '🚀 Calling shortcut action', { id: shortcut.id });
						shortcut.action(event);
						debug.debug(DebugCategories.INTERACTION, '✅ Shortcut action completed successfully', { id: shortcut.id });

						const triggerInfo = {
							id: shortcut.id,
							description: shortcut.description,
							timestamp: Date.now()
						};

						keyboardActionStore.update(state => ({
							...state,
							lastTriggered: triggerInfo
						}));

						debug.info(DebugCategories.INTERACTION, 'Updated last triggered shortcut', triggerInfo);
					} catch (error) {
						debug.error(DebugCategories.INTERACTION, 'Shortcut execution failed', {
							id: shortcut.id,
							error: error.message,
							stack: error.stack
						});

						// Ensure errors don't break the keyboard system
						console.error(`Shortcut execution failed [${shortcut.id}]:`, error);
					}

					break; // Execute only the first matching shortcut
				}
			}

			if (triggeredShortcuts.length === 0) {
				debug.debug(DebugCategories.INTERACTION, '🔍 No shortcuts matched for key combo', { normalizedKeyCombo });
			}
		}

		debug.debug(DebugCategories.INTERACTION, '📡 Adding keydown event listener to main element', { phase: 'capture' });
		// Use Svelte's declarative event system with CAPTURE phase for priority
		// Document backup runs first, then main element handler processes actions
		node.addEventListener('keydown', handleKeyDown, { capture: true });

		return {
			update(newConfig) {
				debug.debug(DebugCategories.INTERACTION, '🔄 keyboardAction() update called', { newConfigKeys: Object.keys(newConfig) });
				// Handle configuration updates if needed
			},
			destroy() {
				debug.debug(DebugCategories.INTERACTION, '🗑️ keyboardAction() destroy called', { nodeTagName: node.tagName });
				node.removeEventListener('keydown', handleKeyDown, { capture: true });

				// Clear main element instance if this was the last one
				if (mainElementInstance === node) {
					mainElementInstance = null;
					debug.debug(DebugCategories.INTERACTION, '📍 Main element instance cleared');
				}

				debug.debug(DebugCategories.INTERACTION, '✅ keyboardAction cleanup completed');
			}
		};
	} catch (error) {
		debug.error(DebugCategories.INTERACTION, 'Failed to initialize keyboard action', { error: error.message, nodeTagName: node.tagName });
		throw error;
	}
}

/**
 * Check if the key is a modifier key (should be ignored for shortcut processing)
 */
function isModifierKey(key) {
	const modifierKeys = ['Control', 'Alt', 'Shift', 'Meta'];
	return modifierKeys.includes(key);
}

// Export the remaining functions for backward compatibility
export function getKeyCombo(event) {
	debug.debug(DebugCategories.INTERACTION, 'getKeyCombo() called', { key: event.key, code: event.code, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, shiftKey: event.shiftKey });

	// CRITICAL: Filter out modifier key events
	if (isModifierKey(event.key)) {
		debug.debug(DebugCategories.INTERACTION, '🚫 Modifier key event ignored', { key: event.key, reason: 'Modifier keys should not be processed as shortcuts' });
		return '';
	}

	try {
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

		const mainKey = specialKeys[key] || key;
		parts.push(mainKey);

		const result = parts.join('+');
		debug.debug(DebugCategories.INTERACTION, '✅ Key combo calculated', { modifiers: parts.slice(0, -1), mainKey, result });

		return result;
	} catch (error) {
		debug.error(DebugCategories.INTERACTION, 'Failed to calculate key combo', { error: error.message });
		return '';
	}
}

export function normalizeKeyCombo(keyCombo) {
	debug.debug(DebugCategories.INTERACTION, '🔧 normalizeKeyCombo() called', { keyCombo, type: typeof keyCombo });

	try {
		if (!keyCombo || typeof keyCombo !== 'string') {
			debug.warn(DebugCategories.INTERACTION, 'Invalid key combo provided, returning empty string', { keyCombo });
			return '';
		}

		const result = keyCombo
			.toLowerCase()
			.trim()
			.replace(/\s+/g, '')
			.replace(/\bcmd\b|\bcommand\b/g, 'meta')
			.replace(/\bcontrol\b/g, 'ctrl');

		debug.debug(DebugCategories.INTERACTION, '✅ Key combo normalized', { original: keyCombo, normalized: result });

		return result;
	} catch (error) {
		debug.error(DebugCategories.INTERACTION, 'Failed to normalize key combo', { keyCombo, error: error.message });
		return '';
	}
}

// Export shortcuts for backward compatibility
export { shortcuts as registeredShortcuts };

/**
 * Get initialization status
 */
export function getInitializationStatus() {
	const status = {
		isInitialized,
		initializationPromise: initializationPromise ? 'pending' : 'none',
		shortcutsCount: shortcuts.size,
		activeContext,
		isEnabled,
		documentBackupInstalled,
		hasMainElement: !!mainElementInstance
	};

	debug.debug(DebugCategories.INTERACTION, 'getInitializationStatus() called', status);

	return status;
}

/**
 * Reset system (for testing/debugging)
 */
export function resetKeyboardSystem() {
	debug.info(DebugCategories.INTERACTION, 'resetKeyboardSystem() called', {
		shortcutsCount: shortcuts.size,
		activeContext,
		isEnabled,
		isInitialized,
		documentBackupInstalled
	});

	try {
		shortcuts.clear();
		activeContext = 'global';
		isEnabled = true;
		isInitialized = false;
		initializationPromise = null;
		mainElementInstance = null;

		debug.debug(DebugCategories.INTERACTION, '🧹 Core state variables reset');

		// Remove document backup
		removeDocumentBackup();

		debug.debug(DebugCategories.INTERACTION, '💾 Resetting keyboardActionStore');
		// Reset stores
		keyboardActionStore.update(state => ({
			...state,
			shortcuts: {},
			activeContext: 'global',
			isEnabled: true,
			lastTriggered: null
		}));

		debug.debug(DebugCategories.INTERACTION, '🧹 Clearing keyboardEventStore');
		keyboardEventStore.set(null);

		debug.debug(DebugCategories.INTERACTION, '✅ Keyboard system reset completed successfully');
	} catch (error) {
		debug.error(DebugCategories.INTERACTION, 'Failed to reset keyboard system', { error: error.message });
		throw error;
	}
}

// Final module completion log
debug.info(DebugCategories.INTERACTION, 'keyboardAction.js module fully loaded and ready', {
	exportedFunctions: [
		'SHORTCUT_CONTEXTS',
		'SHORTCUT_CATEGORIES',
		'keyboardActionStore',
		'keyboardEventStore',
		'eventHistory',
		'initializeKeyboardSystem',
		'registerShortcut',
		'setContext',
		'setEnabled',
		'keyboardAction',
		'getKeyCombo',
		'normalizeKeyCombo',
		'registeredShortcuts',
		'getInitializationStatus',
		'resetKeyboardSystem',
		'dispatchKeyboardEvent'
	]
});