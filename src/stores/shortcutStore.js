/**
 * Reactive Shortcut Store for NeuroSense FX
 *
 * Provides Svelte store integration for keyboard shortcuts
 * with workspace persistence and user customization support.
 */

import { writable, derived, get } from 'svelte/store';
import { keyboardAction, registerShortcut, setContext, setEnabled, keyboardActionStore, dispatchKeyboardEvent, initializeKeyboardSystem, keyboardEventStore } from '../actions/keyboardAction.js';
import DEFAULT_SHORTCUTS, {
	WORKFLOW_PRIORITIES,
	validateShortcutConfig,
	findShortcutConflicts,
	getShortcutsByCategory,
	getShortcutsByWorkflow,
	sortShortcutsByPriority,
	formatKeyForDisplay
} from '../utils/shortcutConfig.js';
import { displayStore, icons, displayActions, panels } from './displayStore.js';
import { displayStateStore, displayStateActions } from './displayStateStore.js';
import { workspacePersistenceManager } from '../utils/workspacePersistence.js';

// === COMPREHENSIVE DEBUG LOGGING SYSTEM ===
/**
 * Debug logging helper for shortcut store system
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
debugLog('🔧 shortcutStore.js module loading', { timestamp: Date.now() });

/**
 * Store for shortcut state and configuration
 * Now uses the new action-based system internally
 */
export const shortcutStore = writable({
	shortcuts: { ...DEFAULT_SHORTCUTS },
	userShortcuts: {},
	activeContext: 'global',
	isEnabled: true,
	showHelp: false,
	lastTriggered: null,
	customShortcuts: {},
	conflicts: []
});

debugLog('🗄️ shortcutStore initialized', {
	totalDefaultShortcuts: Object.keys(DEFAULT_SHORTCUTS).length,
	initialState: {
		shortcutsCount: Object.keys(DEFAULT_SHORTCUTS).length,
		userShortcutsCount: 0,
		activeContext: 'global',
		isEnabled: true,
		customShortcutsCount: 0,
		conflictsCount: 0
	}
});

/**
 * Derived store for currently active shortcuts
 */
export const activeShortcuts = derived(
	[shortcutStore, displayStore],
	([$shortcutStore, $displayStore]) => {
		const context = determineActiveContext($displayStore);
		return Object.entries($shortcutStore.shortcuts)
			.filter(([id, shortcut]) => isShortcutActive(shortcut, context))
			.map(([id, shortcut]) => ({
				...shortcut,
				id, // ✅ CRITICAL FIX: Include the shortcut ID to prevent undefined keys
				formattedKey: formatKeyForDisplay(typeof shortcut.key === 'string' ? shortcut.key : '')
			}));
	}
);

/**
 * Derived store for shortcuts by category
 */
export const shortcutsByCategory = derived(
	shortcutStore,
	($shortcutStore) => {
		const categories = {};
		Object.entries($shortcutStore.shortcuts).forEach(([id, shortcut]) => {
			if (!categories[shortcut.category]) {
				categories[shortcut.category] = [];
			}
			categories[shortcut.category].push({
				...shortcut,
				id, // ✅ CRITICAL FIX: Include the shortcut ID to prevent undefined keys
				formattedKey: formatKeyForDisplay(typeof shortcut.key === 'string' ? shortcut.key : '')
			});
		});

		// Sort each category by priority
		Object.keys(categories).forEach(category => {
			categories[category] = sortShortcutsByPriority(categories[category]);
		});

		return categories;
	}
);

/**
 * Derived store for workflow-specific shortcuts
 */
export const shortcutsByWorkflow = derived(
	shortcutStore,
	($shortcutStore) => {
		const workflows = {
			core: [],
			'quick-actions': [],
			professional: [],
			system: []
		};

		Object.entries($shortcutStore.shortcuts).forEach(([id, shortcut]) => {
			const workflow = shortcut.workflow || 'system';
			if (workflows[workflow]) {
				workflows[workflow].push({
					...shortcut,
					id, // ✅ CRITICAL FIX: Include the shortcut ID to prevent undefined keys
					formattedKey: formatKeyForDisplay(typeof shortcut.key === 'string' ? shortcut.key : '')
				});
			}
		});

		// Sort each workflow by priority
		Object.keys(workflows).forEach(workflow => {
			workflows[workflow] = sortShortcutsByPriority(workflows[workflow]);
		});

		return workflows;
	}
);

/**
 * Derived store for shortcut conflicts
 */
