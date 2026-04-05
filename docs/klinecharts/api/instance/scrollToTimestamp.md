---
outline: deep
---

# scrollToTimestamp(timestamp, animationDuration?)
`scrollToTimestamp` scroll the right side of the chart to the specified timestamp.

## Reference {#reference}

### Parameters {#parameters}
- `timestamp` Timestamp.
- `animationDuration` Animation duration. If less than or equal to 0, there is no animation.

### Returns {#returns}
`scrollToTimestamp` returns `undefined`.

## Usage {#usage}

```js
const dataList = chart.getDataList()
chart.scrollToTimestamp(dataList[dataList.length - 100].timestamp, 200)
```
