# Volatility Orb Design Specification

## Executive Summary

Volatility visualisation delivering real-time market volatility assessment through multi-mode rendering.

Seamless integration with UnifiedVisualisation foundation patterns while maintaining volatility orb's role as a background element that supports market analysis through clear volatility visualization.

## 1. Foundation Architecture: UnifiedVisualization Integration

### UnifiedVisualization Base Class Implementation

Foundation Pattern Inheritance:

// Standard UnifiedVisualization pattern usageexport const drawVolatilityOrb = createVisualization(‘VolatilityOrb’, volatilityOrbImplementation);Core Foundation Methods Leveraged:

validateRenderData(): Safety checks + percentage conversion + bounds validation

drawCore(): Main orb rendering with DPR-aware transformations

addEnhancements(): Bounds-checked enhancements (flash, metrics, ambient effects)

processVolatilityData(): Worker data processing with comprehensive validation

### DPR-Aware Rendering Implementation

// UnifiedVisualization provides crisp rendering across all device densitiesctx.save();ctx.translate(0.5, 0.5); // Crisp text renderingctx.imageSmoothingEnabled = false; // Sharp pixel alignment// … rendering operationsctx.restore(); // UnifiedVisualization handles restoration

### Performance Optimization Patterns

Pre-calculation: All positions and dimensions calculated once per frame

Early Exit Validation: Skip rendering when disabled or data invalid

Selective Enhancement: Core always renders, enhancements have bounds checking

Object Reuse: Minimal allocation in render loops for efficient performance

## 2. User Experience Design

### Essential User Interactions

#### Fundamental Mechanisms

Size: The size responds to market volatility, allowing users to perceive volatility levels via orb size relative to canvas.

#### Color / Brightness

Directional Color Mode: Customizable up/down volatility colors and transparency

Intensity Mode: Adjusts color rendering intensity and/or transparency modifiers

#### Combinations

Users can choose any combination of the fundamental mechanisms.

### Flash

Flash modifier provides a visual change for significant price movements. Flash can be the orb itself or the full canvas background.

#### Interaction Modes

**Directional Mode**
- Color changes based on tick direction
- Color based on price direction

**Static Mode**
- Single color regardless of direction
- Reduced visual complexity

**Intensity Mode**
- Color rendering intensity based on volatility
- Logarithmic color intensity mapping

### Visual Hierarchy

**Primary**
- Orb: Main volatility information through size and color

**Secondary**
- Flash Effects: Visual notification for significant price movements

**Tertiary**
- Volatility Metric: Numeric display of volatility level

## 3. Advanced Multi-Mode Visualization System

### Mode 1: Directional (Default)

Provides immediate trend context through color coding

// Direction-aware color coding for trend recognitioncase ‘directional’:return direction === ‘up’? (config.priceUpColor || ‘#3b82f6’) // Blue for upward movement: (config.priceDownColor || ‘#a78bfa’); // Purple for downward movementVisual Characteristics:

- Color communicates trend direction
- Brightness inversion support for different lighting conditions
- Maintains visibility in both background and foreground modes

### Mode 2: Static

Provides consistent color for reduced visual complexity

// Consistent color for reduced visual complexitycase ‘static’:return config.priceStaticColor || ‘#d1d5db’; // Neutral grayVisual Characteristics:

- Eliminates directional processing overhead
- Reduced visual complexity during extended use
- Compatible with ambient glow effects

### Mode 3: Intensity

Provides color/brightness scaling based on volatility levels

// Logarithmic scaling for human-perceptible volatility mappingconst rawIntensity = volatility &gt; 0? Math.log(Math.max(0.1, volatility + 0.1)) / Math.log(10): 0;const intensity = Math.min(1.0, rawIntensity);Visual Characteristics:

- Logarithmic scaling for volatility mapping
- Smooth color transitions using HSL color space

## 6. Simple Flash Alert System

### Foundation-Based Flash Architecture

