/**
 * Animation Engine for NeuroSense FX
 * Provides smooth animations, transitions, and micro-interactions
 */

/**
 * Base Animation Controller
 */
export class AnimationController {
  constructor() {
    this.animations = new Map();
    this.globalSpeed = 1.0;
    this.isRunning = true;
    this.lastFrameTime = 0;
    this.frameId = null;
  }

  /**
   * Start the animation loop
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.tick();
  }

  /**
   * Stop the animation loop
   */
  stop() {
    this.isRunning = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  /**
   * Main animation loop
   */
  tick = () => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = currentTime;

    // Update all animations
    for (const [id, animation] of this.animations) {
      if (animation.isRunning) {
        animation.update(deltaTime * this.globalSpeed);
      }
    }

    // Clean up completed animations
    for (const [id, animation] of this.animations) {
      if (animation.isCompleted && !animation.persistent) {
        this.animations.delete(id);
      }
    }

    this.frameId = requestAnimationFrame(this.tick);
  }

  /**
   * Add an animation
   */
  addAnimation(animation) {
    const id = this.generateId();
    this.animations.set(id, animation);
    return id;
  }

  /**
   * Remove an animation
   */
  removeAnimation(id) {
    this.animations.delete(id);
  }

  /**
   * Set global animation speed
   */
  setGlobalSpeed(speed) {
    this.globalSpeed = Math.max(0, speed);
  }