export const shortcutConflicts = derived(
	shortcutStore,
	($shortcutStore) => {
		const allShortcuts = {
			...$shortcutStore.shortcuts,
			...$shortcutStore.userShortcuts,
			...$shortcutStore.customShortcuts
		};

		return findShortcutConflicts(allShortcuts);
	}
);

/**
 * Initialize shortcut system with default shortcuts
 * Enhanced with dual-layer event interception support
 */
export async function initializeShortcuts() {
	debugLog('🚀 initializeShortcuts() called - starting shortcut system initialization');

	try {
		debugLog('📡 Phase 1: Initializing core keyboard system with document backup');
		// First initialize the core keyboard system with document backup
		await initializeKeyboardSystem();

		debugLog('🔧 Phase 1.5: Verifying display store initialization');
		// 🔧 CRITICAL FIX: Ensure display stores are properly initialized before registering shortcuts
		const $displayStateStore = get(displayStateStore);
		if (!$displayStateStore || !$displayStateStore.displays) {
			debugLog('❌ Display state store not available during shortcut initialization', {
				hasStore: !!$displayStateStore,
				hasDisplays: !!$displayStateStore?.displays
			}, 'ERROR');
			// Don't throw error - continue with initialization but display switching may not work
		}

		const $shortcutStore = get(shortcutStore);
		debugLog('📊 Current shortcut store state', {
			shortcutsCount: Object.keys($shortcutStore.shortcuts).length,
			activeContext: $shortcutStore.activeContext,
			isEnabled: $shortcutStore.isEnabled,
			displayStoreAvailable: !!$displayStateStore?.displays
		});

		debugLog('📝 Phase 2: Registering default shortcuts with enhanced system');
		let registeredCount = 0;
		let skippedCount = 0;

		// Register all default shortcuts with the enhanced system
		// These will now work with the dual-layer architecture
		Object.entries(DEFAULT_SHORTCUTS).forEach(([id, config]) => {
			debugLog('🔍 Creating action for shortcut', { id, key: config.key, category: config.category });

			const action = createActionForShortcut(id);
			if (action) {
				debugLog('📝 Registering shortcut with action system', { id, key: config.key });
				registerShortcut(id, {
					...config,
					action
				});
				registeredCount++;
			} else {
				debugLog('⚠️ No action created for shortcut', { id, key: config.key });
				skippedCount++;
			}
		});

		debugLog('📊 Default shortcuts registration completed', {
			totalShortcuts: Object.keys(DEFAULT_SHORTCUTS).length,
			registeredCount,
			skippedCount
		});

		debugLog('🎯 Phase 3: Setting up context management with dual-layer support');
		// Setup context management with dual-layer support
		setupContextManagement();

		debugLog('💾 Phase 4: Loading user customizations');
		// Load user customizations
		await loadUserShortcuts();

		debugLog('🎉 Shortcut system initialization completed successfully', {
			registeredShortcuts: registeredCount,
			totalDefaultShortcuts: Object.keys(DEFAULT_SHORTCUTS).length
		});
	} catch (error) {
		debugLog('❌ Shortcut system initialization failed', {
			error: error.message,
			stack: error.stack
		}, 'ERROR');
		console.error('Shortcut system initialization failed:', error);
		throw error;
	}
}

/**
 * Create action handlers for shortcuts
 */
