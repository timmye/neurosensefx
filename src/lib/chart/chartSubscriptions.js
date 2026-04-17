/**
 * Lifecycle-managed KLineChart action subscriptions.
 * Factory pattern: each chart gets its own subscription state
 * so multiple charts don't clobber each other.
 */

/**
 * Create a subscription manager for a single chart instance.
 * @param {() => object|null} getChart - getter returning the KLineChart instance
 * @returns {{ subscribeZoom, unsubscribeZoom, subscribeVisibleRangeChange, unsubscribeVisibleRangeChange, subscribeOnDataReady, unsubscribeOnDataReady, unsubscribeAll }}
 */
export function createChartSubscriptions(getChart) {
  const handlers = {
    onZoom: null,
    onVisibleRangeChange: null,
    onDataReady: null,
  };

  function subscribeZoom(handler) {
    unsubscribeZoom();
    handlers.onZoom = handler;
    getChart()?.subscribeAction('onZoom', handler);
  }

  function unsubscribeZoom() {
    if (handlers.onZoom && getChart()) {
      getChart().unsubscribeAction('onZoom', handlers.onZoom);
      handlers.onZoom = null;
    }
  }

  function subscribeVisibleRangeChange(handler) {
    unsubscribeVisibleRangeChange();
    handlers.onVisibleRangeChange = handler;
    getChart()?.subscribeAction('onVisibleRangeChange', handler);
  }

  function unsubscribeVisibleRangeChange() {
    if (handlers.onVisibleRangeChange && getChart()) {
      getChart().unsubscribeAction('onVisibleRangeChange', handlers.onVisibleRangeChange);
      handlers.onVisibleRangeChange = null;
    }
  }

  function subscribeOnDataReady(handler) {
    unsubscribeOnDataReady();
    handlers.onDataReady = handler;
    getChart()?.subscribeAction('onDataReady', handler);
  }

  function unsubscribeOnDataReady() {
    if (handlers.onDataReady && getChart()) {
      getChart().unsubscribeAction('onDataReady', handlers.onDataReady);
      handlers.onDataReady = null;
    }
  }

  function unsubscribeAll() {
    unsubscribeZoom();
    unsubscribeVisibleRangeChange();
    unsubscribeOnDataReady();
  }

  return {
    subscribeZoom, unsubscribeZoom,
    subscribeVisibleRangeChange, unsubscribeVisibleRangeChange,
    subscribeOnDataReady, unsubscribeOnDataReady,
    unsubscribeAll,
  };
}
