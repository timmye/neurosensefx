# AUDUSD Configuration Analysis Instructions

## 🔍 Purpose
This diagnostic tool helps identify why AUDUSD text appears crisp while other symbols may have blurry text by extracting and comparing workspace configurations.

## 🚀 How to Use

1. **Open the Analysis Tool**
   - Open `debug-audusd-config.html` in your browser
   - Must be opened from the same NeuroSense FX application domain to access localStorage

2. **Run Analysis**
   - Click "🚀 Extract & Analyze AUDUSD Config" 
   - The tool will automatically extract all localStorage data and analyze AUDUSD's configuration

3. **Review Results**
   - Compare AUDUSD values against factory defaults
   - Look for 🔴 DIFFERENT parameters in text rendering sections
   - Check "🎯 Key Findings" for critical differences

## 📊 What to Look For

### Text Rendering Parameters
- **priceFontSize**: Base font size percentage (higher = potentially crisper)
- **bigFigureFontSizeRatio**: Big figure size ratio (affects main digits)
- **pipFontSizeRatio**: Pips size ratio (affects decimal digits)
- **pipetteFontSizeRatio**: Pipette size ratio (affects smallest digits)
- **priceFontWeight**: Font weight (600 vs 400 = crisper text)
- **priceDisplayPositioning**: Positioning mode (affects alignment)
- **priceDisplayPadding**: Padding around text (affects rendering space)

### Display Size Parameters
- **containerSize**: Overall display dimensions (affects pixel density)
- **visualizationsContentWidth**: Content area width (affects text space)
- **meterHeight**: Content height (affects vertical text space)
- **adrAxisPosition**: Text positioning (affects alignment)

## 🎯 Expected Findings

**Crisp text typically comes from:**
- Larger font sizes or ratios
- Higher font weights
- Larger display dimensions (more pixels for text)
- Different positioning that aligns better with pixel grid
- Content area configurations that give text more space

## 📤 Export Options

- **Export Analysis**: Downloads complete configuration data for further analysis
- **Clear All Data**: Resets workspace to factory defaults (use with caution)

## 🔧 Technical Details

The tool compares:
1. **AUDUSD's effective config** (global defaults + display-specific overrides)
2. **Factory defaults** from `src/utils/configDefaults.js`
3. **Identifies differences** that could affect text rendering crispness

## 📋 Next Steps After Analysis

Once you identify the differences causing crisp text:
1. Apply successful AUDUSD parameters to other displays
2. Update factory defaults if the differences should be universal
3. Create standardized text rendering approach based on successful configuration

---

**Note**: This analysis tool provides the diagnostic data needed to understand text rendering differences between symbols and identify the root cause of blurry vs crisp text.
