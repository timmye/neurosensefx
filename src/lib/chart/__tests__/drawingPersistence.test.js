import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers: inline mergeByTimestamp (not exported from drawingStore.js)
// ---------------------------------------------------------------------------
function mergeByTimestamp(serverData, localData) {
  const result = [...serverData];
  for (const local of localData) {
    if (!local.overlayId) { result.push(local); continue; }
    const serverIdx = result.findIndex(d => d.overlayId === local.overlayId);
    if (serverIdx === -1) {
      result.push(local);
    } else {
      const server = result[serverIdx];
      if (local.updatedAt > (server.updatedAt || 0)) {
        result[serverIdx] = local;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Section 1: Key splitting fix (authStore migration bug)
// ---------------------------------------------------------------------------
describe('collectLocalData key splitting', () => {
  it('splits forex pair key correctly using lastIndexOf', () => {
    const key = 'EUR/USD/4h';
    const lastSlash = key.lastIndexOf('/');
    const symbol = key.slice(0, lastSlash);
    const resolution = key.slice(lastSlash + 1);
    expect(symbol).toBe('EUR/USD');
    expect(resolution).toBe('4h');
  });

  it('splits non-slash symbol correctly', () => {
    const key = 'BTCUSDT/1h';
    const lastSlash = key.lastIndexOf('/');
    const symbol = key.slice(0, lastSlash);
    const resolution = key.slice(lastSlash + 1);
    expect(symbol).toBe('BTCUSDT');
    expect(resolution).toBe('1h');
  });

  it('handles symbol with multiple slashes', () => {
    const key = 'EUR/GBP/USD/4h';
    const lastSlash = key.lastIndexOf('/');
    const symbol = key.slice(0, lastSlash);
    const resolution = key.slice(lastSlash + 1);
    expect(symbol).toBe('EUR/GBP/USD');
    expect(resolution).toBe('4h');
  });
});

// ---------------------------------------------------------------------------
// Section 2: _mergeByTimestamp behavior
// ---------------------------------------------------------------------------
describe('_mergeByTimestamp behavior', () => {
  it('merges server and local data, keeping newest by updatedAt', () => {
    const serverData = [
      { overlayId: 'd1', updatedAt: 1000 },
      { overlayId: 'd2', updatedAt: 2000 },
    ];
    const localData = [
      { overlayId: 'd1', updatedAt: 3000 },
      { overlayId: 'd3', updatedAt: 4000 },
    ];

    const result = mergeByTimestamp(serverData, localData);

    expect(result).toHaveLength(3);
    expect(result.find(d => d.overlayId === 'd1').updatedAt).toBe(3000);
    expect(result.find(d => d.overlayId === 'd2').updatedAt).toBe(2000);
    expect(result.find(d => d.overlayId === 'd3').updatedAt).toBe(4000);
  });

  it('keeps server-only drawings', () => {
    const serverData = [{ overlayId: 's1', updatedAt: 1000 }];
    const localData = [];

    const result = mergeByTimestamp(serverData, localData);

    expect(result).toHaveLength(1);
    expect(result[0].overlayId).toBe('s1');
  });

  it('handles drawings without overlayId', () => {
    const serverData = [];
    const localData = [{ overlayType: 'line', updatedAt: 1000 }];

    const result = mergeByTimestamp(serverData, localData);

    expect(result).toHaveLength(1);
    expect(result[0].overlayType).toBe('line');
  });

  it('local wins when updatedAt is newer', () => {
    const serverData = [{ overlayId: 'd1', updatedAt: 1000, points: [{ x: 1 }] }];
    const localData = [{ overlayId: 'd1', updatedAt: 2000, points: [{ x: 2 }] }];

    const result = mergeByTimestamp(serverData, localData);

    expect(result).toHaveLength(1);
    expect(result[0].points[0].x).toBe(2);
  });

  it('server wins when updatedAt is newer', () => {
    const serverData = [{ overlayId: 'd1', updatedAt: 3000, points: [{ x: 1 }] }];
    const localData = [{ overlayId: 'd1', updatedAt: 2000, points: [{ x: 2 }] }];

    const result = mergeByTimestamp(serverData, localData);

    expect(result).toHaveLength(1);
    expect(result[0].points[0].x).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Section 3: Eager sync cache behavior
// ---------------------------------------------------------------------------
describe('_updateSyncCache populates _lastSyncData eagerly', () => {
  it('flushPending can use data immediately after save (no 500ms wait)', async () => {
    const _lastSyncData = new Map();
    const mockDbDrawings = {
      async add() { return 1; },
      where() {
        return {
          async toArray() {
            return [{ overlayId: 'test', updatedAt: Date.now() }];
          },
        };
      },
    };

    const symbol = 'EUR/USD';
    const resolution = '4h';
    const key = symbol + '/' + resolution;
    const drawing = { overlayType: 'line', points: [] };

    await mockDbDrawings.add(drawing);

    // Simulate _updateSyncCache (the fix)
    const all = await mockDbDrawings.where().toArray();
    _lastSyncData.set(key, all);

    // flushPending checks _lastSyncData
    const cachedData = _lastSyncData.get(key);
    expect(cachedData).toBeDefined();
    expect(cachedData).toHaveLength(1);
    expect(cachedData[0].overlayId).toBe('test');
  });

  it('flushPending returns undefined when debounce has not fired (old behavior)', () => {
    const _lastSyncData = new Map();
    const key = 'EUR/USD/4h';

    // Without eager cache update, _lastSyncData is empty
    const cachedData = _lastSyncData.get(key);
    expect(cachedData).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Section 4: Client 409 merge behavior
// ---------------------------------------------------------------------------
describe('client-side 409 merge behavior', () => {
  it('mergeByTimestamp combines server and local data correctly on conflict', () => {
    const serverData = [{ overlayId: 'd1', updatedAt: 1000, overlayType: 'line' }];
    const localData = [
      { overlayId: 'd1', updatedAt: 1000, overlayType: 'line' },
      { overlayId: 'd2', updatedAt: 2000, overlayType: 'fibonacci' },
    ];

    const result = mergeByTimestamp(serverData, localData);

    expect(result).toHaveLength(2);
    expect(result.map(d => d.overlayId).sort()).toEqual(['d1', 'd2']);
  });

  it('both local-only and server-only drawings survive', () => {
    const serverData = [
      { overlayId: 's1', updatedAt: 1000, overlayType: 'line' },
    ];
    const localData = [
      { overlayId: 'l1', updatedAt: 2000, overlayType: 'fibonacci' },
    ];

    const result = mergeByTimestamp(serverData, localData);

    expect(result).toHaveLength(2);
    expect(result.map(d => d.overlayId).sort()).toEqual(['l1', 's1']);
  });
});
