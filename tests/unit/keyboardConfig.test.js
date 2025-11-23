/**
 * Unit Tests for Keyboard Shortcut Configuration
 *
 * Tests shortcut configuration parsing, validation, and management utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_SHORTCUTS,
  WORKFLOW_PRIORITIES,
  validateShortcutConfig,
  findShortcutConflicts,
  getShortcutsByCategory,
  getShortcutsByWorkflow,
  sortShortcutsByPriority,
  formatKeyForDisplay
} from '../../src/utils/shortcutConfig.js';

describe('Keyboard Shortcut Configuration', () => {
  describe('DEFAULT_SHORTCUTS Structure', () => {
    it('should contain valid shortcut definitions', () => {
      expect(DEFAULT_SHORTCUTS).toBeInstanceOf(Object);
      expect(Object.keys(DEFAULT_SHORTCUTS).length).toBeGreaterThan(0);
    });

    it('should have required fields for each shortcut', () => {
      Object.entries(DEFAULT_SHORTCUTS).forEach(([id, shortcut]) => {
        expect(shortcut.key).toBeDefined();
        expect(typeof shortcut.key).toBe('string');
        expect(shortcut.description).toBeDefined();
        expect(typeof shortcut.description).toBe('string');
        expect(shortcut.category).toBeDefined();
        expect(shortcut.contexts).toBeDefined();
        expect(Array.isArray(shortcut.contexts)).toBe(true);
      });
    });

    it('should include core workflow shortcuts', () => {
      const coreShortcuts = Object.entries(DEFAULT_SHORTCUTS)
        .filter(([_, config]) => config.workflow === 'core');

      expect(coreShortcuts.length).toBeGreaterThan(0);

      // Check for essential symbol palette shortcuts
      expect(DEFAULT_SHORTCUTS['symbol.focusPalette']).toBeDefined();
      expect(DEFAULT_SHORTCUTS['symbol.focusPalette'].key).toBe('Ctrl+K');

      // Check for display navigation shortcuts
      expect(DEFAULT_SHORTCUTS['display.switch1']).toBeDefined();
      expect(DEFAULT_SHORTCUTS['display.switch1'].key).toBe('Ctrl+1');
    });

    it('should properly prioritize shortcuts', () => {
      const coreShortcuts = Object.entries(DEFAULT_SHORTCUTS)
        .filter(([_, config]) => config.priority === 1);

      expect(coreShortcuts.length).toBeGreaterThan(0);

      // All core shortcuts should have priority 1
      coreShortcuts.forEach(([id, shortcut]) => {
        expect(shortcut.priority).toBe(1);
        expect(['core', 'legacy'].includes(shortcut.workflow)).toBe(true);
      });
    });
  });

  describe('WORKFLOW_PRIORITIES', () => {
    it('should define valid priority levels', () => {
      expect(WORKFLOW_PRIORITIES.CORE).toBe(1);
      expect(WORKFLOW_PRIORITIES.QUICK_ACTIONS).toBe(2);
      expect(WORKFLOW_PRIORITIES.PROFESSIONAL).toBe(3);
      expect(WORKFLOW_PRIORITIES.SYSTEM).toBe(4);
    });

    it('should have increasing priority values', () => {
      expect(WORKFLOW_PRIORITIES.CORE).toBeLessThan(WORKFLOW_PRIORITIES.QUICK_ACTIONS);
      expect(WORKFLOW_PRIORITIES.QUICK_ACTIONS).toBeLessThan(WORKFLOW_PRIORITIES.PROFESSIONAL);
      expect(WORKFLOW_PRIORITIES.PROFESSIONAL).toBeLessThan(WORKFLOW_PRIORITIES.SYSTEM);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const validConfig = {
        'test.shortcut': {
          key: 'Ctrl+K',
          description: 'Test shortcut',
          category: 'test',
          contexts: ['global']
        }
      };

      const result = validateShortcutConfig(validConfig);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidConfigs = [
        {
          config: {
            'test.noKey': {
              description: 'Test without key',
              category: 'test'
            }
          },
          expectedError: 'Missing key combination'
        },
        {
          config: {
            'test.noDescription': {
              key: 'Ctrl+K',
              category: 'test'
            }
          },
          expectedError: 'Missing description'
        }
      ];

      invalidConfigs.forEach(({ config, expectedError }) => {
        const result = validateShortcutConfig(config);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some(error => error.includes(expectedError))).toBe(true);
      });
    });

    it('should handle missing optional fields with warnings', () => {
      const configWithMissingOptionals = {
        'test.minimal': {
          key: 'Ctrl+K',
          description: 'Minimal test shortcut'
          // Missing category and contexts
        }
      };

      const result = validateShortcutConfig(configWithMissingOptionals);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);

      // Should auto-fill missing fields
      expect(configWithMissingOptionals['test.minimal'].category).toBe('general');
      expect(configWithMissingOptionals['test.minimal'].contexts).toEqual(['global']);
    });

    it('should detect invalid key formats', () => {
      const configWithInvalidKey = {
        'test.invalidKey': {
          key: 'Invalid++Key',
          description: 'Invalid key format test',
          category: 'test',
          contexts: ['global']
        }
      };

      const result = validateShortcutConfig(configWithInvalidKey);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('Invalid key format'))).toBe(true);
    });

    it('should warn about invalid priority values', () => {
      const configWithInvalidPriority = {
        'test.invalidPriority': {
          key: 'Ctrl+K',
          description: 'Invalid priority test',
          category: 'test',
          contexts: ['global'],
          priority: 15 // Too high
        }
      };

      const result = validateShortcutConfig(configWithInvalidPriority);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(warning => warning.includes('Priority should be between'))).toBe(true);
    });
  });

  describe('Conflict Detection', () => {
    it('should detect key conflicts', () => {
      const conflictingConfig = {
        'shortcut1': {
          key: 'Ctrl+K',
          description: 'First shortcut',
          category: 'test',
          contexts: ['global']
        },
        'shortcut2': {
          key: 'Ctrl+K', // Same key
          description: 'Second shortcut',
          category: 'test',
          contexts: ['global']
        }
      };

      const conflicts = findShortcutConflicts(conflictingConfig);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toContain('Key conflict');
      expect(conflicts[0]).toContain('shortcut1');
      expect(conflicts[0]).toContain('shortcut2');
    });

    it('should not detect conflicts for different keys', () => {
      const nonConflictingConfig = {
        'shortcut1': {
          key: 'Ctrl+K',
          description: 'First shortcut',
          category: 'test',
          contexts: ['global']
        },
        'shortcut2': {
          key: 'Ctrl+L', // Different key
          description: 'Second shortcut',
          category: 'test',
          contexts: ['global']
        }
      };

      const conflicts = findShortcutConflicts(nonConflictingConfig);
      expect(conflicts).toHaveLength(0);
    });

    it('should handle case insensitive conflict detection', () => {
      const caseConfig = {
        'shortcut1': {
          key: 'Ctrl+K',
          description: 'First shortcut',
          category: 'test',
          contexts: ['global']
        },
        'shortcut2': {
          key: 'ctrl+k', // Different case
          description: 'Second shortcut',
          category: 'test',
          contexts: ['global']
        }
      };

      const conflicts = findShortcutConflicts(caseConfig);
      expect(conflicts).toHaveLength(1);
    });
  });

  describe('Shortcut Filtering', () => {
    it('should get shortcuts by category', () => {
      const symbolShortcuts = getShortcutsByCategory('symbol');
      const navigationShortcuts = getShortcutsByCategory('navigation');

      expect(Object.keys(symbolShortcuts).length).toBeGreaterThan(0);
      expect(Object.keys(navigationShortcuts).length).toBeGreaterThan(0);

      // All returned shortcuts should have the correct category
      Object.values(symbolShortcuts).forEach(shortcut => {
        expect(shortcut.category).toBe('symbol');
      });

      Object.values(navigationShortcuts).forEach(shortcut => {
        expect(shortcut.category).toBe('navigation');
      });
    });

    it('should get shortcuts by workflow', () => {
      const coreShortcuts = getShortcutsByWorkflow('core');
      const systemShortcuts = getShortcutsByWorkflow('system');

      expect(Object.keys(coreShortcuts).length).toBeGreaterThan(0);
      expect(Object.keys(systemShortcuts).length).toBeGreaterThan(0);

      // All returned shortcuts should have the correct workflow
      Object.values(coreShortcuts).forEach(shortcut => {
        expect(shortcut.workflow).toBe('core');
      });

      Object.values(systemShortcuts).forEach(shortcut => {
        expect(shortcut.workflow).toBe('system');
      });
    });

    it('should return empty object for non-existent filters', () => {
      const emptyCategory = getShortcutsByCategory('non-existent-category');
      const emptyWorkflow = getShortcutsByWorkflow('non-existent-workflow');

      expect(Object.keys(emptyCategory)).toHaveLength(0);
      expect(Object.keys(emptyWorkflow)).toHaveLength(0);
    });
  });

  describe('Priority Sorting', () => {
    it('should sort shortcuts by priority', () => {
      const unsortedShortcuts = [
        { priority: 3, description: 'Priority 3' },
        { priority: 1, description: 'Priority 1' },
        { priority: 2, description: 'Priority 2' },
        { description: 'No priority' }, // Should default to 10
        { priority: 1, description: 'Another Priority 1' }
      ];

      const sorted = sortShortcutsByPriority(unsortedShortcuts);

      expect(sorted[0].priority).toBe(1);
      expect(sorted[1].priority).toBe(1);
      expect(sorted[2].priority).toBe(2);
      expect(sorted[3].priority).toBe(3);
      expect(sorted[4].priority).toBeUndefined(); // No priority should be last
    });

    it('should handle shortcuts without priority values', () => {
      const shortcutsWithoutPriority = [
        { description: 'No priority 1' },
        { description: 'No priority 2' }
      ];

      const sorted = sortShortcutsByPriority(shortcutsWithoutPriority);
      expect(sorted).toHaveLength(2);
      // Should not throw and maintain order
    });
  });

  describe('Key Display Formatting', () => {
    it('should format standard key combinations', () => {
      const testCases = [
        { input: 'ctrl+k', expected: 'Ctrl + K' },
        { input: 'ctrl+shift+k', expected: 'Ctrl + Shift + K' },
        { input: 'alt+tab', expected: 'Alt + Tab' },
        { input: 'meta+k', expected: 'Cmd + K' },
        { input: 'ctrl+meta+s', expected: 'Ctrl + Cmd + S' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = formatKeyForDisplay(input);
        expect(result).toBe(expected);
      });
    });

    it('should format special keys', () => {
      const specialKeyCases = [
        { input: 'escape', expected: 'Esc' },
        { input: 'space', expected: 'Space' },
        { input: 'arrowup', expected: '↑' },
        { input: 'arrowdown', expected: '↓' },
        { input: 'arrowleft', expected: '←' },
        { input: 'arrowright', expected: '→' }
      ];

      specialKeyCases.forEach(({ input, expected }) => {
        const result = formatKeyForDisplay(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle empty and invalid inputs', () => {
      expect(() => formatKeyForDisplay('')).not.toThrow();
      expect(formatKeyForDisplay('')).toBe('');

      expect(() => formatKeyForDisplay('invalid-key')).not.toThrow();
      expect(formatKeyForDisplay('invalid-key')).toBe('INVALID-KEY');
    });

    it('should capitalize single letters', () => {
      const letterCases = [
        { input: 'a', expected: 'A' },
        { input: 'ctrl+a', expected: 'Ctrl + A' },
        { input: 'f1', expected: 'F1' }
      ];

      letterCases.forEach(({ input, expected }) => {
        const result = formatKeyForDisplay(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Integration with Default Shortcuts', () => {
    it('should validate all default shortcuts', () => {
      const result = validateShortcutConfig(DEFAULT_SHORTCUTS);

      // Should have no errors in default configuration
      expect(result.errors).toHaveLength(0);

      // May have some warnings but should be minimal
      if (result.warnings.length > 0) {
        console.log('Default shortcuts warnings:', result.warnings);
      }
    });

    it('should detect no conflicts in default shortcuts', () => {
      const conflicts = findShortcutConflicts(DEFAULT_SHORTCUTS);
      expect(conflicts).toHaveLength(0);
    });

    it('should format default shortcut keys for display', () => {
      const testShortcuts = [
        { id: 'symbol.focusPalette', expectedKey: 'Ctrl + K' },
        { id: 'system.help', expectedKey: 'Ctrl + /' },
        { id: 'display.navigateRight', expectedKey: 'Alt + →' }
      ];

      testShortcuts.forEach(({ id, expectedKey }) => {
        const shortcut = DEFAULT_SHORTCUTS[id];
        expect(shortcut).toBeDefined();
        expect(formatKeyForDisplay(shortcut.key)).toBe(expectedKey);
      });
    });

    it('should provide categorized shortcuts correctly', () => {
      const symbolShortcuts = getShortcutsByCategory('symbol');
      const navigationShortcuts = getShortcutsByCategory('navigation');
      const systemShortcuts = getShortcutsByCategory('system');

      // Should have appropriate numbers of shortcuts in each category
      expect(Object.keys(symbolShortcuts).length).toBeGreaterThan(3);
      expect(Object.keys(navigationShortcuts).length).toBeGreaterThan(10);
      expect(Object.keys(systemShortcuts).length).toBeGreaterThan(5);

      // Should contain known shortcuts
      expect(symbolShortcuts['symbol.focusPalette']).toBeDefined();
      expect(navigationShortcuts['display.switch1']).toBeDefined();
      expect(systemShortcuts['system.help']).toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty configuration', () => {
      const result = validateShortcutConfig({});
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle null and undefined configurations', () => {
      expect(() => validateShortcutConfig(null)).not.toThrow();
      expect(() => validateShortcutConfig(undefined)).not.toThrow();

      const nullResult = validateShortcutConfig(null);
      const undefinedResult = validateShortcutConfig(undefined);

      expect(nullResult.errors).toHaveLength(0);
      expect(undefinedResult.errors).toHaveLength(0);
    });

    it('should handle configuration with non-string keys', () => {
      const configWithInvalidKeys = {
        'test.invalidKeyType': {
          key: 123, // Number instead of string
          description: 'Invalid key type test',
          category: 'test',
          contexts: ['global']
        }
      };

      const result = validateShortcutConfig(configWithInvalidKeys);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle malformed shortcut objects', () => {
      const malformedConfig = {
        'test.notObject': 'not an object',
        'test.nullObject': null,
        'test.emptyObject': {}
      };

      expect(() => validateShortcutConfig(malformedConfig)).not.toThrow();
      const result = validateShortcutConfig(malformedConfig);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});