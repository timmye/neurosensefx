/**
 * Mock for klinecharts module.
 * Only provides registerXAxis as a no-op so that xAxisCustom.js
 * can be imported without a real KLineChart runtime.
 */
export function registerXAxis(_config) {
  // no-op
}
