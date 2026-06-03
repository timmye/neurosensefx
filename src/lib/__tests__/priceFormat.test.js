/**
 * Price Formatting Utilities Tests
 *
 * Tests for all exported functions in priceFormat.js:
 *   formatPrice, formatPriceWithPipPosition, formatPriceToPipLevel,
 *   formatPipMovement, formatPriceToPip, getPipetteDigit,
 *   emphasizeDigits, splitByPipPosition
 *
 * Run: npm run test:unit -- src/lib/__tests__/priceFormat.test.js
 */

import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  formatPriceWithPipPosition,
  formatPriceToPipLevel,
  formatPipMovement,
  formatPriceToPip,
  getPipetteDigit,
  emphasizeDigits,
  splitByPipPosition,
} from '../priceFormat.js';

// ── formatPrice ──

describe('formatPrice', () => {
  it('formats EURUSD price (pipPosition=4) to 4 decimal places', () => {
    expect(formatPrice(1.08532, 4)).toBe('1.0853');
  });

  it('formats EURUSD price (pipPosition=5) to 5 decimal places', () => {
    expect(formatPrice(1.08532, 5)).toBe('1.08532');
  });

  it('formats USDJPY price (pipPosition=2) to 2 decimal places', () => {
    expect(formatPrice(149.853, 2)).toBe('149.85');
  });

  it('formats USDJPY price (pipPosition=3) to 3 decimal places (with pipette)', () => {
    expect(formatPrice(149.853, 3)).toBe('149.853');
  });

  it('formats XAUUSD price (pipPosition=1) to 1 decimal place', () => {
    expect(formatPrice(2340.67, 1)).toBe('2340.7');
  });

  it('formats XAUUSD price (pipPosition=2) to 2 decimal places', () => {
    expect(formatPrice(2340.67, 2)).toBe('2340.67');
  });

  it('rounds using standard rounding (toFixed rounds half-up for positive numbers)', () => {
    // 1.08535 rounded to 4 places: 1.0854 (rounds up)
    expect(formatPrice(1.08535, 4)).toBe('1.0854');
    // 1.08534 rounded to 4 places: 1.0853 (rounds down)
    expect(formatPrice(1.08534, 4)).toBe('1.0853');
  });

  it('returns "N/A" for non-number input', () => {
    expect(formatPrice('1.0853', 4)).toBe('N/A');
    expect(formatPrice(null, 4)).toBe('N/A');
    expect(formatPrice(undefined, 4)).toBe('N/A');
  });

  it('returns "N/A" for Infinity and NaN', () => {
    expect(formatPrice(Infinity, 4)).toBe('N/A');
    expect(formatPrice(-Infinity, 4)).toBe('N/A');
    expect(formatPrice(NaN, 4)).toBe('N/A');
  });

  it('throws if pipPosition is missing', () => {
    expect(() => formatPrice(1.0853)).toThrow('[formatPrice] pipPosition is required');
    expect(() => formatPrice(1.0853, null)).toThrow('[formatPrice] pipPosition is required');
    expect(() => formatPrice(1.0853, undefined)).toThrow('[formatPrice] pipPosition is required');
  });

  it('handles zero correctly', () => {
    expect(formatPrice(0, 4)).toBe('0.0000');
    expect(formatPrice(0, 0)).toBe('0');
  });

  it('handles negative prices', () => {
    expect(formatPrice(-1.08532, 4)).toBe('-1.0853');
    expect(formatPrice(-2340.67, 1)).toBe('-2340.7');
  });

  it('handles very large prices', () => {
    expect(formatPrice(67500.5, 1)).toBe('67500.5');
    expect(formatPrice(39850.25, 1)).toBe('39850.3');
  });

  it('handles pipPosition=0 (whole number formatting)', () => {
    expect(formatPrice(2340.67, 0)).toBe('2341');
    expect(formatPrice(2340.3, 0)).toBe('2340');
  });
});

// ── formatPriceWithPipPosition (legacy alias) ──

describe('formatPriceWithPipPosition (legacy alias)', () => {
  it('returns the same result as formatPrice', () => {
    expect(formatPriceWithPipPosition(1.08532, 4)).toBe(formatPrice(1.08532, 4));
    expect(formatPriceWithPipPosition(149.85, 2)).toBe(formatPrice(149.85, 2));
    expect(formatPriceWithPipPosition(2340.67, 1)).toBe(formatPrice(2340.67, 1));
  });

  it('passes through the error for missing pipPosition', () => {
    expect(() => formatPriceWithPipPosition(1.0853)).toThrow();
  });
});

