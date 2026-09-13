export function contentPointAtAnchor(anchor, surfaceStart, zoom) {
  return (anchor - surfaceStart) / zoom;
}

export function anchoredScroll(currentScroll, surfaceStart, anchor, contentPoint, zoom) {
  const wantedSurfaceStart = anchor - contentPoint * zoom;
  return currentScroll + surfaceStart - wantedSurfaceStart;
}

export function zoomedStageLayout(baseWidth, baseHeight, zoom, viewportWidth, viewportHeight) {
  const contentWidth = baseWidth * zoom;
  const contentHeight = baseHeight * zoom;
  const width = Math.max(viewportWidth, contentWidth);
  const height = Math.max(viewportHeight, contentHeight);
  return {
    width,
    height,
    offsetX: Math.max(0, (width - contentWidth) / 2),
    offsetY: Math.max(0, (height - contentHeight) / 2)
  };
}
