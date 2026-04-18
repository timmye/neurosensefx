import { createResizeState } from '../../chartResize.js';

export { createResizeState };

/**
 * Creates a mock chart object with call tracking.
 * All methods are jest.fn()-style spies (call tracking via .calls array).
 */
export function createMockChart(overrides = {}) {
  const methods = [
    'applyNewData',
    'clearData',
    'removeOverlay',
    'resize',
    'createOverlay',
    'getOverlayById',
    'getDataList',
    'setBarSpace',
    'setOffsetRightDistance',
    'scrollToRealTime',
    'setZoomEnabled',
    'setScrollEnabled',
    'setStyles',
    'setTimezone',
    'createIndicator',
    'removeIndicator',
    'setCustomApi',
    'setPaneOptions',
    'registerXAxis',
    'subscribeAction',
    'unsubscribeAction',
    'updateData',
    'getVisibleRange',
    'setPriceVolumePrecision',
    'dispose',
  ];

  const mock = {};

  for (const name of methods) {
    const fn = (...args) => {
      fn.calls.push(args);
    };
    fn.calls = [];
    mock[name] = fn;
  }

  // Override methods that return values, preserving call tracking.
  // Use closures so the returned reference stays mutable.
  let _dataListReturns = [];
  const _dataListCalls = [];
  mock.getDataList = (...args) => {
    _dataListCalls.push(args);
    return _dataListReturns;
  };
  mock.getDataList.calls = _dataListCalls;
  // Expose a mutable returns bag via property descriptor
  Object.defineProperty(mock.getDataList, 'returns', {
    get() { return _dataListReturns; },
    set(v) { _dataListReturns = v; },
  });

  let _visibleRangeReturns = { from: 0, to: 100 };
  const _visibleRangeCalls = [];
  mock.getVisibleRange = (...args) => {
    _visibleRangeCalls.push(args);
    return _visibleRangeReturns;
  };
  mock.getVisibleRange.calls = _visibleRangeCalls;
  Object.defineProperty(mock.getVisibleRange, 'returns', {
    get() { return _visibleRangeReturns; },
    set(v) { _visibleRangeReturns = v; },
  });

  return { ...mock, ...overrides };
}

/**
 * Creates a mock applyBarSpace function with call tracking.
 */
export function createMockBarSpace(overrides = {}) {
  const applyBarSpace = (...args) => {
    applyBarSpace.calls.push(args);
  };
  applyBarSpace.calls = [];
  if (overrides) {
    Object.assign(applyBarSpace, overrides);
  }
  return applyBarSpace;
}

/**
 * Creates a pending data ref matching the pattern in ChartDisplay.svelte:
 *   { get value() { ... }, set value(v) { ... } }
 */
export function createPendingDataRef(initialValue = null) {
  let _value = initialValue;
  return {
    get value() { return _value; },
    set value(v) { _value = v; },
  };
}
