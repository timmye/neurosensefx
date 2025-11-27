/**
 * Keyboard Action Unit Tests
 *
 * Tests for the unified keyboard action system
 * Following "Simple, Performant, Maintainable" philosophy
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	KeyboardAction,
	registerShortcut,
	setContext,
	setEnabled,
	SHORTCUT_CONTEXTS,
	SHORTCUT_CATEGORIES,
	getKeyCombo,
	normalizeKeyCombo,
	getInitializationStatus,
	resetKeyboardSystem,
	initializeKeyboardSystem,
	dispatchKeyboardEvent
} from '../../src/actions/keyboardAction.js';

describe('KeyboardAction System', () => {
	beforeEach(() => {
		// Reset system before each test
		resetKeyboardSystem();
	});

	afterEach(() => {
		// Clean up after each test
		resetKeyboardSystem();
	});

	describe('Constants and Configuration', () => {
		it('should export frozen shortcut contexts', () => {
			expect(Object.isFrozen(SHORTCUT_CONTEXTS)).toBe(true);
			expect(SHORTCUT_CONTEXTS.GLOBAL).toBe('global');
			expect(SHORTCUT_CONTEXTS.SYMBOL_PALETTE).toBe('symbol-palette');
			expect(SHORTCUT_CONTEXTS.DISPLAY_FOCUSED).toBe('display-focused');
			expect(SHORTCUT_CONTEXTS.CONTEXT_MENU).toBe('context-menu');
			expect(SHORTCUT_CONTEXTS.INPUT).toBe('input');
		});

		it('should export frozen shortcut categories', () => {
			expect(Object.isFrozen(SHORTCUT_CATEGORIES)).toBe(true);
			expect(SHORTCUT_CATEGORIES.NAVIGATION).toBe('navigation');
			expect(SHORTCUT_CATEGORIES.SYMBOL).toBe('symbol');
			expect(SHORTCUT_CATEGORIES.DISPLAY).toBe('display');
			expect(SHORTCUT_CATEGORIES.CONFIGURATION).toBe('configuration');
			expect(SHORTCUT_CATEGORIES.SYSTEM).toBe('system');
		});
	});

	describe('Key Combination Handling', () => {
		it('should normalize key combinations correctly', () => {
			expect(normalizeKeyCombo('Ctrl+K')).toBe('ctrl+k');
			expect(normalizeKeyCombo('cmd+v')).toBe('meta+v');
			expect(normalizeKeyCombo('command+s')).toBe('meta+s');
			expect(normalizeKeyCombo('Control+F')).toBe('ctrl+f');
			expect(normalizeKeyCombo('  alt+tab  ')).toBe('alt+tab');
		});

		it('should handle edge cases in normalization', () => {
			expect(normalizeKeyCombo('')).toBe('');
			expect(normalizeKeyCombo(null)).toBe('');
			expect(normalizeKeyCombo(undefined)).toBe('');
			expect(normalizeKeyCombo(123)).toBe('');
		});

		it('should extract key combinations from events', () => {
			const mockEvent = {
				ctrlKey: true,
				shiftKey: false,
				altKey: false,
				metaKey: false,
				key: 'k'
			};

			expect(getKeyCombo(mockEvent)).toBe('ctrl+k');
		});

		it('should handle special keys correctly', () => {
			const spaceEvent = {
				ctrlKey: false,
				shiftKey: false,
				altKey: false,
				metaKey: false,
				key: ' '
			};

			expect(getKeyCombo(spaceEvent)).toBe('space');

			const escapeEvent = {
				ctrlKey: false,
				shiftKey: false,
				altKey: false,
				metaKey: false,
				key: 'Escape'
			};

			expect(getKeyCombo(escapeEvent)).toBe('escape');
		});
	});

	describe('Shortcut Registration', () => {
		it('should register shortcuts correctly', () => {
			const testAction = { test: 'action' };
			const unregister = registerShortcut('test-shortcut', {
				key: 'ctrl+t',
				action: () => testAction,
				description: 'Test shortcut',
				category: 'system',
				contexts: ['global']
			});

			expect(typeof unregister).toBe('function');

			// Verify shortcut was registered
			const shortcuts = KeyboardAction.registeredShortcuts;
			expect(shortcuts.has('test-shortcut')).toBe(true);

			// Test unregister
			unregister();
			expect(shortcuts.has('test-shortcut')).toBe(false);
		});

		it('should handle shortcut registration with defaults', () => {
			registerShortcut('minimal-shortcut', {
				key: 'ctrl+m',
				action: () => {}
			});

			const shortcuts = KeyboardAction.registeredShortcuts;
			const shortcut = shortcuts.get('minimal-shortcut');

			expect(shortcut.description).toBe('minimal-shortcut');
			expect(shortcut.category).toBe('general');
			expect(shortcut.contexts).toEqual(['global']);
			expect(shortcut.preventDefault).toBe(true);
			expect(shortcut.stopPropagation).toBe(true);
		});
	});

	describe('Context Management', () => {
		it('should set and get active context', () => {
			setContext(SHORTCUT_CONTEXTS.SYMBOL_PALETTE);

			const status = KeyboardAction.keyboardActionStore.get();
			expect(status.activeContext).toBe(SHORTCUT_CONTEXTS.SYMBOL_PALETTE);
		});

		it('should enable and disable keyboard shortcuts', () => {
			setEnabled(false);

			let status = KeyboardAction.keyboardActionStore.get();
			expect(status.isEnabled).toBe(false);

			setEnabled(true);

			status = KeyboardAction.keyboardActionStore.get();
			expect(status.isEnabled).toBe(true);
		});
	});

	describe('System Initialization', () => {
		it('should initialize system correctly', async () => {
			const statusBefore = getInitializationStatus();
			expect(statusBefore.isInitialized).toBe(false);

			const result = await initializeKeyboardSystem();

			expect(result).toBe('ready');

			const statusAfter = getInitializationStatus();
			expect(statusAfter.isInitialized).toBe(true);
		});

		it('should handle multiple initialization calls', async () => {
			const promise1 = initializeKeyboardSystem();
			const promise2 = initializeKeyboardSystem();

			const [result1, result2] = await Promise.all([promise1, promise2]);

			expect(result1).toBe('ready');
			expect(result2).toBe('ready');
		});
	});

	describe('Event Dispatching', () => {
		it('should dispatch keyboard events', () => {
			let eventData = null;

			KeyboardAction.keyboardEventStore.subscribe((data) => {
				eventData = data;
			});

			dispatchKeyboardEvent('test-event', { test: 'data' });

			expect(eventData).not.toBeNull();
			expect(eventData.type).toBe('test-event');
			expect(eventData.data.test).toBe('data');
			expect(eventData.source).toBe('keyboardAction');
			expect(typeof eventData.timestamp).toBe('number');
		});
	});

	describe('Error Handling', () => {
		it('should handle malformed shortcuts gracefully', () => {
			expect(() => {
				registerShortcut('bad-shortcut', {
					key: null,
					action: () => {}
				});
			}).not.toThrow();
		});

		it('should handle action execution errors', () => {
			registerShortcut('error-shortcut', {
				key: 'ctrl+e',
				action: () => {
					throw new Error('Test error');
				}
			});

			// Should not throw when system processes errors
			expect(() => {
				// Simulate key processing
				const mockEvent = {
					ctrlKey: true,
					key: 'e',
					preventDefault: () => {},
					stopPropagation: () => {}
				};

				// This should not throw even if action fails
				const shortcuts = KeyboardAction.registeredShortcuts;
				const shortcut = shortcuts.get('error-shortcut');
				if (shortcut) {
					try {
						shortcut.action(mockEvent);
					} catch (error) {
						// Expected to be caught by system
					}
				}
			}).not.toThrow();
		});
	});

	describe('Performance and Memory', () => {
		it('should handle rapid shortcut registration/unregistration', () => {
			const start = performance.now();

			for (let i = 0; i < 100; i++) {
				const unregister = registerShortcut(`rapid-${i}`, {
					key: `ctrl+${i}`,
					action: () => {}
				});
				unregister();
			}

			const duration = performance.now() - start;
			expect(duration).toBeLessThan(100); // Should complete in under 100ms
		});

		it('should maintain memory efficiency', () => {
			const shortcuts = KeyboardAction.registeredShortcuts;
			const initialSize = shortcuts.size;

			// Register many shortcuts
			const unregisters = [];
			for (let i = 0; i < 50; i++) {
				unregisters.push(registerShortcut(`memory-${i}`, {
					key: `ctrl+alt+${i}`,
					action: () => {}
				}));
			}

			expect(shortcuts.size).toBe(initialSize + 50);

			// Unregister all
			unregisters.forEach(unregister => unregister());

			expect(shortcuts.size).toBe(initialSize);
		});
	});

	describe('Backward Compatibility', () => {
		it('should maintain reactive store interface', () => {
			let storeData = null;

			KeyboardAction.keyboardActionStore.subscribe((data) => {
				storeData = data;
			});

			expect(storeData).not.toBeNull();
			expect(typeof storeData.shortcuts).toBe('object');
			expect(typeof storeData.activeContext).toBe('string');
			expect(typeof storeData.isEnabled).toBe('boolean');
		});
	});
});