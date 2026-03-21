# Price Ticker - Quick Reference

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+I` | Create new Price Ticker |
| `Alt+A` | Create cTrader Display |
| `Alt+T` | Create TradingView Display |
| `Alt+B` | Create FX Basket |
| `Alt+W` | Workspace Menu |
| `Alt+R` | Reinit All |
| `ESC` | Close overlays / Clear focus |

## File Locations

```
src/components/PriceTicker.svelte              # Main component (~250 LOC)
src/lib/marketProfile/orchestrator.js          # Mini renderer (+40 LOC)
src/lib/keyboardHandler.js                     # Alt+I handler (+8 LOC)
src/stores/workspace.js                        # addPriceTicker action (+12 LOC)
src/components/Workspace.svelte                # Ticker rendering (+4 LOC)
```

## Data Integration Points

| Data | Source | Function |
|------|--------|----------|
| Current Price | `displayDataProcessor.js` | `processSymbolData()` |
| Day Range % | `dayRangeCalculations.js` | `calculateDayRangePercentage()` |
| Market Profile | `marketProfileStateless.js` | Reuse from `useSymbolData` |
| Price Format | `priceFormat.js` | `formatPrice()` |
| WebSocket | `useWebSocketSub.js` | Existing composable |

## Component Structure

```
PriceTicker.svelte
├── Identity Column (85px)
│   ├── Symbol label
│   ├── Current price
│   └── Direction indicator (↑↓ + pips)
├── Chart Column (37.5px)
│   └── Mini market profile canvas (60px height, 1:1.6 ratio)
└── Stats Column (flex: 1, ~117.5px)
    ├── High price
    ├── Low price
    └── Range percentage
```

## Dimensions Spec

```
Total: 240px × 80px
├── Identity: 85px (35.4%)
├── Chart: 37.5px (15.6%)
└── Stats: 117.5px (49.0%)

Chart aspect ratio: 60px / 37.5px = 1.6
```

## Reactive Variables

```javascript
$: currentPrice = lastData?.current
$: highPrice = lastData?.high
$: lowPrice = lastData?.low
$: rangePercent = calculateDayRangePercentage(lastData)
$: direction = lastData?.direction
$: pipChange = calculatePipMovement(currentPrice, openPrice)
```

## CSS Classes

```css
.ticker-container        /* Main 240×80px container */
.identity-column         /* 85px width */
.chart-column           /* 37.5px width */
.stats-column           /* flex: 1 */
.chart-canvas           /* 37.5×60px canvas */
.direction-up           /* Green text */
.direction-down         /* Red text */
.direction-neutral      /* Gray text */
.tabular                /* Monospaced numbers */
```

## Debug Commands

```javascript
// Get all tickers
window.workspaceStore.getState().displays.forEach((d, id) => {
  if (d.type === 'priceTicker') console.log(d);
});

// Manually create ticker
window.workspaceActions.addPriceTicker('EURUSD');

// Check WebSocket
window.connectionManager?.status

// Inspect reactive data
// (Add in PriceTicker.svelte)
$: console.log('[Ticker] price:', currentPrice);
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Price not updating | Check WebSocket connection, verify symbol format |
| Layout broken | Inspect flex widths, verify `box-sizing: border-box` |
| Profile blank | Check `lastMarketProfileData` in console |
| Can't drag | Verify `interact.js` loaded, check element binding |
| Alt+I not working | Check keyboard focus, verify handler registered |

## Testing Checklist

- [ ] Renders at 240×80px (DevTools)
- [ ] 3-column layout accurate (85px + 37.5px + flex)
- [ ] Market profile 1:1.6 ratio (60px / 37.5px)
- [ ] Real-time price updates
- [ ] Statistics match FloatingDisplay
- [ ] Alt+I creates ticker
- [ ] Drag-and-drop works
- [ ] No layout shift on updates
- [ ] Tabular nums working

## Performance Targets

- Initial render: <16ms
- Update latency: <100ms
- Memory per ticker: ~5KB
- CPU usage: Negligible

## Next Steps

1. **Test**: Run through testing guide
2. **Polish**: Adjust colors, spacing
3. **Enhance**: Add tooltips, custom alerts
4. **Document**: Update user docs

---

**Implementation**: 2025-03-20
**Status**: ✅ Complete
**Lines Added**: 314
**Files Modified**: 5
