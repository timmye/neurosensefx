# Volatility-Driven Background Effect - Design Document

> Status: Research complete, design approved
> Date: 2026-03-30

## Objective

Wire FX basket volatility metrics directly to the existing `BackgroundShader.svelte` uniforms. No new GLSL, no new visual effects — just make the existing hardcoded shader parameters respond to live market data.

---

## Part 1: FX Basket Volatility Quantification

### 1.1 Current Data Available

Each tick produces a `changePercent` per basket — the signed percentage change from daily open:

| Currency | Typical Range | p95 Daily Range | Extremes Observed |
|----------|--------------|-----------------|-------------------|
| USD | 0.01 - 0.45 | 0.456 | 0.611 |
| EUR | 0.01 - 0.24 | 0.240 | 0.334 |
| JPY | 0.02 - 0.72 | 0.718 | 1.358 |
| GBP | 0.02 - 0.61 | 0.608 | 0.832 |
| AUD | 0.04 - 0.58 | 0.578 | 0.631 |
| CAD | 0.00 - 0.41 | 0.411 | 0.968 |
| CHF | 0.01 - 0.48 | 0.477 | 0.562 |
| NZD | 0.00 - 0.55 | 0.549 | 1.219 |

Source: `data/fx-basket-historical-analysis.json` (65-day empirical analysis)

**Key observation**: JPY and NZD are ~3x more volatile than EUR. Any aggregate metric MUST normalize per-currency or be dominated by the most volatile basket.

### 1.2 What Does NOT Exist Yet

- No tick timestamps in the basket pipeline
- No ring buffers or historical accumulators
- No per-basket OHLC tracking
- No 1-minute rolling windows
- No velocity/acceleration derivatives
- No volatility store

The only state per tick: `baseline` Map (daily opens), `current` Map (latest prices), and the computed `changePercent` snapshot.

### 1.3 Volatility Metrics

#### Metric A: Max Zone-Normalized Score

**What it captures**: Single-currency explosions. When JPY spikes but everything else is calm, this detects it.

**Formula**:
```
zone_score_i = |changePercent_i| / BASKET_ZONES[i].active
max_zone = MAX(zone_score_i) across all 8 baskets
```

Where `BASKET_ZONES` thresholds already exist in `fxBasketConfig.js:73-82`:

| Currency | QUIET | NORMAL | ACTIVE |
|----------|-------|--------|--------|
| USD | <0.07 | <0.25 | <0.40 |
| EUR | <0.05 | <0.18 | <0.22 |
| JPY | <0.12 | <0.40 | <0.60 |
| GBP | <0.07 | <0.25 | <0.45 |
| AUD | <0.11 | <0.35 | <0.50 |
| CAD | <0.05 | <0.25 | <0.35 |
| CHF | <0.07 | <0.30 | <0.42 |
| NZD | <0.08 | <0.30 | <0.48 |

A score of 1.0 = at ACTIVE threshold. Scores >1.0 = EXTREME territory.

**Aggregation**: `MAX(zone_score_i)` — the single most stressed currency.

**Cost**: O(8) per tick, stateless.
**Infrastructure**: None. Uses existing config.

---

#### Metric B: Cross-Currency Dispersion (Sigma)

**What it captures**: Market structure stress. How divergent are currencies from each other. High sigma means aggressive flow rotation — capital flowing from one currency to another. This captures something fundamentally different from magnitude: it measures whether the market is "breaking apart."

**Formula**:
```
mean_cp = MEAN(changePercent_i)      // signed
sigma = SQRT( (1/8) * SUM( (changePercent_i - mean_cp)^2 ) )
```

**Typical range**: 0.02 (calm, all currencies aligned) to 0.40 (extreme divergence).

**Scaling**: `sigma_score = clamp(sigma / 0.40 * 100, 0, 100)`

**Why this matters**: If USD is +0.5% and JPY is -0.5%, sigma is high even though the mean absolute is moderate. The market isn't "moving" in aggregate — it's rotating.

**Cost**: O(8) per tick, stateless.
**Infrastructure**: None.

---

#### Metric C: EWMA of Tick-to-Tick Absolute Returns

**What it captures**: Rate of change intensity. How fast prices are moving right now, not just where they are. Detects acceleration — a currency drifting slowly vs one suddenly spiking.

**Formula** (per basket):
```
delta_i = |changePercent_i(t) - changePercent_i(t-1)|
ewma_abs_i = lambda * ewma_abs_i + (1 - lambda) * delta_i
```

**Aggregation**: `MEAN(ewma_abs_i)` across all 8 baskets.

