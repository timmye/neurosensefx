/**
 * NeuroSense FX — Dark Theme (Slate + Green Accent)
 *
 * Palette:
 *   Body up:    #26a69a (teal)      Body down:  #ef5350 (red)
 *   Border up:  #d1d4dc (light)     Border dn:  #d1d4dc (light)
 *   Accent:     #34d399 (green)     Bollinger:  upper=red, MA=light, lower=teal
 */

export const DARK_THEME = {
  grid: {
    show: true,
    horizontal: {
      show: true,
      size: 1,
      color: '#2a2e39',
      style: 'dashed',
      dashedValue: [2, 2]
    },
    vertical: {
      show: true,
      size: 1,
      color: '#2a2e39',
      style: 'dashed',
      dashedValue: [2, 2]
    }
  },
  candle: {
    type: 'candle_solid',
    bar: {
      compareRule: 'current_open',
      upColor: '#26a69a',
      downColor: '#ef5350',
      noChangeColor: '#787b86',
      upBorderColor: '#a3a6ad',
      downBorderColor: '#a3a6ad',
      noChangeBorderColor: '#a3a6ad',
      upWickColor: '#a3a6ad',
      downWickColor: '#a3a6ad',
      noChangeWickColor: '#a3a6ad'
    },
    area: {
      lineSize: 2,
      lineColor: '#66bb6a',
      smooth: false,
      value: 'close',
      backgroundColor: [
        { offset: 0, color: 'rgba(38, 166, 154, 0.01)' },
        { offset: 1, color: 'rgba(38, 166, 154, 0.25)' }
      ],
      point: {
        show: true,
        color: '#66bb6a',
        radius: 4,
        rippleColor: 'rgba(38, 166, 154, 0.3)',
        rippleRadius: 8,
        animation: true,
        animationDuration: 1000
      }
    },
    priceMark: {
      show: true,
      high: {
        show: true,
        color: '#66bb6a',
        textMargin: 5,
        textSize: 10,
        textFamily: '"Georgia Pro", Georgia, serif',
        textWeight: 'normal'
      },
      low: {
        show: true,
        color: '#ef5350',
        textMargin: 5,
        textSize: 10,
        textFamily: '"Georgia Pro", Georgia, serif',
        textWeight: 'normal'
      },
      last: {
        show: true,
        compareRule: 'current_open',
        upColor: '#66bb6a',
        downColor: '#ef5350',
        noChangeColor: '#787b86',
        line: {
          show: true,
          style: 'dashed',
          dashedValue: [4, 4],
          size: 1
        },
        text: {
          show: true,
          style: 'fill',
          size: 12,
          paddingLeft: 4,
          paddingTop: 4,
          paddingRight: 4,
          paddingBottom: 4,
          borderStyle: 'solid',
          borderSize: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderDashedValue: [2, 2],
          color: '#131722',
          family: '"Georgia Pro", Georgia, serif',
          weight: 'normal',
          borderRadius: 2
        },
        extendTexts: [
          {
            show: true,
            style: 'fill',
            position: 'above_price',
            updateInterval: 0,
            size: 11,
            paddingLeft: 4,
            paddingTop: 3,
            paddingRight: 4,
            paddingBottom: 3,
            borderStyle: 'solid',
            borderSize: 0,
            borderColor: 'transparent',
            borderDashedValue: [2, 2],
            color: '#131722',
            family: '"Georgia Pro", Georgia, serif',
            weight: 'normal',
            borderRadius: 2
          }
        ]
      }
    },
    tooltip: {
      offsetLeft: 4,
      offsetTop: 6,
      offsetRight: 4,
      offsetBottom: 6,
      showRule: 'always',
      showType: 'standard',
      title: {
        show: true,
        size: 13,
        family: '"Georgia Pro", Georgia, serif',
        weight: 'bold',
        color: '#d1d4dc',
        marginLeft: 8,
        marginTop: 4,
        marginRight: 8,
        marginBottom: 4,
        template: '{ticker} · {period}'
      },
      legend: {
        size: 12,
        family: '"Georgia Pro", Georgia, serif',
        weight: 'normal',
        color: '#a3a6ad',
        marginLeft: 8,
        marginTop: 4,
        marginRight: 8,
        marginBottom: 4,
        defaultValue: 'n/a',
        template: [
          { title: 'time', value: '{time}' },
          { title: { text: 'open', color: '#a3a6ad' }, value: { text: '{open}', color: '#d1d4dc' } },
          { title: { text: 'high', color: '#a3a6ad' }, value: { text: '{high}', color: '#26a69a' } },
          { title: { text: 'low', color: '#a3a6ad' }, value: { text: '{low}', color: '#ef5350' } },
          { title: { text: 'close', color: '#a3a6ad' }, value: { text: '{close}', color: '#d1d4dc' } },
          { title: 'volume', value: '{volume}' }
        ]
      },
      features: []
    }
  },
  indicator: {
    ohlc: {
      compareRule: 'current_open',
      upColor: 'rgba(38, 166, 154, .7)',
      downColor: 'rgba(239, 83, 80, .7)',
      noChangeColor: '#787b86'
    },
    bars: [{
      style: 'fill',
      borderStyle: 'solid',
      borderSize: 1,
      borderDashedValue: [2, 2],
      upColor: 'rgba(38, 166, 154, .7)',
      downColor: 'rgba(239, 83, 80, .7)',
      noChangeColor: '#787b86'
    }],
    lines: [
      { style: 'solid', smooth: false, size: 1, dashedValue: [2, 2], color: '#ef5350' },
      { style: 'solid', smooth: false, size: 2, dashedValue: [2, 2], color: '#d1d4dc' },
      { style: 'solid', smooth: false, size: 1, dashedValue: [2, 2], color: '#66bb6a' },
      { style: 'solid', smooth: false, size: 1, dashedValue: [2, 2], color: '#66bb6a' },
      { style: 'solid', smooth: false, size: 1, dashedValue: [2, 2], color: '#ef5350' }
    ],
    circles: [{
      style: 'fill',
      borderStyle: 'solid',
      borderSize: 1,
      borderDashedValue: [2, 2],
      upColor: 'rgba(38, 166, 154, .7)',
      downColor: 'rgba(239, 83, 80, .7)',
      noChangeColor: '#787b86'
    }],
    lastValueMark: {
      show: true,
      text: {
        show: true,
        style: 'fill',
        color: '#131722',
        size: 11,
        family: '"Georgia Pro", Georgia, serif',
        weight: 'normal',
        borderStyle: 'solid',
        borderSize: 1,
        borderDashedValue: [2, 2],
        paddingLeft: 4,
        paddingTop: 4,
        paddingRight: 4,
        paddingBottom: 4,
        borderRadius: 2
      }
    },
    tooltip: {
      offsetLeft: 4,
      offsetTop: 6,
      offsetRight: 4,
      offsetBottom: 6,
      showRule: 'always',
      showType: 'standard',
      title: {
        show: true,
        showName: true,
        showParams: true,
        size: 12,
        family: '"Georgia Pro", Georgia, serif',
        weight: 'normal',
        color: '#a3a6ad',
        marginLeft: 8,
        marginTop: 4,
        marginRight: 8,
        marginBottom: 4
      },
      legend: {
        size: 12,
        family: '"Georgia Pro", Georgia, serif',
        weight: 'normal',
        color: '#a3a6ad',
        marginLeft: 8,
        marginTop: 4,
        marginRight: 8,
        marginBottom: 4,
        defaultValue: 'n/a'
      },
      features: []
    }
  },
  xAxis: {
    show: true,
    size: 'auto',
    axisLine: {
      show: true,
      color: '#363a45',
      size: 1
    },
    tickText: {
      show: true,
      color: '#a3a6ad',
      family: '"Georgia Pro", Georgia, serif',
      weight: 'normal',
      size: 11,
      marginStart: 4,
      marginEnd: 4
    },
    tickLine: {
      show: true,
      size: 1,
      length: 3,
      color: '#363a45'
    }
  },
  yAxis: {
    show: true,
    size: 'auto',
    axisLine: {
      show: true,
      color: '#363a45',
      size: 1
    },
    tickText: {
      show: true,
      color: '#a3a6ad',
      family: '"Georgia Pro", Georgia, serif',
      weight: 'normal',
      size: 11,
      marginStart: 4,
      marginEnd: 4
    },
    tickLine: {
      show: true,
      size: 1,
      length: 3,
      color: '#363a45'
    }
  },
  separator: {
    size: 1,
    color: '#363a45',
    fill: true,
    activeBackgroundColor: 'rgba(38, 166, 154, .08)'
  },
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: {
        show: true,
        style: 'dashed',
        dashedValue: [4, 2],
        size: 1,
        color: '#d4c44f'
      },
      text: {
        show: true,
        style: 'fill',
        color: '#131722',
        size: 11,
        family: '"Georgia Pro", Georgia, serif',
        weight: 'normal',
        borderStyle: 'solid',
        borderDashedValue: [2, 2],
        borderSize: 1,
        borderColor: '#d4c44f',
        borderRadius: 2,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 4,
        backgroundColor: '#d4c44f'
      },
      features: []
    },
    vertical: {
      show: true,
      line: {
        show: true,
        style: 'dashed',
        dashedValue: [4, 2],
        size: 1,
        color: '#d4c44f'
      },
      text: {
        show: true,
        style: 'fill',
        color: '#131722',
        size: 11,
        family: '"Georgia Pro", Georgia, serif',
        weight: 'normal',
        borderStyle: 'solid',
        borderDashedValue: [2, 2],
        borderSize: 1,
        borderColor: '#d4c44f',
        borderRadius: 2,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 4,
        backgroundColor: '#d4c44f'
      }
    }
  },
  overlay: {
    point: {
      color: '#26a69a',
      borderColor: 'rgba(38, 166, 154, 0.35)',
      borderSize: 1,
      radius: 5,
      activeColor: '#26a69a',
      activeBorderColor: 'rgba(38, 166, 154, 0.35)',
      activeBorderSize: 3,
      activeRadius: 5
    },
    line: {
      style: 'solid',
      smooth: false,
      color: '#26a69a',
      size: 1,
      dashedValue: [2, 2]
    },
    rect: {
      style: 'fill',
      color: 'rgba(38, 166, 154, 0.10)',
      borderColor: '#26a69a',
      borderSize: 1,
      borderRadius: 0,
      borderStyle: 'solid',
      borderDashedValue: [2, 2]
    },
    polygon: {
      style: 'fill',
      color: 'rgba(38, 166, 154, 0.10)',
      borderColor: '#26a69a',
      borderSize: 1,
      borderStyle: 'solid',
      borderDashedValue: [2, 2]
    },
    circle: {
      style: 'fill',
      color: 'rgba(38, 166, 154, 0.10)',
      borderColor: '#26a69a',
      borderSize: 1,
      borderStyle: 'solid',
      borderDashedValue: [2, 2]
    },
    arc: {
      style: 'solid',
      color: '#26a69a',
      size: 1,
      dashedValue: [2, 2]
    },
    text: {
      style: 'fill',
      color: '#131722',
      size: 11,
      family: '"Georgia Pro", Georgia, serif',
      weight: 'normal',
      borderStyle: 'solid',
      borderDashedValue: [2, 2],
      borderSize: 1,
      borderRadius: 2,
      borderColor: '#26a69a',
      paddingLeft: 4,
      paddingRight: 4,
      paddingTop: 4,
      paddingBottom: 4,
      backgroundColor: '#26a69a'
    }
  }
};
