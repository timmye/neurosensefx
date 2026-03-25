// Centralized Price Formatting - Crystal Clarity Compliant
// Framework-First: Uses native JavaScript toFixed() only
// Simple, Performant, Maintainable

export function formatPrice(price, pipPosition) {
  if (typeof price !== 'number' || !isFinite(price)) return 'N/A';
  if (pipPosition === null || pipPosition === undefined) {
    throw new Error('[formatPrice] pipPosition is required');
  }
  return price.toFixed(pipPosition);
}

// Legacy alias for backward compatibility - DEPRECATED
export function formatPriceWithPipPosition(price, pipPosition) {
  return formatPrice(price, pipPosition);
}

// Format price to pip level only (no pipette)
export function formatPriceToPipLevel(price, pipPosition, pipSize) {
  if (typeof price !== 'number' || !isFinite(price)) return null;
  if (pipPosition !== undefined && pipPosition !== null && pipSize) {
    const pips = Math.round(price / pipSize);
    return pips * pipSize;
  }
  throw new Error('[formatPriceToPipLevel] pipPosition and pipSize are required');
}

export function formatPipMovement(priceChange, pipPosition) {
  if (typeof priceChange !== 'number' || !isFinite(priceChange)) return '0 pips';
  const pipValue = priceChange / Math.pow(10, -pipPosition);
  return `${pipValue > 0 ? '+' : ''}${pipValue.toFixed(1)} pips`;
}

// Format price to pip level only for ticker display
export function formatPriceToPip(price, pipPosition) {
  if (typeof price !== 'number' || !isFinite(price)) return 'N/A';
  if (pipPosition === null || pipPosition === undefined) {
    throw new Error('[formatPriceToPip] pipPosition is required');
  }
  // Round down to pip level (floor at pipPosition precision)
  const pipSize = Math.pow(10, -pipPosition);
  return (Math.floor(price / pipSize) * pipSize).toFixed(pipPosition);
}

// Extract single pipette digit (0-9) for ticker display
export function getPipetteDigit(price, pipPosition) {
  if (typeof price !== 'number' || !isFinite(price)) return '-';
  if (pipPosition === null || pipPosition === undefined) {
    return '-';
  }
  // Multiply to get all digits as integer, then extract last digit
  const multiplier = Math.pow(10, pipPosition + 1);
  return Math.round(price * multiplier) % 10;
}

// Emphasize 4th and 5th significant digits (pips) in price
export function emphasizeDigits(formattedPrice, pipPosition) {
  if (!formattedPrice) {
    return { regular: '', emphasized: '', remaining: '' };
  }

  // Remove negative sign for processing
  const isNegative = formattedPrice.startsWith('-');
  const cleanPrice = isNegative ? formattedPrice.substring(1) : formattedPrice;

  // Find the 4th and 5th digits in the price string
  // These are the digits at positions 3 and 4 (0-indexed) when ignoring the decimal
  const priceChars = cleanPrice.split('');
  let digitCount = 0;
  let fourthDigitIndex = -1;
  let fifthDigitIndex = -1;

  // Find indices of 4th and 5th digits
  for (let i = 0; i < priceChars.length; i++) {
    if (priceChars[i] >= '0' && priceChars[i] <= '9') {
      digitCount++;
      if (digitCount === 4) fourthDigitIndex = i;
      if (digitCount === 5) fifthDigitIndex = i;
    }
  }

  // Need at least 5 digits to emphasize
  if (fifthDigitIndex === -1) {
    return { regular: formattedPrice, emphasized: '', remaining: '' };
  }

  // Extract segments
  const regular = cleanPrice.substring(0, fourthDigitIndex);
  const emphasized = cleanPrice.substring(fourthDigitIndex, fifthDigitIndex + 1);
  const remaining = cleanPrice.substring(fifthDigitIndex + 1);

  // Add back negative sign
  return {
    regular: isNegative ? '-' + regular : regular,
    emphasized: emphasized,
    remaining: remaining
  };
}

// Split price formatted to pip level into larger digits (to shrink) and pip digits (normal size)
// Returns: { largerDigits, pipDigits }
// largerDigits: everything before the pips (should be displayed smaller)
// pipDigits: the 4th and 5th significant digits (normal/larger size)
// Note: Input should already be formatted to pip level (no pipettes)
export function splitByPipPosition(formattedPrice) {
  if (!formattedPrice) {
    return { largerDigits: '', pipDigits: '' };
  }

  // Remove negative sign for processing
  const isNegative = formattedPrice.startsWith('-');
  const cleanPrice = isNegative ? formattedPrice.substring(1) : formattedPrice;

  // Find the 4th and 5th digits (pips) in the price string
  const priceChars = cleanPrice.split('');
  let digitCount = 0;
  let fourthDigitIndex = -1;
  let fifthDigitIndex = -1;

  // Find indices of 4th and 5th digits (the pip positions)
  for (let i = 0; i < priceChars.length; i++) {
    if (priceChars[i] >= '0' && priceChars[i] <= '9') {
      digitCount++;
      if (digitCount === 4) fourthDigitIndex = i;
      if (digitCount === 5) fifthDigitIndex = i;
    }
  }

  // If fewer than 5 digits, return entire price as pipDigits (nothing to shrink)
  if (fifthDigitIndex === -1) {
    return { largerDigits: '', pipDigits: formattedPrice };
  }

  // Extract segments
  const largerDigits = cleanPrice.substring(0, fourthDigitIndex);
  const pipDigits = cleanPrice.substring(fourthDigitIndex, fifthDigitIndex + 1);

  // Add back negative sign to larger digits if present
  return {
    largerDigits: isNegative ? '-' + largerDigits : largerDigits,
    pipDigits: pipDigits
  };
}

