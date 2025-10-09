/**
 * Advanced Layout Algorithms for NeuroSense FX Workspace
 * Provides intelligent canvas positioning and optimization algorithms
 */

/**
 * Grid-based layout algorithm
 * Arranges canvases in a uniform grid with optimal spacing
 */
export class GridLayout {
  constructor(options = {}) {
    this.columns = options.columns || 4;
    this.rows = options.rows || 3;
    this.gap = options.gap || 10;
    this.padding = options.padding || 20;
    this.containerWidth = options.containerWidth || 1200;
    this.containerHeight = options.containerHeight || 800;
  }

  /**
   * Calculate optimal grid dimensions based on canvas count
   */
  calculateOptimalGrid(canvasCount) {
    const aspectRatio = this.containerWidth / this.containerHeight;
    const minColumns = Math.ceil(Math.sqrt(canvasCount * aspectRatio));
    const minRows = Math.ceil(canvasCount / minColumns);
    
    return {
      columns: Math.max(minColumns, 2),
      rows: Math.max(minRows, 2)
    };
  }

  /**
   * Arrange canvases in a grid layout
   */
  arrangeCanvases(canvases) {
    if (canvases.length === 0) return [];

    const { columns, rows } = this.calculateOptimalGrid(canvases.length);
    const availableWidth = this.containerWidth - (this.padding * 2);
    const availableHeight = this.containerHeight - (this.padding * 2);
    
    const cellWidth = (availableWidth - (columns - 1) * this.gap) / columns;
    const cellHeight = (availableHeight - (rows - 1) * this.gap) / rows;
    
    const arrangedCanvases = canvases.map((canvas, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      
      return {
        ...canvas,
        position: {
          x: this.padding + col * (cellWidth + this.gap),
          y: this.padding + row * (cellHeight + this.gap)
        },
        size: {
          width: cellWidth,
          height: cellHeight
        },
        gridPosition: { row, col }
      };
    });

    return arrangedCanvases;
  }

  /**
   * Optimize grid for canvas importance (larger canvases for important symbols)
   */
  arrangeByImportance(canvases, importanceMap = {}) {
    const sortedCanvases = [...canvases].sort((a, b) => {
      const importanceA = importanceMap[a.symbol] || 0;
      const importanceB = importanceMap[b.symbol] || 0;
      return importanceB - importanceA;
    });

    return this.arrangeCanvases(sortedCanvases);
  }
}

/**
 * Masonry layout algorithm
 * Arranges canvases in a Pinterest-style masonry layout
 */
export class MasonryLayout {
  constructor(options = {}) {
    this.columns = options.columns || 3;
    this.gap = options.gap || 10;
    this.padding = options.padding || 20;
    this.containerWidth = options.containerWidth || 1200;
    this.minCanvasHeight = options.minCanvasHeight || 150;
    this.maxCanvasHeight = options.maxCanvasHeight || 400;
  }

  /**
   * Arrange canvases in masonry layout
   */
  arrangeCanvases(canvases) {
    if (canvases.length === 0) return [];

    const columnWidth = (this.containerWidth - this.padding * 2 - (this.columns - 1) * this.gap) / this.columns;
    const columns = Array(this.columns).fill(0).map(() => ({
      height: this.padding,
      canvases: []
    }));

    // Calculate canvas heights based on content/indicators
    const canvasesWithHeight = canvases.map(canvas => ({
      ...canvas,
      height: this.calculateCanvasHeight(canvas)
    }));

    // Distribute canvases to columns
    canvasesWithHeight.forEach(canvas => {
      const shortestColumn = columns.reduce((min, col) => 
        col.height < min.height ? col : min
      );

      canvas.position = {
        x: this.padding + columns.indexOf(shortestColumn) * (columnWidth + this.gap),
        y: shortestColumn.height
      };
      canvas.size = {
        width: columnWidth,
        height: canvas.height
      };

      shortestColumn.canvases.push(canvas);
      shortestColumn.height += canvas.height + this.gap;
    });

    return columns.flatMap(col => col.canvases);
  }