Foundation Justification: “Flash modifier is offered as an option for traders to have an instant visual change, allowing customised tick flash threshold” (Section 2)

#### Core Flash Mechanism

Data Source: Existing tick magnitude from data processorTrigger Logic: Price movement exceeds user-defined thresholdVisual Effect: Brief white overlay on the orb itself

#### Simple Implementation

// Foundation-aligned flash logicfunction shouldFlash(state, config) {if (!config.showOrbFlash) return false;

const latestTick = state.ticks &amp;&amp; state.ticks.length &gt; 0? state.ticks[state.ticks.length - 1]: null;

const priceChange = latestTick?.magnitude || 0;return priceChange &gt;= config.flashThreshold;}

// Simple flash effect - orb only, not canvas backgroundfunction applyOrbFlash(ctx, orbData, config) {ctx.save();ctx.globalAlpha = 0.6; // Fixed intensity for simplicityctx.fillStyle = ‘#FFFFFF’;

// Apply flash only to orb areactx.beginPath();ctx.arc(orbData.centerX, orbData.centerY, orbData.radius, 0, Math.PI * 2);ctx.fill();

ctx.restore();}

#### Design Integration

- Non-Disruptive: Flash affects only the orb, preserving foreground analysis
- Configurable Sensitivity: User controls threshold via flashThreshold parameter
- Background Element: Flash supports rather than competes with primary trading information
- Brief flash duration for reduced visual interruption

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

Volatility Colors

volatilityUpColor, volatilityDownColor, volatilityStaticColor

3

Enhanced directional color customization

Transparency Controls

volatilityUpOpacity, volatilityDownOpacity, volatilityStaticOpacity, volatilityOrbOpacity

4

Neuro-adaptive opacity management

Fallback Colors

priceUpColor, priceDownColor, priceStaticColor

3

Backward compatibility support

Total

17 Essential Parameters

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

#### Color Configuration (Enhanced Customization)

##### Volatility-Specific Colors

volatilityUpColor: string

Foundation Justification: Enhanced "customise up/down volatility colour" (Section 2)

Purpose: Custom color for upward volatility movements (takes precedence over price colors)

Default: '#3b82f6' (NeuroSense blue)

volatilityDownColor: string

Foundation Justification: Enhanced "customise up/down volatility colour" (Section 2)

Purpose: Custom color for downward volatility movements (takes precedence over price colors)

Default: '#a78bfa' (NeuroSense purple)

volatilityStaticColor: string

Foundation Justification: Enhanced single color for static mode (Section 2)

Purpose: Custom color for static volatility mode (takes precedence over price colors)

Default: '#d1d5db' (Neutral gray)

##### Fallback Colors (Backward Compatibility)

priceUpColor: string

Foundation Justification: Original "customise up/down volatility colour" (Section 2)

Purpose: Fallback color for upward price movements when volatility-specific colors not configured

Default: '#3b82f6'

priceDownColor: string

Foundation Justification: Original "customise up/down volatility colour" (Section 2)

Purpose: Fallback color for downward price movements when volatility-specific colors not configured

Default: '#a78bfa'

priceStaticColor: string

Foundation Justification: Original single color for static mode (Section 2)

Purpose: Fallback color for static intensity mode when volatility-specific colors not configured

Default: '#d1d5db'

#### Transparency Control System (Neuro-Adaptive Enhancement)

##### Individual Transparency Controls

volatilityUpOpacity: number (0.1-1.0)

Cognitive Purpose: Fine-tuned cognitive load management for upward movements

Purpose: Individual transparency control for upward volatility colors

Default: 0.8

volatilityDownOpacity: number (0.1-1.0)

Cognitive Purpose: Fine-tuned cognitive load management for downward movements

Purpose: Individual transparency control for downward volatility colors

Default: 0.8

volatilityStaticOpacity: number (0.1-1.0)

Cognitive Purpose: Fine-tuned cognitive load management for static mode

