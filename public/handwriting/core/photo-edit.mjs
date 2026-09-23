export function photoPointFromClient(clientX, clientY, {
  centerX, centerY, displayWidth, displayHeight, rotation = 0, imageWidth, imageHeight
}) {
  if (!(displayWidth > 0 && displayHeight > 0 && imageWidth > 0 && imageHeight > 0)) return null;
  const angle = -rotation * Math.PI / 180;
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
  const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
  const x = (localX / displayWidth + 0.5) * imageWidth;
  const y = (localY / displayHeight + 0.5) * imageHeight;
  return x >= 0 && x < imageWidth && y >= 0 && y < imageHeight ? { x, y } : null;
}

// Find one connected patch of a similar colour. Callers can bound its size or
// radius when they need a smaller selection.
export function connectedColorRegion(pixels, width, height, seedX, seedY, {
  tolerance = 42, maxFraction = 0.45, radius = Infinity
} = {}) {
  const total = width * height;
  const empty = { mask: new Uint8Array(total), count: 0, tooLarge: false };
  if (!total || pixels.length !== total * 4 || seedX < 0 || seedX >= width || seedY < 0 || seedY >= height) return empty;
  const seed = Math.floor(seedY) * width + Math.floor(seedX);
  const seedOffset = seed * 4;
  if (pixels[seedOffset + 3] < 16) return empty;

  const queue = new Uint32Array(total);
  const visited = new Uint8Array(total);
  const mask = empty.mask;
  const limit = Math.max(1, Math.floor(total * maxFraction));
  const squaredTolerance = tolerance * tolerance;
  const [red, green, blue] = pixels.slice(seedOffset, seedOffset + 3);
  const centerX = Math.floor(seedX);
  const centerY = Math.floor(seedY);
  const squaredRadius = radius * radius;
  let head = 0;
  let tail = 0;
  const visit = index => {
    if (visited[index]) return;
    visited[index] = 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if ((x - centerX) ** 2 + (y - centerY) ** 2 > squaredRadius) return;
    const offset = index * 4;
    if (pixels[offset + 3] < 16) return;
    const dr = pixels[offset] - red;
    const dg = pixels[offset + 1] - green;
    const db = pixels[offset + 2] - blue;
    if (dr * dr + dg * dg + db * db > squaredTolerance) return;
    mask[index] = 1;
    queue[tail++] = index;
  };
  visit(seed);
  while (head < tail) {
    if (tail > limit) return { mask: new Uint8Array(total), count: 0, tooLarge: true };
    const index = queue[head++];
    const x = index % width;
    if (x > 0) visit(index - 1);
    if (x + 1 < width) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index + width < total) visit(index + width);
  }
  return { mask, count: tail, tooLarge: false };
}

export function regionPreviewPixels(mask, width, height, edgeRadius = 1, preview = new Uint8ClampedArray(width * height * 4)) {
  if (mask.length !== width * height) return preview;
  const edge = Math.max(1, Math.floor(edgeRadius));
  for (let index = 0; index < mask.length; index++) {
    if (!mask[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    const isEdge = x < edge || x + edge >= width || y < edge || y + edge >= height
      || !mask[index - edge] || !mask[index + edge]
      || !mask[index - edge * width] || !mask[index + edge * width];
    const offset = index * 4;
    preview[offset] = isEdge ? 44 : 71;
    preview[offset + 1] = isEdge ? 56 : 82;
    preview[offset + 2] = isEdge ? 143 : 171;
    preview[offset + 3] = isEdge ? 235 : 65;
  }
  return preview;
}