  /**
   * Calculate canvas height based on indicators and content
   */
  calculateCanvasHeight(canvas) {
    const baseHeight = this.minCanvasHeight;
    const indicatorHeight = 30; // Height per indicator
    const indicatorCount = canvas.indicators?.length || 1;
    
    let height = baseHeight + (indicatorCount - 1) * indicatorHeight;
    
    // Add height for complex indicators
    if (canvas.indicators?.includes('marketProfile')) {
      height += 50;
    }
    if (canvas.indicators?.includes('volatilityOrb')) {
      height += 30;
    }

    return Math.min(Math.max(height, this.minCanvasHeight), this.maxCanvasHeight);
  }
}

/**
 * Circular layout algorithm
 * Arranges canvases in a circular pattern
 */
export class CircularLayout {
  constructor(options = {}) {
    this.centerX = options.centerX || 600;
    this.centerY = options.centerY || 400;
    this.radius = options.radius || 300;
    this.startAngle = options.startAngle || 0;
    this.clockwise = options.clockwise !== false;
    this.canvasSize = options.canvasSize || { width: 200, height: 150 };
  }

  /**
   * Arrange canvases in a circular pattern
   */
  arrangeCanvases(canvases) {
    if (canvases.length === 0) return [];

    const angleStep = (2 * Math.PI) / canvases.length;
    const arrangedCanvases = canvases.map((canvas, index) => {
      const angle = this.startAngle + (index * angleStep * (this.clockwise ? 1 : -1));
      
      return {
        ...canvas,
        position: {
          x: this.centerX + Math.cos(angle) * this.radius - this.canvasSize.width / 2,
          y: this.centerY + Math.sin(angle) * this.radius - this.canvasSize.height / 2
        },
        size: { ...this.canvasSize },
        angle: angle
      };
    });

    return arrangedCanvases;
  }

  /**
   * Arrange canvases in concentric circles
   */
  arrangeInConcentricCircles(canvases, rings = 3) {
    if (canvases.length === 0) return [];

    const canvasesPerRing = Math.ceil(canvases.length / rings);
    const arrangedCanvases = [];

    for (let ring = 0; ring < rings; ring++) {
      const ringCanvases = canvases.slice(ring * canvasesPerRing, (ring + 1) * canvasesPerRing);
      const ringRadius = this.radius * ((ring + 1) / rings);
      
      const angleStep = (2 * Math.PI) / ringCanvases.length;
      const ringLayout = new CircularLayout({
        ...this,
        radius: ringRadius,
        canvasSize: {
          width: this.canvasSize.width * (1 - ring * 0.2),
          height: this.canvasSize.height * (1 - ring * 0.2)
        }
      });

      arrangedCanvases.push(...ringLayout.arrangeCanvases(ringCanvases));
    }

    return arrangedCanvases;
  }
}

/**
 * Spiral layout algorithm
 * Arranges canvases in a spiral pattern
 */
export class SpiralLayout {
  constructor(options = {}) {
    this.centerX = options.centerX || 600;
    this.centerY = options.centerY || 400;
    this.initialRadius = options.initialRadius || 50;
    this.radiusGrowth = options.radiusGrowth || 30;
    this.angleStep = options.angleStep || 0.5;
    this.canvasSize = options.canvasSize || { width: 180, height: 120 };
  }

  /**
   * Arrange canvases in a spiral pattern
   */
  arrangeCanvases(canvases) {
    if (canvases.length === 0) return [];

    return canvases.map((canvas, index) => {
      const angle = index * this.angleStep;
      const radius = this.initialRadius + (index * this.radiusGrowth);
      
      return {
        ...canvas,
        position: {
          x: this.centerX + Math.cos(angle) * radius - this.canvasSize.width / 2,
          y: this.centerY + Math.sin(angle) * radius - this.canvasSize.height / 2
        },
        size: { ...this.canvasSize },
        angle: angle,
        radius: radius
      };
    });
  }
}

/**
 * Force-directed layout algorithm
 * Uses physics simulation to arrange canvases
 */
