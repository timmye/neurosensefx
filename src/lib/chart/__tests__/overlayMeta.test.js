import { describe, it, expect } from 'vitest';
import { createOverlayMeta } from '../overlayMeta.js';

describe('createOverlayMeta', () => {
  it('setDbId + getDbId round-trip', () => {
    const meta = createOverlayMeta();
    meta.setDbId('overlay-1', 'db-42');
    expect(meta.getDbId('overlay-1')).toBe('db-42');
  });

  it('getDbId returns null for unknown overlay', () => {
    const meta = createOverlayMeta();
    expect(meta.getDbId('nonexistent')).toBeNull();
  });

  it('setPinned + getPinned + isPinned round-trip', () => {
    const meta = createOverlayMeta();
    meta.setPinned('overlay-2', true);
    expect(meta.getPinned('overlay-2')).toBe(true);
  });

  it('getPinned returns false by default', () => {
    const meta = createOverlayMeta();
    expect(meta.getPinned('overlay-3')).toBe(false);
  });

  it('delete() clears both dbId and pinned for an overlay', () => {
    const meta = createOverlayMeta();
    meta.setDbId('overlay-4', 'db-99');
    meta.setPinned('overlay-4', true);

    expect(meta.getDbId('overlay-4')).toBe('db-99');
    expect(meta.getPinned('overlay-4')).toBe(true);

    meta.delete('overlay-4');

    expect(meta.getDbId('overlay-4')).toBeNull();
    expect(meta.getPinned('overlay-4')).toBe(false);
  });

  it('clear() removes all entries', () => {
    const meta = createOverlayMeta();
    meta.setDbId('a', '1');
    meta.setDbId('b', '2');
    meta.setPinned('a', true);

    meta.clear();

    expect(meta.getDbId('a')).toBeNull();
    expect(meta.getDbId('b')).toBeNull();
    expect(meta.getPinned('a')).toBe(false);
  });
});