Purpose: Individual transparency control for static volatility color

Default: 0.8

##### Overall Ambient Control

volatilityOrbOpacity: number (0.1-1.0)

Cognitive Purpose: Ambient vs. focused attention modes for different trading contexts

Purpose: Overall orb opacity for ambient background vs. focused attention scenarios

Default: 0.9

Implementation: Applied via ctx.globalAlpha in drawCoreOrb() for consistent overall transparency

### Simplified Positioning System

Fixed Center Positioning: The orb is always positioned at canvas center

Rationale: Eliminates coordinate system complexity from later sections

Foundation Alignment: Supports “background element positioning” (Section 2)

Cognitive Benefit: Consistent reference point reduces cognitive load

Implementation: No positioning parameters required

### Configuration Validation Patterns

Type-Safe Validation:

validateRenderData(contentArea, adrAxisX, config, state) {// Early exit for performanceif (!config.showVolatilityOrb) {return { shouldRender: false, error: ‘Volatility orb disabled’ };}

// Validate essential dataconst { volatility, currentPrice } = state;if (currentPrice === undefined || currentPrice === null ||volatility === undefined || volatility === null) {return { shouldRender: false, error: ‘Missing essential data’ };}

// Continue with comprehensive validation…}

## 8. Performance Architecture

### Rendering Approach

#### Core Performance Strategy

- Single-Pass Rendering: One gradient operation per frame
- Fixed Center Positioning: Eliminates coordinate calculation overhead
- Simple Flash System: Single overlay operation when triggered
- Minimal State Management: Limited configuration reduces memory footprint

#### Implementation Optimization

// Efficient rendering with bounds checkingfunction renderBackgroundOrb(ctx, orbData, config, volatility) {if (!config.showVolatilityOrb) return;

const volatilityScale = Math.min(2.0, volatility * 0.8);const radius = orbData.baseRadius * volatilityScale * config.volatilitySizeMultiplier;

// Single gradient operationconst gradient = ctx.createRadialGradient(orbData.centerX, orbData.centerY, 0,orbData.centerX, orbData.centerY, radius * config.gradientSpread);

// Apply gradient with softnessgradient.addColorStop(0, getOrbColor(config, 1.0));gradient.addColorStop(config.gradientSoftness, getOrbColor(config, 0.3));gradient.addColorStop(1, 'transparent');

ctx.fillStyle = gradient;ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);}

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

Single-pass gradient rendering for efficient performance

Fixed center positioning eliminates coordinate complexity

Simple configuration with 10 essential parameters

Foundation-aligned performance approach

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

Performance Goals

- Efficient rendering performance
- Responsive data-to-visual updates
- Support for multiple concurrent displays
- Minimal CPU/memory impact

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

Efficient performance approach for background element role

Implementation patterns following UnifiedVisualization foundation

Cognitive focus on supporting rather than competing with foreground analysis

This design embodies the “Simple, Performant, Maintainable” philosophy while honoring the human-centered design principles that make NeuroSense FX effective for professional trading workflows.

The Volatility Orb is ready for implementation as a cognitive-aware background visualization element that extends trader capabilities without adding cognitive overhead.

## 10. Enhanced Customization & Neuro-Adaptive Features

### Custom Color System Implementation

#### Volatility-Specific Color Parameters
The implementation introduces three volatility-specific color parameters that take precedence over the existing price colors:

```javascript
// Enhanced color selection logic
if (actualDirection === 'up') {
  baseColor = volatilityUpColor || priceUpColor || '#3b82f6';
  targetOpacity = volatilityUpOpacity || 0.8;
} else if (actualDirection === 'down') {
  baseColor = volatilityDownColor || priceDownColor || '#a78bfa';
  targetOpacity = volatilityDownOpacity || 0.8;
}
```

**Cognitive Benefits:**
- **Personalized Visual Comfort**: Traders can select colors that match their individual visual preferences and sensitivities
- **Colorblind Accessibility**: Custom colors support various color vision deficiencies
- **Environmental Adaptation**: Colors can be optimized for different lighting conditions and monitor setups