export class ForceDirectedLayout {
  constructor(options = {}) {
    this.width = options.width || 1200;
    this.height = options.height || 800;
    this.repulsionForce = options.repulsionForce || 5000;
    this.attractionForce = options.attractionForce || 0.001;
    this.damping = options.damping || 0.9;
    this.maxIterations = options.maxIterations || 100;
    this.canvasSize = options.canvasSize || { width: 200, height: 150 };
  }

  /**
   * Arrange canvases using force-directed algorithm
   */
  arrangeCanvases(canvases) {
    if (canvases.length === 0) return [];

    // Initialize random positions
    const nodes = canvases.map(canvas => ({
      ...canvas,
      x: Math.random() * (this.width - this.canvasSize.width),
      y: Math.random() * (this.height - this.canvasSize.height),
      vx: 0,
      vy: 0,
      size: { ...this.canvasSize }
    }));

    // Create relationships based on symbol similarity
    const relationships = this.createRelationships(canvases);

    // Run simulation
    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      // Apply forces
      this.applyRepulsionForces(nodes);
      this.applyAttractionForces(nodes, relationships);
      
      // Update positions
      nodes.forEach(node => {
        node.vx *= this.damping;
        node.vy *= this.damping;
        
        node.x += node.vx;
        node.y += node.vy;
        
        // Keep within bounds
        node.x = Math.max(0, Math.min(this.width - node.size.width, node.x));
        node.y = Math.max(0, Math.min(this.height - node.size.height, node.y));
      });
    }

    // Convert to final format
    return nodes.map(node => ({
      ...node,
      position: { x: node.x, y: node.y },
      size: node.size
    }));
  }

  /**
   * Create relationships between canvases based on symbol similarity
   */
  createRelationships(canvases) {
    const relationships = [];
    
    for (let i = 0; i < canvases.length; i++) {
      for (let j = i + 1; j < canvases.length; j++) {
        const similarity = this.calculateSymbolSimilarity(canvases[i].symbol, canvases[j].symbol);
        if (similarity > 0.3) {
          relationships.push({
            source: i,
            target: j,
            strength: similarity
          });
        }
      }
    }
    
    return relationships;
  }

  /**
   * Calculate similarity between two symbols
   */
  calculateSymbolSimilarity(symbol1, symbol2) {
    // Simple similarity based on base currency
    const base1 = symbol1.slice(0, 3);
    const base2 = symbol2.slice(0, 3);
    
    if (base1 === base2) return 0.8;
    
    // Check for any common characters
    const commonChars = symbol1.split('').filter(char => symbol2.includes(char)).length;
    return commonChars / Math.max(symbol1.length, symbol2.length);
  }

  /**
   * Apply repulsion forces between all nodes
   */
  applyRepulsionForces(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0 && distance < 200) {
          const force = this.repulsionForce / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }
    }
  }

  /**
   * Apply attraction forces between related nodes
   */
  applyAttractionForces(nodes, relationships) {
    relationships.forEach(rel => {
      const source = nodes[rel.source];
      const target = nodes[rel.target];
      
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        const force = distance * this.attractionForce * rel.strength;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }
    });
  }
}

/**
 * Adaptive layout algorithm
 * Automatically chooses the best layout based on canvas count and characteristics
 */
export class AdaptiveLayout {
  constructor(options = {}) {
    this.containerWidth = options.containerWidth || 1200;
    this.containerHeight = options.containerHeight || 800;
    this.algorithms = {
      grid: new GridLayout(options),
      masonry: new MasonryLayout(options),
      circular: new CircularLayout(options),
      spiral: new SpiralLayout(options),
      forceDirected: new ForceDirectedLayout(options)
    };
  }

  /**
   * Automatically choose and apply the best layout
   */
  arrangeCanvases(canvases) {
    if (canvases.length === 0) return [];

    const algorithm = this.selectBestAlgorithm(canvases);
    return algorithm.arrangeCanvases(canvases);
  }