function createActionForShortcut(id) {
	debugLog('🔧 createActionForShortcut() called', { shortcutId: id });

	let action = null;

	switch (id) {
		// === SYMBOL WORKFLOW ===
		case 'symbol.focusPalette':
			action = () => {
				debugLog('⚡ Executing symbol.focusPalette action');
				const $icons = get(icons);
				const symbolIcon = $icons.get('symbol-palette-icon');
				if (symbolIcon && !symbolIcon.isExpanded) {
					displayActions.expandIcon('symbol-palette-icon');
				}
			};
			break;

		case 'symbol.togglePalette':
			action = () => {
				debugLog('⚡ Executing symbol.togglePalette action');
				dispatchKeyboardEvent('toggleSymbolPalette');
			};
			break;

		case 'symbol.quickSubscribe':
			action = () => {
				debugLog('⚡ Executing symbol.quickSubscribe action');
				dispatchKeyboardEvent('quickSubscribe');
			};
			break;

		case 'symbol.quickSubscribeNew':
			action = () => {
				debugLog('⚡ Executing symbol.quickSubscribeNew action');
				dispatchKeyboardEvent('quickSubscribe', { newDisplay: true });
			};
			break;

		case 'symbol.recentCycle':
			action = () => {
				debugLog('⚡ Executing symbol.recentCycle action');
				dispatchKeyboardEvent('cycleRecentSymbols');
			};
			break;

		case 'symbol.favorites':
			action = () => {
				debugLog('⚡ Executing symbol.favorites action');
				dispatchKeyboardEvent('showSymbolFavorites');
			};
			break;

		// === DISPLAY NAVIGATION ===
		case 'display.switch1':
		case 'display.switch2':
		case 'display.switch3':
		case 'display.switch4':
		case 'display.switch5':
		case 'display.switch6':
		case 'display.switch7':
		case 'display.switch8':
		case 'display.switch9':
			const displayNumber = parseInt(id.replace('display.switch', ''));
			action = () => {
				debugLog('⚡ Executing display.switch action', { id, displayNumber });

				try {
					// 🔧 CRITICAL FIX: Add proper error handling and fallbacks
					const $displayStateStore = get(displayStateStore);

					// Check if store is properly initialized and has displays
					if (!$displayStateStore || !$displayStateStore.displays) {
						debugLog('❌ Display state store not properly initialized', {
							hasStore: !!$displayStateStore,
							hasDisplays: !!$displayStateStore?.displays
						});
						return;
					}

					const displays = Array.from($displayStateStore.displays.values());
					debugLog('🔍 Checking display availability', {
						displayNumber,
						totalDisplays: displays.length,
						hasDisplay: !!displays[displayNumber - 1]
					});

					if (displays[displayNumber - 1]) {
						const targetDisplayId = displays[displayNumber - 1].id;
						debugLog('📡 Dispatching focusDisplay event', { targetDisplayId });
						dispatchKeyboardEvent('focusDisplay', { displayId: targetDisplayId });
					} else {
						debugLog('⚠️ No display found for switch action', { displayNumber, availableDisplays: displays.length });
					}
				} catch (error) {
					debugLog('❌ Error in display.switch action', {
						id,
						displayNumber,
						error: error.message,
						stack: error.stack
					}, 'ERROR');
				}
			};
			break;

		case 'display.next':
			action = () => {
				debugLog('⚡ Executing display.next action');
				dispatchKeyboardEvent('navigateDisplay', { direction: 'next' });
			};
			break;

		case 'display.previous':
			action = () => {
				debugLog('⚡ Executing display.previous action');
				dispatchKeyboardEvent('navigateDisplay', { direction: 'previous' });
			};
			break;

		case 'display.navigateRight':
			action = () => {
				debugLog('⚡ Executing display.navigateRight action');
				dispatchKeyboardEvent('navigateDisplay', { direction: 'right' });
			};
			break;

		case 'display.navigateLeft':
			action = () => {
				debugLog('⚡ Executing display.navigateLeft action');
				dispatchKeyboardEvent('navigateDisplay', { direction: 'left' });
			};
			break;

		case 'display.navigateUp':
			action = () => {
				debugLog('⚡ Executing display.navigateUp action');
				dispatchKeyboardEvent('navigateDisplay', { direction: 'up' });
			};
			break;

		case 'display.navigateDown':
			action = () => {
				debugLog('⚡ Executing display.navigateDown action');
				dispatchKeyboardEvent('navigateDisplay', { direction: 'down' });
			};
			break;

		case 'display.close':
			action = () => {
				debugLog('⚡ Executing display.close action');
				dispatchKeyboardEvent('closeDisplay');
			};
			break;

		// === QUICK ACTIONS ===
		case 'quick.contextMenu':
			return () => {
				dispatchKeyboardEvent('showContextMenu');
			};

		case 'quick.configPanel':
			return () => {
				dispatchKeyboardEvent('showQuickConfig');
			};

		case 'quick.pauseUpdates':
			return () => {
				dispatchKeyboardEvent('toggleDataUpdates');
			};

		case 'quick.fullscreen':
			return () => {
				dispatchKeyboardEvent('toggleFullscreen');
			};

		case 'quick.addMarker':
			return () => {
				dispatchKeyboardEvent('addPriceMarker');
			};

		case 'quick.clearMarkers':
			return () => {
				dispatchKeyboardEvent('clearMarkers');
			};

		// === PROFESSIONAL FEATURES ===
		case 'pro.layoutPreset1':
		case 'pro.layoutPreset2':
		case 'pro.layoutPreset3':
			const presetNumber = parseInt(id.replace('pro.layoutPreset', ''));
			return () => {
				dispatchKeyboardEvent('applyLayoutPreset', { preset: presetNumber });
			};

		case 'pro.groupDisplays':
			return () => {
				dispatchKeyboardEvent('groupDisplays');
			};

		case 'pro.ungroupDisplays':
			return () => {
				dispatchKeyboardEvent('ungroupDisplays');
			};

		case 'pro.saveLayout':
			return () => {
				dispatchKeyboardEvent('saveLayoutPreset');
			};

		// === SYSTEM & HELP ===
		case 'system.help':
			return () => {
				setShowHelp(true);
			};

		case 'system.statusPanel':
			return () => {
				dispatchKeyboardEvent('toggleStatusPanel');
			};

		case 'system.performanceMonitor':
			return () => {
				dispatchKeyboardEvent('togglePerformanceMonitor');
			};

		case 'system.screenshot':
			return () => {
				dispatchKeyboardEvent('takeScreenshot');
			};

		case 'system.saveWorkspace':
			return () => {
				dispatchKeyboardEvent('saveWorkspace');
			};

		case 'system.escape':
			return () => {
				dispatchKeyboardEvent('escape');
			};

		// === LEGACY ===
		case 'legacy.newDisplay':
			return () => {
				dispatchKeyboardEvent('newDisplay');
			};

		default:
		debugLog('⚠️ No action defined for shortcut', { id });
		return null;
	}

	debugLog('✅ Action created for shortcut', { id, hasAction: !!action });
	return action;
}

