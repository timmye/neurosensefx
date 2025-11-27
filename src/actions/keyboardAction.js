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

// === COMPREHENSIVE DEBUG LOGGING SYSTEM ===
/**
 * Debug logging helper for keyboard system
 * Provides consistent format and easy filtering for debugging keyboard issues
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
debugLog('🔧 keyboardAction.js module loading', { timestamp: Date.now() });

// Export contexts for backward compatibility
export const SHORTCUT_CONTEXTS = Object.freeze({
	GLOBAL: 'global',
	SYMBOL_PALETTE: 'symbol-palette',
	DISPLAY_FOCUSED: 'display-focused',
	CONTEXT_MENU: 'context-menu',
	INPUT: 'input'
});

debugLog('📋 SHORTCUT_CONTEXTS defined', { contexts: Object.values(SHORTCUT_CONTEXTS) });

// Export categories for backward compatibility
export const SHORTCUT_CATEGORIES = Object.freeze({
	NAVIGATION: 'navigation',
	SYMBOL: 'symbol',
	DISPLAY: 'display',
	CONFIGURATION: 'configuration',
	SYSTEM: 'system'
});

debugLog('📂 SHORTCUT_CATEGORIES defined', { categories: Object.values(SHORTCUT_CATEGORIES) });

// Internal reactive store for backward compatibility
// Note: Main shortcutStore should be imported from shortcutStore.js
export const keyboardActionStore = writable({
	shortcuts: {},
	activeContext: 'global',
	isEnabled: true,
	lastTriggered: null
});

debugLog('🗄️ keyboardActionStore initialized', { initialState: { shortcuts: {}, activeContext: 'global', isEnabled: true } });

// === STORE-BASED EVENT SYSTEM ===
// Replaces CustomEvents with guaranteed listener availability

/**
 * Centralized keyboard event store
 * Eliminates race conditions from CustomEvent dispatch/listener timing
 */
export const keyboardEventStore = writable(null);

debugLog('📡 keyboardEventStore initialized for centralized event handling');

/**
 * Derived store for event history (useful for debugging)
 */
export const eventHistory = derived(keyboardEventStore, ($keyboardEventStore) => {
	// This could be expanded to maintain a full history if needed
	return $keyboardEventStore ? [$keyboardEventStore] : [];
});

debugLog('📊 eventHistory derived store created');

// Active shortcuts registry
const shortcuts = new Map();
let activeContext = 'global';
let isEnabled = true;

debugLog('🗂️ Core system state initialized', { shortcutsCount: 0, activeContext, isEnabled });

/**
 * System initialization state tracking
 */
let initializationPromise = null;
let isInitialized = false;

debugLog('🚀 Initialization tracking variables created', { isInitialized, hasPromise: false });

// === DUAL-LAYER EVENT INTERCEPTION SYSTEM ===
// Critical browser shortcuts that MUST be intercepted at document level
const CRITICAL_BROWSER_SHORTCUTS = Object.freeze(['ctrl+k', 'ctrl+f', 'ctrl+shift+k']);

debugLog('🛡️ Critical browser shortcuts defined', { shortcuts: CRITICAL_BROWSER_SHORTCUTS });

// Document backup system state
let documentBackupInstalled = false;
let mainElementInstance = null;

debugLog('🔧 Document backup system state initialized', { documentBackupInstalled, hasMainElement: false });

/**
 * Document-level backup handler for critical browser shortcuts ONLY
 * This is our emergency override that prevents browser search hijacking
 */
