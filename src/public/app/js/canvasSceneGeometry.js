export const hasCanvasGeometry = g => g && Number.isFinite(g.baseWidth) && g.baseWidth > 0 && Number.isFinite(g.baseHeight) && g.baseHeight > 0;
export const hasGridGeometry = g => g && ['gridLeft', 'gridTop', 'gridWidth', 'gridHeight'].every(k => Number.isFinite(g[k])) && g.gridWidth > 0 && g.gridHeight > 0;
export function sceneReference(strokes) {
  const first = strokes.find(s => hasCanvasGeometry(s.sceneGeometry || s));
  if (!first) return null;
  const reference = { ...(first.sceneGeometry || first), points: undefined };
  if (hasGridGeometry(reference)) {
    const bounds = { left: 0, top: 0, right: reference.baseWidth, bottom: reference.baseHeight };
    for (const s of strokes.filter(s => hasCanvasGeometry(s) && hasGridGeometry(s))) {
      bounds.left = Math.min(bounds.left, reference.gridLeft - s.gridLeft / s.gridWidth * reference.gridWidth);
      bounds.top = Math.min(bounds.top, reference.gridTop - s.gridTop / s.gridHeight * reference.gridHeight);
      bounds.right = Math.max(bounds.right, reference.gridLeft + (s.baseWidth - s.gridLeft) / s.gridWidth * reference.gridWidth);
      bounds.bottom = Math.max(bounds.bottom, reference.gridTop + (s.baseHeight - s.gridTop) / s.gridHeight * reference.gridHeight);
    }
    reference.bounds = bounds;
  }
  return reference;
}
export function fitScene(reference, width, height) {
  const bounds = reference.bounds || { left: 0, top: 0, right: reference.baseWidth, bottom: reference.baseHeight };
  const scale = Math.min(width / (bounds.right - bounds.left), height / (bounds.bottom - bounds.top));
  const left = (width - (bounds.right - bounds.left) * scale) / 2 - bounds.left * scale;
  const top = (height - (bounds.bottom - bounds.top) * scale) / 2 - bounds.top * scale;
  return { scale, left, top, grid: hasGridGeometry(reference) ? {
    gridLeft: left + reference.gridLeft * scale, gridTop: top + reference.gridTop * scale,
    gridWidth: reference.gridWidth * scale, gridHeight: reference.gridHeight * scale
  } : null };
}
export function mapScenePoint(point, stroke, reference, fit) {
  let x, y;
  if (hasGridGeometry(reference) && hasGridGeometry(stroke)) {
    // Different capture layouts refer to the same formula coordinates.
    const u = Number.isFinite(point.relX) ? point.relX : (point.x - stroke.gridLeft) / stroke.gridWidth;
    const v = Number.isFinite(point.relY) ? point.relY : (point.y - stroke.gridTop) / stroke.gridHeight;
    x = reference.gridLeft + u * reference.gridWidth;
    y = reference.gridTop + v * reference.gridHeight;
  } else if (hasCanvasGeometry(stroke) && Number.isFinite(point.x) && Number.isFinite(point.y)) {
    // Legacy canvas-only points were drawn on a uniformly fitted reference.
    const capture = fitScene(reference, stroke.baseWidth, stroke.baseHeight);
    x = (point.x - capture.left) / capture.scale;
    y = (point.y - capture.top) / capture.scale;
  } else return null;
  return { x: fit.left + x * fit.scale, y: fit.top + y * fit.scale,
    scale: Math.max(0.5, Math.min(2, fit.scale)) };
}
