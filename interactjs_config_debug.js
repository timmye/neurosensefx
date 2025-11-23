#!/usr/bin/env node

/**
 * 🔍 INTERACT.JS CONFIGURATION DEBUGGER
 *
 * This script analyzes the actual interact.js configuration being used
 * in FloatingDisplay.svelte to identify potential causes of canvas movement.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 INTERACT.JS CONFIGURATION ANALYSIS');
console.log('=====================================\n');

// Read the FloatingDisplay.svelte file
const filePath = path.join(__dirname, 'src/components/FloatingDisplay.svelte');
const content = fs.readFileSync(filePath, 'utf8');

console.log('📋 ANALYZING FLOATINGDISPLAY.SVELTE INTERACT.JS SETUP...\n');

// Extract interact.js configuration section
const interactStart = content.indexOf('interactable = interact(element);');
const interactEnd = content.indexOf('interactable.unset();');

if (interactStart === -1) {
    console.log('❌ Could not find interact.js setup in FloatingDisplay.svelte');
    process.exit(1);
}

const interactSection = content.substring(interactStart, interactEnd);

console.log('🔧 EXTRACTED INTERACT.JS CONFIGURATION:');
console.log('=====================================\n');

// Find and analyze draggable configuration
const draggableMatch = interactSection.match(/\.draggable\(\{([^}]+)\}\)/s);
if (draggableMatch) {
    console.log('🎯 DRAGGABLE CONFIGURATION:');
    console.log(draggableMatch[1]);

    // Check for inertia setting
    const inertiaMatch = draggableMatch[1].match(/inertia:\s*(false|true)/);
    if (inertiaMatch) {
        const inertiaValue = inertiaMatch[1];
        if (inertiaValue === 'false') {
            console.log('✅ INERTIA IS DISABLED (correct)');
        } else {
            console.log('❌ INERTIA IS ENABLED (this causes post-drag easing!)');
        }
    } else {
        console.log('⚠️  INERTIA NOT SET (defaults to true - this could cause issues!)');
    }

    // Check for modifiers that might affect movement
    const modifiersMatch = draggableMatch[1].match(/modifiers:\s*\[([^\]]+)\]/s);
    if (modifiersMatch) {
        console.log('🔧 MODIFIERS FOUND:');
        console.log(modifiersMatch[1]);

        // Check for restrictSize
        if (modifiersMatch[1].includes('restrictSize')) {
            console.log('✅ RESTRICTSIZE MODIFIER PRESENT');
        }

        // Check for snap modifiers
        if (modifiersMatch[1].includes('snap')) {
            console.log('⚠️  SNAP MODIFIER PRESENT - could cause post-drag adjustment');
        }

        // Check for restrictRect
        if (modifiersMatch[1].includes('restrictRect')) {
            console.log('✅ RESTRICTRECT MODIFIER PRESENT');
        }
    }
}

// Find and analyze resizable configuration
const resizableMatch = interactSection.match(/\.resizable\(\{([^}]+)\}\)/s);
if (resizableMatch) {
    console.log('\n📏 RESIZABLE CONFIGURATION:');
    console.log(resizableMatch[1]);

    // Check for edges configuration
    const edgesMatch = resizableMatch[1].match(/edges:\s*\{([^}]+)\}/);
    if (edgesMatch) {
        console.log('✅ EDGES CONFIGURATION:', edgesMatch[1]);
    }

    // Check for modifiers
    const resizeModifiersMatch = resizableMatch[1].match(/modifiers:\s*\[([^\]]+)\]/s);
    if (resizeModifiersMatch) {
        console.log('🔧 RESIZE MODIFIERS:');
        console.log(resizeModifiersMatch[1]);
    }
}

console.log('\n🎨 CSS STYLING ANALYSIS:');
console.log('=========================');

// Extract CSS section
const cssStart = content.indexOf('<style>');
const cssEnd = content.indexOf('</style>');
if (cssStart !== -1 && cssEnd !== -1) {
    const cssSection = content.substring(cssStart + 7, cssEnd);

    // Check for transition or transform properties that could cause movement
    if (cssSection.includes('transition:')) {
        console.log('⚠️  CSS TRANSITIONS FOUND - could cause post-drag animations:');
        const transitionMatches = cssSection.match(/transition:[^;]+;/g);
        if (transitionMatches) {
            transitionMatches.forEach(match => console.log('   ' + match));
        }
    }

    if (cssSection.includes('transform:')) {
        console.log('⚠️  CSS TRANSFORMS FOUND - could cause positioning issues:');
        const transformMatches = cssSection.match(/transform:[^;]+;/g);
        if (transformMatches) {
            transformMatches.forEach(match => console.log('   ' + match));
        }
    }

    if (cssSection.includes('animation:')) {
        console.log('⚠️  CSS ANIMATIONS FOUND - could cause continuous movement:');
        const animationMatches = cssSection.match(/animation:[^;]+;/g);
        if (animationMatches) {
            animationMatches.forEach(match => console.log('   ' + match));
        }
    }
}

console.log('\n🎯 INLINE STYLE ANALYSIS:');
console.log('=========================');

// Look for inline style binding
const styleBindMatch = content.match(/style="left: \{displayPosition\.x\}px; top: \{displayPosition\.y\}px;[^"]*"/);
if (styleBindMatch) {
    console.log('✅ INLINE STYLE BINDING FOUND:');
    console.log('   ' + styleBindMatch[0]);

    // Check if z-index is included
    if (styleBindMatch[0].includes('z-index')) {
        console.log('✅ Z-INDEX INCLUDED IN INLINE STYLES');
    }
}

console.log('\n🚨 POTENTIAL ISSUES IDENTIFIED:');
console.log('==============================');

const issues = [];

// Check for common problems
if (!draggableMatch || !draggableMatch[1].includes('inertia: false')) {
    issues.push('❌ Inertia not explicitly set to false - could cause post-drag easing');
}

if (cssSection && cssSection.includes('transition:')) {
    issues.push('❌ CSS transitions present - could cause post-drag animations');
}

if (content.includes('window.getComputedStyle')) {
    console.log('ℹ️  Computed style monitoring present - good for debugging');
}

// Check for position update logic
const onmoveMatch = draggableMatch && draggableMatch[1].match(/onmove:\s*\([^)]+\)\s*=>\s*\{([^}]+)\}/);
if (onmoveMatch) {
    console.log('🎯 ONMOVE LOGIC:');
    console.log(onmoveMatch[1]);

    // Check if position is set directly on style
    if (onmoveMatch[1].includes('style.left') || onmoveMatch[1].includes('style.top')) {
        console.log('✅ Direct style manipulation found');
    } else {
        issues.push('❌ No direct style manipulation in onmove - position might be handled elsewhere');
    }
}

if (issues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES FOUND:');
    issues.forEach(issue => console.log(issue));
} else {
    console.log('\n✅ No obvious configuration issues found');
}

console.log('\n📊 NEXT STEPS:');
console.log('==============');
console.log('1. Open debug_real_canvas_movement.html in browser');
console.log('2. Try dragging the test container');
console.log('3. Monitor the debug panel for drift detection');
console.log('4. Check browser DevTools for CSS transform changes');
console.log('5. Look for any CSS animations or transitions in Elements panel');

console.log('\n🔍 BROWSER INSPECTION INSTRUCTIONS:');
console.log('===================================');
console.log('1. Open DevTools (F12)');
console.log('2. Select the draggable container element');
console.log('3. Watch the Styles panel during drag operations');
console.log('4. Check the Computed tab for transform property changes');
console.log('5. Monitor the Elements panel for style attribute changes');
console.log('6. Use Performance tab to record drag operations');

console.log('\n✅ Analysis complete!');