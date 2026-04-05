import { formatPrice } from '../priceFormat.js';

export function pixelToDataPoint(chart, px, py) {
  const result = chart.convertFromPixel(
    [{ x: px, y: py }],
    { paneId: 'candle_pane' }
  );
  const point = result[0];
  if (point == null || point.dataIndex == null) return null;
  return point;
}

export function calcBarCount(startIndex, endIndex) {
  return Math.abs(endIndex - startIndex);
}

export function calcDeltaTime(startTimestamp, endTimestamp) {
  if (startTimestamp === undefined || endTimestamp === undefined) return 'N/A';
  const diffMs = Math.abs(endTimestamp - startTimestamp);
  if (diffMs === 0) return '0m';

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

export function calcDeltaPrice(startPrice, endPrice, openPrice) {
  const delta = endPrice - startPrice;
  const base = openPrice !== undefined ? openPrice : startPrice;
  const percent = base !== 0 ? (delta / base) * 100 : 0;
  const range = [Math.min(startPrice, endPrice), Math.max(startPrice, endPrice)];
  return { delta, percent, range };
}

export function formatRulerData(chart, marketData, origin, cursor) {
  if (origin.x === cursor.x && origin.y === cursor.y) return null;

  const { pipPosition, open } = marketData;

  const startPt = pixelToDataPoint(chart, origin.x, origin.y);
  const endPt = pixelToDataPoint(chart, cursor.x, cursor.y);

  const bars =
    startPt && endPt
      ? calcBarCount(startPt.dataIndex, endPt.dataIndex)
      : 'N/A';

  const time =
    startPt && endPt
      ? calcDeltaTime(startPt.timestamp, endPt.timestamp)
      : 'N/A';

  if (pipPosition == null) {
    return {
      bars: startPt && endPt ? calcBarCount(startPt.dataIndex, endPt.dataIndex) : 'N/A',
      time: startPt && endPt ? calcDeltaTime(startPt.timestamp, endPt.timestamp) : 'N/A',
      price: 'N/A',
      percent: 'N/A',
      range: 'N/A'
    };
  }

  if (!startPt || !endPt) {
    return {
      bars,
      time,
      price: 'N/A',
      percent: 'N/A',
      range: 'N/A'
    };
  }

  const { delta, percent, range } = calcDeltaPrice(
    startPt.value,
    endPt.value,
    open
  );

  return {
    bars,
    time,
    price: formatPrice(delta, pipPosition),
    percent: percent.toFixed(2) + '%',
    range: formatPrice(range[0], pipPosition) + ' - ' + formatPrice(range[1], pipPosition)
  };
}
