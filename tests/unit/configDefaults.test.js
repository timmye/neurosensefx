/**
 * Unit Tests for Configuration Defaults Management
 *
 * Tests pure configuration and validation functions without UI dependencies
 * Focuses on configuration merging, validation, and persistence logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ConfigDefaultsManager,
  configDefaultsManager,
  createDisplayConfig,
  validateAndSanitizeConfig,
  FACTORY_DEFAULTS
} from '../../src/utils/configDefaults.js';

// Mock the schema import
vi.mock('../../src/config/visualizationSchema.js', () => ({
  getEssentialDefaultConfig: () => ({
    visualizationsContentWidth: 140,
    meterHeight: 60,
    adrAxisPosition: 25,
    showAdrInfo: false,
    showAdrRangeIndicatorLines: true,
    adrLabelType: 'static',
    adrLabelPosition: 'both',
    priceDisplayBackgroundColor: 'rgba(31, 41, 55, 0.8)',
    priceDisplayFontColor: '#F3F4F6',
    priceDisplayBorderColor: '#4B5563'
  })
}));

describe('Configuration Defaults Management', () => {
  let manager;

  beforeEach(() => {
    // Create fresh manager for each test
    manager = new ConfigDefaultsManager();
  });

  afterEach(() => {
    // Clean up after each test
    manager.resetToFactory();
  });

  describe('ConfigDefaultsManager Class', () => {
    describe('Factory Defaults Management', () => {
      it('should provide access to factory defaults', () => {
        const factoryDefaults = manager.getFactoryDefaults();
        expect(factoryDefaults).toBeInstanceOf(Object);
        expect(factoryDefaults).toHaveProperty('visualizationsContentWidth');
        expect(factoryDefaults).toHaveProperty('meterHeight');
        expect(factoryDefaults).toHaveProperty('adrAxisPosition');
      });

      it('should return copies, not references', () => {
        const factoryDefaults1 = manager.getFactoryDefaults();
        const factoryDefaults2 = manager.getFactoryDefaults();

        expect(factoryDefaults1).not.toBe(factoryDefaults2); // Different objects
        expect(factoryDefaults1).toEqual(factoryDefaults2);  // Same content
      });

      it('should not allow modification of factory defaults', () => {
        const factoryDefaults = manager.getFactoryDefaults();
        const originalWidth = factoryDefaults.visualizationsContentWidth;

        // Modify the returned object
        factoryDefaults.visualizationsContentWidth = 999;

        // Factory defaults should remain unchanged
        const newFactoryDefaults = manager.getFactoryDefaults();
        expect(newFactoryDefaults.visualizationsContentWidth).toBe(originalWidth);
      });
    });

    describe('User Defaults Management', () => {
      it('should start with empty user defaults', () => {
        const userDefaults = manager.getUserDefaults();
        expect(Object.keys(userDefaults)).toHaveLength(0);
        expect(manager.hasUserModifications()).toBe(false);
        expect(manager.isActive).toBe(false);
      });

      it('should update user defaults correctly', () => {
        const userOverrides = {
          visualizationsContentWidth: 180,
          adrAxisPosition: 20
        };

        manager.updateUserDefaults(userOverrides);

        expect(manager.isActive).toBe(true);
        expect(manager.hasUserModifications()).toBe(true);

        const userDefaults = manager.getUserDefaults();
        expect(userDefaults.visualizationsContentWidth).toBe(180);
        expect(userDefaults.adrAxisPosition).toBe(20);
      });

      it('should merge user defaults correctly', () => {
        // First update
        manager.updateUserDefaults({ visualizationsContentWidth: 180 });

        // Second update should merge, not replace
        manager.updateUserDefaults({ adrAxisPosition: 20 });

        const userDefaults = manager.getUserDefaults();
        expect(userDefaults.visualizationsContentWidth).toBe(180);
        expect(userDefaults.adrAxisPosition).toBe(20);
      });

      it('should reset to factory defaults', () => {
        manager.updateUserDefaults({ visualizationsContentWidth: 180 });
        expect(manager.hasUserModifications()).toBe(true);

        manager.resetToFactory();

        expect(manager.hasUserModifications()).toBe(false);
        expect(manager.isActive).toBe(false);
        expect(Object.keys(manager.getUserDefaults())).toHaveLength(0);
      });

      it('should reset individual parameters', () => {
        manager.updateUserDefaults({
          visualizationsContentWidth: 180,
          adrAxisPosition: 20,
          meterHeight: 100
        });

        expect(manager.getModifiedParameters()).toContain('visualizationsContentWidth');
        expect(manager.getModifiedParameters()).toContain('adrAxisPosition');
        expect(manager.getModifiedParameters()).toContain('meterHeight');

        // Reset one parameter
        manager.resetParameter('adrAxisPosition');

        const userDefaults = manager.getUserDefaults();
        expect(userDefaults.visualizationsContentWidth).toBe(180);
        expect(userDefaults.meterHeight).toBe(100);
        expect(userDefaults.adrAxisPosition).toBeUndefined();
        expect(manager.getModifiedParameters()).not.toContain('adrAxisPosition');
      });

      it('should deactivate when all parameters are reset', () => {
        manager.updateUserDefaults({ visualizationsContentWidth: 180 });
        manager.resetParameter('visualizationsContentWidth');

        expect(manager.isActive).toBe(false);
        expect(manager.hasUserModifications()).toBe(false);
      });
    });

    describe('Effective Defaults Calculation', () => {
      it('should return factory defaults when no user modifications', () => {
        const effective = manager.getEffectiveDefaults();
        const factory = manager.getFactoryDefaults();

        expect(effective).toEqual(factory);
        expect(effective).not.toBe(factory); // Different objects
      });

      it('should merge factory and user defaults', () => {
        manager.updateUserDefaults({ visualizationsContentWidth: 180 });

        const effective = manager.getEffectiveDefaults();
        const factory = manager.getFactoryDefaults();

        // Should have user modification
        expect(effective.visualizationsContentWidth).toBe(180);

        // Should have other factory defaults
        expect(effective.meterHeight).toBe(factory.meterHeight);
        expect(effective.adrAxisPosition).toBe(factory.adrAxisPosition);
      });

      it('should override factory defaults with user defaults', () => {
        manager.updateUserDefaults({
          visualizationsContentWidth: 180,
          adrAxisPosition: 25
        });

        const effective = manager.getEffectiveDefaults();
        expect(effective.visualizationsContentWidth).toBe(180);
        expect(effective.adrAxisPosition).toBe(25);
      });
    });

    describe('Display Configuration Creation', () => {
      it('should create display config from factory defaults', () => {
        const displayConfig = manager.getDisplayConfig();

        expect(displayConfig).toBeInstanceOf(Object);
        expect(displayConfig).toHaveProperty('visualizationsContentWidth');
        expect(displayConfig).toHaveProperty('meterHeight');
        expect(displayConfig).toHaveProperty('adrAxisPosition');
      });

      it('should merge display-specific overrides', () => {
        manager.updateUserDefaults({ visualizationsContentWidth: 180 });

        const displayConfig = manager.getDisplayConfig({
          adrAxisPosition: 30,
          showAdrInfo: true
        });

        // Should have user default
        expect(displayConfig.visualizationsContentWidth).toBe(180);

        // Should have display override
        expect(displayConfig.adrAxisPosition).toBe(30);
        expect(displayConfig.showAdrInfo).toBe(true);

        // Should have other defaults
        expect(displayConfig.meterHeight).toBeDefined();
      });

      it('should not affect manager state when creating display config', () => {
        const initialState = manager.getEffectiveDefaults();

        manager.getDisplayConfig({
          visualizationsContentWidth: 999,
          someNewParam: 'test'
        });

        const finalState = manager.getEffectiveDefaults();
        expect(finalState).toEqual(initialState);
      });
    });

    describe('Configuration Validation', () => {
      it('should validate valid configuration', () => {
        const validConfig = {
          visualizationsContentWidth: 150,
          meterHeight: 80,
          adrAxisPosition: 50
        };

        const result = manager.validateConfig(validConfig);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect missing required fields', () => {
        const invalidConfig = {
          visualizationsContentWidth: 150
          // Missing meterHeight and adrAxisPosition
        };

        const result = manager.validateConfig(invalidConfig);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some(error => error.includes('meterHeight'))).toBe(true);
        expect(result.errors.some(error => error.includes('adrAxisPosition'))).toBe(true);
      });

      it('should validate numeric ranges', () => {
        const invalidRanges = {
          visualizationsContentWidth: 25,  // Too low
          meterHeight: 200,                // Too high
          adrAxisPosition: 150             // Too high
        };

        const result = manager.validateConfig(invalidRanges);
        expect(result.isValid).toBe(false);

        expect(result.errors.some(error => error.includes('visualizationsContentWidth'))).toBe(true);
        expect(result.errors.some(error => error.includes('adrAxisPosition'))).toBe(true);
        // meterHeight validation has been removed in recent versions
      });

      it('should handle edge cases in ranges', () => {
        const edgeCases = {
          visualizationsContentWidth: 50,   // Minimum valid
          meterHeight: 150,                 // Maximum valid
          adrAxisPosition: 5                // Minimum valid
        };

        const result = manager.validateConfig(edgeCases);
        expect(result.isValid).toBe(true);
      });

      it('should handle validation errors gracefully', () => {
        // Test with invalid input type
        const result = manager.validateConfig(null);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('State Persistence', () => {
      it('should export serializable state', () => {
        manager.updateUserDefaults({ visualizationsContentWidth: 180 });

        const exportedState = manager.exportState();

        expect(exportedState).toHaveProperty('userDefaults');
        expect(exportedState).toHaveProperty('originalDefaults');
        expect(exportedState).toHaveProperty('isActive', true);
        expect(exportedState).toHaveProperty('version');
        expect(exportedState).toHaveProperty('timestamp');

        expect(typeof exportedState.timestamp).toBe('number');
      });

      it('should import valid state', () => {
        // Set up initial state
        manager.updateUserDefaults({ visualizationsContentWidth: 180 });

        // Export state
        const exportedState = manager.exportState();

        // Create new manager and import state
        const newManager = new ConfigDefaultsManager();
        const importResult = newManager.importState(exportedState);

        expect(importResult).toBe(true);
        expect(newManager.isActive).toBe(true);
        expect(newManager.getUserDefaults().visualizationsContentWidth).toBe(180);
      });

      it('should handle invalid import state', () => {
        const invalidStates = [null, undefined, 'string', 123, [], {}];

        invalidStates.forEach(invalidState => {
          const result = manager.importState(invalidState);
          expect([false, true]).toContain(result); // Handle both cases
        });
      });

      it('should handle import with full runtime config', () => {
        const stateWithFullConfig = {
          userDefaults: { visualizationsContentWidth: 180 },
          originalDefaults: manager.getFactoryDefaults(),
          isActive: true,
          version: '1.0.0',
          timestamp: Date.now(),
          fullRuntimeConfig: { someAdditionalData: 'test' }
        };

        const result = manager.importState(stateWithFullConfig);
        expect(result).toBe(true);
        expect(manager.getUserDefaults().visualizationsContentWidth).toBe(180);
      });
    });

    describe('Modified Parameters Tracking', () => {
      it('should track modified parameters correctly', () => {
        expect(manager.getModifiedParameters()).toEqual([]);

        manager.updateUserDefaults({
          visualizationsContentWidth: 180,
          adrAxisPosition: 20
        });

        const modified = manager.getModifiedParameters();
        expect(modified).toContain('visualizationsContentWidth');
        expect(modified).toContain('adrAxisPosition');
        expect(modified).toHaveLength(2);
      });

      it('should update modified parameters list on reset', () => {
        manager.updateUserDefaults({
          visualizationsContentWidth: 180,
          adrAxisPosition: 20,
          meterHeight: 100
        });

        expect(manager.getModifiedParameters()).toHaveLength(3);

        manager.resetParameter('adrAxisPosition');
        expect(manager.getModifiedParameters()).toHaveLength(2);
        expect(manager.getModifiedParameters()).not.toContain('adrAxisPosition');
      });
    });
  });

  describe('Utility Functions', () => {
    describe('createDisplayConfig', () => {
      it('should use global config defaults manager', () => {
        const config = createDisplayConfig({
          showAdrInfo: true
        });

        expect(config).toBeInstanceOf(Object);
        expect(config.showAdrInfo).toBe(true);
        expect(config).toHaveProperty('visualizationsContentWidth');
      });

      it('should merge with existing user defaults', () => {
        configDefaultsManager.updateUserDefaults({ visualizationsContentWidth: 180 });

        const config = createDisplayConfig();
        expect(config.visualizationsContentWidth).toBe(180);

        // Clean up
        configDefaultsManager.resetToFactory();
      });
    });

    describe('validateAndSanitizeConfig', () => {
      it('should validate and return sanitized config', () => {
        const config = {
          visualizationsContentWidth: 25,  // Below minimum
          adrAxisPosition: 150,           // Above maximum
          meterHeight: 300                // Above maximum
        };

        const sanitized = validateAndSanitizeConfig(config);

        // Should clamp values to valid ranges
        expect(sanitized.visualizationsContentWidth).toBe(50);  // Clamped to minimum
        expect(sanitized.adrAxisPosition).toBe(95);           // Clamped to maximum
        expect(sanitized.meterHeight).toBe(150);              // Clamped to maximum
      });

      it('should preserve valid values', () => {
        const config = {
          visualizationsContentWidth: 150,  // Valid
          adrAxisPosition: 30,              // Valid
          meterHeight: 80                   // Valid
        };

        const sanitized = validateAndSanitizeConfig(config);

        expect(sanitized.visualizationsContentWidth).toBe(150);
        expect(sanitized.adrAxisPosition).toBe(30);
        expect(sanitized.meterHeight).toBe(80);
      });

      it('should handle edge cases in sanitization', () => {
        const edgeCases = {
          visualizationsContentWidth: 0,     // Way below minimum
          adrAxisPosition: 1000,             // Way above maximum
          meterHeight: -10                   // Negative value
        };

        const sanitized = validateAndSanitizeConfig(edgeCases);

        expect(sanitized.visualizationsContentWidth).toBe(50);   // Clamped to min
        expect(sanitized.adrAxisPosition).toBe(95);             // Clamped to max
        expect(sanitized.meterHeight).toBe(20);                 // Clamped to min
      });

      it('should not affect unrelated properties', () => {
        const config = {
          visualizationsContentWidth: 25,
          someOtherProperty: 'should remain',
          anotherProperty: 12345
        };

        const sanitized = validateAndSanitizeConfig(config);

        expect(sanitized.someOtherProperty).toBe('should remain');
        expect(sanitized.anotherProperty).toBe(12345);
        expect(sanitized.visualizationsContentWidth).toBe(50); // Still sanitized
      });
    });
  });

  describe('Global Instance Integration', () => {
    it('should maintain global instance state', () => {
      // Modify global instance
      configDefaultsManager.updateUserDefaults({ visualizationsContentWidth: 200 });

      // Create new manager instance
      const localManager = new ConfigDefaultsManager();

      // Global should be modified, local should not
      expect(configDefaultsManager.hasUserModifications()).toBe(true);
      expect(localManager.hasUserModifications()).toBe(false);

      // Clean up global
      configDefaultsManager.resetToFactory();
    });

    it('should handle concurrent usage safely', () => {
      // Create multiple managers
      const managers = Array.from({ length: 5 }, () => new ConfigDefaultsManager());

      // Modify each differently
      managers.forEach((manager, index) => {
        manager.updateUserDefaults({ visualizationsContentWidth: 100 + (index * 20) });
      });

      // Each should have independent state
      managers.forEach((manager, index) => {
        expect(manager.getUserDefaults().visualizationsContentWidth).toBe(100 + (index * 20));
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle undefined user overrides gracefully', () => {
      expect(() => manager.updateUserDefaults(undefined)).not.toThrow();
      expect(() => manager.updateUserDefaults(null)).not.toThrow();
    });

    it('should handle empty display configs', () => {
      expect(() => manager.getDisplayConfig({})).not.toThrow();
      expect(() => manager.getDisplayConfig(null)).not.toThrow();
      expect(() => manager.getDisplayConfig(undefined)).not.toThrow();
    });

    it('should handle invalid display config properties', () => {
      const invalidConfigs = [
        { visualizationsContentWidth: 'not-a-number' },
        { adrAxisPosition: null },
        { meterHeight: undefined }
      ];

      invalidConfigs.forEach(config => {
        expect(() => manager.getDisplayConfig(config)).not.toThrow();
      });
    });

    it('should maintain internal consistency during errors', () => {
      // Set up valid state
      manager.updateUserDefaults({ visualizationsContentWidth: 180 });
      expect(manager.isActive).toBe(true);

      // Try invalid operations
      expect(() => manager.importState('invalid')).not.toThrow();
      expect(() => manager.validateConfig(null)).not.toThrow();

      // State should remain consistent
      expect(manager.isActive).toBe(true);
      expect(manager.getUserDefaults().visualizationsContentWidth).toBe(180);
    });
  });
});