  /**
   * Select the best algorithm based on canvas characteristics
   */
  selectBestAlgorithm(canvases) {
    const count = canvases.length;
    const hasVariedSizes = this.hasVariedCanvasSizes(canvases);
    const hasRelatedSymbols = this.hasRelatedSymbols(canvases);

    if (count <= 3) {
      return this.algorithms.circular;
    } else if (count <= 6 && hasRelatedSymbols) {
      return this.algorithms.forceDirected;
    } else if (hasVariedSizes) {
      return this.algorithms.masonry;
    } else if (count <= 8) {
      return this.algorithms.spiral;
    } else {
      return this.algorithms.grid;
    }
  }

  /**
   * Check if canvases have varied sizes
   */
  hasVariedCanvasSizes(canvases) {
    const indicatorCounts = canvases.map(c => c.indicators?.length || 0);
    const minCount = Math.min(...indicatorCounts);
    const maxCount = Math.max(...indicatorCounts);
    return maxCount - minCount > 2;
  }

  /**
   * Check if symbols are related
   */
  hasRelatedSymbols(canvases) {
    const forceLayout = new ForceDirectedLayout();
    const relationships = forceLayout.createRelationships(canvases);
    return relationships.length > 0;
  }
}

/**
 * Layout optimizer
 * Provides utilities for optimizing existing layouts
 */
export class LayoutOptimizer {
  /**
   * Optimize layout to minimize overlaps and maximize space usage
   */
  static optimizeLayout(canvases, containerBounds) {
    const optimized = [...canvases];
    
    // Remove overlaps
    this.removeOverlaps(optimized);
    
    // Align to grid
    this.alignToGrid(optimized, 10);
    
    // Ensure within bounds
    this.ensureWithinBounds(optimized, containerBounds);
    
    return optimized;
  }

  /**
   * Remove overlapping canvases
   */
  static removeOverlaps(canvases) {
    for (let i = 0; i < canvases.length; i++) {
      for (let j = i + 1; j < canvases.length; j++) {
        const canvas1 = canvases[i];
        const canvas2 = canvases[j];
        
        if (this.isOverlapping(canvas1, canvas2)) {
          this.separateCanvases(canvas1, canvas2);
        }
      }
    }
  }

  /**
   * Check if two canvases are overlapping
   */
  static isOverlapping(canvas1, canvas2) {
    return !(canvas1.position.x + canvas1.size.width <= canvas2.position.x ||
             canvas2.position.x + canvas2.size.width <= canvas1.position.x ||
             canvas1.position.y + canvas1.size.height <= canvas2.position.y ||
             canvas2.position.y + canvas2.size.height <= canvas1.position.y);
  }

  /**
   * Separate overlapping canvases
   */
  static separateCanvases(canvas1, canvas2) {
    const centerX1 = canvas1.position.x + canvas1.size.width / 2;
    const centerY1 = canvas1.position.y + canvas1.size.height / 2;
    const centerX2 = canvas2.position.x + canvas2.size.width / 2;
    const centerY2 = canvas2.position.y + canvas2.size.height / 2;
    
    const dx = centerX2 - centerX1;
    const dy = centerY2 - centerY1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      const separationX = (dx / distance) * 10;
      const separationY = (dy / distance) * 10;
      
      canvas1.position.x -= separationX;
      canvas1.position.y -= separationY;
      canvas2.position.x += separationX;
      canvas2.position.y += separationY;
    }
  }

  /**
   * Align canvases to grid
   */
  static alignToGrid(canvases, gridSize) {
    canvases.forEach(canvas => {
      canvas.position.x = Math.round(canvas.position.x / gridSize) * gridSize;
      canvas.position.y = Math.round(canvas.position.y / gridSize) * gridSize;
    });
  }

  /**
   * Ensure canvases are within container bounds
   */
  static ensureWithinBounds(canvases, containerBounds) {
    canvases.forEach(canvas => {
      canvas.position.x = Math.max(0, Math.min(containerBounds.width - canvas.size.width, canvas.position.x));
      canvas.position.y = Math.max(0, Math.min(containerBounds.height - canvas.size.height, canvas.position.y));
    });
  }
}

// Export all layout algorithms
export {
  GridLayout,
  MasonryLayout,
  CircularLayout,
  SpiralLayout,
  ForceDirectedLayout,
  AdaptiveLayout,
  LayoutOptimizer
};
