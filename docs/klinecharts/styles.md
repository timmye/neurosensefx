# Default Style Configuration

Full default style configuration for KLineChart.

## xAxis (relevant to x-axis bug)

```javascript
xAxis: {
  show: true,
  size: 'auto',
  axisLine: {
    show: true,
    color: '#888888',
    size: 1
  },
  tickText: {
    show: true,
    color: '#D9D9D9',
    family: 'Helvetica Neue',
    weight: 'normal',
    size: 12,
    marginStart: 4,
    marginEnd: 4
  },
  tickLine: {
    show: true,
    size: 1,
    length: 3,
    color: '#888888'
  }
}
```

## Full Configuration

```javascript
const styles = {
  grid: {
    show: true,
    horizontal: {
      show: true, size: 1, color: '#EDEDED',
      style: 'dashed', dashedValue: [2, 2]
    },
    vertical: {
      show: true, size: 1, color: '#EDEDED',
      style: 'dashed', dashedValue: [2, 2]
    }
  },
  candle: {
    type: 'candle_solid',
    bar: {
      compareRule: 'current_open',
      upColor: '#2DC08E', downColor: '#F92855', noChangeColor: '#888888',
      upBorderColor: '#2DC08E', downBorderColor: '#F92855', noChangeBorderColor: '#888888',
      upWickColor: '#2DC08E', downWickColor: '#F92855', noChangeWickColor: '#888888'
    },
    area: {
      lineSize: 2, lineColor: '#2196F3', smooth: false, value: 'close',
      backgroundColor: [
        { offset: 0, color: 'rgba(33, 150, 243, 0.01)' },
        { offset: 1, color: 'rgba(33, 150, 243, 0.2)' }
      ],
      point: {
        show: true, radius: 4, rippleRadius: 8,
        animation: true, animationDuration: 1000
      }
    },
    priceMark: {
      show: true,
      high: { show: true, color: '#D9D9D9', textMargin: 5, textSize: 10 },
      low: { show: true, color: '#D9D9D9', textMargin: 5, textSize: 10 },
      last: {
        show: true, compareRule: 'current_open',
        upColor: '#2DC08E', downColor: '#F92855', noChangeColor: '#888888',
        line: { show: true, style: 'dashed', dashedValue: [4, 4], size: 1 },
        text: {
          show: true, style: 'fill', size: 12,
          paddingLeft: 4, paddingTop: 4, paddingRight: 4, paddingBottom: 4,
          borderSize: 0, borderRadius: 2,
          color: '#FFFFFF', family: 'Helvetica Neue', weight: 'normal'
        },
        extendTexts: []
      }
    },
    tooltip: {
      offsetLeft: 4, offsetTop: 6, offsetRight: 4, offsetBottom: 6,
      showRule: 'always', showType: 'standard',
      rect: {
        position: 'fixed', paddingLeft: 4, paddingRight: 4,
        paddingTop: 4, paddingBottom: 4, borderRadius: 4,
        borderSize: 1, borderColor: '#f2f3f5', color: '#FEFEFE'
      },
      title: {
        show: true, size: 14, family: 'Helvetica Neue', weight: 'normal',
        color: '#76808F', template: '{ticker} · {period}'
      },
      legend: {
        size: 12, family: 'Helvetica Neue', weight: 'normal',
        color: '#76808F', defaultValue: 'n/a',
        template: [
          { title: 'time', value: '{time}' },
          { title: 'open', value: '{open}' },
          { title: 'high', value: '{high}' },
          { title: 'low', value: '{low}' },
          { title: 'close', value: '{close}' },
          { title: 'volume', value: '{volume}' }
        ]
      },
      features: []
    }
  },
  indicator: {
    ohlc: {
      compareRule: 'current_open',
      upColor: 'rgba(45, 192, 142, .7)', downColor: 'rgba(249, 40, 85, .7)',
      noChangeColor: '#888888'
    },
    bars: [{
      style: 'fill', borderStyle: 'solid', borderSize: 1,
      upColor: 'rgba(45, 192, 142, .7)', downColor: 'rgba(249, 40, 85, .7)',
      noChangeColor: '#888888'
    }],
    lines: [
      { style: 'solid', size: 1, color: '#FF9600' },
      { style: 'solid', size: 1, color: '#935EBD' },
      { style: 'solid', size: 1, color: '#2196F3' },
      { style: 'solid', size: 1, color: '#E11D74' },
      { style: 'solid', size: 1, color: '#01C5C4' }
    ],
    circles: [{
      style: 'fill', borderStyle: 'solid', borderSize: 1,
      upColor: 'rgba(45, 192, 142, .7)', downColor: 'rgba(249, 40, 85, .7)',
      noChangeColor: '#888888'
    }],
    tooltip: {
      showRule: 'always', showType: 'standard',
      title: { show: true, showName: true, showParams: true, size: 12 },
      legend: { size: 12, defaultValue: 'n/a' },
      features: []
    }
  },
  xAxis: {
    show: true, size: 'auto',
    axisLine: { show: true, color: '#888888', size: 1 },
    tickText: {
      show: true, color: '#D9D9D9', family: 'Helvetica Neue',
      weight: 'normal', size: 12, marginStart: 4, marginEnd: 4
    },
    tickLine: { show: true, size: 1, length: 3, color: '#888888' }
  },
  yAxis: {
    show: true, size: 'auto',
    axisLine: { show: true, color: '#888888', size: 1 },
    tickText: {
      show: true, color: '#D9D9D9', family: 'Helvetica Neue',
      weight: 'normal', size: 12, marginStart: 4, marginEnd: 4
    },
    tickLine: { show: true, size: 1, length: 3, color: '#888888' }
  },
  separator: {
    size: 1, color: '#888888', fill: true,
    activeBackgroundColor: 'rgba(230, 230, 230, .15)'
  },
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#888888' },
      text: {
        show: true, style: 'fill', color: '#FFFFFF', size: 12,
        borderSize: 1, borderColor: '#686D76', borderRadius: 2,
        backgroundColor: '#686D76'
      },
      features: []
    },
    vertical: {
      show: true,
      line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#888888' },
      text: {
        show: true, style: 'fill', color: '#FFFFFF', size: 12,
        borderSize: 1, borderColor: '#686D76', borderRadius: 2,
        backgroundColor: '#686D76'
      }
    }
  },
  overlay: {
    point: { color: '#1677FF', borderColor: 'rgba(22, 119, 255, 0.35)', radius: 5 },
    line: { style: 'solid', color: '#1677FF', size: 1 },
    rect: { style: 'fill', color: 'rgba(22, 119, 255, 0.25)', borderColor: '#1677FF', borderRadius: 0 },
    text: {
      style: 'fill', color: '#FFFFFF', size: 12, family: 'Helvetica Neue',
      backgroundColor: '#1677FF', borderRadius: 2
    }
  }
}
```