// ── formatPriceToPipLevel ──

describe('formatPriceToPipLevel', () => {
  it('rounds to pip level for EURUSD (pipSize=0.0001)', () => {
    // 1.08532 rounded to nearest 0.0001 = 1.0853
    expect(formatPriceToPipLevel(1.08532, 4, 0.0001)).toBeCloseTo(1.0853, 5);
    // 1.08538 rounded to nearest 0.0001 = 1.0854
    expect(formatPriceToPipLevel(1.08538, 4, 0.0001)).toBeCloseTo(1.0854, 5);
  });

  it('rounds to pip level for USDJPY (pipSize=0.01)', () => {
    // 149.857 rounded to nearest 0.01 = 149.86
    expect(formatPriceToPipLevel(149.857, 2, 0.01)).toBeCloseTo(149.86, 5);
    // 149.853 rounded to nearest 0.01 = 149.85
    expect(formatPriceToPipLevel(149.853, 2, 0.01)).toBeCloseTo(149.85, 5);
  });

  it('rounds to pip level for XAUUSD (pipSize=0.1)', () => {
    // 2340.67 rounded to nearest 0.1 = 2340.7
    expect(formatPriceToPipLevel(2340.67, 1, 0.1)).toBeCloseTo(2340.7, 5);
    // 2340.64 rounded to nearest 0.1 = 2340.6
    expect(formatPriceToPipLevel(2340.64, 1, 0.1)).toBeCloseTo(2340.6, 5);
  });

  it('rounds to pip level for XAGUSD (pipSize=0.001)', () => {
    // 29.1575 rounded to nearest 0.001 = 29.158
    expect(formatPriceToPipLevel(29.1575, 3, 0.001)).toBeCloseTo(29.158, 5);
    // 29.1574 rounded to nearest 0.001 = 29.157
    expect(formatPriceToPipLevel(29.1574, 3, 0.001)).toBeCloseTo(29.157, 5);
  });

  it('returns exact price when already at pip boundary', () => {
    expect(formatPriceToPipLevel(1.0853, 4, 0.0001)).toBeCloseTo(1.0853, 5);
    expect(formatPriceToPipLevel(149.85, 2, 0.01)).toBeCloseTo(149.85, 5);
    expect(formatPriceToPipLevel(2340.7, 1, 0.1)).toBeCloseTo(2340.7, 5);
  });

  it('uses Math.round (rounds half-up behavior)', () => {
    // Exactly at the midpoint: 1.08535 / 0.0001 = 10853.5 → Math.round → 10854 → 1.0854
    expect(formatPriceToPipLevel(1.08535, 4, 0.0001)).toBeCloseTo(1.0854, 5);
    // Exactly at the midpoint going down: 1.08525 / 0.0001 = 10852.5 → Math.round → 10853 → 1.0853
    // Note: JS Math.round rounds 0.5 up, so this becomes 10853
    expect(formatPriceToPipLevel(1.08525, 4, 0.0001)).toBeCloseTo(1.0853, 5);
  });

  it('returns null for non-number input', () => {
    expect(formatPriceToPipLevel('1.0853', 4, 0.0001)).toBe(null);
    expect(formatPriceToPipLevel(null, 4, 0.0001)).toBe(null);
    expect(formatPriceToPipLevel(NaN, 4, 0.0001)).toBe(null);
    expect(formatPriceToPipLevel(Infinity, 4, 0.0001)).toBe(null);
  });

  it('throws if pipPosition is missing', () => {
    expect(() => formatPriceToPipLevel(1.0853, undefined, 0.0001)).toThrow(
      '[formatPriceToPipLevel] pipPosition and pipSize are required'
    );
  });

  it('throws if pipSize is missing (falsy)', () => {
    expect(() => formatPriceToPipLevel(1.0853, 4, undefined)).toThrow(
      '[formatPriceToPipLevel] pipPosition and pipSize are required'
    );
    expect(() => formatPriceToPipLevel(1.0853, 4, 0)).toThrow(
      '[formatPriceToPipLevel] pipPosition and pipSize are required'
    );
  });

  it('handles zero price', () => {
    expect(formatPriceToPipLevel(0, 4, 0.0001)).toBe(0);
  });

  it('handles negative prices', () => {
    expect(formatPriceToPipLevel(-1.08532, 4, 0.0001)).toBeCloseTo(-1.0853, 5);
  });
});

