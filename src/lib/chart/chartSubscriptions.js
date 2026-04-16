/**
 * Lifecycle-managed KLineChart action subscriptions.
 * Stores handler refs so they can be unsubscribed on teardown.
 */

let _chart = null;
const handlers = {
  onZoom: null,
  onVisibleRangeChange: null,
  onDataReady: null,
};

export function setChart(chart) {
  _chart = chart;
}

export function subscribeZoom(handler) {
  unsubscribeZoom();
  handlers.onZoom = handler;
  _chart?.subscribeAction('onZoom', handler);
}

export function unsubscribeZoom() {
  if (handlers.onZoom && _chart) {
    _chart.unsubscribeAction('onZoom', handlers.onZoom);
    handlers.onZoom = null;
  }
}

export function subscribeVisibleRangeChange(handler) {
  unsubscribeVisibleRangeChange();
  handlers.onVisibleRangeChange = handler;
  _chart?.subscribeAction('onVisibleRangeChange', handler);
}

export function unsubscribeVisibleRangeChange() {
  if (handlers.onVisibleRangeChange && _chart) {
    _chart.unsubscribeAction('onVisibleRangeChange', handlers.onVisibleRangeChange);
    handlers.onVisibleRangeChange = null;
  }
}

export function subscribeOnDataReady(handler) {
  unsubscribeOnDataReady();
  handlers.onDataReady = handler;
  _chart?.subscribeAction('onDataReady', handler);
}

export function unsubscribeOnDataReady() {
  if (handlers.onDataReady && _chart) {
    _chart.unsubscribeAction('onDataReady', handlers.onDataReady);
    handlers.onDataReady = null;
  }
}

export function unsubscribeAll() {
  unsubscribeZoom();
  unsubscribeVisibleRangeChange();
  unsubscribeOnDataReady();
}