### Transparency Control Architecture

#### Layered Transparency System
The implementation uses a sophisticated layered approach to transparency control:

1. **Individual Transparency**: Per-color opacity control (volatilityUpOpacity, volatilityDownOpacity, volatilityStaticOpacity)
2. **Intensity Scaling**: Mode-based intensity adjustments (intensity mode multiplies with static opacity)
3. **Overall Opacity**: Master transparency control for ambient vs. focused attention (volatilityOrbOpacity)

**Implementation Pattern:**
```javascript
// Individual transparency selection
targetOpacity = volatilityUpOpacity || 0.8;

// Mode-specific adjustments (intensity mode example)
targetOpacity = (volatilityStaticOpacity || 0.8) * intensityValue;

// Overall opacity applied in drawCoreOrb
ctx.globalAlpha = config.volatilityOrbOpacity || 0.9;
```

**Neuro-Adaptive Benefits:**
- **Cognitive Load Management**: Fine-tuned opacity controls reduce visual overload
- **Attention Control**: Overall opacity enables ambient vs. focused attention modes
- **Extended Session Comfort**: Reduced eye strain during long trading sessions

### Backward Compatibility Design

#### Seamless Migration Strategy
The implementation maintains 100% backward compatibility with existing configurations:

- **Fallback Hierarchy**: Volatility colors → Price colors → Hardcoded defaults
- **Graceful Degradation**: Missing parameters use sensible defaults
- **No Breaking Changes**: Existing workspaces continue functioning unchanged

**Fallback Pattern:**
```javascript
// Multi-level fallback ensures compatibility
baseColor = volatilityUpColor || priceUpColor || '#3b82f6';
targetOpacity = volatilityUpOpacity || 0.8;
```

### Mode-Specific Enhancement Details

#### Directional Mode Enhancement
- **Custom Up/Down Colors**: Separate color control for directional movements
- **Individual Transparency**: Different opacity levels for up vs. down movements
- **Enhanced Pattern Recognition**: Improved trend visibility through personalized colors

#### Static Mode Enhancement
- **Single Custom Color**: Personalized static color for reduced cognitive load
- **Dedicated Transparency**: Independent opacity control for static mode
- **Extended Session Comfort**: Reduced visual complexity during long sessions

#### Intensity Mode Enhancement
- **Custom Base Color**: User-selected color for intensity scaling
- **Logarithmic Transparency**: Intensity multiplies with base transparency
- **Perceptual Accuracy**: Maintains logarithmic scaling with custom colors

### Performance & Quality Assurance

#### Rendering Performance
- **Minimal Overhead**: Additional transparency calculations minimally impact performance
- **No Memory Impact**: 7 new parameters (~100 bytes total memory footprint)
- **Efficient Performance**: All transparency operations optimized for real-time rendering

#### Validation & Testing
- **Schema Validation**: Type-safe validation prevents configuration errors
- **Range Enforcement**: Opacity values constrained to 0.1-1.0 range
- **Format Validation**: Color parameters validated as hex color strings

### Trader Experience Enhancement

#### Customization Workflow
1. **Color Selection**: Intuitive color pickers for up/down/static colors
2. **Transparency Tuning**: Percentage sliders for fine-grained opacity control
3. **Real-time Preview**: Immediate visual feedback as settings change
4. **Mode Testing**: Easy switching between directional/static/intensity modes

#### Cognitive Design Alignment
- **Pre-attentive Processing**: Custom colors enhance instant volatility recognition
- **Progressive Disclosure**: Information layers from glanceable to analytical
- **Extended Session**: Personalized comfort for long trading sessions
- **Accessibility**: Support for diverse visual needs and preferences

The enhanced Volatility Orb now provides comprehensive customization capabilities while maintaining the project's core principles of cognitive awareness, performance optimization, and architectural simplicity.