// ── formatPipMovement ──

describe('formatPipMovement', () => {
  it('formats positive pip movement for EURUSD (pipPosition=4)', () => {
    // 0.0005 price change = 5 pips at pipPosition 4
    expect(formatPipMovement(0.0005, 4)).toBe('+5.0 pips');
  });

  it('formats positive pip movement for USDJPY (pipPosition=2)', () => {
    // 0.50 price change = 50 pips at pipPosition 2
    expect(formatPipMovement(0.50, 2)).toBe('+50.0 pips');
  });

  it('formats negative pip movement for EURUSD', () => {
    expect(formatPipMovement(-0.0003, 4)).toBe('-3.0 pips');
  });

  it('formats negative pip movement for XAUUSD (pipPosition=1)', () => {
    // -2.0 price change = -20 pips at pipPosition 1
    expect(formatPipMovement(-2.0, 1)).toBe('-20.0 pips');
  });

  it('formats zero movement (no + prefix since 0 is not > 0)', () => {
    expect(formatPipMovement(0, 4)).toBe('0.0 pips');
  });

  it('formats sub-pip movement (fractional pips)', () => {
    // 0.00015 = 1.5 pips at pipPosition 4
    expect(formatPipMovement(0.00015, 4)).toBe('+1.5 pips');
  });

  it('formats large pip movement', () => {
    // 0.05 = 500 pips at pipPosition 4
    expect(formatPipMovement(0.05, 4)).toBe('+500.0 pips');
  });

  it('returns "0 pips" for non-number input', () => {
    expect(formatPipMovement('0.0005', 4)).toBe('0 pips');
    expect(formatPipMovement(null, 4)).toBe('0 pips');
    expect(formatPipMovement(NaN, 4)).toBe('0 pips');
    expect(formatPipMovement(Infinity, 4)).toBe('0 pips');
  });

  it('does not add + prefix for zero (ternary checks > 0, not >= 0)', () => {
    // 0 > 0 is false, so ternary yields '' prefix. Result is "0.0 pips".
    expect(formatPipMovement(0, 4)).toBe('0.0 pips');
  });

  it('does add + prefix for very small positive movement', () => {
    expect(formatPipMovement(0.00001, 4)).toBe('+0.1 pips');
  });
});

// ── formatPriceToPip ──

describe('formatPriceToPip', () => {
  it('floors EURUSD price to pip level (pipPosition=4, pipSize=0.0001)', () => {
    // 1.08532 floored to pip = 1.0853
    expect(formatPriceToPip(1.08532, 4)).toBe('1.0853');
    // 1.08538 floored to pip = 1.0853 (floor, not round)
    expect(formatPriceToPip(1.08538, 4)).toBe('1.0853');
  });

  it('floors USDJPY price to pip level (pipPosition=2)', () => {
    // 149.857 floored to pip = 149.85 (floor, not round)
    expect(formatPriceToPip(149.857, 2)).toBe('149.85');
  });

  it('floors XAUUSD price to pip level (pipPosition=1)', () => {
    // 2340.67 floored to pip = 2340.6 (floor, not round)
    expect(formatPriceToPip(2340.67, 1)).toBe('2340.6');
  });

  it('returns exact string when already at pip boundary', () => {
    expect(formatPriceToPip(1.0853, 4)).toBe('1.0853');
    expect(formatPriceToPip(149.85, 2)).toBe('149.85');
  });

  it('uses floor (truncates), not round', () => {
    // 1.08539 → floor at 0.0001 → 1.0853 (NOT 1.0854)
    expect(formatPriceToPip(1.08539, 4)).toBe('1.0853');
    // 149.899 → floor at 0.01 → 149.89 (NOT 149.90)
    expect(formatPriceToPip(149.899, 2)).toBe('149.89');
  });

  it('handles negative prices (floor goes more negative)', () => {
    // -1.08532 floored at 0.0001 → -1.0854 (Math.floor goes toward -inf)
    expect(formatPriceToPip(-1.08532, 4)).toBe('-1.0854');
  });

  it('handles zero', () => {
    expect(formatPriceToPip(0, 4)).toBe('0.0000');
  });

  it('returns "N/A" for non-number input', () => {
    expect(formatPriceToPip('1.0853', 4)).toBe('N/A');
    expect(formatPriceToPip(null, 4)).toBe('N/A');
    expect(formatPriceToPip(NaN, 4)).toBe('N/A');
    expect(formatPriceToPip(Infinity, 4)).toBe('N/A');
  });

  it('throws if pipPosition is missing', () => {
    expect(() => formatPriceToPip(1.0853)).toThrow('[formatPriceToPip] pipPosition is required');
    expect(() => formatPriceToPip(1.0853, null)).toThrow('[formatPriceToPip] pipPosition is required');
  });
});