**Parameters**:
- `lambda = 0.97` for tick-level data (effective lookback ~33 ticks)
- RiskMetrics/J.P. Morgan standard for real-time volatility tracking

**Scaling**: `velocity_score = clamp(aggregate / 0.05 * 100, 0, 100)` where 0.05 is empirically extreme for tick-level returns.

**Cost**: O(8) per tick.
**Infrastructure**: Store 16 numbers (previous changePercent + ewma_abs per basket).

---

#### Metric D: Range Across Baskets

**What it captures**: Full-spectrum width between strongest and weakest currency. Robust, simple complement to sigma.

**Formula**:
```
range = MAX(changePercent_i) - MIN(changePercent_i)    // signed values
```

**Typical range**: 0.10 (calm) to 1.0 (extreme spread).

**Scaling**: `range_score = clamp(range / 1.0 * 100, 0, 100)`

**Cost**: O(8) per tick, stateless.
**Infrastructure**: None.

---

#### Metric E: Per-Basket Directional (Signed)

**What it captures**: Which direction each currency is moving. Useful for color mapping — warm = strengthening, cool = weakening.

**Formula**:
```
direction_i = changePercent_i    // already signed
```

**Note**: `SUM(changePercent_i)` should be ~0 in FX (zero-sum across currencies). Deviation from 0 indicates data anomaly.

**Cost**: Already available. Zero new infrastructure.

---

### 1.4 Why NOT Average Into a Single Scalar

The shader has **multiple independent tunable parameters** (speed, turbulence, color, pulse, wave amount). Averaging 4 metrics into 1 scalar, then deriving 4+ shader params from that 1 number, creates an information bottleneck.

Example — these two market states produce nearly the same composite average:

| State | Sigma | Max Zone | EWMA Vel | Range | Composite |
|-------|-------|----------|----------|-------|-----------|
| JPY spiking, others calm | Low (15) | High (90) | Medium (40) | Medium (50) | ~46 |
| All currencies diverging | High (80) | Low (20) | Medium (40) | Medium (50) | ~50 |

Same output, completely different market reality. The background should look different for each.

**Instead**: Each metric drives its own shader uniform directly. This gives the background a 4-dimensional visual vocabulary that encodes actual market structure without needing conscious decoding.

---

## Part 2: Direct Metric → Uniform Mapping

### 2.1 Current Background Infrastructure

`BackgroundShader.svelte` uses Three.js with a GLSL fragment shader. All uniforms are hardcoded constants. The animation loop (`BackgroundShader.svelte:216-220`) only updates `uTime` per frame:

```js
function animate() {
  animationId = requestAnimationFrame(animate);
  material.uniforms.uTime.value = clock.getElapsedTime();
  renderer.render(scene, camera);
}
```

**No GLSL changes.** The shader stays as-is. We only change what the JS animation loop writes to the existing uniforms.

### 2.2 Direct Mapping Table

Each volatility metric drives one shader uniform. Each mapping is a simple `lerp` from a calm value to an extreme value, with EWMA smoothing to prevent jitter.

| Shader Uniform | Driven By | Calm (0) | Extreme (100) | Visual Effect |
|---|---|---|---|---|
| `uSpeed` | EWMA Velocity (Metric C) | `0.02` | `0.12` | Background moves faster when prices change rapidly |
| `uTurbulence` | Dispersion Sigma (Metric B) | `0.8` | `3.5` | Pattern gets chaotic when currencies diverge |
| `uPulse` | Range (Metric D) | `0.0` | `0.4` | Pulsing amplitude grows with spread between strongest/weakest |
| `uColor2` | Max Zone Score (Metric A) | `#578fff` (blue) | `#e040fb` (magenta) | Color shifts when a single currency spikes |
| `uAccent` | Max Zone Score (Metric A) | `#004280` (dark blue) | `#ff6b35` (orange) | Accent shifts with single-currency stress |

### 2.3 How Different Market States Look

**State: Calm day** — all metrics low
- Slow movement (uSpeed=0.02), coherent patterns (uTurbulence=0.8), no pulse, blue tones
- Visual: Slow, smooth, relaxing blue flow

**State: JPY spiking alone** — max_zone high, sigma low
- Moderate speed, coherent patterns (no divergence), color shifts to magenta/orange (single currency alert)
- Visual: Same smooth flow but color turns alert — "something specific is happening"

**State: All currencies diverging** — sigma high, max_zone low
- Moderate speed, chaotic patterns (high turbulence), blue tones (no single culprit)
- Visual: Patterns break apart, background gets visually agitated — "everything is stressed"

