# Arrow Overlay

Custom overlay registered via `registerOverlay()` in `src/lib/chart/customOverlays.js`.

## Specification

| Property | Value |
|----------|-------|
| Name | `arrowOverlay` |
| Steps | 2 (tail → head) |
| Arrowhead ratio | 3:1 (base width : depth) |
| Arrowhead length | 30px |
| Arrowhead style | Filled, black (`#333333`) |
| Arrowhead position | Forward (at head point) |
| Line style | Solid, inherits overlay styles |

## Geometry

Given tail point `(x0, y0)` and head point `(x1, y1)`:

```
1. Calculate line angle: θ = atan2(y1 - y0, x1 - x0)
2. Calculate perpendicular unit vector: (-sin θ, cos θ)
3. Arrowhead depth = 30px along the line direction (towards tail)
4. Arrowhead base half-width = 10px (30 / 3) along perpendicular
5. Tip vertex = head point (x1, y1)
6. Left base = (x1 - 30·cos θ + 10·sin θ, y1 - 30·sin θ - 10·cos θ)
7. Right base = (x1 - 30·cos θ - 10·sin θ, y1 - 30·sin θ + 10·cos θ)
```

## Figures

Two figures returned by `createPointFigures`:

| Figure | Type | Description |
|--------|------|-------------|
| Shaft | `line` | Line from tail to head coordinates |
| Head | `polygon` | Filled triangle at head point, 30px deep, 10px half-width base |

```
          tip
         /|\
        / | \        depth = 30px
       /  |  \
      /   |   \
     -----+-----    base width = 20px (2 × 10px)
          |
          | shaft (line)
          |
         tail
```

## KLineChart References

- `registerOverlay()` — registers custom overlay type
- `PolygonStyle` — `{ style: 'fill', color: '#333333' }`
- `SmoothLineStyle` — line shaft styling
- `needDefaultPointFigure: true` — shows drag handles at tail and head
- `needDefaultXAxisFigure: true`, `needDefaultYAxisFigure: true` — axis markers
