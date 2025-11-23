/**
 * Reactive Shortcut Store for NeuroSense FX
 *
 * Provides Svelte store integration for keyboard shortcuts
 * with workspace persistence and user customization support.
 */

import { writable, derived, get } from 'svelte/store';
import { keyboardManager } from '../utils/keyboardShortcutManager.js';
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
 */
export function initializeShortcuts() {
	const $shortcutStore = get(shortcutStore);

	// Register all default shortcuts
	Object.entries(DEFAULT_SHORTCUTS).forEach(([id, config]) => {
		const action = createActionForShortcut(id);
		if (action) {
			keyboardManager.register(id, {
				...config,
				action
			});
		}
	});

	// Setup context management
	setupContextManagement();

	// Load user customizations
	loadUserShortcuts();

	console.log('Keyboard shortcut system initialized');
}

/**
 * Create action handlers for shortcuts
 */
function createActionForShortcut(id) {
	switch (id) {
		// === SYMBOL WORKFLOW ===
		case 'symbol.focusPalette':
			return () => {
				document.dispatchEvent(new CustomEvent('focusSymbolPalette'));
			};

		case 'symbol.togglePalette':
			return () => {
				document.dispatchEvent(new CustomEvent('toggleSymbolPalette'));
			};

		case 'symbol.quickSubscribe':
			return () => {
				const event = new CustomEvent('quickSubscribe');
				document.dispatchEvent(event);
			};

		case 'symbol.quickSubscribeNew':
			return () => {
				const event = new CustomEvent('quickSubscribe', { detail: { newDisplay: true } });
				document.dispatchEvent(event);
			};

		case 'symbol.recentCycle':
			return () => {
				const event = new CustomEvent('cycleRecentSymbols');
				document.dispatchEvent(event);
			};

		case 'symbol.favorites':
			return () => {
				document.dispatchEvent(new CustomEvent('showSymbolFavorites'));
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
					const event = new CustomEvent('focusDisplay', {
						detail: { displayId: displays[displayNumber - 1].id }
					});
					document.dispatchEvent(event);
				}
			};

		case 'display.next':
			return () => {
				document.dispatchEvent(new CustomEvent('navigateDisplay', { detail: { direction: 'next' } }));
			};

		case 'display.previous':
			return () => {
				document.dispatchEvent(new CustomEvent('navigateDisplay', { detail: { direction: 'previous' } }));
			};

		case 'display.navigateRight':
			return () => {
				document.dispatchEvent(new CustomEvent('navigateDisplay', { detail: { direction: 'right' } }));
			};

		case 'display.navigateLeft':
			return () => {
				document.dispatchEvent(new CustomEvent('navigateDisplay', { detail: { direction: 'left' } }));
			};

		case 'display.navigateUp':
			return () => {
				document.dispatchEvent(new CustomEvent('navigateDisplay', { detail: { direction: 'up' } }));
			};

		case 'display.navigateDown':
			return () => {
				document.dispatchEvent(new CustomEvent('navigateDisplay', { detail: { direction: 'down' } }));
			};

		// === QUICK ACTIONS ===
		case 'quick.contextMenu':
			return () => {
				document.dispatchEvent(new CustomEvent('showContextMenu'));
			};

		case 'quick.configPanel':
			return () => {
				document.dispatchEvent(new CustomEvent('showQuickConfig'));
			};

		case 'quick.pauseUpdates':
			return () => {
				document.dispatchEvent(new CustomEvent('toggleDataUpdates'));
			};

		case 'quick.fullscreen':
			return () => {
				document.dispatchEvent(new CustomEvent('toggleFullscreen'));
			};

		case 'quick.addMarker':
			return () => {
				document.dispatchEvent(new CustomEvent('addPriceMarker'));
			};

		case 'quick.clearMarkers':
			return () => {
				document.dispatchEvent(new CustomEvent('clearMarkers'));
			};

		// === PROFESSIONAL FEATURES ===
		case 'pro.layoutPreset1':
		case 'pro.layoutPreset2':
		case 'pro.layoutPreset3':
			const presetNumber = parseInt(id.replace('pro.layoutPreset', ''));
			return () => {
				const event = new CustomEvent('applyLayoutPreset', { detail: { preset: presetNumber } });
				document.dispatchEvent(event);
			};

		case 'pro.groupDisplays':
			return () => {
				document.dispatchEvent(new CustomEvent('groupDisplays'));
			};

		case 'pro.ungroupDisplays':
			return () => {
				document.dispatchEvent(new CustomEvent('ungroupDisplays'));
			};

		case 'pro.saveLayout':
			return () => {
				document.dispatchEvent(new CustomEvent('saveLayoutPreset'));
			};

		// === SYSTEM & HELP ===
		case 'system.help':
			return () => {
				setShowHelp(true);
			};

		case 'system.statusPanel':
			return () => {
				document.dispatchEvent(new CustomEvent('toggleStatusPanel'));
			};

		case 'system.performanceMonitor':
			return () => {
				document.dispatchEvent(new CustomEvent('togglePerformanceMonitor'));
			};

		case 'system.screenshot':
			return () => {
				document.dispatchEvent(new CustomEvent('takeScreenshot'));
			};

		case 'system.saveWorkspace':
			return () => {
				const event = new CustomEvent('saveWorkspace');
				document.dispatchEvent(event);
			};

		case 'system.escape':
			return () => {
				document.dispatchEvent(new CustomEvent('escape'));
			};

		// === LEGACY ===
		case 'legacy.newDisplay':
			return () => {
				document.dispatchEvent(new CustomEvent('newDisplay'));
			};

		default:
			console.warn(`No action defined for shortcut: ${id}`);
			return null;
	}
}

