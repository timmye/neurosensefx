import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('createResetFields', () => {
  async function getCreateResetFields() {
    const mod = await import('../dailyResetHandler.js');
    return mod.createResetFields;
  }

  it('returns all session fields as null', async () => {
    const createResetFields = await getCreateResetFields();
    const result = createResetFields({ current: 1.1234 });
    expect(result.marketProfile).toBeNull();
    expect(result.high).toBeNull();
    expect(result.low).toBeNull();
    expect(result.open).toBeNull();
    expect(result.adrHigh).toBeNull();
    expect(result.adrLow).toBeNull();
    expect(result.prevDayOHLC).toBeNull();
    expect(result.receivedAt).toBeNull();
    expect(result.sentAt).toBeNull();
    expect(result.clientReceivedAt).toBeNull();
  });

  it('sets previousPrice to current.current when current has a price', async () => {
    const createResetFields = await getCreateResetFields();
    const result = createResetFields({ current: 1.1234 });
    expect(result.previousPrice).toBe(1.1234);
  });

  it('sets previousPrice to null when current.current is null', async () => {
    const createResetFields = await getCreateResetFields();
    const result = createResetFields({ current: null });
    expect(result.previousPrice).toBeNull();
  });

  it('sets direction to neutral', async () => {
    const createResetFields = await getCreateResetFields();
    const result = createResetFields({ current: 1.0 });
    expect(result.direction).toBe('neutral');
  });

  it('resets latency to all-null object', async () => {
    const createResetFields = await getCreateResetFields();
    const result = createResetFields({ current: 1.0 });
    expect(result.latency).toEqual({ backend: null, network: null, e2e: null });
  });

  it('sets lastUpdate to a recent timestamp', async () => {
    const createResetFields = await getCreateResetFields();
    const before = Date.now();
    const result = createResetFields({ current: 1.0 });
    expect(result.lastUpdate).toBeGreaterThanOrEqual(before);
    expect(result.lastUpdate).toBeLessThanOrEqual(Date.now());
  });

  it('does NOT include fields that persist like symbol, source, pipPosition', async () => {
    const createResetFields = await getCreateResetFields();
    const result = createResetFields({ current: 1.0 });
    expect('symbol' in result).toBe(false);
    expect('source' in result).toBe(false);
    expect('pipPosition' in result).toBe(false);
  });
});

describe('setupDailyResetHandler', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function fresh() {
    const mod = await import('../dailyResetHandler.js');
    return { createResetFields: mod.createResetFields, setupDailyResetHandler: mod.setupDailyResetHandler };
  }

  it('calls connectionManager.addSystemSubscription with a callback', async () => {
    const { setupDailyResetHandler } = await fresh();
    const connectionManager = { addSystemSubscription: vi.fn() };
    setupDailyResetHandler(connectionManager, vi.fn());
    expect(connectionManager.addSystemSubscription).toHaveBeenCalledOnce();
    expect(connectionManager.addSystemSubscription).toHaveBeenCalledWith(expect.any(Function));
  });

  it('calls resetCallback for each symbol on dailyReset message', async () => {
    const { setupDailyResetHandler } = await fresh();
    const connectionManager = { addSystemSubscription: vi.fn() };
    const resetCallback = vi.fn();
    setupDailyResetHandler(connectionManager, resetCallback);
    const handler = connectionManager.addSystemSubscription.mock.calls[0][0];

    handler({ type: 'dailyReset', symbols: ['EURUSD', 'GBPUSD'] });
    expect(resetCallback).toHaveBeenCalledTimes(2);
    expect(resetCallback).toHaveBeenCalledWith('EURUSD');
    expect(resetCallback).toHaveBeenCalledWith('GBPUSD');
  });

  it('ignores messages that are not type dailyReset', async () => {
    const { setupDailyResetHandler } = await fresh();
    const connectionManager = { addSystemSubscription: vi.fn() };
    const resetCallback = vi.fn();
    setupDailyResetHandler(connectionManager, resetCallback);
    const handler = connectionManager.addSystemSubscription.mock.calls[0][0];

    handler({ type: 'other', symbols: ['EURUSD'] });
    expect(resetCallback).not.toHaveBeenCalled();
  });

  it('ignores dailyReset with no symbols array', async () => {
    const { setupDailyResetHandler } = await fresh();
    const connectionManager = { addSystemSubscription: vi.fn() };
    const resetCallback = vi.fn();
    setupDailyResetHandler(connectionManager, resetCallback);
    const handler = connectionManager.addSystemSubscription.mock.calls[0][0];

    handler({ type: 'dailyReset' });
    expect(resetCallback).not.toHaveBeenCalled();
  });

  it('resetCallback receives the symbol string', async () => {
    const { setupDailyResetHandler } = await fresh();
    const connectionManager = { addSystemSubscription: vi.fn() };
    const resetCallback = vi.fn();
    setupDailyResetHandler(connectionManager, resetCallback);
    const handler = connectionManager.addSystemSubscription.mock.calls[0][0];

    handler({ type: 'dailyReset', symbols: ['BTCUSD'] });
    expect(resetCallback).toHaveBeenCalledWith('BTCUSD');
  });

  it('only subscribes once — double-call is a no-op', async () => {
    const { setupDailyResetHandler } = await fresh();
    const connectionManager = { addSystemSubscription: vi.fn() };
    setupDailyResetHandler(connectionManager, vi.fn());
    setupDailyResetHandler(connectionManager, vi.fn());
    expect(connectionManager.addSystemSubscription).toHaveBeenCalledOnce();
  });
});
