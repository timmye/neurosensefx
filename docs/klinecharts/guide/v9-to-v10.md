# v9 to v10 Migration Guide

## Style configuration adjustment
+ Remove `yAxis.position`, `yAxis.type`, `yAxis.inside`. Use `axis` in window configuration instead. See `init(dcs, options)`, `createIndicator(value, isStack, paneOptions)`, and `setPaneOptions(options)`.
+ Remove `overlay.rectText`, `candle.tooltip.text`, `indicator.tooltip.text`.
+ Remove `candle.tooltip.defaultValue`, `candle.tooltip.custom`, use `candle.tooltip.legend` instead.
+ Remove `indicator.tooltip.showName`, `indicator.tooltip.showParams`, use `indicator.tooltip.title` instead.
+ Remove `indicator.tooltip.defaultValue`, use `indicator.tooltip.legend` instead.
+ `candle.tooltip.icons` changed to `candle.tooltip.features`, `indicator.tooltip.icons` changed to `indicator.tooltip.features`.

## API adjustment (Chart API)
+ Remove `utils.drawArc`, `utils.drawCircle`, `utils.drawLine`, `utils.drawPolygon`, `utils.drawRect`, `utils.drawText`, `utils.drawRectText` — use `getFigureClass(name)` instead.
+ `init(dcs, options)`: `position` in `options.layout` changed to `order`, **`options.customApi` changed to `options.formatter`** (with `formatDate` now taking a single object param), `options.thousandsSeparator` changed to `{ sign, format }`, `options.decimalFoldThreshold` changed to `options.decimalFold`.

## API adjustment (Instance API)
+ **Remove `setCustomApi(api)` — use `setFormatter(formatter)`**.
+ **Remove `getCustomApi(api)` — use `getFormatter(formatter)`**.
+ Remove `setPriceVolumePrecision(pricePrecision, volumePrecision)` — use `setSymbol(symbolInfo)`.
+ Remove `applyNewData`, `applyMoreData`, `updateData`, `setLoadDataCallback`, `loadMore` — use `setDataLoader(loader)`.
+ Remove `clearData()`.
+ Remove `getIndicatorByPaneId(paneId, name)` — use `getIndicators(filter)`.
+ Remove `getOverlayById(id)` — use `getOverlays(filter)`.
+ Remove `onTooltipIconClick` in subscribe/unsubscribe — use `onCandleTooltipFeatureClick` and `onIndicatorTooltipFeatureClick`.
+ `getBarSpace()` return value changed to object.
+ `createIndicator` return value changed to return indicator id.

## Extension adjustment
+ Indicator `createTooltipDataSource`: `values` changed to `legends`, `icons` changed to `features`.
+ Indicator `calc` return value changed from array to object keyed by timestamp.
+ Remove built-in basic graphic `rectText` — use `text` instead.