// Handle custom context events
function handleSetShortcutContext(event) {
	debugLog('🎯 handleSetShortcutContext() called', { context: event.detail.context });

	setContext(event.detail.context);
	shortcutStore.update(state => ({ ...state, activeContext: event.detail.context }));

	debugLog('✅ Shortcut context updated', { newContext: event.detail.context });
}

/**
 * Handle critical shortcut events from document backup system
 * This processes Ctrl+K, Ctrl+F, Ctrl+Shift+K intercepted by document backup
 */
function handleCriticalShortcut(eventData) {
	debugLog('🚨 handleCriticalShortcut() called - processing critical shortcut from document backup');

	const keyCombo = eventData?.data?.keyCombo;
	const event = eventData?.data?.event;

	debugLog('📊 Critical shortcut data received', { keyCombo, hasEvent: !!event, eventData });

	if (!keyCombo) {
		debugLog('❌ No key combo in critical shortcut event');
		return;
	}

	// CRITICAL FIX: Normalize keyCombo for comparison to handle case sensitivity
	// The issue: DEFAULT_SHORTCUTS uses "Ctrl+K" (uppercase) but getKeyCombo() returns "ctrl+k" (lowercase)
	const normalizedKeyCombo = keyCombo.toLowerCase();

	debugLog('🔍 Searching for matching critical shortcut', {
		originalKeyCombo: keyCombo,
		normalizedKeyCombo,
		totalShortcuts: Object.keys(DEFAULT_SHORTCUTS).length
	});

	// Find matching shortcut with case-insensitive comparison
	const matchingShortcut = Object.values(DEFAULT_SHORTCUTS).find(shortcut =>
		shortcut.key.toLowerCase() === normalizedKeyCombo
	);

	if (matchingShortcut) {
		const shortcutId = Object.keys(DEFAULT_SHORTCUTS).find(id => DEFAULT_SHORTCUTS[id] === matchingShortcut);
		debugLog('✅ Found matching critical shortcut', { shortcutId, shortcut: matchingShortcut });

		const action = createActionForShortcut(shortcutId);

		if (action) {
			debugLog('⚡ Executing critical shortcut action', { shortcutId, keyCombo });
			try {
				action(event);
				debugLog('✅ Critical shortcut action completed successfully', { shortcutId });
			} catch (error) {
				debugLog('❌ Error executing critical shortcut', {
					shortcutId,
					keyCombo,
					error: error.message,
					stack: error.stack
				}, 'ERROR');
				console.error(`Error executing critical shortcut ${keyCombo}:`, error);
			}
		} else {
			debugLog('❌ No action created for critical shortcut', { shortcutId });
		}
	} else {
		debugLog('⚠️ No matching shortcut found for critical key combo', { normalizedKeyCombo });
	}
}

/**
 * Setup context management based on current application state
 * Enhanced with dual-layer event interception support
 */
