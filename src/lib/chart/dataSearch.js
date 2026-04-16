/**
 * Binary search utilities for timestamp-based data lookup.
 *
 * Used by xAxisTickGenerator.js to snap timestamps to the nearest
 * bar in a dataList.
 *
 * @module dataSearch
 */

function _binarySearch(dataList, timestamp) {
  let lo = 0;
  let hi = dataList.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const ts = dataList[mid].timestamp;
    if (ts < timestamp) lo = mid + 1;
    else if (ts > timestamp) hi = mid - 1;
    else return { found: mid, lo, hi };
  }
  return { found: -1, lo, hi };
}

export function dataIndexOf(dataList, timestamp) {
  return _binarySearch(dataList, timestamp).found;
}

export function snapToBar(targetTs, dataList) {
  if (!dataList || dataList.length === 0) return null;
  const { found, lo, hi } = _binarySearch(dataList, targetTs);
  if (found !== -1) return targetTs;

  if (lo >= dataList.length) return hi >= 0 ? dataList[hi].timestamp : null;
  if (hi < 0) return dataList[0].timestamp;
  const diffLo = dataList[lo].timestamp - targetTs;
  const diffHi = targetTs - dataList[hi].timestamp;
  return diffLo <= diffHi ? dataList[lo].timestamp : dataList[hi].timestamp;
}
