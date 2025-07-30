# Price Markers: Source and Purpose

The following table clarifies the source and purpose of each price marker used within the NeuroSense FX visualization. It is essential that these markers are derived from accurate market data and used consistently throughout the application.

| Marker Name | Source | Purpose |
| :--- | :--- | :--- |
| `todaysOpen` | Backend (Market Data) | The official opening price for the current trading session. |
| `todaysHigh` | Backend (Market Data) | The highest price reached *so far* in the current trading session. |
| `todaysLow` | Backend (Market Data) | The lowest price reached *so far* in the current trading session. |
| `projectedAdrHigh` | Backend (`todaysOpen` + `adr`) | The statistically projected high for the day, based on the Average Daily Range. This forms the **upper boundary of the core Y-axis.** |
| `projectedAdrLow` | Backend (`todaysOpen` - `adr`) | The statistically projected low for the day, based on the Average Daily Range. This forms the **lower boundary of the core Y-axis.** |
| `visualHigh` | **Calculated in Worker** | The dynamic top edge of the visible canvas area. It expands to ensure all critical price points (`projectedAdrHigh`, `todaysHigh`, market profile, current price) are always visible, plus a small buffer. |
| `visualLow` | **Calculated in Worker** | The dynamic bottom edge of the visible canvas area. It expands to ensure all critical price points (`projectedAdrLow`, `todaysLow`, market profile, current price) are always visible, plus a small buffer. |
| `currentPrice` | Backend (Live Tick) | The most recent bid price from the live tick stream. Represented by the "Price Float." |
