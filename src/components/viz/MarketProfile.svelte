<script>
  import { onMount, onDestroy } from 'svelte';
  
  // Component props
  export let data = []; // Array of price data points
  export let width = 200;
  export let height = 100;
  export let viewMode = 'separate'; // 'separate', 'combinedLeft', 'combinedRight'
  export let opacity = 0.7;
  export let outline = false;
  export let outlineStroke = 1;
  export let outlineUpColor = 'var(--color-bullish, #10b981)';
  export let outlineDownColor = 'var(--color-bearish, #ef4444)';
  export let outlineOpacity = 0.8;
  export let upColor = 'var(--color-bullish, #10b981)';
  export let downColor = 'var(--color-bearish, #ef4444)';
  export let priceBucketMultiplier = 1;
  export let widthRatio = 1.0;
  export let animated = true;
  
  // Canvas and context
  let canvas;
  let ctx;
  let animationFrame;
  
  // Processed data
  let priceBuckets = new Map();
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let maxBucketSize = 0;
  
  // Reactive calculations
  $: processedData = processData(data);
  $: canvasWidth = width * widthRatio;
  
  function processData(rawData) {
    if (!rawData || rawData.length === 0) {
      return { buckets: new Map(), minPrice: 0, maxPrice: 0, maxBucketSize: 0 };
    }
    
    const buckets = new Map();
    let min = Infinity;
    let max = -Infinity;
    let maxBucket = 0;
    
    // Group prices into buckets
    rawData.forEach(point => {
      const price = point.price || point;
      const direction = point.direction || 'neutral';
      const bucketSize = 0.0001 * priceBucketMultiplier; // Adjust bucket size based on multiplier
      const bucketKey = Math.floor(price / bucketSize) * bucketSize;
      
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, { up: 0, down: 0, total: 0 });
      }
      
      const bucket = buckets.get(bucketKey);
      if (direction === 'up') {
        bucket.up++;
      } else if (direction === 'down') {
        bucket.down++;
      }
      bucket.total++;
      
      min = Math.min(min, price);
      max = Math.max(max, price);
      maxBucket = Math.max(maxBucket, bucket.total);
    });
    
    return {
      buckets,
      minPrice: min,
      maxPrice: max,
      maxBucketSize: maxBucket
    };
  }
  
  // Render the market profile
  function render() {
    if (!ctx || !processedData.buckets.size) return;
    
    const { buckets, minPrice, maxPrice, maxBucketSize } = processedData;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, height);
    
    // Calculate price range
    const priceRange = maxPrice - minPrice || 1;
    const bucketHeight = height / buckets.size;
    
    // Set global opacity
    ctx.globalAlpha = opacity;
    
    let y = 0;
    
    // Sort buckets by price (high to low for rendering)
    const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => b[0] - a[0]);
    
    sortedBuckets.forEach(([price, bucket]) => {
      const upWidth = (bucket.up / maxBucketSize) * canvasWidth * 0.5;
      const downWidth = (bucket.down / maxBucketSize) * canvasWidth * 0.5;
      
      if (viewMode === 'separate') {
        // Render up and down separately
        if (bucket.up > 0) {
          ctx.fillStyle = upColor;
          ctx.fillRect(0, y, upWidth, bucketHeight - 1);
        }
        
        if (bucket.down > 0) {
          ctx.fillStyle = downColor;
          ctx.fillRect(canvasWidth - downWidth, y, downWidth, bucketHeight - 1);
        }
      } else if (viewMode === 'combinedLeft') {
        // Render combined on the left
        const totalWidth = (bucket.total / maxBucketSize) * canvasWidth * 0.8;
        ctx.fillStyle = upColor;
        ctx.fillRect(0, y, totalWidth, bucketHeight - 1);
        
        // Overlay down ticks
        if (bucket.down > 0) {
          ctx.fillStyle = downColor;
          ctx.fillRect(0, y, (bucket.down / maxBucketSize) * canvasWidth * 0.8, bucketHeight - 1);
        }
      } else if (viewMode === 'combinedRight') {
        // Render combined on the right
        const totalWidth = (bucket.total / maxBucketSize) * canvasWidth * 0.8;
        ctx.fillStyle = upColor;
        ctx.fillRect(canvasWidth - totalWidth, y, totalWidth, bucketHeight - 1);
        
        // Overlay down ticks
        if (bucket.down > 0) {
          ctx.fillStyle = downColor;
          ctx.fillRect(canvasWidth - (bucket.down / maxBucketSize) * canvasWidth * 0.8, y, (bucket.down / maxBucketSize) * canvasWidth * 0.8, bucketHeight - 1);
        }
      }
      
      y += bucketHeight;
    });
    
    // Draw outline if enabled
    if (outline) {
      drawOutline(sortedBuckets, bucketHeight);
    }
    
    // Reset global alpha
    ctx.globalAlpha = 1;
  }
  
  function drawOutline(sortedBuckets, bucketHeight) {
    ctx.globalAlpha = outlineOpacity;
    ctx.lineWidth = outlineStroke;
    
    let y = 0;
    
    sortedBuckets.forEach(([price, bucket]) => {
      const upWidth = (bucket.up / processedData.maxBucketSize) * canvasWidth * 0.5;
      const downWidth = (bucket.down / processedData.maxBucketSize) * canvasWidth * 0.5;
      
      if (viewMode === 'separate') {
        // Outline up bars
        if (bucket.up > 0) {
          ctx.strokeStyle = outlineUpColor;
          ctx.strokeRect(0, y, upWidth, bucketHeight - 1);
        }
        
        // Outline down bars
        if (bucket.down > 0) {
          ctx.strokeStyle = outlineDownColor;
          ctx.strokeRect(canvasWidth - downWidth, y, downWidth, bucketHeight - 1);
        }
      } else {
        // Combined outline
        const totalWidth = (bucket.total / processedData.maxBucketSize) * canvasWidth * 0.8;
        const startX = viewMode === 'combinedLeft' ? 0 : canvasWidth - totalWidth;
        
        ctx.strokeStyle = outlineUpColor;
        ctx.strokeRect(startX, y, totalWidth, bucketHeight - 1);
      }
      
      y += bucketHeight;
    });
  }
  
  // Animation loop
  function animate() {
    render();
    if (animated) {
      animationFrame = requestAnimationFrame(animate);
    }
  }
  
  // Initialize canvas
  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d');
      canvas.width = canvasWidth;
      canvas.height = height;
      
      // Enable smooth rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      if (animated) {
        animate();
      } else {
        render();
      }
    }
  });
  
  // Update canvas when data changes
  $: if (canvas && processedData.buckets.size > 0) {
    canvas.width = canvasWidth;
    canvas.height = height;
    if (!animated) {
      render();
    }
  }
  
  // Cleanup
  onDestroy(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  });
  
  // Accessibility
  $: ariaLabel = `Market profile showing ${processedData.buckets.size} price levels from ${minPrice.toFixed(5)} to ${maxPrice.toFixed(5)}`;
</script>

<div class="market-profile-container">
  <canvas 
    bind:this={canvas}
    class="market-profile-canvas"
    width={canvasWidth}
    height={height}
    role="img"
    aria-label={ariaLabel}
  />
</div>

<style>
  .market-profile-container {
    position: relative;
    display: inline-block;
  }
  
  .market-profile-canvas {
    display: block;
    border-radius: 2px;
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .market-profile-canvas {
      border: 1px solid currentColor;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .market-profile-container {
      animation: none !important;
    }
  }
  
  /* Print styles */
  @media print {
    .market-profile-canvas {
      filter: contrast(1.2) !important;
    }
  }
</style>
