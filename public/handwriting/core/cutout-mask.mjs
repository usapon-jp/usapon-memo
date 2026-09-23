const clamp01 = value => Math.max(0, Math.min(1, value));

// Keep pixels well inside the subject opaque (including dark eyes), while
// retaining the model's soft edge around fur and whiskers.
export function refineForegroundMask(raw, width, height) {
  if (raw.length !== width * height) throw new Error('切り抜きマスクの大きさが違います。');
  let min = Infinity;
  let max = -Infinity;
  for (const value of raw) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || max - min < 1e-8) throw new Error('切り抜きマスクを作れませんでした。');

  const size = width * height;
  const normalized = new Uint8Array(size);
  const foreground = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    normalized[i] = Math.round(clamp01((raw[i] - min) / (max - min)) * 255);
    foreground[i] = normalized[i] >= 90 ? 1 : 0;
  }

  const horizontal = new Uint8Array(size);
  const radius = 5;
  for (let y = 0; y < height; y++) {
    for (let x = radius; x < width - radius; x++) {
      let solid = 1;
      for (let dx = -radius; dx <= radius; dx++) {
        if (!foreground[y * width + x + dx]) { solid = 0; break; }
      }
      horizontal[y * width + x] = solid;
    }
  }

  const alpha = new Uint8Array(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      let solid = y >= radius && y < height - radius && horizontal[index];
      if (solid) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (!horizontal[index + dy * width]) { solid = 0; break; }
        }
      }
      const soft = clamp01((normalized[index] / 255 - 0.32) / 0.68);
      alpha[index] = solid ? 255 : Math.round(soft * 255);
    }
  }
  return alpha;
}
