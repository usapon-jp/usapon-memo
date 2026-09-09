export function contentPointAtAnchor(anchor, surfaceStart, zoom) {
  return (anchor - surfaceStart) / zoom;
}

export function anchoredScroll(currentScroll, surfaceStart, anchor, contentPoint, zoom) {
  const wantedSurfaceStart = anchor - contentPoint * zoom;
  return currentScroll + surfaceStart - wantedSurfaceStart;
}
