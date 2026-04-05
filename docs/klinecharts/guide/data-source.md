# Data

The data required by the chart must be in a fixed format. Use `setDataLoader(loader)` to interact with the chart.

```typescript
{
  // Timestamp, millisecond, required fields
  timestamp: number
  // Open price, required fields
  open: number
  // Close price, required field
  close: number
  // Highest price, required field
  high: number
  // Lowest price, required field
  low: number
  // volume, optional field
  volume: number
  // Turnover, optional field (needed for 'EMV' and 'AVP' indicators)
  turnover: number
}
```
