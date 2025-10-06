/**
 * Multi-format Data Import/Export Utilities for NeuroSense FX
 * Supports JSON, CSV, XML formats with validation and error handling
 */

/**
 * Base Data Import/Export Handler
 */
export class DataImportExport {
  constructor() {
    this.supportedFormats = ['json', 'csv', 'xml'];
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
  }

  /**
   * Import data from file
   */
  async importFromFile(file, format = null) {
    try {
      // Validate file
      this.validateFile(file);
      
      // Detect format if not specified
      const detectedFormat = format || this.detectFormat(file.name);
      
      // Read file content
      const content = await this.readFile(file);
      
      // Parse based on format
      const data = await this.parseContent(content, detectedFormat);
      
      // Validate imported data
      const validation = this.validateImportedData(data, detectedFormat);
      
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      
      return {
        success: true,
        data,
        format: detectedFormat,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          importedAt: new Date(),
          recordCount: this.countRecords(data)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metadata: {
          fileName: file?.name,
          importedAt: new Date()
        }
      };
    }
  }

  /**
   * Export data to file
   */
  async exportToFile(data, format, filename, options = {}) {
    try {
      // Validate format
      if (!this.supportedFormats.includes(format)) {
        throw new Error(`Unsupported format: ${format}`);
      }
      
      // Convert data based on format
      const content = await this.convertToFormat(data, format, options);
      
      // Create blob and download
      const blob = new Blob([content], this.getMimeType(format));
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = this.addExtension(filename, format);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      return {
        success: true,
        format,
        filename: this.addExtension(filename, format),
        metadata: {
          exportedAt: new Date(),
          recordCount: this.countRecords(data),
          fileSize: content.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metadata: {
          format,
          filename,
          exportedAt: new Date()
        }
      };
    }
  }

  /**
   * Validate file before import
   */
  validateFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }
    
    if (file.size > this.maxFileSize) {
      throw new Error(`File size exceeds maximum limit of ${this.maxFileSize / 1024 / 1024}MB`);
    }
    
