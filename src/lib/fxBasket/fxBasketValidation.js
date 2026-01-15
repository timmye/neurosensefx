/**
 * FX Basket Validation Layer
 * Reject invalid data at ingestion point
 * All functions <15 lines (Crystal Clarity)
 */

export function validatePrice(price) {
  if (typeof price !== 'number') {
    return { valid: false, reason: 'Price is not a number' };
  }
  if (isNaN(price)) {
    return { valid: false, reason: 'Price is NaN' };
  }
  if (!isFinite(price)) {
    return { valid: false, reason: 'Price is infinite' };
  }
  if (price <= 0) {
    return { valid: false, reason: 'Price must be positive' };
  }
  return { valid: true, reason: null };
}

export function validateMessage(message) {
  if (!message || typeof message !== 'object') {
    return { valid: false, reason: 'Message is not an object' };
  }
  if (!message.symbol || typeof message.symbol !== 'string') {
    return { valid: false, reason: 'Missing or invalid symbol' };
  }
  if (!message.todaysOpen && !message.dailyOpen) {
    return { valid: false, reason: 'Missing todaysOpen price' };
  }
  if (!message.bid && !message.ask && !message.current) {
    return { valid: false, reason: 'Missing current price (bid/ask/current)' };
  }
  const openPrice = message.todaysOpen || message.dailyOpen;
  const currentPrice = message.current || message.bid;
  const openValidation = validatePrice(openPrice);
  if (!openValidation.valid) {
    return { valid: false, reason: `Invalid todaysOpen: ${openValidation.reason}` };
  }
  const currentValidation = validatePrice(currentPrice);
  if (!currentValidation.valid) {
    return { valid: false, reason: `Invalid current price: ${currentValidation.reason}` };
  }
  return { valid: true, reason: null };
}