function handleDocumentBackup(event) {
	debugLog('🛡️ Document backup handler triggered', { key: event.key, code: event.code, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey, metaKey: event.metaKey });

	const keyCombo = getKeyCombo(event);
	debugLog('🔑 Key combo calculated', { keyCombo, originalKey: event.key });

	// CRITICAL: Ignore empty key combos (modifier keys only)
	if (!keyCombo) {
		debugLog('🚫 Empty key combo ignored', { originalKey: event.key, reason: 'Modifier key events should not be processed' });
		return;
	}

	// ONLY handle critical browser shortcuts - minimal footprint
	if (CRITICAL_BROWSER_SHORTCUTS.includes(keyCombo)) {
		debugLog('⚡ Critical shortcut intercepted by document backup', { keyCombo, action: 'PREVENTING DEFAULT BEHAVIOR' });

		// CRITICAL: Stop browser native behavior immediately
		event.preventDefault();
		event.stopPropagation();

		debugLog('📡 Forwarding to main system for processing', { keyCombo, source: 'document-backup' });

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
		debugLog('↩️ Non-critical shortcut ignored by document backup', { keyCombo });
	}
}

/**
 * Install document-level backup listener
 * Only installs once per application lifecycle
 */
function installDocumentBackup() {
	debugLog('🔧 installDocumentBackup() called', { documentBackupInstalled });

	if (documentBackupInstalled) {
		debugLog('⚠️ Document backup already installed, skipping', { documentBackupInstalled });
		return;
	}

	debugLog('📡 Installing document-level backup listener', { phase: 'capture', shortcuts: CRITICAL_BROWSER_SHORTCUTS });

	try {
		document.addEventListener('keydown', handleDocumentBackup, { capture: true });
		documentBackupInstalled = true;
		debugLog('✅ Document backup listener installed successfully', { documentBackupInstalled });
	} catch (error) {
		debugLog('❌ Failed to install document backup listener', { error: error.message }, 'ERROR');
	}
}

/**
 * Remove document backup listener (for cleanup)
 */
function removeDocumentBackup() {
	debugLog('🗑️ removeDocumentBackup() called', { documentBackupInstalled });

	if (documentBackupInstalled) {
		try {
			document.removeEventListener('keydown', handleDocumentBackup, { capture: true });
			documentBackupInstalled = false;
			debugLog('✅ Document backup listener removed successfully', { documentBackupInstalled });
		} catch (error) {
			debugLog('❌ Failed to remove document backup listener', { error: error.message }, 'ERROR');
		}
	} else {
		debugLog('⚠️ Document backup not installed, nothing to remove', { documentBackupInstalled });
	}
}

debugLog('🔧 Document backup management functions defined');

// Note: getKeyCombo and normalizeKeyCombo functions are exported below

/**
 * Check if shortcut is active in current context
 */
function isShortcutActive(shortcut) {
	const isActive = shortcut.contexts.includes('global') ||
					 shortcut.contexts.includes(activeContext);

	debugLog('🔍 Checking shortcut activity', {
		shortcutId: shortcut.id || 'unknown',
		shortcutContexts: shortcut.contexts,
		activeContext,
		isActive
	});

	return isActive;
}

/**
 * Update reactive store with current state
 */
function updateStore() {
	debugLog('📝 updateStore() called', { shortcutsCount: shortcuts.size, activeContext, isEnabled });

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

		debugLog('💾 Updating keyboardActionStore with current state', {
			totalShortcuts: shortcuts.size,
			shortcutsList: Object.keys(shortcutsObj),
			activeContext,
			isEnabled
		});

		keyboardActionStore.update(state => ({
			...state,
			shortcuts: shortcutsObj,
			activeContext,
			isEnabled
		}));

		debugLog('✅ keyboardActionStore updated successfully');
	} catch (error) {
		debugLog('❌ Failed to update keyboardActionStore', { error: error.message }, 'ERROR');
	}
}

/**
 * Dispatch store-based event (replaces CustomEvent.dispatchEvent)
 * Guaranteed listener availability - no race conditions
 */