**State: Flash crash** — all metrics high
- Fast movement, chaotic patterns, strong pulse, magenta/orange/red
- Visual: Everything at once — unmistakable urgency

### 2.4 Color Mapping Detail

`uColor2` driven by max zone score (Metric A) — the single-currency explosion indicator:

```
max_zone 0-25:   uColor2 = lerp(#578fff, #00d4aa, score/25)      // blue → teal
max_zone 25-50:  uColor2 = lerp(#00d4aa, #e040fb, (score-25)/25)  // teal → magenta
max_zone 50-75:  uColor2 = lerp(#e040fb, #ff6b35, (score-50)/25)  // magenta → orange
max_zone 75-100: uColor2 = lerp(#ff6b35, #ef4444, (score-75)/25)  // orange → red
```

`uAccent` follows the same curve but on the accent color range.

### 2.5 Smoothing

Each metric gets its own EWMA smoothing before driving the uniform:

```
smoothed_metric = lambda * prev_smoothed + (1 - lambda) * raw_metric
```

| Metric | Lambda | Time Constant | Why |
|---|---|---|---|
| EWMA Velocity | 0.90 | ~2-3 sec | Already smoothed by inner EWMA, light outer smoothing |
| Dispersion Sigma | 0.92 | ~3 sec | Divergence changes gradually, moderate smoothing |
| Max Zone Score | 0.88 | ~2 sec | Single-currency spikes should show faster |
| Range | 0.92 | ~3 sec | Range changes gradually |

**Total smoothing state**: 4 numbers (one per metric).

### 2.6 Implementation in Animation Loop

The only code change in `BackgroundShader.svelte` is in the `animate()` function and the uniform initialization:

```js
// In animate() — replace single uTime update with:
material.uniforms.uTime.value = clock.getElapsedTime();

const v = $volatilityStore;  // reactive subscription to store
if (v.ready) {
  material.uniforms.uSpeed.value = lerp(0.02, 0.12, v.smoothedVelocity / 100);
  material.uniforms.uTurbulence.value = lerp(0.8, 3.5, v.smoothedSigma / 100);
  material.uniforms.uPulse.value = lerp(0.0, 0.4, v.smoothedRange / 100);
  material.uniforms.uColor2.value.set(colorForZone(v.smoothedMaxZone));
  material.uniforms.uAccent.value.set(accentForZone(v.smoothedMaxZone));
}
```

**No GLSL changes. No new uniforms. No new rendering pipeline.**

---

## Part 3: Implementation Architecture

### 3.1 New Files

```
src/lib/fxBasket/fxBasketVolatility.js    // Volatility quantification module
src/stores/volatilityStore.js             // Svelte store for volatility state
```

### 3.2 Modified Files

```
src/components/BackgroundShader.svelte    // Read from volatilityStore in animate()
src/lib/fxBasket/fxBasketSubscription.js  // Call computeVolatility() on each tick
```

### 3.3 Data Flow

```
Tick arrives (fxBasketSubscription.js)
  → updateBaskets() produces { changePercent } per currency
  → fxBasketVolatility.compute(baskets) produces:
      {
        sigma:          0-100,   // cross-currency divergence
        maxZone:        0-100,   // single-currency explosion
        ewmaVelocity:   0-100,   // rate-of-change intensity
        range:          0-100,   // full-spectrum width
        smoothedSigma:  0-100,   // EWMA-smoothed
        smoothedMaxZone: 0-100,
        smoothedVelocity: 0-100,
        smoothedRange:  0-100,
        perBasket: { USD: { vol, direction }, ... },
        ready: true
      }
  → volatilityStore.set(metrics)
  → BackgroundShader.svelte animate() reads $volatilityStore
  → Sets shader uniforms: uSpeed, uTurbulence, uPulse, uColor2, uAccent
```

### 3.4 API: fxBasketVolatility.js

```js
// State held internally (not exported)
// - prevChangePercent: Map<string, number>     (previous tick per basket)
// - ewmaAbsPerBasket: Map<string, number>       (per-basket EWMA accumulator)
// - smoothed: { sigma, maxZone, velocity, range } (outer EWMA state)

// Initialize — call once when basket data starts flowing
export function initVolatility(baskets);

// Per-tick update — call on every basket recalculation
// Returns: { sigma, maxZone, ewmaVelocity, range, smoothed*, perBasket, ready }
export function computeVolatility(baskets);

// Reset — call on disconnect/cleanup
export function resetVolatility();
```

### 3.5 API: volatilityStore.js

