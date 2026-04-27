import { describe, it, expect } from 'vitest';
import { createOverlayMeta } from '../overlayMeta.js';

describe('createOverlayMeta', () => {
  it('setPinned + getPinned round-trip', () => {
    const meta = createOverlayMeta();
    meta.setPinned('overlay-2', true);
    expect(meta.getPinned('overlay-2')).toBe(true);
  });

  it('getPinned returns false by default', () => {
    const meta = createOverlayMeta();
    expect(meta.getPinned('overlay-3')).toBe(false);
  });

  it('delete() clears pinned for an overlay', () => {
    const meta = createOverlayMeta();
    meta.setPinned('overlay-4', true);

    expect(meta.getPinned('overlay-4')).toBe(true);

    meta.delete('overlay-4');

    expect(meta.getPinned('overlay-4')).toBe(false);
  });

  it('clear() removes all entries', () => {
    const meta = createOverlayMeta();
    meta.setPinned('a', true);
    meta.setPinned('b', true);

    meta.clear();

    expect(meta.getPinned('a')).toBe(false);
    expect(meta.getPinned('b')).toBe(false);
  });

  it('entries() returns all tracked overlays', () => {
    const meta = createOverlayMeta();
    meta.setPinned('a', true);
    meta.setPinned('b', false);

    const entries = [...meta.entries()];
    expect(entries).toHaveLength(2);
    expect(entries.map(e => e[0]).sort()).toEqual(['a', 'b']);
  });

  it('get() returns entry or undefined', () => {
    const meta = createOverlayMeta();
    meta.setPinned('x', true);

    expect(meta.get('x')).toEqual({ pinned: true });
    expect(meta.get('unknown')).toBeUndefined();
  });
});
