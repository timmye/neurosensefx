---
outline: deep
---

# registerXAxis(xAxis)
`registerXAxis` used to custom x-axis.

## Reference {#reference}

```typescript
(
  xAxis: {
    name: string
    scrollZoomEnabled?: boolean
    createTicks?: (params: object) => Array<{
      coord: number
      value: number | string
      text: string
    }>
  }
) => void
```

### Parameters {#parameters}
- `xAxis` X-axis configuration.
  - `name` Name, a unique identifier used for creation or modification.
  - `scrollZoomEnabled` Whether scrolling and zooming are possible on the axis.
  - `createTicks` Create ticks information callback method.

### Returns {#returns}
`registerXAxis` returns `undefined`.

## Usage {#usage}

### Basic usage {#basic}

```js
import { init, registerXAxis } from 'klinecharts'

registerXAxis({
  name: 'customXAxis',
  createTicks: ({ defaultTicks }) => {
    return defaultTicks.map(({ coord, value }) => {
      const date = new Date(value)
      const year = date.getFullYear()
      const month = `${date.getMonth() + 1}`.padStart(2, '0')
      const day = `${date.getDate()}`.padStart(2, '0')
      return {
        coord,
        value,
        text: `${day}/${month}/${year}`
      }
    })
  }
})

const chart = init(
  'custom-x-axis-chart',
  {
    layout: [
      {
        type: 'xAxis',
        options: {
          order: 1000,
          axis: {
            name: 'customXAxis'
          }
        }
      }
    ]
  }
)

chart.setSymbol({ ticker: 'TestSymbol' })
chart.setPeriod({ span: 1, type: 'day' })
chart.setDataLoader({
  getBars: ({ callback }) => {
    fetch('https://klinecharts.com/datas/kline.json')
      .then(res => res.json())
      .then(dataList => callback(dataList))
  }
})
```

## Notes for NeuroSense FX

- Project uses `registerXAxis({ name: 'calendar' })` in `src/lib/chart/xAxisCustom.js`
- Custom axis is activated via `chart.setStyles({ xAxis: { name: 'calendar' } })` in `ChartDisplay.svelte`
- The `createTicks` callback receives `{ defaultTicks }` — default tick array from KLineChart
- Return format: `Array<{ coord: number, value: number | string, text: string }>`
- `coord` is pixel position, `value` is timestamp, `text` is displayed label