export function dispatchKeyboardEvent(eventType, data = {}) {
	debugLog('📡 dispatchKeyboardEvent() called', { eventType, dataKeys: Object.keys(data) });

	try {
		const eventData = {
			type: eventType,
			data,
			timestamp: Date.now(),
			source: 'keyboardAction'
		};

		debugLog('📤 Dispatching keyboard event', {
			type: eventType,
			timestamp: eventData.timestamp,
			source: eventData.source,
			data: eventData.data
		});

		// Update store - all subscribers will receive this immediately
		keyboardEventStore.set(eventData);

		debugLog('✅ Keyboard event dispatched successfully', { eventType });
	} catch (error) {
		debugLog('❌ Failed to dispatch keyboard event', { eventType, error: error.message }, 'ERROR');
	}
}

/**
 * Initialize keyboard system with proper sequencing
 * Guarantees initialization order to prevent race conditions
 */
export async function initializeKeyboardSystem() {
	debugLog('🚀 initializeKeyboardSystem() called', { isInitialized, hasPromise: !!initializationPromise });

	if (initializationPromise) {
		debugLog('⏳ Initialization already in progress, returning existing promise');
		return initializationPromise;
	}

	debugLog('🔄 Starting keyboard system initialization');

	initializationPromise = (async () => {
		try {
			debugLog('📋 Phase 1: Setting up core system');
			// Phase 1: Setup core system
			setupCoreSystem();

			debugLog('📡 Phase 2: Setting up event communication');
			// Phase 2: Setup event communication
			setupEventCommunication();

			debugLog('✅ Phase 3: Verifying system readiness');
			// Phase 3: Verify system readiness
			await verifySystemReadiness();

			isInitialized = true;
			debugLog('🎉 Keyboard system initialization completed successfully', { isInitialized });

			return 'ready';
		} catch (error) {
			debugLog('❌ Keyboard system initialization failed', {
				error: error.message,
				stack: error.stack
			}, 'ERROR');

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
	debugLog('🔧 setupCoreSystem() starting');

	try {
		// Ensure initial state is properly set
		activeContext = 'global';
		isEnabled = true;

		debugLog('📊 Setting initial core state', { activeContext, isEnabled });

		// Initialize stores with proper state
		const newState = {
			...keyboardActionStore,
			activeContext,
			isEnabled,
			lastTriggered: null
		};

		debugLog('💾 Updating keyboardActionStore with initial state', newState);
		keyboardActionStore.set(newState);

		debugLog('🧹 Clearing keyboardEventStore');
		keyboardEventStore.set(null); // Clear any previous events

		// CRITICAL: Install document-level backup for critical browser shortcuts
		debugLog('🛡️ Installing document-level backup for critical shortcuts');
		installDocumentBackup();

		debugLog('✅ Core system setup completed successfully');
	} catch (error) {
		debugLog('❌ Core system setup failed', { error: error.message }, 'ERROR');
		throw error;
	}
}

/**
 * Setup event communication system
 */
function setupEventCommunication() {
	debugLog('📡 setupEventCommunication() starting');

	try {
		// Store-based events are inherently ready
		// No additional setup needed for store subscribers
		debugLog('✅ Store-based event communication ready (no additional setup needed)');
	} catch (error) {
		debugLog('❌ Event communication setup failed', { error: error.message }, 'ERROR');
		throw error;
	}
}

/**
 * Verify system is ready for operation
 */
async function verifySystemReadiness() {
	debugLog('🔍 verifySystemReadiness() starting');

	try {
		// Verify stores are responsive
		const testEvent = {
			type: 'system-test',
			data: { test: true },
			timestamp: Date.now()
		};

		debugLog('🧪 Testing store dispatch with test event', testEvent);

		// Test store dispatch
		keyboardEventStore.set(testEvent);

		debugLog('⏳ Waiting for state propagation...');
		// Small delay to ensure state propagation
		await new Promise(resolve => setTimeout(resolve, 10));

		debugLog('🔍 Verifying test event can be read back');

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
		debugLog('📊 Test event verification result', {
			receivedType: eventResult?.type,
			expectedType: 'system-test',
			eventMatches: eventResult?.type === 'system-test'
		});

		if (eventResult?.type !== 'system-test') {
			throw new Error('Store-based event system not responding correctly');
		}

		debugLog('🧹 Clearing test event');
		// Clear test event
		keyboardEventStore.set(null);

		debugLog('✅ System readiness verification completed successfully');
	} catch (error) {
		debugLog('❌ System readiness verification failed', { error: error.message }, 'ERROR');
		throw error;
	}
}

/**
 * Register a keyboard shortcut (backward compatibility)
 */
export function registerShortcut(id, config) {
	debugLog('📝 registerShortcut() called', { id, configKeys: Object.keys(config) });

	try {
		const normalizedKey = normalizeKeyCombo(config.key);
		debugLog('🔑 Key normalized for registration', {
			originalKey: config.key,
			normalizedKey
		});

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

		debugLog('📋 Creating shortcut object', {
			id,
			key: shortcut.key,
			description: shortcut.description,
			category: shortcut.category,
			contexts: shortcut.contexts,
			hasAction: !!shortcut.action
		});

		shortcuts.set(id, shortcut);
		debugLog('💾 Shortcut registered in memory', { totalShortcuts: shortcuts.size });

		updateStore();

		debugLog('✅ Shortcut registration completed', { id, key: shortcut.key });

		return () => {
			debugLog('🗑️ Unregistering shortcut', { id });
			shortcuts.delete(id);
			updateStore();
			debugLog('✅ Shortcut unregistered', { id, remainingShortcuts: shortcuts.size });
		};
	} catch (error) {
		debugLog('❌ Failed to register shortcut', { id, error: error.message }, 'ERROR');
		throw error;
	}
}

/**
 * Set active context for shortcuts
 */
export function setContext(context) {
	debugLog('🎯 setContext() called', { newContext: context, previousContext: activeContext });

	try {
		activeContext = context;
		keyboardActionStore.update(state => ({ ...state, activeContext: context }));

		debugLog('✅ Active context updated successfully', { activeContext: context });
	} catch (error) {
		debugLog('❌ Failed to set context', { context, error: error.message }, 'ERROR');
		throw error;
	}
}

/**
 * Enable/disable keyboard shortcuts
 */
export function setEnabled(enabled) {
	debugLog('🔛 setEnabled() called', { enabled, previousState: isEnabled });

	try {
		isEnabled = enabled;
		keyboardActionStore.update(state => ({ ...state, isEnabled: enabled }));

		debugLog('✅ Keyboard system enabled/disabled successfully', { isEnabled: enabled });
	} catch (error) {
		debugLog('❌ Failed to set enabled state', { enabled, error: error.message }, 'ERROR');
		throw error;
	}
}

/**
 * Main Svelte action for keyboard handling
 * Enhanced with dual-layer event interception coordination
 */
export function keyboardAction(node, config = {}) {
	debugLog('🎯 keyboardAction() Svelte action initialized', {
		nodeTagName: node.tagName,
		nodeId: node.id,
		nodeClass: node.className,
		configKeys: Object.keys(config)
	});

	try {
		// Track main element instance for coordination with document backup
		mainElementInstance = node;
		debugLog('📍 Main element instance tracked', { nodeTagName: node.tagName });

		function handleKeyDown(event) {
			debugLog('⌨️ KeyDown event captured', {
				key: event.key,
				code: event.code,
				ctrlKey: event.ctrlKey,
				shiftKey: event.shiftKey,
				altKey: event.altKey,
				metaKey: event.metaKey,
				isEnabled,
				activeContext,
				targetTagName: event.target.tagName
			});

			if (!isEnabled) {
				debugLog('🚫 Keyboard system disabled, ignoring event');
				return;
			}

			const keyCombo = getKeyCombo(event);
			debugLog('🔑 Key combo calculated', { keyCombo });

			// CRITICAL: Ignore empty key combos (modifier keys only)
			if (!keyCombo) {
				debugLog('🚫 Empty key combo ignored in main handler', { originalKey: event.key, reason: 'Modifier key events should not be processed' });
				return;
			}

			// Skip critical browser shortcuts - document backup handles them
			// This prevents double-prevention and maintains proper event flow
			if (CRITICAL_BROWSER_SHORTCUTS.includes(keyCombo)) {
				debugLog('⚡ Critical shortcut detected, skipping main processing (document backup handles it)', { keyCombo });
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

			debugLog('🔍 Input field check', {
				activeElementTagName: activeElement?.tagName,
				isInputElement,
				activeContext,
				shouldIgnore: isInputElement && activeContext !== 'input'
			});

			if (isInputElement && activeContext !== 'input') {
				debugLog('🚫 Ignoring keyboard event in input field');
				return;
			}

			// CRITICAL FIX: Normalize keyCombo for comparison to handle case sensitivity
			// The issue: shortcuts can be registered with "Ctrl+K" (uppercase) but getKeyCombo() returns "ctrl+k" (lowercase)
			const normalizedKeyCombo = keyCombo.toLowerCase();
			debugLog('🔍 Searching for matching shortcuts', {
				normalizedKeyCombo,
				totalShortcuts: shortcuts.size,
				registeredKeys: Array.from(shortcuts.values()).map(s => s.key)
			});

			const triggeredShortcuts = Array.from(shortcuts.values())
				.filter(shortcut => shortcut.key.toLowerCase() === normalizedKeyCombo);

			debugLog('🎯 Found matching shortcuts', {
				matchedCount: triggeredShortcuts.length,
				matchedIds: triggeredShortcuts.map(s => s.id)
			});

			for (const shortcut of triggeredShortcuts) {
				debugLog('🔍 Evaluating shortcut', {
					id: shortcut.id,
					key: shortcut.key,
					contexts: shortcut.contexts,
					hasCondition: !!shortcut.condition
				});

				const isActive = isShortcutActive(shortcut);
				const conditionMet = shortcut.condition();

				debugLog('🔍 Shortcut evaluation result', {
					id: shortcut.id,
					isActive,
					conditionMet,
					shouldExecute: isActive && conditionMet
				});

				if (isActive && conditionMet) {
					debugLog('⚡ Executing shortcut action', { id: shortcut.id, description: shortcut.description });

					// For critical shortcuts, document backup already prevented default
					// For others, prevent default as needed
					if (!CRITICAL_BROWSER_SHORTCUTS.includes(keyCombo)) {
						if (shortcut.preventDefault) {
							event.preventDefault();
							debugLog('🛑 Event default prevented');
						}
						if (shortcut.stopPropagation) {
							event.stopPropagation();
							debugLog('🛑 Event propagation stopped');
						}
					} else {
						debugLog('⚡ Critical shortcut - document backup already prevented default');
					}

					try {
						debugLog('🚀 Calling shortcut action', { id: shortcut.id });
						shortcut.action(event);
						debugLog('✅ Shortcut action completed successfully', { id: shortcut.id });

						const triggerInfo = {
							id: shortcut.id,
							description: shortcut.description,
							timestamp: Date.now()
						};

						keyboardActionStore.update(state => ({
							...state,
							lastTriggered: triggerInfo
						}));

						debugLog('💾 Updated last triggered shortcut', triggerInfo);
					} catch (error) {
						debugLog('❌ Shortcut execution failed', {
							id: shortcut.id,
							error: error.message,
							stack: error.stack
						}, 'ERROR');

						// Ensure errors don't break the keyboard system
						console.error(`Shortcut execution failed [${shortcut.id}]:`, error);
					}

					break; // Execute only the first matching shortcut
				}
			}

			if (triggeredShortcuts.length === 0) {
				debugLog('🔍 No shortcuts matched for key combo', { normalizedKeyCombo });
			}
		}

		debugLog('📡 Adding keydown event listener to main element', { phase: 'capture' });
		// Use Svelte's declarative event system with CAPTURE phase for priority
		// Document backup runs first, then main element handler processes actions
		node.addEventListener('keydown', handleKeyDown, { capture: true });

		return {
			update(newConfig) {
				debugLog('🔄 keyboardAction() update called', { newConfigKeys: Object.keys(newConfig) });
				// Handle configuration updates if needed
			},
			destroy() {
				debugLog('🗑️ keyboardAction() destroy called', { nodeTagName: node.tagName });
				node.removeEventListener('keydown', handleKeyDown, { capture: true });

				// Clear main element instance if this was the last one
				if (mainElementInstance === node) {
					mainElementInstance = null;
					debugLog('📍 Main element instance cleared');
				}

				debugLog('✅ keyboardAction cleanup completed');
			}
		};
	} catch (error) {
		debugLog('❌ Failed to initialize keyboard action', { error: error.message, nodeTagName: node.tagName }, 'ERROR');
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
	debugLog('🔑 getKeyCombo() called', {
		key: event.key,
		code: event.code,
		ctrlKey: event.ctrlKey,
		metaKey: event.metaKey,
		altKey: event.altKey,
		shiftKey: event.shiftKey
	});

	// CRITICAL: Filter out modifier key events
	if (isModifierKey(event.key)) {
		debugLog('🚫 Modifier key event ignored', { key: event.key, reason: 'Modifier keys should not be processed as shortcuts' });
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
		debugLog('✅ Key combo calculated', { modifiers: parts.slice(0, -1), mainKey, result });

		return result;
	} catch (error) {
		debugLog('❌ Failed to calculate key combo', { error: error.message }, 'ERROR');
		return '';
	}
}

export function normalizeKeyCombo(keyCombo) {
	debugLog('🔧 normalizeKeyCombo() called', { keyCombo, type: typeof keyCombo });

	try {
		if (!keyCombo || typeof keyCombo !== 'string') {
			debugLog('⚠️ Invalid key combo provided, returning empty string', { keyCombo });
			return '';
		}

		const result = keyCombo
			.toLowerCase()
			.trim()
			.replace(/\s+/g, '')
			.replace(/\bcmd\b|\bcommand\b/g, 'meta')
			.replace(/\bcontrol\b/g, 'ctrl');

		debugLog('✅ Key combo normalized', { original: keyCombo, normalized: result });

		return result;
	} catch (error) {
		debugLog('❌ Failed to normalize key combo', { keyCombo, error: error.message }, 'ERROR');
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

	debugLog('📊 getInitializationStatus() called', status);

	return status;
}

/**
 * Reset system (for testing/debugging)
 */
export function resetKeyboardSystem() {
	debugLog('🔄 resetKeyboardSystem() called', {
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

		debugLog('🧹 Core state variables reset');

		// Remove document backup
		removeDocumentBackup();

		debugLog('💾 Resetting keyboardActionStore');
		// Reset stores
		keyboardActionStore.update(state => ({
			...state,
			shortcuts: {},
			activeContext: 'global',
			isEnabled: true,
			lastTriggered: null
		}));

		debugLog('🧹 Clearing keyboardEventStore');
		keyboardEventStore.set(null);

		debugLog('✅ Keyboard system reset completed successfully');
	} catch (error) {
		debugLog('❌ Failed to reset keyboard system', { error: error.message }, 'ERROR');
		throw error;
	}
}

// Final module completion log
debugLog('✅ keyboardAction.js module fully loaded and ready', {
	exportedFunctions: [
		'SHORTCUT_CONTEXTS',
		'SHORTCUT_CATEGORIES',
		'keyboardActionStore',
		'keyboardEventStore',
		'eventHistory',
		'dispatchKeyboardEvent',
		'initializeKeyboardSystem',
		'registerShortcut',
		'setContext',
		'setEnabled',
		'keyboardAction',
		'getKeyCombo',
		'normalizeKeyCombo',
		'registeredShortcuts',
		'getInitializationStatus',
		'resetKeyboardSystem'
	]
});