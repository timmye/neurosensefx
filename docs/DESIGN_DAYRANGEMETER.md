# Day Range Meter Design Specification

## Executive Summary

The Day Range Meter provides traders with exact spatial context for current price within the day's range. Using the Average Daily Range (ADR) as the primary reference framework, it transforms abstract price data into intuitive visual positioning that can be processed pre-attentively.

**Core Principle**: Price is everything. The meter provides instant spatial understanding of where current price sits relative to the day's expected range and historical context through pixel-perfect visual positioning.

---

## 1. Core Philosophy & Purpose

### Primary Function
- **Spatial Context**: Convert absolute price values into relative positioning
- **Perceptual Anchor**: Daily Open Price serves as the central reference point
- **Range Visualization**: Display current price within the context of Average Daily Range
- **Trader Precision**: Pixel-perfect accuracy for professional trading decisions

### Design Philosophy
- **Foundation First**: Elemental information display (lines, text, positioning) before perceptual enhancements
- **Price-Centric**: All visual elements serve to contextualize current price
- **Immediate Response**: Every backend tick displayed with zero latency goal
- **Expandable Range**: Dynamic adjustment for price movements beyond expected boundaries
- **Visual Clarity**: Crisp rendering that maintains quality across all display conditions

---

## 2. Visual Architecture

### Canvas Foundation

#### Rendering Quality
- **DPR-Aware Rendering**: Automatic handling of high-DPI displays with device pixel ratio scaling
- **Pixel Perfect Lines**: Sub-pixel alignment for crisp 1px line rendering
- **Anti-aliased Text**: Clear, readable typography at all scales
- **Responsive Scaling**: Maintains visual quality during canvas resizing

#### Coordinate System
```
Canvas Coordinate System:
- Y-axis: 0% (top) to 100% (bottom) = Price range
- X-axis: Flexible ADR axis placement
- Center: 50% canvas height = Daily Open Price
- Origin: Top-left (0, 0)
```

### Layering Architecture
1. **Background Layer**: Canvas clearing and base preparation
2. **Structure Layer**: ADR axis and reference lines
3. **Data Layer**: Percentage markers and spatial indicators
4. **Information Layer**: Price markers and labels
5. **Overlay Layer**: ADR information display

---

## 3. Data Architecture

### Source of Truth Structure

#### Primary Data Sources
- **Daily Open Price**: `midPrice` field (mapped from backend `todaysOpen`)
- **Current Price**: `currentPrice` field (real-time tick updates)
- **Session Extremes**: `todaysHigh` and `todaysLow` fields
- **ADR Boundaries**: `projectedAdrHigh` and `projectedAdrLow` fields
- **Display Precision**: `digits` field for decimal formatting

#### Data Flow Principles
- **Schema-Driven**: All fields sourced from unified `dataProcessor` schema
- **Consistent Naming**: No field aliasing or renaming in visualization layer
- **Single Source**: Backend calculations flow directly to display without transformation
- **Real-Time Updates**: Immediate reflection of backend tick data

### ADR Calculation Architecture
- **Boundary Definition**: ADR = `projectedAdrHigh - projectedAdrLow`
- **Percentage Reference**: All calculations relative to `midPrice` (daily open)
- **Dynamic Expansion**: Canvas boundaries extend beyond initial ±50% ADR when needed
- **Consistent Methodology**: Same calculation used for positioning and labeling

---

## 4. Visual Structure Specification

### ADR Axis (Core Meter Element)

#### Positioning & Layout
- **X-Position**: Configurable horizontal placement via `adrAxisX` coordinate
- **Vertical Span**: Full canvas content area height
- **Reference Point**: Daily Open Price (`midPrice`) = 50% canvas height
- **Boundary Mapping**: ±50% ADR = initial canvas extremes

#### Visual Characteristics
- **Primary Line**: Solid vertical line through full canvas height
- **Center Reference**: Horizontal dashed line at canvas center (daily open position)
- **Color Scheme**: Neutral gray for primary structure, lighter gray for references
- **Line Weight**: 1px for all structural elements

### Percentage Marker System

#### Static Percentage Markers
- **Levels**: 30%, 50%, 75%, 100% of ADR
- **Activation**: Display when session range exceeds each threshold
- **Visual Style**: Short horizontal lines with percentage labels
- **Positioning**: Calculated from daily open price using ADR percentage

#### Dynamic Percentage Markers
- **Source**: Actual session high/low positions relative to ADR
- **Calculation**: Real-time percentage based on current price extremes
- **Display**: Shows exact ADR percentage for today's high and low
- **Orientation**: Right-side placement with clear labeling

#### Marker Visualization
- **Lines**: 8px horizontal lines at percentage levels
- **Labels**: Sans-serif typography with percentage indicators
- **Color Coding**: Subtle gray for differentiation from price markers
- **Spacing**: Consistent visual spacing based on actual ADR percentages

### Price Marker System

#### Daily Open Price Marker
- **Position**: Center axis (0% ADR, 50% canvas height)
- **Display**: Prominent marker with "O" prefix and price label
- **Reference Role**: Serves as primary spatial anchor for all positioning
- **Visual Style**: Gray color, left-side placement

