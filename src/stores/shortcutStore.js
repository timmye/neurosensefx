/**
 * Reactive Shortcut Store for NeuroSense FX
 *
 * Provides Svelte store integration for keyboard shortcuts
 * with workspace persistence and user customization support.
 */

import { writable, derived, get } from 'svelte/store';
import { keyboardAction, registerShortcut, setContext, setEnabled, keyboardActionStore, dispatchKeyboardEvent, initializeKeyboardSystem, keyboardEventStore } from '../actions/keyboardAction.js';
import DEFAULT_SHORTCUTS, {
	validateShortcutConfig,
	findShortcutConflicts,
	getShortcutsByCategory,
	getShortcutsByWorkflow,
	sortShortcutsByPriority,
	formatKeyForDisplay
} from '../utils/shortcutConfig.js';
import { displayStore } from './displayStore.js';
import { workspacePersistenceManager } from '../utils/workspacePersistence.js';

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

/**
 * Derived store for currently active shortcuts
 */
export const activeShortcuts = derived(
	[shortcutStore, displayStore],
	([$shortcutStore, $displayStore]) => {
		const context = determineActiveContext($displayStore);
		return Object.values($shortcutStore.shortcuts)
			.filter(shortcut => isShortcutActive(shortcut, context))
			.map(shortcut => ({
				...shortcut,
				formattedKey: formatKeyForDisplay(shortcut.key)
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
		Object.values($shortcutStore.shortcuts).forEach(shortcut => {
			if (!categories[shortcut.category]) {
				categories[shortcut.category] = [];
			}
			categories[shortcut.category].push({
				...shortcut,
				formattedKey: formatKeyForDisplay(shortcut.key)
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

		Object.values($shortcutStore.shortcuts).forEach(shortcut => {
			const workflow = shortcut.workflow || 'system';
			if (workflows[workflow]) {
				workflows[workflow].push({
					...shortcut,
					formattedKey: formatKeyForDisplay(shortcut.key)
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
	try {
		// First initialize the core keyboard system with document backup
		await initializeKeyboardSystem();

		const $shortcutStore = get(shortcutStore);

		// Register all default shortcuts with the enhanced system
		// These will now work with the dual-layer architecture
		Object.entries(DEFAULT_SHORTCUTS).forEach(([id, config]) => {
			const action = createActionForShortcut(id);
			if (action) {
				registerShortcut(id, {
					...config,
					action
				});
			}
		});

		// Setup context management with dual-layer support
		setupContextManagement();

		// Load user customizations
		await loadUserShortcuts();
	} catch (error) {
		console.error('Shortcut system initialization failed:', error);
		throw error;
	}
}

/**
 * Create action handlers for shortcuts
 */
function createActionForShortcut(id) {
	switch (id) {
		// === SYMBOL WORKFLOW ===
		case 'symbol.focusPalette':
			return () => {
				dispatchKeyboardEvent('focusSymbolPalette');
			};

		case 'symbol.togglePalette':
			return () => {
				dispatchKeyboardEvent('toggleSymbolPalette');
			};

		case 'symbol.quickSubscribe':
			return () => {
				dispatchKeyboardEvent('quickSubscribe');
			};

		case 'symbol.quickSubscribeNew':
			return () => {
				dispatchKeyboardEvent('quickSubscribe', { newDisplay: true });
			};

		case 'symbol.recentCycle':
			return () => {
				dispatchKeyboardEvent('cycleRecentSymbols');
			};

		case 'symbol.favorites':
			return () => {
				dispatchKeyboardEvent('showSymbolFavorites');
			};

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
			return () => {
				const $displayStore = get(displayStore);
				const displays = Array.from($displayStore.displays.values());
				if (displays[displayNumber - 1]) {
					dispatchKeyboardEvent('focusDisplay', { displayId: displays[displayNumber - 1].id });
				}
			};

		case 'display.next':
			return () => {
				dispatchKeyboardEvent('navigateDisplay', { direction: 'next' });
			};

		case 'display.previous':
			return () => {
				dispatchKeyboardEvent('navigateDisplay', { direction: 'previous' });
			};

		case 'display.navigateRight':
			return () => {
				dispatchKeyboardEvent('navigateDisplay', { direction: 'right' });
			};

		case 'display.navigateLeft':
			return () => {
				dispatchKeyboardEvent('navigateDisplay', { direction: 'left' });
			};

		case 'display.navigateUp':
			return () => {
				dispatchKeyboardEvent('navigateDisplay', { direction: 'up' });
			};

		case 'display.navigateDown':
			return () => {
				dispatchKeyboardEvent('navigateDisplay', { direction: 'down' });
			};

		case 'display.close':
			return () => {
				dispatchKeyboardEvent('closeDisplay');
			};

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
			return null;
	}
}

// Handle custom context events
function handleSetShortcutContext(event) {
	setContext(event.detail.context);
	shortcutStore.update(state => ({ ...state, activeContext: event.detail.context }));
}

/**
 * Handle critical shortcut events from document backup system
 * This processes Ctrl+K, Ctrl+F, Ctrl+Shift+K intercepted by document backup
 */
function handleCriticalShortcut(eventData) {
	const keyCombo = eventData?.data?.keyCombo;
	const event = eventData?.data?.event;

	if (!keyCombo) {
		return;
	}

	// CRITICAL FIX: Normalize keyCombo for comparison to handle case sensitivity
	// The issue: DEFAULT_SHORTCUTS uses "Ctrl+K" (uppercase) but getKeyCombo() returns "ctrl+k" (lowercase)
	const normalizedKeyCombo = keyCombo.toLowerCase();

	// Find matching shortcut with case-insensitive comparison
	const matchingShortcut = Object.values(DEFAULT_SHORTCUTS).find(shortcut =>
		shortcut.key.toLowerCase() === normalizedKeyCombo
	);

	if (matchingShortcut) {
		const shortcutId = Object.keys(DEFAULT_SHORTCUTS).find(id => DEFAULT_SHORTCUTS[id] === matchingShortcut);
		const action = createActionForShortcut(shortcutId);

		if (action) {
			try {
				action(event);
			} catch (error) {
				console.error(`Error executing critical shortcut ${keyCombo}:`, error);
			}
		}
	}
}

/**
 * Setup context management based on current application state
 * Enhanced with dual-layer event interception support
 */
function setupContextManagement() {
	// Listen for context changes
	displayStore.subscribe($displayStore => {
		const newContext = determineActiveContext($displayStore);
		setContext(newContext);
		shortcutStore.update(state => ({ ...state, activeContext: newContext }));
	});

	// Create custom event store for context management (Svelte-first pattern)
	const customEventStore = writable(null);

	// Subscribe to custom events and critical shortcuts from unified system
	customEventStore.subscribe((eventData) => {
		if (eventData) {
			if (eventData.type === 'setShortcutContext') {
				handleSetShortcutContext(eventData);
			} else if (eventData.type === 'criticalShortcut') {
				// Handle critical shortcuts intercepted by document backup
				handleCriticalShortcut(eventData);
			}
		}
	});

	// Export for use in components
	shortcutStore.setCustomEvent = customEventStore.set;

	// Listen to keyboard event store for critical shortcuts
	keyboardEventStore.subscribe((eventData) => {
		if (eventData && eventData.type === 'criticalShortcut') {
			handleCriticalShortcut(eventData);
		}
	});
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

	// Check if we have a focused display
	if (displayState.focusedDisplayId) {
		return 'display-focused';
	}

	// Check if symbol palette is visible
	const symbolPalette = document.querySelector('[data-symbol-palette]');
	if (symbolPalette && !symbolPalette.hidden) {
		return 'symbol-palette';
	}

	// Check if context menu is open
	const contextMenu = document.querySelector('[data-context-menu]');
	if (contextMenu && !contextMenu.hidden) {
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
			formattedKey: formatKeyForDisplay(shortcut.key)
		}));
}

// Initialization handled by App.svelte to avoid conflicts