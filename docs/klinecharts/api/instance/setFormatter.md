---
outline: deep
---

# setFormatter(formatter)
`setFormatter` set some format APIs for charts.

## Reference {#reference}

```typescript
(
  formatter: {
    formatDate?: (params: {
      dateTimeFormat: Intl.DateTimeFormat
      timestamp: number
      template: string
      type: 'tooltip' | 'crosshair' | 'xAxis'
    }) => string
    formatBigNumber?: (value: string | number) => string
  }
) => void
```

### Parameters {#parameters}
- `formatter` Format APIs.
  - `formatDate` Formats a date. Receives object with:
    - `dateTimeFormat` Intl.DateTimeFormat instance
    - `timestamp` Timestamp in milliseconds
    - `template` Format template string
    - `type` One of `'tooltip' | 'crosshair' | 'xAxis'`
  - `formatBigNumber` Format big numbers (1000 -> 1k, 1000000 -> 1M, etc.)

### Returns {#returns}
`setFormatter` returns `undefined`.

## Usage {#usage}

### Format date {#formatDate}

```js
import { init, utils } from 'klinecharts'

const chart = init('chart')

chart.setFormatter({
  formatDate: ({ dateTimeFormat, timestamp, type }) => {
    switch (type) {
      case 'tooltip':
        return utils.formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD HH:mm')
      case 'crosshair':
        return utils.formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD')
      case 'xAxis':
        return utils.formatDate(dateTimeFormat, timestamp, 'MM-DD')
    }
    return utils.formatDate(dateTimeFormat, timestamp, 'MM-DD HH:mm')
  }
})
```

## Notes for NeuroSense FX

- v9 uses `setCustomApi({ formatDate: ... })` — v10 renames to `setFormatter`
- The `formatDate` `type: 'xAxis'` is important: this is used for DEFAULT axis labels
- When a custom `registerXAxis` is active, its `createTicks` generates labels directly
- H4 investigation: check if `formatDate` with `type: 'xAxis'` still fires alongside custom axis
- Current code in `ChartDisplay.svelte` line 391: `chart.setCustomApi({ formatDate: formatAxisLabel })`
