# NeuroSense FX: Metrics Documentation

This document provides a technical breakdown of the metrics calculated within `src/workers/dataProcessor.js` and their direct application in the NeuroSense FX visualization.

## 1. Foundational State

These are the core values upon which all other metrics are derived.

-   **`currentPrice`**: The most recent bid price from the data source.
-   **`todaysHigh` / `todaysLow`**: The session's recorded high and low prices.
-   **`projectedAdrHigh` / `projectedAdrLow`**: The calculated Average Daily Range high and low.
-   **`visualHigh` / `visualLow`**: The price range used for the Y-axis of the visualization, calculated as the min/max of the day's prices and the ADR, plus a 5% padding.

---

## 2. Volatility Calculation

The "volatility" metric is a dimensionless score representing the market's current activity level. It is the foundation for the **Volatility Orb** visualization. The calculation is a multi-step process designed to produce a smoothed, responsive value.

### Step 2.1: Raw Score Components

Two primary components are calculated over a **10-second lookback period**:

1.  **`magnitudeScore`**: Measures the average size of price movements.
    -   **Formula**: `Math.min(avgMagnitude / 2, 3)`
    -   **Explanation**: It takes the average magnitude of recent ticks and divides it by a calibration factor of `2`. The result is capped at `3.0`. This means an average price movement of 6 pips or more will result in a maximum magnitude score.

2.  **`frequencyScore`**: Measures the number of price updates per second.
    -   **Formula**: `Math.min(tickFrequency / 5, 3)`
    -   **Explanation**: It takes the number of ticks in the lookback period and divides it by a calibration factor of `5`. The result is capped at `3.0`. This means a frequency of 5 ticks per second or more will result in a maximum frequency score.

### Step 2.2: Raw Volatility Score

The two scores are combined in a weighted average to create the `rawVolatility`.

-   **Formula**: `(magnitudeScore * 0.6) + (frequencyScore * 0.4)`
-   **Explanation**: The magnitude of price movement is weighted more heavily (60%) than the frequency of updates (40%). The theoretical maximum for this score is `3.0`.

### Step 2.3: Smoothed Volatility (`state.volatility`)

The `rawVolatility` is smoothed over time using an Exponential Moving Average (EMA) to prevent erratic jumping.

-   **Formula**: `(state.volatility * 0.8) + (rawVolatility * 0.2)`
-   **Explanation**: The final `volatility` score consists of 80% of its previous value and 20% of the new `rawVolatility` score. This creates a stable but responsive metric that is displayed to the user as "Volatility".

---

## 3. Volatility Intensity (`state.volatilityIntensity`)

This is the **normalized value** used to directly drive the visualization of the **Volatility Orb**. It translates the abstract `volatility` score into a simple `0.0` to `1.0` scale.

-   **Formula**: `Math.min(1, state.volatility / 3.5)`
-   **Explanation**:
    -   The smoothed `state.volatility` is divided by `3.5`.
    -   This `3.5` is a **UI calibration constant**. It is a developer-defined value that represents the `volatility` score at which the orb should be considered at 100% intensity.
    -   By setting this divisor higher than the theoretical maximum raw score of `3.0`, it ensures the orb only reaches its maximum visual intensity under the most extreme and sustained market conditions.
    -   `Math.min(1, ...)` caps the value at `1.0`, preventing it from exceeding 100%.

The final result is a percentage that shows how close the current market activity is to the pre-defined maximum for the UI. This is displayed to the user as "Intensity %".

---

## 4. Market Profile (Tick-Based Price Histogram)

This visualization provides a histogram showing the distribution of price ticks over time. It is **not** a traditional volume profile that uses actual trade volume.

-   **Construction Method**: The profile is built from two data sources in a two-phase process:
    1.  **Initialization (from 1-min Bars)**: At startup, the application processes historical 1-minute bar data. It synthesizes a single "tick" from each bar's `close` price to build the initial profile. The direction (`buy`/`sell`) is determined by comparing the bar's `close` to its `open`.
    2.  **Live Operation (from Real-time Ticks)**: After initialization, the profile is updated exclusively with live, real-time price ticks as they are received.

-   **`volume` (Tick Count)**: The term `volume` in this context is a **count of the number of ticks** that have occurred at each specific price level (both historical and live).
-   **`buy` / `sell`**: These are also tick counts, categorized by whether the tick was an uptick (`buy`) or a downtick (`sell`).
-   **`priceBucketMultiplier`**: A user-configurable setting that groups prices together. A higher value creates a more granular profile by reducing the size of each price bucket.
-   **`distributionDepthMode`**: Determines whether the profile is built from all ticks since the session start or only a recent percentage of them.
-   **`levels`**: The final array of data sent to the UI, containing the `price`, total `volume` (tick count), `buy` (uptick count), and `sell` (downtick count) for each price bucket.

-   **Potential Enhancement**: The cTrader API provides a `volume` field (representing the number of ticks) for each 1-minute bar. The current implementation does not use this field. A future enhancement could use this `volume` data to more accurately weight the initial profile construction, rather than synthesizing a single tick from the `close` price.