function setupContextManagement() {
	debugLog('🔧 setupContextManagement() called - setting up context management');

	try {
		debugLog('👂 Setting up display store subscription for context changes');
		// Listen for context changes - subscribe to both stores for complete context
		displayStore.subscribe($displayStore => {
			const newContext = determineActiveContext($displayStore);
			debugLog('🎯 Context change detected from main store', {
				newContext,
				activePanelId: $displayStore.activePanelId,
				contextMenuOpen: $displayStore.contextMenu?.open
			});

			setContext(newContext);
			shortcutStore.update(state => ({ ...state, activeContext: newContext }));
		});

		// Also listen to displayStateStore for display focus changes
		displayStateStore.subscribe($displayStateStore => {
			const newContext = determineActiveContext($displayStateStore);
			debugLog('🎯 Context change detected from display state store', {
				newContext,
				activeDisplayId: $displayStateStore.activeDisplayId,
				displayCount: $displayStateStore.displays?.size || 0
			});

			setContext(newContext);
			shortcutStore.update(state => ({ ...state, activeContext: newContext }));
		});

		debugLog('📡 Creating custom event store for context management (Svelte-first pattern)');
		// Create custom event store for context management (Svelte-first pattern)
		const customEventStore = writable(null);

		debugLog('👂 Setting up custom event store subscription');
		// Subscribe to custom events and critical shortcuts from unified system
		customEventStore.subscribe((eventData) => {
			if (eventData) {
				debugLog('📡 Custom event received', { type: eventData.type });
				if (eventData.type === 'setShortcutContext') {
					handleSetShortcutContext(eventData);
				} else if (eventData.type === 'criticalShortcut') {
					// Handle critical shortcuts intercepted by document backup
					handleCriticalShortcut(eventData);
				}
			}
		});

		debugLog('🔧 Exporting custom event store setter to shortcutStore');
		// Export for use in components
		shortcutStore.setCustomEvent = customEventStore.set;

		debugLog('👂 Setting up keyboard event store subscription for critical shortcuts');
		// Listen to keyboard event store for critical shortcuts
		keyboardEventStore.subscribe((eventData) => {
			if (eventData && eventData.type === 'criticalShortcut') {
				debugLog('🚨 Critical shortcut event received from keyboard store');
				handleCriticalShortcut(eventData);
			}
		});

		debugLog('✅ Context management setup completed successfully');
	} catch (error) {
		debugLog('❌ Failed to setup context management', { error: error.message, stack: error.stack }, 'ERROR');
		throw error;
	}
}

/**
 * Trigger custom context change event (Svelte-first approach)
 * @param {string} context - New context to set
 */
export function setShortcutContext(context) {
	const $shortcutStore = get(shortcutStore);
	if ($shortcutStore.setCustomEvent) {
		$shortcutStore.setCustomEvent({
			type: 'setShortcutContext',
			detail: { context }
		});
	}
}

/**
 * Cleanup context management event listeners
 * @deprecated Not needed with Svelte-first approach
 */
export function cleanupContextManagement() {
	// No longer needed with Svelte-first approach
}

/**
 * Determine active context based on current application state
 */
function determineActiveContext(displayState) {
	const activeElement = document.activeElement;

	// Check if we're in an input field
	if (activeElement && (
		activeElement.tagName === 'INPUT' ||
		activeElement.tagName === 'TEXTAREA' ||
		activeElement.contentEditable === 'true'
	)) {
		return 'input';
	}

	// Check if we have a focused display from displayStateStore
	const $displayStateStore = get(displayStateStore);
	if ($displayStateStore.activeDisplayId) {
		return 'display-focused';
	}

	// Check if symbol palette is visible using store state
	const currentPanels = get(panels);
	const symbolPalettePanel = currentPanels.get('symbol-palette');
	if (symbolPalettePanel && symbolPalettePanel.isVisible) {
		return 'symbol-palette';
	}

	// Check if context menu is open using store state
	const contextMenuState = get(displayStore).contextMenu;
	if (contextMenuState && contextMenuState.open) {
		return 'context-menu';
	}

	return 'global';
}

/**
 * Check if shortcut is active in current context
 */
function isShortcutActive(shortcut, currentContext) {
	return shortcut.contexts.includes('global') ||
		   shortcut.contexts.includes(currentContext);
}

/**
 * Load user custom shortcuts from workspace persistence
 */
