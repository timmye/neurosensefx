// ADR Boundary Rendering Utilities - Single Responsibility
// Framework-first: Direct Canvas 2D rendering for ADR boundaries

import { renderPixelPerfectLine } from './dayRangeCore.js';

export function renderBoundaryLines(ctx, width, coordinates, colors) {
  if (!coordinates) return;

  ctx.save();
  ctx.strokeStyle = colors.boundaryLine;
  ctx.lineWidth = 2;

  // Draw boundary lines at the ADR boundaries
  renderPixelPerfectLine(ctx, 0, coordinates.upperY, width, coordinates.upperY);
  renderPixelPerfectLine(ctx, 0, coordinates.lowerY, width, coordinates.lowerY);

  ctx.restore();
}

export function renderBoundaryLabels(
  _ctx, _width, _height, _boundaries, _coordinates, _colors, _labelPadding = 5
) {
  // Function disabled - ADR percentage labels no longer rendered
  // This reduces visual clutter while maintaining API compatibility
  return;
}

export function renderReferenceLines(ctx, width, boundaries, coordinates, referenceLines, colors) {
  if (!shouldRenderReferences(boundaries, referenceLines)) return;

  ctx.save();
  ctx.strokeStyle = `${colors.boundaryLine}99`; // Add transparency
  ctx.lineWidth = 1;
  ctx.setLineDash([8,8]);

  // Only show if different from current boundaries
  if (boundaries.upperExpansion > 0.5 && Math.abs(referenceLines.fiftyUpperY - coordinates.upperY) > 5) {
    renderPixelPerfectLine(ctx, 0, referenceLines.fiftyUpperY, width, referenceLines.fiftyUpperY);
    ctx.fillStyle = `${colors.percentageLabels}99`;
    //ctx.fillText('+50% ADR', width - 70, referenceLines.fiftyUpperY);
  }

  if (boundaries.lowerExpansion > 0.5 && Math.abs(referenceLines.fiftyLowerY - coordinates.lowerY) > 5) {
    renderPixelPerfectLine(ctx, 0, referenceLines.fiftyLowerY, width, referenceLines.fiftyLowerY);
    ctx.fillStyle = `${colors.percentageLabels}99`;
    //ctx.fillText('-50% ADR', width - 70, referenceLines.fiftyLowerY);
  }

  ctx.setLineDash([]);
  ctx.restore();
}

function shouldRenderReferences(boundaries, referenceLines) {
  return boundaries && referenceLines &&
         (boundaries.upperExpansion > 0.5 || boundaries.lowerExpansion > 0.5);
}