// ── getPipetteDigit ──

describe('getPipetteDigit', () => {
  it('extracts pipette digit for EURUSD (pipPosition=4)', () => {
    // 1.08532: multiplier = 10^5 = 100000; 1.08532 * 100000 = 108532; 108532 % 10 = 2
    expect(getPipetteDigit(1.08532, 4)).toBe(2);
    // 1.08537: 108537 % 10 = 7
    expect(getPipetteDigit(1.08537, 4)).toBe(7);
    // 1.08530: 108530 % 10 = 0
    expect(getPipetteDigit(1.08530, 4)).toBe(0);
  });

  it('extracts pipette digit for USDJPY (pipPosition=2)', () => {
    // 149.853: multiplier = 10^3 = 1000; 149.853 * 1000 = 149853; % 10 = 3
    expect(getPipetteDigit(149.853, 2)).toBe(3);
    // 149.857: 149857 % 10 = 7
    expect(getPipetteDigit(149.857, 2)).toBe(7);
  });

  it('extracts pipette digit for XAUUSD (pipPosition=1)', () => {
    // 2340.67: multiplier = 10^2 = 100; 2340.67 * 100 = 234067; % 10 = 7
    expect(getPipetteDigit(2340.67, 1)).toBe(7);
  });

  it('returns digit 0-9 for all valid prices', () => {
    for (let i = 0; i <= 9; i++) {
      const price = 1.0853 + i * 0.00001; // 1.08530 to 1.08539
      expect(getPipetteDigit(price, 4)).toBe(i);
    }
  });

  it('returns "-" for non-number input', () => {
    expect(getPipetteDigit('1.0853', 4)).toBe('-');
    expect(getPipetteDigit(null, 4)).toBe('-');
    expect(getPipetteDigit(NaN, 4)).toBe('-');
  });

  it('returns "-" when pipPosition is null or undefined', () => {
    expect(getPipetteDigit(1.0853, null)).toBe('-');
    expect(getPipetteDigit(1.0853, undefined)).toBe('-');
  });
});

// ── emphasizeDigits ──

describe('emphasizeDigits', () => {
  it('splits EURUSD price into regular/emphasized/remaining segments', () => {
    // "1.08532" → digits only: 1,0,8,5,3,2
    // 4th digit is '5' at char index 4, 5th digit is '3' at char index 5
    // regular: "1.08" (chars 0-3), emphasized: "53" (chars 4-5), remaining: "2"
    const result = emphasizeDigits('1.08532', 4);
    expect(result).toEqual({ regular: '1.08', emphasized: '53', remaining: '2' });
  });

  it('handles price with more digits beyond pipette', () => {
    // "1.085325" → digits only: 1,0,8,5,3,2,5
    // 4th digit '5' at index 4, 5th digit '3' at index 5
    const result = emphasizeDigits('1.085325', 4);
    expect(result).toEqual({ regular: '1.08', emphasized: '53', remaining: '25' });
  });

  it('handles negative price', () => {
    // "-1.08532" → clean "1.08532" → same split, negate regular
    const result = emphasizeDigits('-1.08532', 4);
    expect(result).toEqual({ regular: '-1.08', emphasized: '53', remaining: '2' });
  });

  it('handles price with fewer than 5 digits — returns full string as regular', () => {
    const result = emphasizeDigits('1.08', 4);
    expect(result).toEqual({ regular: '1.08', emphasized: '', remaining: '' });
  });

  it('handles empty/null/undefined input', () => {
    expect(emphasizeDigits('')).toEqual({ regular: '', emphasized: '', remaining: '' });
    expect(emphasizeDigits(null)).toEqual({ regular: '', emphasized: '', remaining: '' });
    expect(emphasizeDigits(undefined)).toEqual({ regular: '', emphasized: '', remaining: '' });
  });

  it('handles whole number price (no decimal)', () => {
    // "12345" → all chars are digits: 1,2,3,4,5
    // 4th digit '4' at index 3, 5th digit '5' at index 4
    const result = emphasizeDigits('12345', 0);
    expect(result).toEqual({ regular: '123', emphasized: '45', remaining: '' });
  });

  it('handles large price like XAUUSD (pipPosition=1)', () => {
    // "2340.67" → digit chars: 2,3,4,0,6,7
    // 4th digit '0' at char index 3, 5th digit '6' at char index 5
    // decimal point at index 4 is skipped, not counted
    const result = emphasizeDigits('2340.67', 1);
    expect(result).toEqual({ regular: '234', emphasized: '0.6', remaining: '7' });
  });

  it('handles price with only 5 digits total', () => {
    // "1.085" → digits: 1,0,8,5 (only 4 digits, less than 5)
    const result = emphasizeDigits('1.085', 4);
    expect(result).toEqual({ regular: '1.085', emphasized: '', remaining: '' });
  });
});

