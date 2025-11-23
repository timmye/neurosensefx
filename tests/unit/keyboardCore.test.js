/**
 * Core Keyboard Utility Tests
 *
 * Focuses on testing the fundamental keyboard utility functions
 * without complex reactive store or DOM dependencies
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Extract core functions from KeyboardShortcutManager for isolated testing
class TestKeyboardManager {
  normalizeKeyCombo(keyCombo) {
    if (!keyCombo || typeof keyCombo !== 'string') {
      return '';
    }
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

  getKeyCombo(event) {
    if (!event) return '';

    const parts = [];

    if (event.ctrlKey) parts.push('ctrl');
    if (event.metaKey) parts.push('meta');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');

    // Handle special keys
    const key = event.key ? event.key.toLowerCase() : '';
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

  isShortcutActive(shortcut, activeContext = 'global') {
    if (!shortcut || !shortcut.contexts) return false;
    return shortcut.contexts.includes('global') ||
           shortcut.contexts.includes(activeContext);
  }
}

describe('Core Keyboard Utility Functions', () => {
  let manager;

  beforeEach(() => {
    manager = new TestKeyboardManager();
  });

  describe('Key Combination Normalization', () => {
    it('should normalize standard key combinations', () => {
      const testCases = [
        { input: 'Ctrl+K', expected: 'ctrl+k' },
        { input: 'ctrl+k', expected: 'ctrl+k' },
        { input: 'CMD+Enter', expected: 'meta+enter' },
        { input: 'Command+Space', expected: 'meta+space' },
        { input: 'Alt+Shift+T', expected: 'alt+shift+t' },
        { input: 'Ctrl + Shift + A', expected: 'ctrl+shift+a' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = manager.normalizeKeyCombo(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle edge cases in normalization', () => {
      const edgeCases = [
        { input: '', expected: '' },
        { input: null, expected: '' },
        { input: undefined, expected: '' },
        { input: 'a', expected: 'a' },
        { input: 'SHIFT+A', expected: 'shift+a' }
      ];

      edgeCases.forEach(({ input, expected }) => {
        const result = manager.normalizeKeyCombo(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle malformed input gracefully', () => {
      const malformedInputs = [
        'Ctrl+',
        '+K',
        'Ctrl+++Shift+K',
        'invalid-key-without-plus'
      ];

      malformedInputs.forEach(input => {
        expect(() => manager.normalizeKeyCombo(input)).not.toThrow();
        const result = manager.normalizeKeyCombo(input);
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('Key Event Processing', () => {
    it('should extract basic key combinations', () => {
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

    it('should handle single keys', () => {
      const mockEvent = {
        key: 'a',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false
      };

      const combo = manager.getKeyCombo(mockEvent);
      expect(combo).toBe('a');
    });

    it('should handle special keys', () => {
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

    it('should handle multiple modifiers', () => {
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

    it('should handle missing event properties', () => {
      const incompleteEvents = [
        null,
        undefined,
        {},
        { key: 'a' },
        { ctrlKey: true },
        { key: 'a', ctrlKey: true }
      ];

      incompleteEvents.forEach(event => {
        expect(() => manager.getKeyCombo(event)).not.toThrow();
        const result = manager.getKeyCombo(event);
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('Shortcut Context Activation', () => {
    it('should activate global shortcuts in any context', () => {
      const globalShortcut = {
        id: 'global-test',
        contexts: ['global']
      };

      expect(manager.isShortcutActive(globalShortcut, 'global')).toBe(true);
      expect(manager.isShortcutActive(globalShortcut, 'any-context')).toBe(true);
      expect(manager.isShortcutActive(globalShortcut, 'symbol-palette')).toBe(true);
    });

    it('should only activate context-specific shortcuts in matching context', () => {
      const contextShortcut = {
        id: 'context-test',
        contexts: ['symbol-palette']
      };

      expect(manager.isShortcutActive(contextShortcut, 'global')).toBe(false);
      expect(manager.isShortcutActive(contextShortcut, 'symbol-palette')).toBe(true);
      expect(manager.isShortcutActive(contextShortcut, 'display-focused')).toBe(false);
    });

    it('should handle shortcuts with multiple contexts', () => {
      const multiContextShortcut = {
        id: 'multi-context-test',
        contexts: ['symbol-palette', 'display-focused']
      };

      expect(manager.isShortcutActive(multiContextShortcut, 'global')).toBe(false);
      expect(manager.isShortcutActive(multiContextShortcut, 'symbol-palette')).toBe(true);
      expect(manager.isShortcutActive(multiContextShortcut, 'display-focused')).toBe(true);
      expect(manager.isShortcutActive(multiContextShortcut, 'context-menu')).toBe(false);
    });

    it('should handle invalid shortcut objects', () => {
      const invalidShortcuts = [
        null,
        undefined,
        {},
        { contexts: null },
        { contexts: undefined },
        { id: 'test' } // Missing contexts
      ];

      invalidShortcuts.forEach(shortcut => {
        expect(manager.isShortcutActive(shortcut, 'global')).toBe(false);
      });
    });
  });

  describe('Integration Examples', () => {
    it('should handle common keyboard shortcut patterns', () => {
      const commonShortcuts = [
        { combo: 'Ctrl+S', contexts: ['global'], expectedContext: 'any', shouldMatch: true },
        { combo: 'Ctrl+Shift+S', contexts: ['symbol-palette'], expectedContext: 'symbol-palette', shouldMatch: true },
        { combo: 'Escape', contexts: ['context-menu'], expectedContext: 'global', shouldMatch: false },
        { combo: 'Enter', contexts: ['global', 'input'], expectedContext: 'input', shouldMatch: true }
      ];

      commonShortcuts.forEach(({ combo, contexts, expectedContext, shouldMatch }) => {
        const normalizedCombo = manager.normalizeKeyCombo(combo);
        const shortcut = { contexts };

        if (expectedContext === 'any') {
          expect(manager.isShortcutActive(shortcut, 'global')).toBe(shouldMatch);
        } else {
          expect(manager.isShortcutActive(shortcut, expectedContext)).toBe(shouldMatch);
        }

        // Verify normalization produces valid output
        expect(typeof normalizedCombo).toBe('string');
        expect(normalizedCombo.length).toBeGreaterThan(0);
      });
    });

    it('should process realistic keyboard events', () => {
      const realisticEvents = [
        {
          description: 'Quick save',
          event: { key: 's', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
          expectedCombo: 'ctrl+s'
        },
        {
          description: 'Save as',
          event: { key: 's', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true },
          expectedCombo: 'ctrl+shift+s'
        },
        {
          description: 'Close window',
          event: { key: 'w', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false },
          expectedCombo: 'meta+w'
        },
        {
          description: 'Open command palette',
          event: { key: 'k', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
          expectedCombo: 'ctrl+k'
        },
        {
          description: 'Undo',
          event: { key: 'z', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
          expectedCombo: 'ctrl+z'
        }
      ];

      realisticEvents.forEach(({ description, event, expectedCombo }) => {
        const combo = manager.getKeyCombo(event);
        expect(combo).toBe(expectedCombo);
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle repeated operations efficiently', () => {
      const start = performance.now();
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        manager.normalizeKeyCombo('Ctrl+Shift+Alt+Meta+K');
        manager.getKeyCombo({
          key: 'k',
          ctrlKey: true,
          metaKey: true,
          altKey: true,
          shiftKey: true
        });
      }

      const end = performance.now();
      const duration = end - start;

      // Should complete quickly for many operations
      expect(duration).toBeLessThan(100);
    });

    it('should handle extreme key combinations', () => {
      const extremeEvent = {
        key: 'ArrowUp',
        ctrlKey: true,
        metaKey: true,
        altKey: true,
        shiftKey: true
      };

      const combo = manager.getKeyCombo(extremeEvent);
      expect(combo).toBe('ctrl+meta+alt+shift+up');
    });

    it('should maintain consistency across multiple calls', () => {
      const testInput = 'Ctrl+Shift+K';
      const results = [];

      for (let i = 0; i < 100; i++) {
        results.push(manager.normalizeKeyCombo(testInput));
      }

      // All results should be identical
      const firstResult = results[0];
      results.forEach(result => {
        expect(result).toBe(firstResult);
      });
    });
  });
});