  /**
   * Generate unique animation ID
   */
  generateId() {
    return `anim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Base Animation Class
 */
export class Animation {
  constructor(options = {}) {
    this.duration = options.duration || 1.0; // seconds
    this.easing = options.easing || 'easeOutQuad';
    this.delay = options.delay || 0;
    this.loop = options.loop || false;
    this.reverse = options.reverse || false;
    this.persistent = options.persistent || false;
    this.onStart = options.onStart || null;
    this.onUpdate = options.onUpdate || null;
    this.onComplete = options.onComplete || null;
    
    this.currentTime = 0;
    this.isRunning = false;
    this.isCompleted = false;
    this.isReversed = false;
  }

  /**
   * Start the animation
   */
  start() {
    this.currentTime = 0;
    this.isRunning = true;
    this.isCompleted = false;
    this.isReversed = false;
    
    if (this.onStart) {
      this.onStart(this);
    }
  }

  /**
   * Update animation state
   */
  update(deltaTime) {
    if (!this.isRunning || this.isCompleted) return;

    // Handle delay
    if (this.currentTime < this.delay) {
      this.currentTime += deltaTime;
      return;
    }

    // Calculate progress
    const adjustedTime = this.currentTime - this.delay;
    const progress = Math.min(adjustedTime / this.duration, 1);
    
    // Apply easing
    const easedProgress = this.applyEasing(progress);
    
    // Update animation
    this.onUpdate(easedProgress, this);
    
    // Check completion
    if (progress >= 1) {
      this.handleCompletion();
    }
    
    this.currentTime += deltaTime;
  }

  /**
   * Handle animation completion
   */
  handleCompletion() {
    if (this.loop) {
      this.currentTime = this.delay;
      if (this.reverse) {
        this.isReversed = !this.isReversed;
      }
    } else {
      this.isCompleted = true;
      this.isRunning = false;
      
      if (this.onComplete) {
        this.onComplete(this);
      }
    }
  }

  /**
   * Apply easing function
   */
  applyEasing(t) {
    const easingFunctions = {
      linear: t => t,
      easeInQuad: t => t * t,
      easeOutQuad: t => t * (2 - t),
      easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
      easeInCubic: t => t * t * t,
      easeOutCubic: t => (--t) * t * t + 1,
      easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
      easeInQuart: t => t * t * t * t,
      easeOutQuart: t => 1 - (--t) * t * t * t,
      easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
      easeInBack: t => t * t * (2.7 * t - 1.7),
      easeOutBack: t => 1 + (--t) * t * (2.7 * t + 1.7),
      easeOutBounce: t => {
        if (t < 1/2.75) {
          return 7.5625 * t * t;
        } else if (t < 2/2.75) {
          t -= 1.5/2.75;
          return 7.5625 * t * t + 0.75;
        } else if (t < 2.5/2.75) {
          t -= 2.25/2.75;
          return 7.5625 * t * t + 0.9375;
        } else {
          t -= 2.625/2.75;
          return 7.5625 * t * t + 0.984375;
        }
      }
    };

    const easingFn = easingFunctions[this.easing] || easingFunctions.easeOutQuad;
    return this.isReversed ? 1 - easingFn(1 - t) : easingFn(t);
  }

  /**
   * Stop the animation
   */
  stop() {
    this.isRunning = false;
  }

  /**
   * Reset the animation
   */
  reset() {
    this.currentTime = 0;
    this.isRunning = false;
    this.isCompleted = false;
    this.isReversed = false;
  }
}

/**
 * Property Animation
 */
export class PropertyAnimation extends Animation {
  constructor(target, properties, options = {}) {
    super(options);
    this.target = target;
    this.properties = properties;
    this.startValues = {};
    this.endValues = {};
    
    // Store start and end values
    Object.keys(properties).forEach(prop => {
      this.startValues[prop] = target[prop];
      this.endValues[prop] = properties[prop];
    });
  }

  onUpdate(progress) {
    super.onUpdate(progress);
    
    Object.keys(this.properties).forEach(prop => {
      const start = this.startValues[prop];
      const end = this.endValues[prop];
      
      if (typeof start === 'number' && typeof end === 'number') {
        this.target[prop] = start + (end - start) * progress;
      } else if (typeof start === 'string' && typeof end === 'string') {
        // Handle color interpolation
        if (this.isColor(start) && this.isColor(end)) {
          this.target[prop] = this.interpolateColor(start, end, progress);
        }
      }
    });
  }

  isColor(str) {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(str) || 
           /^rgb\(/.test(str) || 
           /^rgba\(/.test(str);
  }

  interpolateColor(start, end, progress) {
    // Simple hex color interpolation
    const startHex = start.replace('#', '');
    const endHex = end.replace('#', '');
    
    const startR = parseInt(startHex.substr(0, 2), 16);
    const startG = parseInt(startHex.substr(2, 2), 16);
    const startB = parseInt(startHex.substr(4, 2), 16);
    
    const endR = parseInt(endHex.substr(0, 2), 16);
    const endG = parseInt(endHex.substr(2, 2), 16);
    const endB = parseInt(endHex.substr(4, 2), 16);
    
    const r = Math.round(startR + (endR - startR) * progress);
    const g = Math.round(startG + (endG - startG) * progress);
    const b = Math.round(startB + (endB - startB) * progress);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
}

/**
 * Canvas Animation
 */
export class CanvasAnimation extends Animation {
  constructor(canvas, drawFunction, options = {}) {
    super(options);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.drawFunction = drawFunction;
    this.clearCanvas = options.clearCanvas !== false;
  }

  onUpdate(progress) {
    super.onUpdate(progress);
    
    if (this.clearCanvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    this.drawFunction(this.ctx, progress, this);
  }
}

/**
 * Micro-interactions Manager
 */
export class MicroInteractions {
  constructor() {
    this.interactions = new Map();
    this.animationController = new AnimationController();
    this.animationController.start();
  }

  /**
   * Register a hover interaction
   */
  registerHover(element, options = {}) {
    const config = {
      scale: options.scale || 1.05,
      duration: options.duration || 0.2,
      easing: options.easing || 'easeOutQuad',
      shadow: options.shadow || '0 4px 12px rgba(0, 0, 0, 0.15)',
      ...options
    };

    let enterAnimation = null;
    let leaveAnimation = null;

    const handleMouseEnter = () => {
      if (leaveAnimation) {
        this.animationController.removeAnimation(leaveAnimation);
        leaveAnimation = null;
      }

      const startTransform = element.style.transform || '';
      const startBoxShadow = element.style.boxShadow || '';

      enterAnimation = new PropertyAnimation(element.style, {
        transform: startTransform + ` scale(${config.scale})`,
        boxShadow: config.shadow
      }, {
        duration: config.duration,
        easing: config.easing
      });

      leaveAnimation = this.animationController.addAnimation(enterAnimation);
    };

    const handleMouseLeave = () => {
      if (enterAnimation) {
        this.animationController.removeAnimation(enterAnimation);
        enterAnimation = null;
      }

      leaveAnimation = new PropertyAnimation(element.style, {
        transform: element.style.transform.replace(/scale\([^)]*\)/, ''),
        boxShadow: element.style.boxShadow.replace(config.shadow, '')
      }, {
        duration: config.duration,
        easing: config.easing
      });

      leaveAnimation = this.animationController.addAnimation(leaveAnimation);
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    const interactionId = this.generateId();
    this.interactions.set(interactionId, {
      element,
      handlers: { handleMouseEnter, handleMouseLeave }
    });

    return interactionId;
  }

  /**
   * Register a click interaction
   */
  registerClick(element, options = {}) {
    const config = {
      scale: options.scale || 0.95,
      duration: options.duration || 0.1,
      easing: options.easing || 'easeOutQuad',
      ...options
    };

    const handleClick = (e) => {
      const startTransform = element.style.transform || '';

      const pressAnimation = new PropertyAnimation(element.style, {
        transform: startTransform + ` scale(${config.scale})`
      }, {
        duration: config.duration,
        easing: config.easing,
        onComplete: () => {
          const releaseAnimation = new PropertyAnimation(element.style, {
            transform: startTransform
          }, {
            duration: config.duration,
            easing: config.easing
          });
          this.animationController.addAnimation(releaseAnimation);
        }
      });

      this.animationController.addAnimation(pressAnimation);
    };

    element.addEventListener('click', handleClick);

    const interactionId = this.generateId();
    this.interactions.set(interactionId, {
      element,
      handlers: { handleClick }
    });

    return interactionId;
  }

  /**
   * Register a focus interaction
   */
  registerFocus(element, options = {}) {
    const config = {
      borderColor: options.borderColor || '#3b82f6',
      shadow: options.shadow || '0 0 0 3px rgba(59, 130, 246, 0.1)',
      duration: options.duration || 0.2,
      easing: options.easing || 'easeOutQuad',
      ...options
    };

    const startBorderColor = element.style.borderColor || '';
    const startBoxShadow = element.style.boxShadow || '';

    const handleFocus = () => {
      const focusAnimation = new PropertyAnimation(element.style, {
        borderColor: config.borderColor,
        boxShadow: config.shadow
      }, {
        duration: config.duration,
        easing: config.easing
      });

      this.animationController.addAnimation(focusAnimation);
    };

    const handleBlur = () => {
      const blurAnimation = new PropertyAnimation(element.style, {
        borderColor: startBorderColor,
        boxShadow: startBoxShadow
      }, {
        duration: config.duration,
        easing: config.easing
      });

      this.animationController.addAnimation(blurAnimation);
    };

    element.addEventListener('focus', handleFocus);
    element.addEventListener('blur', handleBlur);

    const interactionId = this.generateId();
    this.interactions.set(interactionId, {
      element,
      handlers: { handleFocus, handleBlur }
    });

    return interactionId;
  }

  /**
   * Remove an interaction
   */
  removeInteraction(interactionId) {
    const interaction = this.interactions.get(interactionId);
    if (!interaction) return;

    const { element, handlers } = interaction;

    // Remove event listeners
    Object.values(handlers).forEach(handler => {
      element.removeEventListener('click', handler);
      element.removeEventListener('mouseenter', handler);
      element.removeEventListener('mouseleave', handler);
      element.removeEventListener('focus', handler);
      element.removeEventListener('blur', handler);
    });

    this.interactions.delete(interactionId);
  }

  /**
   * Generate unique interaction ID
   */
  generateId() {
    return `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Transition Manager
 */
export class TransitionManager {
  constructor() {
    this.transitions = new Map();
    this.animationController = new AnimationController();
    this.animationController.start();
  }

  /**
   * Fade in an element
   */
  fadeIn(element, options = {}) {
    const config = {
      duration: options.duration || 0.3,
      easing: options.easing || 'easeOutQuad',
      delay: options.delay || 0,
      ...options
    };

    element.style.opacity = '0';
    element.style.display = '';

    const fadeInAnimation = new PropertyAnimation(element.style, {
      opacity: 1
    }, config);

    return this.animationController.addAnimation(fadeInAnimation);
  }

  /**
   * Fade out an element
   */
  fadeOut(element, options = {}) {
    const config = {
      duration: options.duration || 0.3,
      easing: options.easing || 'easeOutQuad',
      delay: options.delay || 0,
      ...options
    };

    const fadeOutAnimation = new PropertyAnimation(element.style, {
      opacity: 0
    }, {
      ...config,
      onComplete: () => {
        element.style.display = 'none';
        if (config.onComplete) config.onComplete();
      }
    });

    return this.animationController.addAnimation(fadeOutAnimation);
  }

  /**
   * Slide an element
   */
  slide(element, direction, options = {}) {
    const config = {
      duration: options.duration || 0.3,
      easing: options.easing || 'easeOutQuad',
      distance: options.distance || 20,
      ...options
    };

    const transforms = {
      up: `translateY(-${config.distance}px)`,
      down: `translateY(${config.distance}px)`,
      left: `translateX(-${config.distance}px)`,
      right: `translateX(${config.distance}px)`
    };

    const startTransform = element.style.transform || '';
    const targetTransform = transforms[direction];

    if (options.reverse) {
      element.style.transform = startTransform + ' ' + targetTransform;
      
      const slideAnimation = new PropertyAnimation(element.style, {
        transform: startTransform
      }, config);

      return this.animationController.addAnimation(slideAnimation);
    } else {
      const slideAnimation = new PropertyAnimation(element.style, {
        transform: startTransform + ' ' + targetTransform
      }, config);

      return this.animationController.addAnimation(slideAnimation);
    }
  }

  /**
   * Scale an element
   */
  scale(element, targetScale, options = {}) {
    const config = {
      duration: options.duration || 0.3,
      easing: options.easing || 'easeOutQuad',
      ...options
    };

    const scaleAnimation = new PropertyAnimation(element.style, {
      transform: `scale(${targetScale})`
    }, config);

    return this.animationController.addAnimation(scaleAnimation);
  }

  /**
   * Rotate an element
   */
  rotate(element, angle, options = {}) {
    const config = {
      duration: options.duration || 0.3,
      easing: options.easing || 'easeOutQuad',
      ...options
    };

    const rotateAnimation = new PropertyAnimation(element.style, {
      transform: `rotate(${angle}deg)`
    }, config);

    return this.animationController.addAnimation(rotateAnimation);
  }
}

/**
 * Loading Animation Manager
 */
export class LoadingAnimations {
  constructor() {
    this.animationController = new AnimationController();
    this.animationController.start();
  }

  /**
   * Create a spinner animation
   */
  createSpinner(element, options = {}) {
    const config = {
      duration: options.duration || 1,
      easing: options.easing || 'linear',
      loop: true,
      ...options
    };

    let currentRotation = 0;

    const spinnerAnimation = new Animation({
      ...config,
      onUpdate: (progress) => {
        currentRotation += 360 * progress;
        element.style.transform = `rotate(${currentRotation}deg)`;
      }
    });

    return this.animationController.addAnimation(spinnerAnimation);
  }

  /**
   * Create a pulse animation
   */
  createPulse(element, options = {}) {
    const config = {
      duration: options.duration || 1.5,
      easing: options.easing || 'easeInOutQuad',
      loop: true,
      scale: options.scale || 1.1,
      ...options
    };

    const pulseAnimation = new Animation({
      ...config,
      onUpdate: (progress) => {
        const scale = 1 + (config.scale - 1) * Math.sin(progress * Math.PI * 2);
        element.style.transform = `scale(${scale})`;
      }
    });

    return this.animationController.addAnimation(pulseAnimation);
  }

  /**
   * Create a progress bar animation
   */
  createProgress(element, targetProgress, options = {}) {
    const config = {
      duration: options.duration || 1,
      easing: options.easing || 'easeOutQuad',
      ...options
    };

    const startWidth = parseFloat(element.style.width) || 0;
    const targetWidth = targetProgress;

    const progressAnimation = new PropertyAnimation(element.style, {
      width: `${targetWidth}%`
    }, {
      ...config,
      onUpdate: (progress) => {
        const currentWidth = startWidth + (targetWidth - startWidth) * progress;
        element.style.width = `${currentWidth}%`;
        
        if (options.onProgress) {
          options.onProgress(currentWidth);
        }
      }
    });

    return this.animationController.addAnimation(progressAnimation);
  }
}

/**
 * Gesture Animation Manager
 */
export class GestureAnimations {
  constructor() {
    this.animationController = new AnimationController();
    this.animationController.start();
    this.gestures = new Map();
  }

  /**
   * Register swipe animation
   */
  registerSwipe(element, options = {}) {
    const config = {
      threshold: options.threshold || 50,
      duration: options.duration || 0.3,
      easing: options.easing || 'easeOutQuad',
      onSwipeLeft: options.onSwipeLeft || null,
      onSwipeRight: options.onSwipeRight || null,
      onSwipeUp: options.onSwipeUp || null,
      onSwipeDown: options.onSwipeDown || null,
      ...options
    };

    let startX = 0;
    let startY = 0;
    let isDragging = false;

    const handleStart = (e) => {
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      isDragging = true;
    };

    const handleMove = (e) => {
      if (!isDragging) return;

      const currentX = e.touches ? e.touches[0].clientX : e.clientX;
      const currentY = e.touches ? e.touches[0].clientY : e.clientY;
      
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      // Apply visual feedback
      element.style.transform = `translate(${deltaX * 0.3}px, ${deltaY * 0.3}px)`;
    };

    const handleEnd = (e) => {
      if (!isDragging) return;

      const currentX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const currentY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      // Reset position
      const resetAnimation = new PropertyAnimation(element.style, {
        transform: 'translate(0, 0)'
      }, {
        duration: config.duration,
        easing: config.easing
      });

      this.animationController.addAnimation(resetAnimation);

      // Check swipe threshold
      if (Math.abs(deltaX) > config.threshold) {
        if (deltaX > 0 && config.onSwipeRight) {
          config.onSwipeRight(deltaX);
        } else if (deltaX < 0 && config.onSwipeLeft) {
          config.onSwipeLeft(deltaX);
        }
      }

      if (Math.abs(deltaY) > config.threshold) {
        if (deltaY > 0 && config.onSwipeDown) {
          config.onSwipeDown(deltaY);
        } else if (deltaY < 0 && config.onSwipeUp) {
          config.onSwipeUp(deltaY);
        }
      }

      isDragging = false;
    };

    // Add event listeners
    element.addEventListener('touchstart', handleStart);
    element.addEventListener('touchmove', handleMove);
    element.addEventListener('touchend', handleEnd);
    element.addEventListener('mousedown', handleStart);
    element.addEventListener('mousemove', handleMove);
    element.addEventListener('mouseup', handleEnd);

    const gestureId = this.generateId();
    this.gestures.set(gestureId, {
      element,
      handlers: { handleStart, handleMove, handleEnd }
    });

    return gestureId;
  }

  /**
   * Register pinch-to-zoom animation
   */
  registerPinch(element, options = {}) {
    const config = {
      minScale: options.minScale || 0.5,
      maxScale: options.maxScale || 3,
      duration: options.duration || 0.1,
      easing: options.easing || 'easeOutQuad',
      onPinch: options.onPinch || null,
      ...options
    };

    let initialDistance = 0;
    let currentScale = 1;

    const getDistance = (touches) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches);
        currentScale = parseFloat(element.style.transform.match(/scale\(([^)]+)\)/)?.[1] || 1);
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        
        const currentDistance = getDistance(e.touches);
        const scale = currentScale * (currentDistance / initialDistance);
        const clampedScale = Math.max(config.minScale, Math.min(config.maxScale, scale));

        const scaleAnimation = new PropertyAnimation(element.style, {
          transform: `scale(${clampedScale})`
        }, {
          duration: config.duration,
          easing: config.easing
        });

        this.animationController.addAnimation(scaleAnimation);

        if (config.onPinch) {
          config.onPinch(clampedScale);
        }
      }
    };

    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchmove', handleTouchMove);

    const gestureId = this.generateId();
    this.gestures.set(gestureId, {
      element,
      handlers: { handleTouchStart, handleTouchMove }
    });

    return gestureId;
  }

  /**
   * Remove a gesture
   */
  removeGesture(gestureId) {
    const gesture = this.gestures.get(gestureId);
    if (!gesture) return;

    const { element, handlers } = gesture;

    // Remove event listeners
    Object.values(handlers).forEach(handler => {
      element.removeEventListener('touchstart', handler);
      element.removeEventListener('touchmove', handler);
      element.removeEventListener('touchend', handler);
      element.removeEventListener('mousedown', handler);
      element.removeEventListener('mousemove', handler);
      element.removeEventListener('mouseup', handler);
    });

    this.gestures.delete(gestureId);
  }

  /**
   * Generate unique gesture ID
   */
  generateId() {
    return `gesture_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export all animation classes
export {
  AnimationController,
  Animation,
  PropertyAnimation,
  CanvasAnimation,
  MicroInteractions,
  TransitionManager,
  LoadingAnimations,
  GestureAnimations
};