// ── splitByPipPosition ──

describe('splitByPipPosition', () => {
  it('splits EURUSD formatted price at pip position', () => {
    // "1.0853" pipPosition=4, decimalIndex=1, splitIndex=1+4-1=4
    // largerDigits: "1.08" (index 0-3), pipDigits: "53" (index 4-5)
    const result = splitByPipPosition('1.0853', 4);
    expect(result).toEqual({ largerDigits: '1.08', pipDigits: '53' });
  });

  it('splits USDJPY formatted price at pip position', () => {
    // "149.85" pipPosition=2, decimalIndex=3, splitIndex=3+2-1=4
    // largerDigits: "149." (index 0-3), pipDigits: "85" (index 4-5)
    const result = splitByPipPosition('149.85', 2);
    expect(result).toEqual({ largerDigits: '149.', pipDigits: '85' });
  });

  it('splits XAUUSD formatted price at pip position', () => {
    // "2340.6" pipPosition=1, decimalIndex=4, splitIndex=4+1-1=4
    // largerDigits: "2340" (index 0-3), pipDigits: ".6" (index 4-5)
    const result = splitByPipPosition('2340.6', 1);
    expect(result).toEqual({ largerDigits: '2340', pipDigits: '.6' });
  });

  it('splits XAGUSD formatted price at pip position', () => {
    // "29.157" pipPosition=3, decimalIndex=2, splitIndex=2+3-1=4
    // largerDigits: "29.1" (index 0-3), pipDigits: "57" (index 4-5)
    const result = splitByPipPosition('29.157', 3);
    expect(result).toEqual({ largerDigits: '29.1', pipDigits: '57' });
  });

  it('handles negative price', () => {
    // "-1.0853" → clean "1.0853" → same split, negate largerDigits
    const result = splitByPipPosition('-1.0853', 4);
    expect(result).toEqual({ largerDigits: '-1.08', pipDigits: '53' });
  });

  it('handles whole number price (no decimal)', () => {
    // "1234" no decimal → length 4, take last 2 digits
    // largerDigits: "12", pipDigits: "34"
    const result = splitByPipPosition('1234', 2);
    expect(result).toEqual({ largerDigits: '12', pipDigits: '34' });
  });

  it('handles short whole number (less than 3 digits)', () => {
    const result = splitByPipPosition('12', 1);
    expect(result).toEqual({ largerDigits: '', pipDigits: '12' });
  });

  it('handles splitIndex <= 0', () => {
    // "1.2" pipPosition=1, decimalIndex=1, splitIndex=1+1-1=1
    // splitIndex=1 > 0, so it works
    // But if pipPosition=0: splitIndex=1+0-1=0 → returns {largerDigits:'', pipDigits: formattedPrice}
    const result = splitByPipPosition('1.2', 0);
    expect(result).toEqual({ largerDigits: '', pipDigits: '1.2' });
  });

  it('handles empty/null/undefined input', () => {
    expect(splitByPipPosition('')).toEqual({ largerDigits: '', pipDigits: '' });
    expect(splitByPipPosition(null)).toEqual({ largerDigits: '', pipDigits: '' });
    expect(splitByPipPosition(undefined)).toEqual({ largerDigits: '', pipDigits: '' });
  });

  it('handles pipPosition=0 with longer whole number', () => {
    // "1234" pipPosition=0, no decimal → length 4, take last 2
    const result = splitByPipPosition('1234', 0);
    expect(result).toEqual({ largerDigits: '12', pipDigits: '34' });
  });
});
