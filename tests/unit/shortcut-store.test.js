/**
 * Shortcut Store Unit Tests
 *
 * Tests for the reactive shortcut store system
 * Following "Simple, Performant, Maintainable" philosophy
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	shortcutStore,
	activeShortcuts,
	shortcutsByCategory,
	shortcutsByWorkflow,
	shortcutConflicts,
	initializeShortcuts,
	updateShortcut,
	removeShortcut,
	resetShortcuts,
	setShortcutsEnabled,
	setShowHelp,
	getShortcutsForContext,
	setShortcutContext
} from '../../src/stores/shortcutStore.js';
import { writable } from 'svelte/store';

// Mock dependencies
vi.mock('../../src/actions/keyboardAction.js', () => ({
	initializeKeyboardSystem: vi.fn().mockResolvedValue('ready'),
	registerShortcut: vi.fn(),
	setContext: vi.fn(),
	setEnabled: vi.fn(),
	keyboardActionStore: writable({
		shortcuts: {},
		activeContext: 'global',
		isEnabled: true,
		lastTriggered: null
	}),
	dispatchKeyboardEvent: vi.fn(),
	keyboardEventStore: writable(null)
}));

vi.mock('../../src/utils/shortcutConfig.js', () => ({
	DEFAULT_SHORTCUTS: {
		'test.shortcut1': {
			key: 'Ctrl+K',
			description: 'Test shortcut 1',
			category: 'symbol',
			contexts: ['global'],
			workflow: 'core'
		},
		'test.shortcut2': {
			key: 'Ctrl+F',
			description: 'Test shortcut 2',
			category: 'display',
			contexts: ['global'],
			workflow: 'quick-actions'
		}
	},
	validateShortcutConfig: vi.fn().mockReturnValue({ errors: [], warnings: [] }),
	findShortcutConflicts: vi.fn().mockReturnValue([]),
	getShortcutsByCategory: vi.fn().mockReturnValue({}),
	getShortcutsByWorkflow: vi.fn().mockReturnValue({}),
	sortShortcutsByPriority: vi.fn().mockImplementation(arr => arr),
	formatKeyForDisplay: vi.fn().mockImplementation(key => key.toUpperCase())
}));

vi.mock('../../src/stores/displayStore.js', () => ({
	displayStore: writable({
		displays: new Map(),
		focusedDisplayId: null,
		activeDisplays: []
	})
}));

vi.mock('../../src/utils/workspacePersistence.js', () => ({
	workspacePersistenceManager: {
		loadWorkspaceLayout: vi.fn().mockResolvedValue(null),
		saveWorkspaceLayoutImmediate: vi.fn()
	}
}));

describe('Shortcut Store', () => {
	beforeEach(() => {
		// Reset store state before each test
		shortcutStore.set({
			shortcuts: {},
			userShortcuts: {},
			activeContext: 'global',
			isEnabled: true,
			showHelp: false,
			lastTriggered: null,
			customShortcuts: {},
			conflicts: []
		});
		vi.clearAllMocks();
	});

	describe('Store Structure', () => {
		it('should initialize with correct default state', () => {
			let storeData;
			shortcutStore.subscribe(data => storeData = data)();

			expect(storeData).toHaveProperty('shortcuts');
			expect(storeData).toHaveProperty('userShortcuts');
			expect(storeData).toHaveProperty('activeContext', 'global');
			expect(storeData).toHaveProperty('isEnabled', true);
			expect(storeData).toHaveProperty('showHelp', false);
			expect(storeData).toHaveProperty('customShortcuts');
			expect(storeData).toHaveProperty('conflicts');
		});
	});

	describe('Derived Stores', () => {
		it('should compute active shortcuts based on context', () => {
			shortcutStore.set({
				shortcuts: {
					'test.shortcut1': {
						key: 'Ctrl+K',
						description: 'Test shortcut',
						category: 'symbol',
						contexts: ['global', 'symbol-palette']
					}
				},
				userShortcuts: {},
				activeContext: 'symbol-palette',
				isEnabled: true,
				showHelp: false,
				lastTriggered: null,
				customShortcuts: {},
				conflicts: []
			});

			let activeShorts;
			activeShortcuts.subscribe(data => activeShorts = data)();

			expect(Array.isArray(activeShorts)).toBe(true);
			// More specific assertions depend on mocked formatKeyForDisplay
		});

		it('should compute shortcuts by category', () => {
			shortcutStore.set({
				shortcuts: {
					'test.symbol': {
						key: 'Ctrl+S',
						description: 'Symbol action',
						category: 'symbol',
						contexts: ['global']
					},
					'test.display': {
						key: 'Ctrl+D',
						description: 'Display action',
						category: 'display',
						contexts: ['global']
					}
				},
				userShortcuts: {},
				activeContext: 'global',
				isEnabled: true,
				showHelp: false,
				lastTriggered: null,
				customShortcuts: {},
				conflicts: []
			});

			let categorized;
			shortcutsByCategory.subscribe(data => categorized = data)();

			expect(typeof categorized).toBe('object');
		});

		it('should compute shortcuts by workflow', () => {
			shortcutStore.set({
				shortcuts: {
					'test.core': {
						key: 'Ctrl+C',
						description: 'Core action',
						category: 'system',
						contexts: ['global'],
						workflow: 'core'
					}
				},
				userShortcuts: {},
				activeContext: 'global',
				isEnabled: true,
				showHelp: false,
				lastTriggered: null,
				customShortcuts: {},
				conflicts: []
			});

			let byWorkflow;
			shortcutsByWorkflow.subscribe(data => byWorkflow = data)();

			expect(typeof byWorkflow).toBe('object');
			expect(byWorkflow).toHaveProperty('core');
		});

		it('should detect shortcut conflicts', () => {
			shortcutStore.set({
				shortcuts: {
					'test.conflict1': {
						key: 'Ctrl+Z',
						description: 'First shortcut',
						category: 'symbol',
						contexts: ['global']
					},
					'test.conflict2': {
						key: 'Ctrl+Z',
						description: 'Second shortcut',
						category: 'display',
						contexts: ['global']
					}
				},
				userShortcuts: {},
				activeContext: 'global',
				isEnabled: true,
				showHelp: false,
				lastTriggered: null,
				customShortcuts: {},
				conflicts: []
			});

			let conflicts;
			shortcutConflicts.subscribe(data => conflicts = data)();

			expect(Array.isArray(conflicts)).toBe(true);
		});
	});

	describe('Shortcut Management', () => {
		it('should update shortcuts correctly', async () => {
			const newShortcut = {
				key: 'Ctrl+T',
				description: 'New test shortcut',
				category: 'test',
				contexts: ['global']
			};

			await updateShortcut('test.new', newShortcut);

			let storeData;
			shortcutStore.subscribe(data => storeData = data)();

			expect(storeData.customShortcuts['test.new']).toEqual(newShortcut);
		});

		it('should remove shortcuts correctly', async () => {
			// First add a shortcut
			await updateShortcut('test.removable', {
				key: 'Ctrl+R',
				description: 'Removable shortcut',
				category: 'test',
				contexts: ['global']
			});

			// Then remove it
			await removeShortcut('test.removable');

			let storeData;
			shortcutStore.subscribe(data => storeData = data)();

			expect(storeData.customShortcuts).not.toHaveProperty('test.removable');
		});

		it('should reset shortcuts to defaults', async () => {
			// Add some custom shortcuts
			await updateShortcut('test.custom1', {
				key: 'Ctrl+1',
				description: 'Custom 1',
				category: 'test',
				contexts: ['global']
			});

			await updateShortcut('test.custom2', {
				key: 'Ctrl+2',
				description: 'Custom 2',
				category: 'test',
				contexts: ['global']
			});

			// Reset
			await resetShortcuts();

			let storeData;
			shortcutStore.subscribe(data => storeData = data)();

			expect(Object.keys(storeData.customShortcuts)).toHaveLength(0);
			expect(storeData.conflicts).toHaveLength(0);
		});
	});

	describe('Store Controls', () => {
		it('should enable and disable shortcuts', async () => {
			const { setEnabled } = await import('../../src/actions/keyboardAction.js');

			await setShortcutsEnabled(false);
			expect(setEnabled).toHaveBeenCalledWith(false);

			await setShortcutsEnabled(true);
			expect(setEnabled).toHaveBeenCalledWith(true);

			let storeData;
			shortcutStore.subscribe(data => storeData = data)();

			expect(storeData.isEnabled).toBe(true);
		});

		it('should show and hide help', () => {
			setShowHelp(true);

			let storeData;
			shortcutStore.subscribe(data => storeData = data)();

			expect(storeData.showHelp).toBe(true);

			setShowHelp(false);

			expect(storeData.showHelp).toBe(false);
		});
	});

	describe('Context Management', () => {
		it('should get shortcuts for specific context', () => {
			const shortcuts = getShortcutsForContext('global');

			expect(Array.isArray(shortcuts)).toBe(true);
		});

		it('should set shortcut context', () => {
			setShortcutContext('symbol-palette');

			let storeData;
			shortcutStore.subscribe(data => storeData = data)();

			expect(storeData.activeContext).toBe('symbol-palette');
		});
	});

	describe('Error Handling', () => {
		it('should handle initialization failures gracefully', async () => {
			const { initializeKeyboardSystem } = await import('../../src/actions/keyboardAction.js');
			initializeKeyboardSystem.mockRejectedValueOnce(new Error('Init failed'));

			await expect(initializeShortcuts()).rejects.toThrow('Init failed');
		});

		it('should handle validation errors when updating shortcuts', async () => {
			const { validateShortcutConfig } = await import('../../src/utils/shortcutConfig.js');
			validateShortcutConfig.mockReturnValueOnce({
				errors: ['Invalid key combination'],
				warnings: []
			});

			await expect(updateShortcut('test.invalid', {
				key: 'invalid',
				description: 'Invalid shortcut'
			})).rejects.toThrow('Invalid shortcut configuration');
		});

		it('should handle persistence errors gracefully', async () => {
			const { workspacePersistenceManager } = await import('../../src/utils/workspacePersistence.js');
			workspacePersistenceManager.saveWorkspaceLayoutImmediate.mockRejectedValueOnce(
				new Error('Save failed')
			);

			// Should not throw, but should handle the error
			await expect(saveUserShortcuts()).rejects.toThrow('Save failed');
		});
	});

	describe('Performance', () => {
		it('should handle rapid store updates efficiently', () => {
			const start = performance.now();

			for (let i = 0; i < 100; i++) {
				shortcutStore.update(state => ({
					...state,
					activeContext: i % 2 === 0 ? 'global' : 'symbol-palette'
				}));
			}

			const duration = performance.now() - start;
			expect(duration).toBeLessThan(50); // Should be very fast
		});
	});

	describe('Integration', () => {
		it('should initialize with default shortcuts', async () => {
			await initializeShortcuts();

			const { registerShortcut } = await import('../../src/actions/keyboardAction.js');
			expect(registerShortcut).toHaveBeenCalledTimes(2); // DEFAULT_SHORTCUTS has 2 items
		});
	});
});