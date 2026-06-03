import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateWebSocketMessage,
  logValidationResult,
} from '../dataContracts.js';

// ============================================================================
// validateWebSocketMessage
// ============================================================================

describe('validateWebSocketMessage', () => {
  // ---------------------------------------------------------------------------
  // Null / undefined / non-object inputs
  // ---------------------------------------------------------------------------

  describe('null and undefined inputs', () => {
    it('returns invalid for null', () => {
      const result = validateWebSocketMessage(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/Expected object/);
    });

    it('returns invalid for undefined', () => {
      const result = validateWebSocketMessage(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/Expected object/);
    });

    it('returns invalid for a string primitive', () => {
      const result = validateWebSocketMessage('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Expected object/);
    });

    it('returns invalid for a number primitive', () => {
      const result = validateWebSocketMessage(42);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Expected object/);
    });

    it('returns invalid for a boolean primitive', () => {
      const result = validateWebSocketMessage(true);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Expected object/);
    });
  });

  // ---------------------------------------------------------------------------
  // Missing or invalid type field
  // ---------------------------------------------------------------------------

  describe('missing or invalid type field', () => {
    it('returns invalid for empty object', () => {
      const result = validateWebSocketMessage({});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/type/);
    });

    it('returns invalid when type is a number', () => {
      const result = validateWebSocketMessage({ type: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/type/);
    });

    it('returns invalid when type is a boolean', () => {
      const result = validateWebSocketMessage({ type: true });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/type/);
    });

    it('returns invalid when type is empty string (falsy)', () => {
      const result = validateWebSocketMessage({ type: '' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/type/);
    });

    it('returns invalid when type is unknown', () => {
      const result = validateWebSocketMessage({ type: 'unknownType' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Unknown message type/);
    });
  });

  // ---------------------------------------------------------------------------
  // Known message types — valid messages
  // ---------------------------------------------------------------------------

  describe('valid known message types', () => {
    const validTypes = [
      'symbolDataPackage',
      'tick',
      'profileUpdate',
      'twapUpdate',
      'error',
      'profileError',
      'status',
      'ready',
      'candleUpdate',
      'candleHistory',
    ];

    validTypes.forEach((type) => {
      it(`accepts type "${type}"`, () => {
        const result = validateWebSocketMessage({ type });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Context parameter
  // ---------------------------------------------------------------------------

  describe('context parameter', () => {
    it('accepts default context', () => {
      const result = validateWebSocketMessage({ type: 'tick' });
      expect(result.valid).toBe(true);
    });

    it('accepts custom context string', () => {
      const result = validateWebSocketMessage({ type: 'tick' }, 'my-handler');
      expect(result.valid).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // symbolDataPackage warnings
  // ---------------------------------------------------------------------------

  describe('symbolDataPackage warnings', () => {
    it('returns valid with warnings when high/todaysHigh are both missing', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        current: 1.0,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('high/todaysHigh'),
      );
    });

    it('returns valid with no high warning when high is present', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        high: 1.5,
      });
      expect(result.valid).toBe(true);
      const hasHighWarning = result.warnings?.some((w) =>
        w.includes('high/todaysHigh'),
      );
      expect(hasHighWarning).toBe(false);
    });

    it('returns valid with no high warning when todaysHigh is present', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        todaysHigh: 1.5,
      });
      expect(result.valid).toBe(true);
      const hasHighWarning = result.warnings?.some((w) =>
        w.includes('high/todaysHigh'),
      );
      expect(hasHighWarning).toBe(false);
    });

    it('returns valid with warnings when low/todaysLow are both missing', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        current: 1.0,
        high: 1.5,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('low/todaysLow'),
      );
    });

    it('returns valid with no low warning when low is present', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        low: 0.5,
      });
      expect(result.valid).toBe(true);
      const hasLowWarning = result.warnings?.some((w) =>
        w.includes('low/todaysLow'),
      );
      expect(hasLowWarning).toBe(false);
    });

    it('returns valid with warnings when open/todaysOpen are both missing', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        current: 1.0,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('open/todaysOpen'),
      );
    });

    it('returns valid with no open warning when open is present', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        open: 1.0,
      });
      expect(result.valid).toBe(true);
      const hasOpenWarning = result.warnings?.some((w) =>
        w.includes('open/todaysOpen'),
      );
      expect(hasOpenWarning).toBe(false);
    });

    it('returns valid with warnings when adrHigh/projectedAdrHigh are both missing', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        current: 1.0,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('adrHigh/projectedAdrHigh'),
      );
    });

    it('returns valid with no adrHigh warning when adrHigh is present', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        adrHigh: 2.0,
      });
      expect(result.valid).toBe(true);
      const hasAdrHighWarning = result.warnings?.some((w) =>
        w.includes('adrHigh/projectedAdrHigh'),
      );
      expect(hasAdrHighWarning).toBe(false);
    });

    it('returns valid with warnings when adrLow/projectedAdrLow are both missing', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        current: 1.0,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('adrLow/projectedAdrLow'),
      );
    });

    it('returns valid with no adrLow warning when adrLow is present', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        adrLow: 0.5,
      });
      expect(result.valid).toBe(true);
      const hasAdrLowWarning = result.warnings?.some((w) =>
        w.includes('adrLow/projectedAdrLow'),
      );
      expect(hasAdrLowWarning).toBe(false);
    });

    it('returns valid with warnings when all price fields are missing', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        high: 2.0,
        low: 0.5,
        open: 1.0,
        adrHigh: 2.0,
        adrLow: 0.5,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('price fields'),
      );
    });

    it('returns valid with no price warning when current is present', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        current: 1.0,
      });
      expect(result.valid).toBe(true);
      const hasPriceWarning = result.warnings?.some((w) =>
        w.includes('price fields'),
      );
      expect(hasPriceWarning).toBe(false);
    });

    it('returns valid with no price warning when price is present', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        price: 1.0,
      });
      expect(result.valid).toBe(true);
      const hasPriceWarning = result.warnings?.some((w) =>
        w.includes('price fields'),
      );
      expect(hasPriceWarning).toBe(false);
    });

    it('returns valid with no price warning when bid is present', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        bid: 1.0,
      });
      expect(result.valid).toBe(true);
      const hasPriceWarning = result.warnings?.some((w) =>
        w.includes('price fields'),
      );
      expect(hasPriceWarning).toBe(false);
    });

    it('returns valid with no price warning when ask is present', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        ask: 1.0,
      });
      expect(result.valid).toBe(true);
      const hasPriceWarning = result.warnings?.some((w) =>
        w.includes('price fields'),
      );
      expect(hasPriceWarning).toBe(false);
    });

    it('returns valid with no price warning when initialPrice is present', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        initialPrice: 1.0,
      });
      expect(result.valid).toBe(true);
      const hasPriceWarning = result.warnings?.some((w) =>
        w.includes('price fields'),
      );
      expect(hasPriceWarning).toBe(false);
    });

    it('no warnings when all required fields are present', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        high: 2.0,
        low: 0.5,
        open: 1.0,
        adrHigh: 2.0,
        adrLow: 0.5,
        current: 1.0,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('alternative fields (todaysHigh, projectedAdrHigh) satisfy warnings', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        todaysHigh: 2.0,
        todaysLow: 0.5,
        todaysOpen: 1.0,
        projectedAdrHigh: 2.0,
        projectedAdrLow: 0.5,
        price: 1.0,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('extra fields on symbolDataPackage do not cause errors', () => {
      const result = validateWebSocketMessage({
        type: 'symbolDataPackage',
        current: 1.0,
        high: 2.0,
        low: 0.5,
        open: 1.0,
        adrHigh: 2.0,
        adrLow: 0.5,
        extraField: 'ignored',
        anotherField: 42,
      });
      expect(result.valid).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Non-symbolDataPackage types have no warnings
  // ---------------------------------------------------------------------------

  describe('non-symbolDataPackage types produce no warnings', () => {
    const nonPackageTypes = [
      'tick',
      'profileUpdate',
      'twapUpdate',
      'error',
      'profileError',
      'status',
      'ready',
      'candleUpdate',
      'candleHistory',
    ];

    nonPackageTypes.forEach((type) => {
      it(`"${type}" returns no warnings`, () => {
        const result = validateWebSocketMessage({ type });
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('array input is treated as object but fails type check', () => {
      const result = validateWebSocketMessage(['tick']);
      // Arrays are typeof 'object' so it passes the first check,
      // but has no string type property at msg.type
      expect(result.valid).toBe(false);
    });

    it('object with type null returns invalid', () => {
      const result = validateWebSocketMessage({ type: null });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/type/);
    });

    it('returns empty errors array for valid message', () => {
      const result = validateWebSocketMessage({ type: 'ready' });
      expect(result.errors).toEqual([]);
    });

    it('handles object with many extra fields gracefully', () => {
      const msg = { type: 'tick' };
      for (let i = 0; i < 100; i++) {
        msg[`field_${i}`] = i;
      }
      const result = validateWebSocketMessage(msg);
      expect(result.valid).toBe(true);
    });
  });
});

// ============================================================================
// logValidationResult
// ============================================================================

describe('logValidationResult', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    consoleSpy.warn.mockRestore();
    consoleSpy.log.mockRestore();
  });

  it('does not log warnings for a valid result with no warnings', () => {
    logValidationResult('test-ctx', { valid: true }, {});
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.log).not.toHaveBeenCalled();
  });

  it('logs warnings for a valid result with warnings (dev mode)', () => {
    // In test environment, import.meta.env.DEV is true (vitest default)
    logValidationResult('test-ctx', {
      valid: true,
      warnings: ['something is off'],
    });
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.log).toHaveBeenCalledWith(
      '[test-ctx] Validation warnings:',
      ['something is off'],
    );
  });

  it('logs errors for an invalid result', () => {
    logValidationResult('my-handler', {
      valid: false,
      errors: ['Missing type'],
    }, { raw: 'data' });
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      '[my-handler] Validation failed:',
      ['Missing type'],
      { raw: 'data' },
    );
  });

  it('logs error without data when data is undefined', () => {
    logValidationResult('ctx', {
      valid: false,
      errors: ['bad'],
    });
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      '[ctx] Validation failed:',
      ['bad'],
      undefined,
    );
  });

  it('logs error without data when data is null', () => {
    logValidationResult('ctx', {
      valid: false,
      errors: ['bad'],
    }, null);
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      '[ctx] Validation failed:',
      ['bad'],
      null,
    );
  });
});
