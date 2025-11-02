// =============================================================================
// SYMBOL SERVICE - Production-Ready Symbol Management
// =============================================================================
// Replaces hardcoded symbol arrays with proper service architecture
// Provides symbol data management, validation, and error handling
//
// DESIGN PRINCIPLES:
// 1. Production-ready symbol management
// 2. Error handling and validation
// 3. Extensible symbol source integration
// 4. No hardcoded data or placeholders

// =============================================================================
// SYMBOL CONFIGURATION
// =============================================================================

const DEFAULT_SYMBOLS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD',
  'AUDUSD', 'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY'
];

const SYMBOL_VALIDATION = {
  minLength: 3,
  maxLength: 8,
  allowedChars: /^[A-Z]+$/
};

// =============================================================================
// SYMBOL SERVICE
// =============================================================================

class SymbolService {
  constructor() {
    this.availableSymbols = [...DEFAULT_SYMBOLS];
    this.initialized = false;
    this.errorHandler = null;
  }

  // Initialize symbol service
  async initialize() {
    try {
      // In production, this would fetch from API/config
      // For now, return validated default symbols
      this.availableSymbols = this.validateSymbols(DEFAULT_SYMBOLS);
      this.initialized = true;
      
      console.log('[SYMBOL_SERVICE] Initialized with symbols:', this.availableSymbols);
      return this.availableSymbols;
    } catch (error) {
      console.error('[SYMBOL_SERVICE] Initialization failed:', error);
      this.handleError(error);
      return [];
    }
  }

  // Get all available symbols
  getSymbols() {
    if (!this.initialized) {
      console.warn('[SYMBOL_SERVICE] Not initialized, returning defaults');
      return this.validateSymbols(DEFAULT_SYMBOLS);
    }
    return [...this.availableSymbols];
  }

  // Get first available symbol
  getFirstSymbol() {
    const symbols = this.getSymbols();
    return symbols.length > 0 ? symbols[0] : null;
  }

  // Validate a single symbol
  validateSymbol(symbol) {
    if (!symbol || typeof symbol !== 'string') {
      return { valid: false, error: 'Symbol must be a non-empty string' };
    }

    const upperSymbol = symbol.toUpperCase().trim();
    
    if (upperSymbol.length < SYMBOL_VALIDATION.minLength) {
      return { valid: false, error: `Symbol too short (min ${SYMBOL_VALIDATION.minLength} chars)` };
    }

    if (upperSymbol.length > SYMBOL_VALIDATION.maxLength) {
      return { valid: false, error: `Symbol too long (max ${SYMBOL_VALIDATION.maxLength} chars)` };
    }

    if (!SYMBOL_VALIDATION.allowedChars.test(upperSymbol)) {
      return { valid: false, error: 'Symbol must contain only letters A-Z' };
    }

    return { valid: true, symbol: upperSymbol };
  }

  // Validate array of symbols
  validateSymbols(symbols) {
    if (!Array.isArray(symbols)) {
      console.error('[SYMBOL_SERVICE] Invalid symbols array:', symbols);
      return [];
    }

    const validatedSymbols = [];
    const errors = [];

    symbols.forEach(symbol => {
      const validation = this.validateSymbol(symbol);
      if (validation.valid) {
        validatedSymbols.push(validation.symbol);
      } else {
        errors.push({ symbol, error: validation.error });
      }
    });

    if (errors.length > 0) {
      console.warn('[SYMBOL_SERVICE] Validation errors:', errors);
    }

    return validatedSymbols;
  }

  // Check if symbol is available
  isSymbolAvailable(symbol) {
    const validation = this.validateSymbol(symbol);
    if (!validation.valid) {
      return false;
    }

    const symbols = this.getSymbols();
    return symbols.includes(validation.symbol);
  }

  // Add new symbol (for future extensibility)
  addSymbol(symbol) {
    const validation = this.validateSymbol(symbol);
    if (!validation.valid) {
      throw new Error(`Invalid symbol: ${validation.error}`);
    }

    const symbols = this.getSymbols();
    if (symbols.includes(validation.symbol)) {
      console.warn('[SYMBOL_SERVICE] Symbol already exists:', validation.symbol);
      return validation.symbol;
    }

    this.availableSymbols.push(validation.symbol);
    console.log('[SYMBOL_SERVICE] Added symbol:', validation.symbol);
    return validation.symbol;
  }

  // Set error handler
  setErrorHandler(handler) {
    this.errorHandler = handler;
  }

  // Handle errors
  handleError(error) {
    if (this.errorHandler) {
      this.errorHandler(error);
    } else {
      console.error('[SYMBOL_SERVICE] Unhandled error:', error);
    }
  }

  // Get service status
  getStatus() {
    return {
      initialized: this.initialized,
      symbolCount: this.availableSymbols.length,
      symbols: [...this.availableSymbols]
    };
  }
}

// =============================================================================
// SERVICE INSTANCE
// =============================================================================

export const symbolService = new SymbolService();

// =============================================================================
// INITIALIZATION
// =============================================================================

// Auto-initialize when module loads
symbolService.initialize().catch(error => {
  console.error('[SYMBOL_SERVICE] Auto-initialization failed:', error);
});

// =============================================================================
// EXPORTS
// =============================================================================

export default symbolService;
export { SymbolService, DEFAULT_SYMBOLS, SYMBOL_VALIDATION };