```js
// Svelte writable store
export const volatilityStore = writable({
  sigma: 0,                // 0-100 cross-currency divergence
  maxZone: 0,              // 0-100 single-currency explosion
  ewmaVelocity: 0,         // 0-100 rate-of-change
  range: 0,                // 0-100 full-spectrum width
  smoothedSigma: 0,        // EWMA-smoothed sigma
  smoothedMaxZone: 0,      // EWMA-smoothed maxZone
  smoothedVelocity: 0,     // EWMA-smoothed velocity
  smoothedRange: 0,        // EWMA-smoothed range
  perBasket: {},            // { USD: { vol, direction }, ... }
  ready: false              // true when basket data is flowing
});
```

### 3.6 Performance Budget

| Component | CPU per tick | Memory | GPU per frame |
|-----------|-------------|--------|---------------|
| Dispersion sigma | 8 ops | 0 | 0 |
| Max zone score | 8 ops | 0 | 0 |
| EWMA velocity | 16 ops | 16 numbers | 0 |
| Range | 8 ops | 0 | 0 |
| Outer EWMA smoothing (4x) | 12 ops | 4 numbers | 0 |
| Store update | ~5 ops | ~300 bytes | 0 |
| **Total per tick** | **~57 ops** | **~20 numbers** | **0** |
| Uniform updates in animate() | 5 ops | 0 | 0 |
| **GPU impact** | — | — | **0** (no GLSL changes) |

**Expected impact**: Zero measurable performance change. No new GPU work at all — the shader is untouched. CPU adds ~57 arithmetic operations per tick (~0.001ms) and the animation loop adds 5 uniform writes per frame.

---

### 3.7 Future Enhancements (Not in Scope)

| Enhancement | What | Infrastructure Needed | Would Add |
|---|---|---|---|
| 1-min rolling stddev | True intra-day volatility | Ring buffer per basket (~480 values) | Per-basket rolling vol for uWaveAmount |
| Per-basket directional tint | Screen regions colored by currency direction | Additional uniforms or shader changes | Geographic vol map |
| Garman-Klass estimator | Efficient vol from OHLC | Per-basket H/L tracking within bar periods | More accurate vol estimation |
| Correlation breakdown | Normally correlated currencies diverging | Rolling covariance matrix (28 pairs) | New metric for uWaveAmount or uBlur |
| Session-aware percentiles | Asian vs London vs NY calibration | Pre-computed per-session distributions | Adaptive thresholds by trading session |

---

## Appendix A: Historical Statistics Reference

From `data/fx-basket-historical-analysis.json` (65 days, 2025-10-15 to 2026-01-15):

| Currency | mean | median | p5 | p95 | stddev | min | max |
|----------|------|--------|------|------|--------|-----|-----|
| USD | 0.178 | 0.137 | 0.014 | 0.456 | 0.144 | 0.002 | 0.611 |
| EUR | 0.118 | 0.113 | 0.011 | 0.240 | 0.073 | 0.000 | 0.334 |
| JPY | 0.295 | 0.239 | 0.021 | 0.718 | 0.248 | 0.005 | 1.358 |
| GBP | 0.186 | 0.142 | 0.024 | 0.608 | 0.165 | 0.008 | 0.832 |
| AUD | 0.253 | 0.221 | 0.042 | 0.578 | 0.162 | 0.002 | 0.631 |
| CAD | 0.147 | 0.114 | 0.004 | 0.411 | 0.152 | 0.001 | 0.968 |
| CHF | 0.184 | 0.146 | 0.007 | 0.477 | 0.148 | 0.001 | 0.562 |
| NZD | 0.213 | 0.161 | 0.005 | 0.549 | 0.215 | 0.002 | 1.219 |

## Appendix B: Key Source Files

| File | Lines | Role |
|------|-------|------|
| `src/lib/fxBasket/fxBasketCalculations.js` | 149 | `updateBaskets()` returns `{ currency, changePercent, normalized }` per basket |
| `src/lib/fxBasket/fxBasketConfig.js` | 83 | `BASKET_ZONES` thresholds, `CURRENCIES` list, `ZONE_COLORS` |
| `src/lib/fxBasket/fxBasketSubscription.js` | 121 | Tick callback pipeline, `subscribeBasket()` |
| `src/lib/fxBasket/fxBasketElements.js` | — | `getZoneColor()` per-basket zone classification |
| `src/components/BackgroundShader.svelte` | 253 | Three.js WebGL background with GLSL simplex noise |
| `src/components/FxBasketDisplay.svelte` | 188 | FX basket canvas display, subscribes to basket data |
| `data/fx-basket-historical-analysis.json` | ~4300 | 65-day empirical daily range statistics |