    const format = this.detectFormat(file.name);
    if (!this.supportedFormats.includes(format)) {
      throw new Error(`Unsupported file format: ${format}`);
    }
  }

  /**
   * Detect file format from filename
   */
  detectFormat(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    return extension;
  }

  /**
   * Read file content
   */
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      reader.readAsText(file);
    });
  }

  /**
   * Parse content based on format
   */
  async parseContent(content, format) {
    switch (format) {
      case 'json':
        return this.parseJSON(content);
      case 'csv':
        return this.parseCSV(content);
      case 'xml':
        return this.parseXML(content);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Parse JSON content
   */
  parseJSON(content) {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
  }

  /**
   * Parse CSV content
   */
  parseCSV(content) {
    try {
      const lines = content.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV must have at least a header and one data row');
      }
      
      const headers = this.parseCSVLine(lines[0]);
      const data = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length === headers.length) {
          const row = {};
          headers.forEach((header, index) => {
            row[header] = this.parseCSVValue(values[index]);
          });
          data.push(row);
        }
      }
      
      return data;
    } catch (error) {
      throw new Error(`Invalid CSV: ${error.message}`);
    }
  }

  /**
   * Parse CSV line handling quoted values
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  /**
   * Parse individual CSV value
   */
  parseCSVValue(value) {
    // Remove quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    
    // Try to parse as number
    if (!isNaN(value) && value !== '') {
      return Number(value);
    }
    
    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Return as string
    return value;
  }

  /**
   * Parse XML content
   */
  parseXML(content) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/xml');
      
      if (doc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('Invalid XML structure');
      }
      
      return this.xmlToObject(doc.documentElement);
    } catch (error) {
      throw new Error(`Invalid XML: ${error.message}`);
    }
  }

  /**
   * Convert XML element to object
   */
  xmlToObject(element) {
    const obj = {};
    
    // Add attributes
    if (element.attributes) {
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        obj[`@${attr.name}`] = attr.value;
      }
    }
    
    // Add child elements
    const children = element.children;
    if (children.length > 0) {
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const childName = child.tagName;
        const childValue = this.xmlToObject(child);
        
        if (obj[childName]) {
          if (!Array.isArray(obj[childName])) {
            obj[childName] = [obj[childName]];
          }
          obj[childName].push(childValue);
        } else {
          obj[childName] = childValue;
        }
      }
    } else {
      // Add text content
      obj.text = element.textContent.trim();
    }
    
    return obj;
  }

  /**
   * Convert data to specified format
   */
  async convertToFormat(data, format, options = {}) {
    switch (format) {
      case 'json':
        return this.toJSON(data, options);
      case 'csv':
        return this.toCSV(data, options);
      case 'xml':
        return this.toXML(data, options);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Convert to JSON
   */
  toJSON(data, options = {}) {
    const { pretty = true, includeMetadata = true } = options;
    
    let exportData = data;
    
    if (includeMetadata) {
      exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0',
          format: 'neurosense-fx'
        },
        data
      };
    }
    
    return JSON.stringify(exportData, null, pretty ? 2 : 0);
  }

  /**
   * Convert to CSV
   */
  toCSV(data, options = {}) {
    const { includeHeaders = true, delimiter = ',' } = options;
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Data must be a non-empty array for CSV export');
    }
    
    // Get headers from first object
    const headers = Object.keys(data[0]);
    const rows = [];
    
    // Add headers if requested
    if (includeHeaders) {
      rows.push(headers.join(delimiter));
    }
    
    // Add data rows
    data.forEach(item => {
      const values = headers.map(header => {
        const value = item[header];
        return this.escapeCSVValue(value);
      });
      rows.push(values.join(delimiter));
    });
    
    return rows.join('\n');
  }

  /**
   * Escape CSV value
   */
  escapeCSVValue(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);
    
    // If value contains comma, quote, or newline, wrap in quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }

  /**
   * Convert to XML
   */
  toXML(data, options = {}) {
    const { rootElement = 'data', includeMetadata = true } = options;
    
    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
    
    if (includeMetadata) {
      xmlContent += '<metadata>\n';
      xmlContent += `  <exportedAt>${new Date().toISOString()}</exportedAt>\n`;
      xmlContent += `  <version>1.0</version>\n`;
      xmlContent += `  <format>neurosense-fx</format>\n`;
      xmlContent += '</metadata>\n';
    }
    
    xmlContent += `<${rootElement}>\n`;
    xmlContent += this.objectToXML(data, 1);
    xmlContent += `</${rootElement}>\n`;
    
    return xmlContent;
  }

  /**
   * Convert object to XML
   */
  objectToXML(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    let xml = '';
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        xml += `${spaces}<item index="${index}">\n`;
        xml += this.objectToXML(item, indent + 1);
        xml += `${spaces}</item>\n`;
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => {
        if (key.startsWith('@')) {
          // Skip attributes, they're handled differently
          return;
        }
        
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
          xml += `${spaces}<${key}>\n`;
          xml += this.objectToXML(value, indent + 1);
          xml += `${spaces}</${key}>\n`;
        } else {
          xml += `${spaces}<${key}>${this.escapeXMLValue(value)}</${key}>\n`;
        }
      });
    } else {
      xml += `${spaces}${this.escapeXMLValue(obj)}\n`;
    }
    
    return xml;
  }

  /**
   * Escape XML value
   */
  escapeXMLValue(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    return String(value)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#39;');
  }

  /**
   * Validate imported data
   */
  validateImportedData(data, format) {
    const errors = [];
    
    if (!data) {
      errors.push('No data found');
      return { isValid: false, errors };
    }
    
    // Format-specific validation
    switch (format) {
      case 'json':
        if (typeof data !== 'object') {
          errors.push('JSON data must be an object or array');
        }
        break;
        
      case 'csv':
        if (!Array.isArray(data)) {
          errors.push('CSV data must be an array');
        } else if (data.length === 0) {
          errors.push('CSV data cannot be empty');
        }
        break;
        
      case 'xml':
        if (typeof data !== 'object') {
          errors.push('XML data must be an object');
        }
        break;
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Count records in data
   */
  countRecords(data) {
    if (Array.isArray(data)) {
      return data.length;
    } else if (typeof data === 'object' && data !== null) {
      return Object.keys(data).length;
    }
    return 1;
  }

  /**
   * Get MIME type for format
   */
  getMimeType(format) {
    const mimeTypes = {
      json: 'application/json',
      csv: 'text/csv',
      xml: 'application/xml'
    };
    
    return mimeTypes[format] || 'text/plain';
  }

  /**
   * Add file extension if not present
   */
  addExtension(filename, format) {
    const extension = `.${format}`;
    return filename.endsWith(extension) ? filename : filename + extension;
  }
}

/**
 * Workspace Configuration Import/Export Handler
 */
export class WorkspaceConfigImportExport extends DataImportExport {
  /**
   * Export workspace configuration
   */
  async exportWorkspace(workspace, format = 'json', options = {}) {
    const config = {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt
      },
      layout: workspace.layout,
      globalSettings: workspace.globalSettings,
      symbolSubscriptions: workspace.symbolSubscriptions,
      visualizationSettings: workspace.visualizationSettings,
      version: '1.0'
    };
    
    const filename = `workspace_${workspace.name.replace(/\s+/g, '_')}_${Date.now()}`;
    return this.exportToFile(config, format, filename, options);
  }

  /**
   * Import workspace configuration
   */
  async importWorkspace(file, format = null) {
    const result = await this.importFromFile(file, format);
    
    if (!result.success) {
      return result;
    }
    
    // Validate workspace structure
    const validation = this.validateWorkspaceConfig(result.data);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Invalid workspace configuration: ${validation.errors.join(', ')}`,
        metadata: result.metadata
      };
    }
    
    return {
      success: true,
      workspaceConfig: result.data,
      metadata: result.metadata
    };
  }

  /**
   * Validate workspace configuration
   */
  validateWorkspaceConfig(config) {
    const errors = [];
    
    if (!config.workspace) {
      errors.push('Missing workspace configuration');
    } else {
      if (!config.workspace.name) {
        errors.push('Workspace name is required');
      }
    }
    
    if (!config.layout) {
      errors.push('Missing layout configuration');
    } else if (!config.layout.canvases) {
      errors.push('Missing canvases configuration');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Indicator Settings Import/Export Handler
 */
export class IndicatorSettingsImportExport extends DataImportExport {
  /**
   * Export indicator settings
   */
  async exportIndicatorSettings(settings, format = 'json', options = {}) {
    const config = {
      indicators: settings,
      version: '1.0',
      exportedAt: new Date().toISOString()
    };
    
    const filename = `indicator_settings_${Date.now()}`;
    return this.exportToFile(config, format, filename, options);
  }

  /**
   * Import indicator settings
   */
  async importIndicatorSettings(file, format = null) {
    const result = await this.importFromFile(file, format);
    
    if (!result.success) {
      return result;
    }
    
    // Validate indicator settings
    const validation = this.validateIndicatorSettings(result.data);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Invalid indicator settings: ${validation.errors.join(', ')}`,
        metadata: result.metadata
      };
    }
    
    return {
      success: true,
      indicatorSettings: result.data.indicators || result.data,
      metadata: result.metadata
    };
  }

  /**
   * Validate indicator settings
   */
  validateIndicatorSettings(settings) {
    const errors = [];
    
    const indicators = settings.indicators || settings;
    
    if (!indicators) {
      errors.push('No indicator settings found');
    } else if (typeof indicators !== 'object') {
      errors.push('Indicator settings must be an object');
    } else {
      // Validate each indicator
      Object.keys(indicators).forEach(indicatorName => {
        const indicator = indicators[indicatorName];
        if (!indicator.type) {
          errors.push(`Indicator ${indicatorName} missing type`);
        }
        if (!indicator.settings) {
          errors.push(`Indicator ${indicatorName} missing settings`);
        }
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Historical Data Import/Export Handler
 */
export class HistoricalDataImportExport extends DataImportExport {
  /**
   * Export historical data
   */
  async exportHistoricalData(data, symbol, format = 'csv', options = {}) {
    const config = {
      symbol,
      data,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    const filename = `historical_data_${symbol}_${Date.now()}`;
    return this.exportToFile(config, format, filename, options);
  }

  /**
   * Import historical data
   */
  async importHistoricalData(file, format = null) {
    const result = await this.importFromFile(file, format);
    
    if (!result.success) {
      return result;
    }
    
    // Validate historical data
    const validation = this.validateHistoricalData(result.data);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Invalid historical data: ${validation.errors.join(', ')}`,
        metadata: result.metadata
      };
    }
    
    return {
      success: true,
      historicalData: result.data.data || result.data,
      symbol: result.data.symbol,
      metadata: result.metadata
    };
  }

  /**
   * Validate historical data
   */
  validateHistoricalData(data) {
    const errors = [];
    
    const historicalData = data.data || data;
    
    if (!Array.isArray(historicalData)) {
      errors.push('Historical data must be an array');
    } else if (historicalData.length === 0) {
      errors.push('Historical data cannot be empty');
    } else {
      // Validate first data point
      const firstPoint = historicalData[0];
      if (!firstPoint.timestamp) {
        errors.push('Data points must have timestamp');
      }
      if (typeof firstPoint.price !== 'number') {
        errors.push('Data points must have numeric price');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export handlers
export {
  DataImportExport,
  WorkspaceConfigImportExport,
  IndicatorSettingsImportExport,
  HistoricalDataImportExport
};
