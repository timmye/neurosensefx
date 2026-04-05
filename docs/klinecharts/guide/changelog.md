# Change Log

## 10.0.0-beta1
`2025-11-21`
+ New Features
  + Support thousands separators and custom decimal collapse.
  + Support displaying future time on the x-axis.
  + Support dragging the y-axis on mobile devices.
  + Support creating multiple metrics with the same name on the same window.
  + **Rewrote the axis module; custom y-axis supports setting the range.**
  + Add `zoomAnchor` to the `options` method of the chart method `init(dom, options)`.
  + New instance methods `setZoomAnchor(anchor)`, `getZoomAnchor()`, `setDataLoader(loader)`, `setSymbol(symbol)`, `getSymbol()`, `setPeriod(period)`, `getPeriod()`, `resetData()`, `setThousandsSeparator(thousandsSeparator)`, `getThousandsSeparator()`, `setDecimalFold(decimalFold)`, `getDecimalFold()`, `getIndicators()` and `getOverlays()`.
  + Add style configurations: `candle.priceMark.last.extendTexts`, `candle.tooltip.title`, `candle.tooltip.legend`, `indicator.tooltip.title`, `indicator.tooltip.legend`, `crosshair.horizontal.features`, `candle.bar.compareRule`, `indicator.ohlc.compareRule`, and `candle.priceMark.last.compareRule`.
  + Add `onIndicatorTooltipFeatureClick` and `onCrosshairFeatureClick` to the `type` parameter in the instance methods `subscribeAction` and `unsubscribeAction`.
+ Changes
  + In the chart method `init(dcs, options)`, the `position` sub-item of `options.layout` has been changed to `order`, `options.thousandsSeparator` has been changed to the object `{ sign, format }`, `options.decimalFoldThreshold` has been changed to `options.decimalFold`, **`options.customApi` has been changed to `options.formatter`**, and the parameter of `formatDate` has been changed to an object.
  + In the instance methods **`setCustomApi` and `getCustomApi` have been changed to `getFormatter`**, the return value of `getBarSpace()` has been changed to an object, the return value of `createIndicator` has been changed to return the indicator ID, and the input parameter `paneId` of `overlayIndicator` has been merged into the input parameter `indicator`.
  + The return value of the custom metric `createTooltipDataSource` method has been changed from `values` to `legends`, and `icons` to `features`.
  + The style configurations `candle.tooltip.icons` and `indicator.tooltip.icons` have been changed to `indicator.tooltip.features`.
+ Optimizations
  + Optimized the `figure` element in the overlay template to ignore event types.
  + Optimized the execution of metric calculation tasks.
  + Optimized the triggering of scroll events on mobile devices.
+ Deprecated
  + Removed: `utils.drawArc`, `utils.drawCircle`, `utils.drawLine`, `utils.drawPolygon`, `utils.drawRect`, `utils.drawText`, `utils.drawRectText` — use `getFigureClass(name)` instead.
  + Removed: `setPriceVolumePrecision(pricePrecision, volumePrecision)` — use `setPrecision(precision)` instead.
  + Removed: `setLoadMoreData`, `applyNewData`, and `updateData` — use `setDataLoader`. Remove `clearData`, `setPrecision`, and `getPrecision`.
  + Removed: `getIndicatorByPaneId(paneId, name)` — use `getIndicators(filter)`.
  + Removed: `getOverlayById(id)` — use `getOverlays(filter)`.
  + Removed: `onTooltipIconClick` in subscribe/unsubscribe — use `onCandleTooltipFeatureClick` and `onIndicatorTooltipFeatureClick`.
  + Removed style configs: `yAxis.position`, `yAxis.type`, `yAxis.inside` — use axis properties in window config.
  + Removed style configs: `candle.tooltip.defaultValue`, `candle.tooltip.custom` — use `candle.tooltip.legend`. Removed `candle.tooltip.text`, `indicator.tooltip.showName`, `indicator.tooltip.showParams` — use `indicator.tooltip.title`. Removed `overlay.rectText`.

## 9.x
See https://v9.klinecharts.com for 9.x changelog.

## Notes for NeuroSense FX

- Current project uses klinecharts `^9.8.12` (v9 line)
- v10 beta is available with **axis module rewrite** — this is significant for the x-axis bug
- v10 renames `setCustomApi` to `setFormatter`, changes `formatDate` param to object
- Migration will be needed when upgrading to v10