#### Session High/Low Markers
- **Position**: Plotted based on actual session extremes
- **Display**: "H" and "L" prefixes with price labels
- **Dynamic Updates**: Real-time positioning with new session extremes
- **Visual Style**: Amber color, left-side placement

#### Current Price Marker
- **Position**: Real-time plotting based on current tick data
- **Display**: "C" prefix with price label
- **Update Frequency**: Every backend tick without buffering
- **Visual Style**: Green color, right-side placement for emphasis

### ADR Information Display

#### Real-Time Information
- **Current ADR Percentage**: Live calculation from daily open to current price
- **Display Format**: "ADR: +X.X%" or "ADR: -X.X%" with sign indicator
- **Position**: Top center of canvas with semi-transparent background
- **Visual Style**: Blue text on dark background with border

---

## 5. Visual Styling Specification

### Color Architecture
- **Structure Elements**: Neutral grays (#4B5563, #6B7280, #374151, #9CA3AF)
- **Price Markers**: Gray for open, amber (#F59E0B) for high/low, green (#10B981) for current
- **Information Display**: Blue (#3B82F6) for ADR information, dark backgrounds for contrast
- **Boundary Indicators**: Red (#EF4444) for extreme range boundaries

### Typography Standards
- **Price Labels**: Monospace fonts for perfect alignment of decimal points
- **Percentage Labels**: Sans-serif for readability at small sizes
- **Information Display**: Monospace for consistent data presentation
- **Sizing Hierarchy**: 10px for markers, 12px for information display

### Line Specifications
- **Structural Lines**: 1px crisp lines with sub-pixel alignment
- **Price Markers**: 2px lines for emphasis and differentiation
- **Reference Lines**: Dashed lines for center reference
- **Boundary Lines**: Solid lines at canvas extremes when needed

---

## 6. Configuration Architecture

### User Customization Options
- **ADR X-Position**: Horizontal axis placement via `centralAxisXPosition`
- **Marker Visibility**: Toggle percentage markers via `showAdrRangeIndicatorLines`
- **Label Style**: Choose between static and dynamic percentage modes via `adrLabelType`
- **Price Precision**: Decimal places for display via `digits` field
- **Color Scheme**: Customizable element colors through configuration schema

### System Integration
- **Content Area**: Uses `renderingContext.contentArea` for dimension management
- **Axis Positioning**: Configured via `renderingContext.adrAxisX` coordinate
- **Configuration**: Full integration with `VisualizationConfigSchema`
- **Bounds Management**: Coordinate checking through `boundsUtils` infrastructure

---

## 7. Integration Architecture

### Backend Data Integration
- **Tick Processing**: Immediate display of every backend tick
- **Session Data**: Real-time high/low updates from data processor
- **ADR Calculations**: Backend-computed values for range boundaries
- **Data Validation**: Schema-based validation for all data inputs

### Display System Integration
- **Canvas Management**: Content-area relative positioning and sizing
- **Multi-Display Support**: Consistent rendering across multiple meters
- **Layout System**: Integration with overall interface positioning
- **Responsive Design**: Automatic adjustment to canvas dimension changes

### Component Architecture
- **Modular Design**: Separate functions for each visual element
- **Parameter Passing**: Unified rendering context for all drawing operations
- **Error Handling**: Graceful degradation for missing or invalid data
- **Performance Optimization**: Efficient rendering pipeline for smooth updates

---

## 8. Visual Quality Standards

### Rendering Requirements
- **Crisp Lines**: All 1px lines rendered with sub-pixel precision
- **Clear Text**: Anti-aliased typography with consistent sizing
- **Color Consistency**: Unified color scheme across all elements
- **No Distortion**: Maintains visual quality during resizing

### Display Characteristics
- **High Contrast**: Clear visibility in various lighting conditions
- **Professional Appearance**: Trading-grade visual quality
- **Information Hierarchy**: Clear visual distinction between element types
- **Spatial Clarity**: Intuitive understanding of price positioning

---

## 9. Future Enhancement Paths

### Perceptual Layer Opportunities
- **Color Coding**: Dynamic color changes based on price movement
- **Motion Effects**: Subtle animations for price changes
- **Visual Alerts**: Enhanced notifications for significant events
- **Contextual Highlighting**: Emphasis on important price levels

### Advanced Visualization Features
- **Historical Context**: Previous day range comparisons
- **Trend Indicators**: Visual representation of price momentum
- **Pattern Recognition**: Highlighting of technical patterns
- **Market State Visualization**: Overall market condition indicators

---

## Conclusion

The Day Range Meter design establishes a robust foundation for the NeuroSense FX visualization system. By prioritizing price accuracy, immediate responsiveness, and spatial context, it provides traders with essential information needed for rapid decision-making.

The implementation achieves pixel-perfect visual quality through DPR-aware rendering while maintaining clean data architecture through unified source of truth principles. The modular design ensures scalability and maintainability as the system evolves.

This design specification reflects the current implemented reality while preserving clear paths for future enhancements and perceptual improvements.

---

## Document Maintenance

This specification should be reviewed and updated as:
- Implementation reveals new requirements or constraints
- User feedback indicates needed adjustments
- Display technologies evolve or improve
- Integration with other components reveals dependencies

All changes should maintain alignment with the core design principles of price accuracy, visual clarity, and trader effectiveness established in this document.
