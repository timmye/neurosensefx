# Implementation Plan

[Overview]
Fix fuzzy text rendering in dayRangeMeter by implementing unified DPR-aware text configuration to ensure crisp text at all display sizes and device pixel ratios.

The issue stems from inconsistent device pixel ratio handling between canvas scaling and text rendering. The canvas is scaled for DPR but text fonts remain in CSS pixels, causing fuzzy rendering at higher DPI settings.

[Types]
No new types required - will extend existing canvasSizing utility functions.

[Files]
- New utility function in src/utils/canvasSizing.js for DPR-aware text configuration
- Modified src/lib/viz/dayRangeMeter.js to use unified text configuration
- No files deleted

[Functions]
- New function configureTextForDPR in canvasSizing.js for unified DPR-aware text setup
- Modified text rendering functions in dayRangeMeter.js to use unified configuration
- No functions removed

[Classes]
No new classes - will extend existing utility patterns.

[Dependencies]
No new dependencies - uses existing canvas API and canvasSizing infrastructure.

[Testing]
Visual verification of text crispness at base size (220×120px) and larger sizes
Cross-browser testing for consistent text rendering
Performance validation with 20+ displays

[Implementation Order]
1. Add DPR-aware text configuration utility to canvasSizing.js
2. Update dayRangeMeter text rendering to use unified configuration
3. Test text crispness at different display sizes
4. Verify performance impact is minimal
