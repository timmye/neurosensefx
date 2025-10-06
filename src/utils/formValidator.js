/**
 * Form Validation Utility
 * Provides comprehensive form validation with rules, messages, and real-time feedback
 */

/**
 * Validation rule definitions
 */
export const VALIDATION_RULES = {
  required: (value) => {
    if (value === null || value === undefined || value === '') {
      return 'This field is required';
    }
    if (Array.isArray(value) && value.length === 0) {
      return 'At least one item must be selected';
    }
    return null;
  },

  email: (value) => {
    if (!value) return null; // Skip if empty (use required rule separately)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },

  minLength: (min) => (value) => {
    if (!value) return null;
    if (value.length < min) {
      return `Must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (max) => (value) => {
    if (!value) return null;
    if (value.length > max) {
      return `Must be no more than ${max} characters`;
    }
    return null;
  },

  min: (min) => (value) => {
    if (value === null || value === undefined || value === '') return null;
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < min) {
      return `Must be at least ${min}`;
    }
    return null;
  },

  max: (max) => (value) => {
    if (value === null || value === undefined || value === '') return null;
    const numValue = Number(value);
    if (isNaN(numValue) || numValue > max) {
      return `Must be no more than ${max}`;
    }
    return null;
  },

  pattern: (regex, message) => (value) => {
    if (!value) return null;
    if (!regex.test(value)) {
      return message || 'Invalid format';
    }
    return null;
  },

  url: (value) => {
    if (!value) return null;
    try {
      new URL(value);
      return null;
    } catch {
      return 'Please enter a valid URL';
    }
  },

  phone: (value) => {
    if (!value) return null;
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    if (!phoneRegex.test(value) || value.replace(/\D/g, '').length < 10) {
      return 'Please enter a valid phone number';
    }
    return null;
  },

  numeric: (value) => {
    if (!value) return null;
    if (isNaN(Number(value))) {
      return 'Must be a number';
    }
    return null;
  },

  integer: (value) => {
    if (!value) return null;
    const numValue = Number(value);
    if (isNaN(numValue) || !Number.isInteger(numValue)) {
      return 'Must be a whole number';
    }
    return null;
  },

  positive: (value) => {
    if (!value) return null;
    const numValue = Number(value);
    if (isNaN(numValue) || numValue <= 0) {
      return 'Must be a positive number';
    }
    return null;
  },

  date: (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return 'Please enter a valid date';
    }
    return null;
  },

  futureDate: (value) => {
    if (!value) return null;
    const date = new Date(value);
    const now = new Date();
    if (date <= now) {
      return 'Date must be in the future';
    }
    return null;
  },

  pastDate: (value) => {
    if (!value) return null;
    const date = new Date(value);
    const now = new Date();
    if (date >= now) {
      return 'Date must be in the past';
    }
    return null;
  },

  alpha: (value) => {
    if (!value) return null;
    if (!/^[a-zA-Z\s]+$/.test(value)) {
      return 'Must contain only letters and spaces';
    }
    return null;
  },

  alphanumeric: (value) => {
    if (!value) return null;
    if (!/^[a-zA-Z0-9\s]+$/.test(value)) {
      return 'Must contain only letters, numbers, and spaces';
    }
    return null;
  },

  password: (value) => {
    if (!value) return null;
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(value)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(value)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(value)) {
      return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
      return 'Password must contain at least one special character';
    }
    return null;
  },

  confirmPassword: (originalPassword) => (value) => {
    if (value !== originalPassword) {
      return 'Passwords do not match';
    }
    return null;
  },

  selectRequired: (value) => {
    if (!value || value === '' || value === 'select') {
      return 'Please select an option';
    }
    return null;
  },

  fileRequired: (value) => {
    if (!value || value.length === 0) {
      return 'Please select a file';
    }
    return null;
  },

  fileSize: (maxSizeMB) => (value) => {
    if (!value || value.length === 0) return null;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    for (const file of value) {
      if (file.size > maxSizeBytes) {
        return `File size must be less than ${maxSizeMB}MB`;
      }
    }
    return null;
  },

  fileType: (allowedTypes) => (value) => {
    if (!value || value.length === 0) return null;
    for (const file of value) {
      if (!allowedTypes.includes(file.type)) {
        return `File type must be one of: ${allowedTypes.join(', ')}`;
      }
    }
    return null;
  }
};

/**
 * FormValidator class for managing form validation
 */
export class FormValidator {
  constructor(schema = {}) {
    this.schema = schema;
    this.errors = {};
    this.touched = {};
    this.validators = {};
    
    // Build validators from schema
    this.buildValidators();
  }

  /**
   * Build validation functions from schema
   */
  buildValidators() {
    for (const [field, rules] of Object.entries(this.schema)) {
      this.validators[field] = this.compileRules(rules);
    }
  }

  /**
   * Compile validation rules into validator functions
   */
  compileRules(rules) {
    const validators = [];
    
    for (const rule of rules) {
      if (typeof rule === 'string') {
        // Simple rule name
        if (VALIDATION_RULES[rule]) {
          validators.push(VALIDATION_RULES[rule]);
        }
      } else if (typeof rule === 'function') {
        // Custom validator function
        validators.push(rule);
      } else if (typeof rule === 'object' && rule.type) {
        // Rule with parameters
        const ruleFunction = VALIDATION_RULES[rule.type];
        if (ruleFunction) {
          if (rule.params) {
            validators.push(ruleFunction(...rule.params));
          } else {
            validators.push(ruleFunction);
          }
        }
      }
    }
    
    return validators;
  }

  /**
   * Validate a single field
   */
  validateField(field, value, formData = {}) {
    const validators = this.validators[field];
    if (!validators) return null;

    for (const validator of validators) {
      const error = validator(value, formData);
      if (error) {
        return error;
      }
    }

    return null;
  }

  /**
   * Validate entire form
   */
  validate(formData) {
    const errors = {};
    let isValid = true;

    for (const [field, validators] of Object.entries(this.validators)) {
      const value = formData[field];
      const error = this.validateField(field, value, formData);
      
      if (error) {
        errors[field] = error;
        isValid = false;
      }
    }

    this.errors = errors;
    return { isValid, errors };
  }

  /**
   * Validate field and update state
   */
  validateAndUpdate(field, value, formData = {}) {
    const error = this.validateField(field, value, formData);
    
    if (error) {
      this.errors[field] = error;
    } else {
      delete this.errors[field];
    }
    
    this.touched[field] = true;
    
    return { error, isValid: !error };
  }

  /**
   * Check if field has error
   */
  hasError(field) {
    return Boolean(this.errors[field]);
  }

  /**
   * Get error message for field
   */
  getError(field) {
    return this.errors[field] || null;
  }

  /**
   * Check if field has been touched
   */
  isTouched(field) {
    return Boolean(this.touched[field]);
  }

  /**
   * Mark field as touched
   */
  touchField(field) {
    this.touched[field] = true;
  }

  /**
   * Mark all fields as touched
   */
  touchAll() {
    for (const field of Object.keys(this.schema)) {
      this.touched[field] = true;
    }
  }

  /**
   * Clear errors for a field
   */
  clearFieldError(field) {
    delete this.errors[field];
  }

  /**
   * Clear all errors
   */
  clearErrors() {
    this.errors = {};
  }

  /**
   * Reset validator state
   */
  reset() {
    this.errors = {};
    this.touched = {};
  }

  /**
   * Update validation schema
   */
  updateSchema(newSchema) {
    this.schema = { ...this.schema, ...newSchema };
    this.buildValidators();
  }

  /**
   * Get field validation state
   */
  getFieldState(field) {
    return {
      error: this.getError(field),
      hasError: this.hasError(field),
      isTouched: this.isTouched(field),
      isValid: !this.hasError(field) && this.isTouched(field)
    };
  }

  /**
   * Get overall form state
   */
  getFormState() {
    return {
      errors: { ...this.errors },
      touched: { ...this.touched },
      isValid: Object.keys(this.errors).length === 0,
      isDirty: Object.keys(this.touched).length > 0
    };
  }
}

/**
 * Create a form validator from schema
 */
export function createValidator(schema) {
  return new FormValidator(schema);
}

/**
 * Common validation schemas
 */
export const COMMON_SCHEMAS = {
  login: {
    email: ['required', 'email'],
    password: ['required', 'minLength:6']
  },

  registration: {
    firstName: ['required', 'alpha', 'maxLength:50'],
    lastName: ['required', 'alpha', 'maxLength:50'],
    email: ['required', 'email'],
    password: ['required', 'password'],
    confirmPassword: [
      { type: 'confirmPassword', params: [] } // Will be set dynamically
    ],
    terms: ['required']
  },

  profile: {
    firstName: ['required', 'alpha', 'maxLength:50'],
    lastName: ['required', 'alpha', 'maxLength:50'],
    email: ['required', 'email'],
    phone: ['phone'],
    bio: ['maxLength:500']
  },

  trading: {
    symbol: ['required', 'selectRequired'],
    quantity: ['required', 'positive', 'integer'],
    orderType: ['required', 'selectRequired'],
    price: ['required', 'positive', 'numeric'],
    stopLoss: ['positive', 'numeric'],
    takeProfit: ['positive', 'numeric']
  },

  workspace: {
    name: ['required', 'maxLength:100'],
    description: ['maxLength:500'],
    symbol: ['required', 'selectRequired'],
    layout: ['required']
  }
};

/**
 * Utility functions for common validation patterns
 */
export const ValidationUtils = {
  /**
   * Create a custom validator
   */
  custom: (validatorFn, message) => {
    return (value) => {
      const result = validatorFn(value);
      if (!result) {
        return message || 'Invalid value';
      }
      return null;
    };
  },

  /**
   * Create a conditional validator
   */
  conditional: (condition, validator) => {
    return (value, formData) => {
      if (condition(formData)) {
        return validator(value, formData);
      }
      return null;
    };
  },

  /**
   * Create an async validator
   */
  async: (asyncValidator) => {
    return async (value, formData) => {
      try {
        const result = await asyncValidator(value, formData);
        return result;
      } catch (error) {
        return error.message || 'Validation failed';
      }
    };
  },

  /**
   * Debounce validation
   */
  debounce: (validator, delay = 300) => {
    let timeoutId;
    return (value, formData) => {
      return new Promise((resolve) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          resolve(validator(value, formData));
        }, delay);
      });
    };
  }
};

export default FormValidator;
