# Volatility Orb Design Specification

## Executive Summary

Volatility visualisation delivering real-time market volatility assessment through multi-mode rendering, and cognitive-aware design.

Seamless integration with UnifiedVisualisation foundation patterns while maintaining volatility orb’s role as a perceptual background element that supports trader decision-making through intuitive volatility visualization without cognitive overhead.

## 1. Foundation Architecture: UnifiedVisualization Integration

### UnifiedVisualization Base Class Implementation

Foundation Pattern Inheritance:

// Standard UnifiedVisualization pattern usage
export const drawVolatilityOrb = createVisualization('VolatilityOrb', volatilityOrbImplementation);
Core Foundation Methods Leveraged:

validateRenderData(): Safety checks + percentage conversion + bounds validation

drawCore(): Main orb rendering with DPR-aware transformations

addEnhancements(): Bounds-checked enhancements (flash, metrics, ambient effects)

processVolatilityData(): Worker data processing with comprehensive validation

### DPR-Aware Rendering Implementation

// UnifiedVisualization provides crisp rendering across all device densities
ctx.save();
ctx.translate(0.5, 0.5); // Crisp text rendering
ctx.imageSmoothingEnabled = false; // Sharp pixel alignment
// … rendering operations
ctx.restore(); // UnifiedVisualization handles restoration
### Performance Optimization Patterns

Pre-calculation: All positions and dimensions calculated once per frame

Early Exit Validation: Skip rendering when disabled or data invalid

Selective Enhancement: Core always renders, enhancements have bounds checking

Object Reuse: Minimal allocation in render loops for 60fps performance

## 2. Cognitive-Aware User Experience Architecture

### Core Design Principles Embedded

#### Perceptual Processing Support

Visual cortex processes parallel information many times faster than sequential

Pre-attentive visual attributes (color, size, motion) for instant volatility recognition

Progressive disclosure from glanceable to analytical information layers

#### Cognitive Load Management

Background element positioning reduces attention competition

Working memory preservation (4±1 chunk limit under stress)

Extended session comfort through reduced visual complexity

#### Environmental Adaptation

Configurable intensity scaling for user preference

### Essential User Interactions &amp; Cognitive Purpose

#### Fundamental Mechanisms

Size: The size responds to market volatility, allowing traders to instantly perceive volatility levels via orb size relative to canvas.

#### Color / Brightness

Directional Color Mode: Offers traders the ability to customize up/down volatility colors and transparency

Intensity Mode: Adjusts color rendering intensity and/or transparency modifiers

#### Combinations

Traders can choose any combination of the fundamental mechanisms to suit their unique cognitive needs.

### Flash

Flash modifier is offered as an option for traders to have an instant visual change, allowing customized tick flash threshold. Flash can be the orb itself or the full canvas background.

#### Interaction Modes

Mode

Cognitive Purpose

Implementation

Directional Mode

Enables color changes for color recognition

Color based on tick direction

Static Mode

Cognitive load reduction

Single color regardless of direction

Intensity Mode

Perceptual volatility using color rendering intensity instead of size

Logarithmic color intensity mapping

### Visual Hierarchy (Cognitive-Aware Priority System)

Priority

Component

Purpose

Primary

Orb

Primary volatility information through size and color

Secondary

Flash Effects

Event significance notification through flash effects on significant price movements

Tertiary

Volatility Metric

Numeric display of volatility level - static position text allowing traders to read exact volatility state

## 3. Advanced Multi-Mode Visualization System

### Mode 1: Directional (Default)

Cognitive Purpose: Immediate trend context recognition

// Direction-aware color coding for trend recognition
case 'directional':
  return direction === 'up'
    ? (config.priceUpColor || '#3b82f6') // Blue for upward movement
    : (config.priceDownColor || '#a78bfa'); // Purple for downward movement
Visual Characteristics:

Pre-attentive Processing: Color instantly communicates trend direction

Brightness Inversion Support: Adapts to environmental lighting

Background/Foreground Integration: Maintains visibility in both modes

### Mode 2: Static

Cognitive Purpose: Extended session comfort through reduced cognitive load

// Consistent color for reduced visual complexity
case 'static':
  return config.priceStaticColor || '#d1d5db'; // Neutral gray
Visual Characteristics:

Cognitive Load Reduction: Eliminates directional processing overhead

Extended Session Comfort: Reduced mental fatigue during long trading sessions

Ambient Glow Compatibility: Enhanced visual softening available

### Mode 3: Intensity

Cognitive Purpose: Perceptual color/brightness volatility scaling for pattern recognition

// Logarithmic scaling for human-perceptible volatility mapping
const rawIntensity = volatility &gt; 0
  ? Math.log(Math.max(0.1, volatility + 0.1)) / Math.log(10)
  : 0;
const intensity = Math.min(1.0, rawIntensity);
Visual Characteristics:

Logarithmic Scaling: Matches human perception of volatility changes

Smooth Perceptual Gradients: HSL color space for natural intensity transitions

## 6. Simple Flash Alert System

### Foundation-Based Flash Architecture

Foundation Justification: “Flash modifier is offered as an option for traders to have an instant visual change, allowing customised tick flash threshold” (Section 2)