// Handle custom context events
function handleSetShortcutContext(event) {
	keyboardManager.setContext(event.detail.context);
	shortcutStore.update(state => ({ ...state, activeContext: event.detail.context }));
}

/**
 * Setup context management based on current application state
 */
function setupContextManagement() {
	// Listen for context changes
	displayStore.subscribe($displayStore => {
		const newContext = determineActiveContext($displayStore);
		keyboardManager.setContext(newContext);
		shortcutStore.update(state => ({ ...state, activeContext: newContext }));
	});

	// Listen for custom context events
	document.addEventListener('setShortcutContext', handleSetShortcutContext);
}

/**
 * Cleanup context management event listeners
 */
export function cleanupContextManagement() {
	document.removeEventListener('setShortcutContext', handleSetShortcutContext);
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
		const workspace = await workspacePersistenceManager.load();
		if (workspace.shortcuts) {
			shortcutStore.update(state => ({
				...state,
				customShortcuts: workspace.shortcuts || {}
			}));

			// Register custom shortcuts
			Object.entries(workspace.shortcuts || {}).forEach(([id, config]) => {
				const action = createActionForShortcut(id);
				if (action) {
					keyboardManager.register(id, {
						...config,
						action
					});
				}
			});
		}
	} catch (error) {
		console.warn('Failed to load user shortcuts:', error);
	}
}

/**
 * Save user custom shortcuts to workspace persistence
 */
export async function saveUserShortcuts() {
	const $shortcutStore = get(shortcutStore);
	const workspace = await workspacePersistenceManager.load();

	workspace.shortcuts = $shortcutStore.customShortcuts;
	await workspacePersistenceManager.save(workspace);
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

	// Register the updated shortcut
	const action = createActionForShortcut(id);
	if (action) {
		keyboardManager.register(id, {
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

	keyboardManager.unregister(id);
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

	// Reinitialize with defaults
	keyboardManager.destroy();
	initializeShortcuts();
	saveUserShortcuts();
}

/**
 * Enable/disable shortcuts
 */
export function setShortcutsEnabled(enabled) {
	keyboardManager.setEnabled(enabled);
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

// Auto-initialize when module is imported
// REMOVED: Let App.svelte handle initialization to avoid conflicts
// if (typeof window !== 'undefined') {
// 	initializeShortcuts();
// }