async function loadUserShortcuts() {
	try {
		const workspace = await workspacePersistenceManager.loadWorkspaceLayout();

		// ✅ FIXED: Check if workspace exists and has shortcuts
		if (workspace && workspace.shortcuts) {
			shortcutStore.update(state => ({
				...state,
				customShortcuts: workspace.shortcuts
			}));

			// Register custom shortcuts with new system
			Object.entries(workspace.shortcuts).forEach(([id, config]) => {
				const action = createActionForShortcut(id);
				if (action) {
					registerShortcut(id, {
						...config,
						action
					});
				}
			});
		}
	} catch (error) {
		// Silently continue with defaults if user shortcuts fail to load
	}
}

/**
 * Save user custom shortcuts to workspace persistence
 */
export async function saveUserShortcuts() {
	try {
		const $shortcutStore = get(shortcutStore);

		// ✅ FIXED: Use correct API method and handle null workspace
		const workspace = await workspacePersistenceManager.loadWorkspaceLayout();

		// If no workspace exists, create a basic structure
		const workspaceToSave = workspace || {
			version: '1.0.0',
			displays: [],
			panels: [],
			icons: [],
			timestamp: Date.now(),
			metadata: {
				exportDate: '',
				exportedBy: 'NeuroSense FX',
				description: ''
			}
		};

		workspaceToSave.shortcuts = $shortcutStore.customShortcuts;

		// Save using the immediate save method (bypassing auto-saver for user actions)
		workspacePersistenceManager.saveWorkspaceLayoutImmediate(workspaceToSave);
	} catch (error) {
		console.error('Failed to save user shortcuts:', error);
		throw error; // Re-throw to allow caller to handle the error
	}
}

/**
 * Update or add custom shortcut
 */
export function updateShortcut(id, config) {
	const validation = validateShortcutConfig({ [id]: config });

	if (validation.errors.length > 0) {
		throw new Error(`Invalid shortcut configuration: ${validation.errors.join(', ')}`);
	}

	shortcutStore.update(state => ({
		...state,
		customShortcuts: {
			...state.customShortcuts,
			[id]: config
		}
	}));

	// Register the updated shortcut with new system
	const action = createActionForShortcut(id);
	if (action) {
		registerShortcut(id, {
			...config,
			action
		});
	}

	saveUserShortcuts();
}

/**
 * Remove custom shortcut
 */
export function removeShortcut(id) {
	shortcutStore.update(state => {
		const { [id]: removed, ...rest } = state.customShortcuts;
		return {
			...state,
			customShortcuts: rest
		};
	});

	// Note: The new action system doesn't have explicit unregister -
	// shortcuts are cleaned up automatically when no longer referenced
	saveUserShortcuts();
}

/**
 * Reset shortcuts to defaults
 */
export function resetShortcuts() {
	shortcutStore.update(state => ({
		...state,
		customShortcuts: {},
		conflicts: []
	}));

	// Reinitialize with defaults using new system
	initializeShortcuts();
	saveUserShortcuts();
}

/**
 * Enable/disable shortcuts
 */
export function setShortcutsEnabled(enabled) {
	setEnabled(enabled);
	shortcutStore.update(state => ({ ...state, isEnabled: enabled }));
}

/**
 * Show/hide shortcut help overlay
 */
export function setShowHelp(show) {
	shortcutStore.update(state => ({ ...state, showHelp: show }));
}

/**
 * Get shortcuts for a specific context
 */
export function getShortcutsForContext(context) {
	const $shortcutStore = get(shortcutStore);
	return Object.values($shortcutStore.shortcuts)
		.filter(shortcut => isShortcutActive(shortcut, context))
		.map(shortcut => ({
			...shortcut,
			formattedKey: formatKeyForDisplay(typeof shortcut.key === 'string' ? shortcut.key : '')
		}));
}

// Initialization handled by App.svelte to avoid conflicts

// Final module completion log
debugLog('✅ shortcutStore.js module fully loaded and ready', {
	exportedFunctions: [
		'shortcutStore',
		'activeShortcuts',
		'shortcutsByCategory',
		'shortcutsByWorkflow',
		'shortcutConflicts',
		'initializeShortcuts',
		'setShortcutContext',
		'saveUserShortcuts',
		'updateShortcut',
		'removeShortcut',
		'resetShortcuts',
		'setShortcutsEnabled',
		'setShowHelp',
		'getShortcutsForContext'
	],
	totalDefaultShortcuts: Object.keys(DEFAULT_SHORTCUTS).length
});