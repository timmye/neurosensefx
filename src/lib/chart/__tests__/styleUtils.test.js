import { describe, it, expect } from 'vitest';
import { fadeColor } from '../styleUtils.js';

describe('fadeColor', () => {
  it('fades an rgb() color by replacing with rgba at the given factor', () => {
    const result = fadeColor('rgb(255, 0, 0)', 0.5);
    expect(result).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('multiplies existing alpha for rgba() colors instead of replacing', () => {
    const result = fadeColor('rgba(255, 0, 0, 0.8)', 0.5);
    expect(result).toBe('rgba(255, 0, 0, 0.4)');
  });

  it('multiplies existing alpha for another rgba() color', () => {
    const result = fadeColor('rgba(0, 0, 255, 0.6)', 0.5);
    expect(result).toBe('rgba(0, 0, 255, 0.3)');
  });

  it('handles 6-digit hex colors', () => {
    const result = fadeColor('#ff0000', 0.5);
    expect(result).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('handles 8-digit hex colors with alpha', () => {
    const result = fadeColor('#ff000080', 0.5);
    // 8-digit hex is not matched by the 6-digit regex, and the rgba regex
    // also does not match hex-with-alpha, so the original is returned.
    expect(result).toBe('#ff000080');
  });

  it('handles uppercase 6-digit hex colors', () => {
    const result = fadeColor('#AABBCC', 0.5);
    expect(result).toBe('rgba(170, 187, 204, 0.5)');
  });
});
