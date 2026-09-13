export function isShortTap(origin, current, threshold = 10) {
  if (!origin || !current) return false;
  return Math.hypot(current.x - origin.x, current.y - origin.y) <= threshold;
}
