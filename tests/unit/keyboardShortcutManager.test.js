/**
 * Unit Tests for Keyboard Shortcut Manager
 *
 * Tests keyboard shortcut handling, key combination parsing,
 * and event management without DOM dependencies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  KeyboardShortcutManager,
  keyboardManager,
  shortcutStore,
  SHORTCUT_CONTEXTS,
  SHORTCUT_CATEGORIES
} from '../../src/utils/keyboardShortcutManager.js';

// Mock DOM environment
const mockDocument = {
  activeElement: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

const mockWindow = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

// Setup DOM mocks
Object.defineProperty(global, 'document', {
  value: mockDocument,
  writable: true
});

Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true
});

describe('KeyboardShortcutManager', () => {
  let manager;

  beforeEach(() => {
    manager = new KeyboardShortcutManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with empty shortcuts', () => {
      expect(manager.shortcuts.size).toBe(0);
      expect(manager.contexts.size).toBe(0);
      expect(manager.activeContext).toBe('global');
      expect(manager.isEnabled).toBe(true);
    });

    it('should have reactive store with initial state', () => {
      const state = {};
      manager.store.subscribe(value => Object.assign(state, value))();

      expect(state.shortcuts).toEqual({});
      expect(state.activeContext).toBe('global');
      expect(state.isEnabled).toBe(true);
      expect(state.lastTriggered).toBe(null);
    });
  });

  describe('Shortcut Registration', () => {
    it('should register shortcut with minimal config', () => {
      const action = vi.fn();
      manager.register('test-shortcut', {
        key: 'Ctrl+K',
        action: action
      });

      const shortcut = manager.shortcuts.get('test-shortcut');
      expect(shortcut).toBeDefined();
      expect(shortcut.key).toBe('ctrl+k');
      expect(shortcut.action).toBe(action);
      expect(shortcut.description).toBe('test-shortcut');
      expect(shortcut.category).toBe('general');
      expect(shortcut.contexts).toEqual(['global']);
    });

    it('should register shortcut with full config', () => {
      const action = vi.fn();
      const condition = vi.fn(() => true);

      manager.register('full-shortcut', {
        key: 'Ctrl+Shift+A',
        action: action,
        description: 'Full test shortcut',
        category: 'test',
        contexts: ['test-context'],
        condition: condition,
        preventDefault: false,
        stopPropagation: false
      });

      const shortcut = manager.shortcuts.get('full-shortcut');
      expect(shortcut.key).toBe('ctrl+shift+a');
      expect(shortcut.description).toBe('Full test shortcut');
      expect(shortcut.category).toBe('test');
      expect(shortcut.contexts).toEqual(['test-context']);
      expect(shortcut.condition).toBe(condition);
      expect(shortcut.preventDefault).toBe(false);
      expect(shortcut.stopPropagation).toBe(false);
    });

    it('should update reactive store when shortcut registered', () => {
      const state = {};
      manager.store.subscribe(value => Object.assign(state, value))();

      manager.register('test-shortcut', {
        key: 'Ctrl+K',
        action: vi.fn()
      });

      expect(state.shortcuts['test-shortcut']).toBeDefined();
      expect(state.shortcuts['test-shortcut'].key).toBe('ctrl+k');
    });
  });

  describe('Shortcut Unregistration', () => {
    it('should unregister shortcut', () => {
      const action = vi.fn();
      manager.register('test-shortcut', {
        key: 'Ctrl+K',
        action: action
      });

      expect(manager.shortcuts.has('test-shortcut')).toBe(true);

      manager.unregister('test-shortcut');
      expect(manager.shortcuts.has('test-shortcut')).toBe(false);
    });

    it('should update reactive store when shortcut unregistered', () => {
      const state = {};
      manager.store.subscribe(value => Object.assign(state, value))();

      manager.register('test-shortcut', {
        key: 'Ctrl+K',
        action: vi.fn()
      });

      expect(state.shortcuts['test-shortcut']).toBeDefined();

      manager.unregister('test-shortcut');
      expect(state.shortcuts['test-shortcut']).toBeUndefined();
    });
  });

  describe('Context Management', () => {
    it('should set active context', () => {
      manager.setContext('test-context');
      expect(manager.activeContext).toBe('test-context');
    });

    it('should update reactive store when context changes', () => {
      const state = {};
      manager.store.subscribe(value => Object.assign(state, value))();

      manager.setContext('new-context');
      expect(state.activeContext).toBe('new-context');
    });

    it('should determine shortcut activation by context', () => {
      manager.register('global-shortcut', {
        key: 'Ctrl+G',
        action: vi.fn(),
        contexts: ['global']
      });

      manager.register('context-shortcut', {
        key: 'Ctrl+C',
        action: vi.fn(),
        contexts: ['test-context']
      });

      manager.setContext('global');
      expect(manager.isShortcutActive(manager.shortcuts.get('global-shortcut'))).toBe(true);
      expect(manager.isShortcutActive(manager.shortcuts.get('context-shortcut'))).toBe(false);

      manager.setContext('test-context');
      expect(manager.isShortcutActive(manager.shortcuts.get('global-shortcut'))).toBe(false);
      expect(manager.isShortcutActive(manager.shortcuts.get('context-shortcut'))).toBe(true);
    });
  });

  describe('Enable/Disable Management', () => {
    it('should enable and disable shortcuts', () => {
      manager.setEnabled(false);
      expect(manager.isEnabled).toBe(false);

      manager.setEnabled(true);
      expect(manager.isEnabled).toBe(true);
    });

    it('should update reactive store when enabled state changes', () => {
      const state = {};
      manager.store.subscribe(value => Object.assign(state, value))();

      manager.setEnabled(false);
      expect(state.isEnabled).toBe(false);
    });
  });

  describe('Key Combination Normalization', () => {
    it('should normalize various key combination formats', () => {
      const testCases = [
        { input: 'Ctrl+K', expected: 'ctrl+k' },
        { input: 'ctrl+k', expected: 'ctrl+k' },
        { input: 'Cmd+Enter', expected: 'meta+enter' },
        { input: 'Command+Space', expected: 'meta+space' },
        { input: 'Alt+Shift+T', expected: 'alt+shift+t' },
        { input: 'Ctrl + Shift + A', expected: 'ctrl+shift+a' }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(manager.normalizeKeyCombo(input)).toBe(expected);
      });
    });
  });

  describe('Key Event Processing', () => {
    it('should extract key combination from keyboard event', () => {
      const mockEvent = {
        key: 'k',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false
      };

      const combo = manager.getKeyCombo(mockEvent);
      expect(combo).toBe('ctrl+k');
    });

    it('should handle special keys correctly', () => {
      const specialKeyCases = [
        { key: ' ', expected: 'space' },
        { key: 'Escape', expected: 'escape' },
        { key: 'Tab', expected: 'tab' },
        { key: 'Enter', expected: 'enter' },
        { key: 'Backspace', expected: 'backspace' },
        { key: 'Delete', expected: 'delete' },
        { key: 'ArrowUp', expected: 'up' },
        { key: 'ArrowDown', expected: 'down' },
        { key: 'ArrowLeft', expected: 'left' },
        { key: 'ArrowRight', expected: 'right' }
      ];

      specialKeyCases.forEach(({ key, expected }) => {
        const mockEvent = {
          key: key,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
          shiftKey: false
        };

        const combo = manager.getKeyCombo(mockEvent);
        expect(combo).toBe(expected);
      });
    });

    it('should handle modifier keys correctly', () => {
      const mockEvent = {
        key: 'k',
        ctrlKey: true,
        metaKey: true,
        altKey: true,
        shiftKey: true
      };

      const combo = manager.getKeyCombo(mockEvent);
      expect(combo).toBe('ctrl+meta+alt+shift+k');
    });
  });

  describe('Shortcut Matching', () => {
    it('should find matching shortcuts for key combination', () => {
      manager.register('shortcut1', {
        key: 'Ctrl+K',
        action: vi.fn()
      });

      manager.register('shortcut2', {
        key: 'Ctrl+L',
        action: vi.fn()
      });

      const matches = manager.findMatchingShortcuts('ctrl+k');
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe('shortcut1');
    });

    it('should find multiple shortcuts with same key combo', () => {
      manager.register('shortcut1', {
        key: 'Ctrl+K',
        action: vi.fn(),
        contexts: ['context1']
      });

      manager.register('shortcut2', {
        key: 'Ctrl+K',
        action: vi.fn(),
        contexts: ['context2']
      });

      const matches = manager.findMatchingShortcuts('ctrl+k');
      expect(matches).toHaveLength(2);
    });
  });

  describe('Event Handling', () => {
    it('should ignore events when disabled', () => {
      const action = vi.fn();
      manager.register('test-shortcut', {
        key: 'Ctrl+K',
        action: action
      });

      manager.setEnabled(false);

      const mockEvent = {
        key: 'k',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      };

      manager.handleKeyDown(mockEvent);
      expect(action).not.toHaveBeenCalled();
    });

    it('should ignore events when typing in input fields', () => {
      const action = vi.fn();
      manager.register('test-shortcut', {
        key: 'Ctrl+K',
        action: action
      });

      // Mock active element as input
      mockDocument.activeElement = {
        tagName: 'INPUT',
        contentEditable: 'false'
      };

      const mockEvent = {
        key: 'k',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      };

      manager.handleKeyDown(mockEvent);
      expect(action).not.toHaveBeenCalled();
    });

    it('should trigger matching shortcut in correct context', () => {
      const action = vi.fn();
      manager.register('test-shortcut', {
        key: 'Ctrl+K',
        action: action,
        contexts: ['test-context']
      });

      manager.setContext('test-context');

      const mockEvent = {
        key: 'k',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      };

      manager.handleKeyDown(mockEvent);
      expect(action).toHaveBeenCalledWith(mockEvent);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it('should respect shortcut conditions', () => {
      const action = vi.fn();
      const condition = vi.fn(() => false);

      manager.register('test-shortcut', {
        key: 'Ctrl+K',
        action: action,
        condition: condition
      });

      const mockEvent = {
        key: 'k',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      };

      manager.handleKeyDown(mockEvent);
      expect(condition).toHaveBeenCalled();
      expect(action).not.toHaveBeenCalled();
    });

    it('should handle action errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      manager.register('error-shortcut', {
        key: 'Ctrl+E',
        action: () => {
          throw new Error('Test error');
        }
      });

      const mockEvent = {
        key: 'e',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      };

      // Should not throw
      expect(() => manager.handleKeyDown(mockEvent)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should update last triggered shortcut', () => {
      const state = {};
      manager.store.subscribe(value => Object.assign(state, value))();

      const action = vi.fn();
      manager.register('test-shortcut', {
        key: 'Ctrl+K',
        action: action,
        description: 'Test description'
      });

      const mockEvent = {
        key: 'k',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      };

      manager.handleKeyDown(mockEvent);

      expect(state.lastTriggered).toEqual({
        id: 'test-shortcut',
        description: 'Test description',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Shortcut Retrieval', () => {
    beforeEach(() => {
      manager.register('test1', {
        key: 'Ctrl+K',
        action: vi.fn(),
        category: 'category1',
        description: 'Test 1'
      });

      manager.register('test2', {
        key: 'Ctrl+L',
        action: vi.fn(),
        category: 'category2',
        description: 'Test 2'
      });

      manager.register('test3', {
        key: 'Ctrl+M',
        action: vi.fn(),
        category: 'category1',
        description: 'Test 3',
        contexts: ['inactive-context']
      });
    });

    it('should get all shortcuts', () => {
      const shortcuts = manager.getShortcuts();
      expect(shortcuts).toHaveLength(3);
    });

    it('should get shortcuts by category', () => {
      const category1Shortcuts = manager.getShortcuts('category1');
      expect(category1Shortcuts).toHaveLength(2);

      const category2Shortcuts = manager.getShortcuts('category2');
      expect(category2Shortcuts).toHaveLength(1);
    });

    it('should get active shortcuts', () => {
      manager.setContext('global');
      const activeShortcuts = manager.getActiveShortcuts();
      expect(activeShortcuts).toHaveLength(2); // Only global context shortcuts

      manager.setContext('inactive-context');
      const inactiveShortcuts = manager.getActiveShortcuts();
      expect(inactiveShortcuts).toHaveLength(1); // Only inactive-context shortcut
    });
  });

  describe('Configuration Export/Import', () => {
    it('should export shortcut configuration', () => {
      manager.register('test-shortcut', {
        key: 'Ctrl+K',
        action: vi.fn(),
        description: 'Test shortcut',
        category: 'test'
      });

      const exported = manager.export();
      expect(exported).toHaveProperty('test-shortcut');
      expect(exported['test-shortcut']).toEqual({
        key: 'ctrl+k',
        description: 'Test shortcut',
        category: 'test',
        contexts: ['global']
      });
    });

    it('should import shortcut configuration', () => {
      const config = {
        'imported-shortcut': {
          key: 'Ctrl+I',
          description: 'Imported shortcut',
          category: 'imported',
          contexts: ['test-context']
        }
      };

      const actionResolver = vi.fn(() => vi.fn());
      manager.import(config, actionResolver);

      expect(actionResolver).toHaveBeenCalledWith('imported-shortcut');
      expect(manager.shortcuts.has('imported-shortcut')).toBe(true);

      const shortcut = manager.shortcuts.get('imported-shortcut');
      expect(shortcut.key).toBe('ctrl+i');
      expect(shortcut.description).toBe('Imported shortcut');
    });
  });

  describe('Event Listener Management', () => {
    it('should bind to element with default document', () => {
      manager.bindToElement();
      expect(mockDocument.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should bind to custom element', () => {
      const customElement = {
        addEventListener: vi.fn()
      };

      manager.bindToElement(customElement);
      expect(customElement.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should cleanup event listeners on destroy', () => {
      manager.bindToElement();
      manager.destroy();

      expect(mockDocument.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(manager.eventListeners.size).toBe(0);
      expect(manager.shortcuts.size).toBe(0);
      expect(manager.contexts.size).toBe(0);
    });
  });
});

describe('Keyboard Shortcut Constants', () => {
  it('should provide predefined contexts', () => {
    expect(SHORTCUT_CONTEXTS.GLOBAL).toBe('global');
    expect(SHORTCUT_CONTEXTS.SYMBOL_PALETTE).toBe('symbol-palette');
    expect(SHORTCUT_CONTEXTS.DISPLAY_FOCUSED).toBe('display-focused');
    expect(SHORTCUT_CONTEXTS.CONTEXT_MENU).toBe('context-menu');
    expect(SHORTCUT_CONTEXTS.INPUT).toBe('input');
  });

  it('should provide predefined categories', () => {
    expect(SHORTCUT_CATEGORIES.NAVIGATION).toBe('navigation');
    expect(SHORTCUT_CATEGORIES.SYMBOL).toBe('symbol');
    expect(SHORTCUT_CATEGORIES.DISPLAY).toBe('display');
    expect(SHORTCUT_CATEGORIES.CONFIGURATION).toBe('configuration');
    expect(SHORTCUT_CATEGORIES.SYSTEM).toBe('system');
  });
});

describe('Global Keyboard Manager Instance', () => {
  it('should provide singleton instance', () => {
    expect(keyboardManager).toBeInstanceOf(KeyboardShortcutManager);
  });

  it('should maintain separate state from local instances', () => {
    const localManager = new KeyboardShortcutManager();

    keyboardManager.register('global-test', {
      key: 'Ctrl+G',
      action: vi.fn()
    });

    localManager.register('local-test', {
      key: 'Ctrl+L',
      action: vi.fn()
    });

    expect(keyboardManager.shortcuts.has('global-test')).toBe(true);
    expect(keyboardManager.shortcuts.has('local-test')).toBe(false);

    expect(localManager.shortcuts.has('local-test')).toBe(true);
    expect(localManager.shortcuts.has('global-test')).toBe(false);
  });
});

describe('Performance and Edge Cases', () => {
  let manager;

  beforeEach(() => {
    manager = new KeyboardShortcutManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should handle large numbers of shortcuts efficiently', () => {
    const start = performance.now();

    // Register many shortcuts
    for (let i = 0; i < 1000; i++) {
      manager.register(`shortcut-${i}`, {
        key: `Ctrl+${i}`,
        action: vi.fn()
      });
    }

    const end = performance.now();
    const duration = end - start;

    // Should complete in reasonable time
    expect(duration).toBeLessThan(100);
    expect(manager.shortcuts.size).toBe(1000);
  });

  it('should handle rapid key events efficiently', () => {
    manager.register('test-shortcut', {
      key: 'Ctrl+K',
      action: vi.fn()
    });

    const start = performance.now();

    const mockEvent = {
      key: 'k',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };

    // Simulate many key events
    for (let i = 0; i < 1000; i++) {
      manager.handleKeyDown(mockEvent);
    }

    const end = performance.now();
    const duration = end - start;

    expect(duration).toBeLessThan(50);
  });

  it('should handle invalid shortcut configurations gracefully', () => {
    const invalidConfigs = [
      null,
      undefined,
      {},
      { key: null },
      { key: '' },
      { action: null }
    ];

    invalidConfigs.forEach(config => {
      expect(() => manager.register('test', config)).not.toThrow();
    });
  });

  it('should handle malformed key combinations', () => {
    const malformedKeys = [
      '',
      null,
      undefined,
      'invalid-key-without-plus',
      'Ctrl+',
      '+K',
      'Ctrl+++Shift+K'
    ];

    malformedKeys.forEach(key => {
      expect(() => manager.normalizeKeyCombo(key)).not.toThrow();
    });
  });

  it('should prevent memory leaks with rapid register/unregister', () => {
    for (let i = 0; i < 100; i++) {
      manager.register(`temp-shortcut-${i}`, {
        key: `Ctrl+${i}`,
        action: vi.fn()
      });

      manager.unregister(`temp-shortcut-${i}`);
    }

    expect(manager.shortcuts.size).toBe(0);
  });
});