#### Core Flash Mechanism

Data Source: Existing tick magnitude from data processorTrigger Logic: Price movement exceeds user-defined thresholdVisual Effect: Brief white overlay on the orb itself

#### Simple Implementation

// Foundation-aligned flash logic
function shouldFlash(state, config) {
  if (!config.showOrbFlash) return false;

  const latestTick = state.ticks &amp;&amp; state.ticks.length &gt; 0
    ? state.ticks[state.ticks.length - 1]
    : null;

  const priceChange = latestTick?.magnitude || 0;
  return priceChange &gt;= config.flashThreshold;
}

// Simple flash effect - orb only, not canvas background
function applyOrbFlash(ctx, orbData, config) {
  ctx.save();
  ctx.globalAlpha = 0.6; // Fixed intensity for simplicity
  ctx.fillStyle = '#FFFFFF';

  // Apply flash only to orb area
  ctx.beginPath();
  ctx.arc(orbData.centerX, orbData.centerY, orbData.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
#### Cognitive Design Integration

Non-Disruptive: Flash affects only the orb, preserving foreground analysisConfigurable Sensitivity: User controls threshold via flashThreshold parameterBackground Element: Flash supports rather than competes with primary trading informationExtended Session: Brief flash duration prevents cognitive fatigue

#### Simplified Configuration

showOrbFlash: boolean toggle for flash systemflashThreshold: number (0.5-5.0) - price movement sensitivity

Removed Complexity (from over-engineered sections):

Multiple intensity levels (fixed 60% opacity sufficient)

Canvas background flash (disrupts foreground analysis)

Complex parameter ranges (simple threshold approach matches foundation)

## 7. Essential Configuration System

### Core Parameter Architecture

Foundation-Based Configuration: All parameters justified by Sections 1-2 or essential cognitive needs

#### Parameter Summary

Category

Parameters

Total

Foundation Basis

Core Display

showVolatilityOrb, volatilityColorMode

2

Background element, cognitive design

Size &amp; Scaling

volatilityOrbBaseWidth, volatilitySizeMultiplier

2

Size response mechanism

Gradient Controls

gradientSoftness, gradientSpread

2

Cognitive need for soft glow

Alert System

showOrbFlash, flashThreshold

2

Flash modifier option

Color Config

priceUpColor, priceDownColor, priceStaticColor

3

Directional color customization

Total

10 Essential Parameters





#### Core Display Parameters

showVolatilityOrb: boolean

Foundation Justification: Implied by background element design

Purpose: Toggle orb visibility for user preference

Default: true

volatilityColorMode: ‘directional’ | ‘static’ | ‘intensity’

Foundation Justification: Explicitly defined in Section 2 cognitive design

Purpose: Three core visualization modes for different cognitive needs

Default: ‘directional’

#### Size &amp; Scaling Parameters

volatilityOrbBaseWidth: number (0.05-0.5)

Foundation Justification: Supports “size responds to market volatility” (Section 2)

Purpose: Base orb size relative to canvas dimensions

Default: 0.15

volatilitySizeMultiplier: number (0.5-3.0)

Foundation Justification: Enhances size response mechanism from Section 2

Purpose: Scaling factor for volatility size response

Default: 1.0

#### Essential Gradient Controls (Cognitive Need Justification)

gradientSoftness: number (0.0-1.0)

Foundation Justification: Supports “color intensity and transparency modifiers” (Section 2)

Cognitive Need: Traders require gradient control for soft glow appearance

Purpose: Controls edge softness for comfortable extended viewing

Default: 0.7

gradientSpread: number (0.8-2.0)

Foundation Justification: Enhances background element positioning (Section 2)

Cognitive Need: Essential for creating soft glow vs harsh circle

Purpose: Controls how far the glow extends from center

Default: 1.2

#### Alert System Integration

showOrbFlash: boolean

Foundation Justification: “Flash modifier is offered as an option” (Section 2)

Purpose: Toggle flash alerts for significant market events

Default: false

flashThreshold: number (0.5-5.0)

Foundation Justification: “customised tick flash threshold” (Section 2)

Purpose: Price movement magnitude that triggers flash

Default: 2.0

#### Color Configuration (Directional Mode Support)

priceUpColor: string

Foundation Justification: “customise up/down volatility colour” (Section 2)

Purpose: Color for upward price movements

Default: ‘#3b82f6’

priceDownColor: string

Foundation Justification: “customise up/down volatility colour” (Section 2)

Purpose: Color for downward price movements

Default: ‘#a78bfa’

priceStaticColor: string

Foundation Justification: Single color for static mode (Section 2)

Purpose: Neutral color for static intensity mode

Default: ‘#d1d5db’

### Simplified Positioning System

Fixed Center Positioning: The orb is always positioned at canvas center

Rationale: Eliminates coordinate system complexity from later sections

Foundation Alignment: Supports “background element positioning” (Section 2)

Cognitive Benefit: Consistent reference point reduces cognitive load

Implementation: No positioning parameters required

### Configuration Validation Patterns

Type-Safe Validation:

validateRenderData(contentArea, adrAxisX, config, state) {// Early exit for performanceif (!config.showVolatilityOrb) {return { shouldRender: false, error: ‘Volatility orb disabled’ };}

// Validate essential data with cognitive awarenessconst { volatility, currentPrice } = state;if (currentPrice === undefined || currentPrice === null ||volatility === undefined || volatility === null) {return { shouldRender: false, error: ‘Missing essential data’ };}

// Continue with comprehensive validation…}

## 8. Realistic Performance Architecture

### Background Element Performance Targets

Foundation-Aligned Performance: Optimized for background element role, not foreground complexity

#### Core Performance Strategy

Single-Pass Rendering: One gradient operation per frameFixed Center Positioning: Eliminates coordinate calculation overheadSimple Flash System: Single overlay operation when triggeredMinimal State Management: Limited configuration reduces memory footprint

#### Implementation Optimization

// Simple pre-calculation for background element
function calculateOrbDimensions(canvas, config) {
  const baseSize = Math.min(canvas.width, canvas.height) * config.volatilityOrbBaseWidth;
  const centerX = canvas.width / 2;  // Fixed center positioning
  const centerY = canvas.height / 2;

  return {
    centerX,
    centerY,
    baseRadius: baseSize / 2
  };
}

// Efficient rendering with bounds checking
function renderBackgroundOrb(ctx, orbData, config, volatility) {
  if (!config.showVolatilityOrb) return;

  const volatilityScale = Math.min(2.0, volatility * 0.8);
  const radius = orbData.baseRadius * volatilityScale * config.volatilitySizeMultiplier;

  // Single gradient operation
  const gradient = ctx.createRadialGradient(
    orbData.centerX, orbData.centerY, 0,
    orbData.centerX, orbData.centerY, radius * config.gradientSpread
  );

  // Apply gradient with softness
  gradient.addColorStop(0, getOrbColor(config, 1.0));
  gradient.addColorStop(config.gradientSoftness, getOrbColor(config, 0.3));
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}
#### Realistic Performance Benchmarks

Background Element Targets

Metric

Target

Rationale

Render Time

1-3ms per orb

Background element (not 10ms+ for foreground)

Latency

&lt;100ms data-to-visual update

Maintains foundation requirement

Memory

&lt;50MB per 20 displays

Background element efficiency

CPU Impact

&lt;2% per display

Minimal foreground competition

Multi-Display Support

Metric

Target

Strategy

Concurrent Displays

15+ at 60fps

Optimized for background role

Quality Management

Graceful degradation

Reduced quality rather than framerate loss

Priority

Background first

Sacrifices quality before impacting critical elements

#### Cognitive Performance Benefits

Extended Session Support:

Low Cognitive Load: Simple rendering reduces mental fatigue

Consistent Performance: Predictable behavior during long sessions

Background Awareness: Provides context without demanding attention

Trader Workflow Support:

Non-Disruptive: Performance issues never impact critical trading components

Reliable Context: Background information remains available during market activity

Progressive Enhancement: Core functionality preserved under system load

## 9. Implementation Readiness

### Foundation-Aligned Implementation Scope

Based on Sections 1-2: The Volatility Orb is ready for implementation with a clear, focused scope that serves the background visualization role without over-engineering.

#### Core Implementation Requirements

Essential Features Only:

Size response to market volatility

Three color modes: directional, static, intensity

Simple flash system with threshold control

Fixed center positioning with soft gradient rendering

Essential gradient controls for cognitive comfort

Technical Implementation:

UnifiedVisualization base class integration

Single-pass gradient rendering (1-3ms per orb)

Fixed center positioning eliminates coordinate complexity

Simple configuration with 10 essential parameters

Foundation-aligned performance targets

#### Success Criteria

Functional Requirements

Requirement

Status

Foundation Reference

Size indicates volatility level

✅

Section 2

Three color modes for cognitive needs

✅

Section 2

Background positioning without competition

✅

Section 2

Simple flash alerts for significant events

✅

Section 2

Performance Requirements

Requirement

Target

Status

Render time per orb

1-3ms

✅

Data-to-visual latency

&lt;100ms

✅

Concurrent displays

15+ at 60fps

✅

CPU/memory impact

Minimal background role

✅

Cognitive Requirements

Requirement

Status

Benefit

Background element supports rather than competes

✅

Reduced attention competition

Pre-attentive visual attributes for instant recognition

✅

Faster pattern recognition

Extended session comfort through reduced complexity

✅

Less mental fatigue

Customizable gradients for individual cognitive needs

✅

Personalized visual comfort

## 

### Implementation Ready

The simplified specification provides:

Clear scope aligned with cognitive design principles

Essential parameters serving specific user needs

Realistic performance targets for background element role

Implementation patterns following UnifiedVisualization foundation

Cognitive focus on supporting rather than competing with foreground analysis

This design embodies the “Simple, Performant, Maintainable” philosophy while honoring the human-centered design principles that make NeuroSense FX effective for professional trading workflows.

The Volatility Orb is ready for implementation as a cognitive-aware background visualization element that extends trader capabilities without adding cognitive overhead.

