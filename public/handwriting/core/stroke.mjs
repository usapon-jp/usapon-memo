// Host translates screen coordinates to logical pixels; smoothing is shared core logic.
export class StrokeBuilder {
  constructor({ tool, input, color, size, time, opacity = 1 }) {
    const smoothingMs = tool === 'pen' ? (input === 'pen' ? 8 : input === 'touch' ? 28 : 16) : (input === 'pen' ? 5 : input === 'touch' ? 22 : 10);
this.stroke = { id: crypto.randomUUID(), tool, input, color, size, opacity, brushVersion: ['crayon', 'pencil'].includes(tool) ? 4 : ['pencil', 'watercolor', 'crayon'].includes(tool) ? 3 : tool === 'marker' ? 2 : 1, smoothingMs, points: [] };
    this.firstTime = time; this.lastInput = null;
  }
  sample({ x, y, time, pressure }) {
    const s = this.stroke; const previous = s.points.at(-1);
    const t = Math.max(previous?.[3] || 0, Math.min(3600000, time - this.firstTime));
    const dt = this.lastInput ? Math.max(1, time - this.lastInput.time) : 16;
    const speed = this.lastInput ? Math.hypot(x - this.lastInput.x, y - this.lastInput.y) / dt : 0.5;
    const value = s.input === 'pen' ? Math.max(0.05, Math.min(1, pressure > 0 ? pressure : previous?.[2] || 0.5)) : Math.max(0.3, Math.min(0.85, 0.8 - speed * 0.12));
    const alpha = 1 - Math.exp(-dt / s.smoothingMs);
    const point = previous ? [previous[0] + (x - previous[0]) * alpha, previous[1] + (y - previous[1]) * alpha, value, t] : [x, y, value, t];
    this.lastInput = { x, y, time };
    if (previous && Math.hypot(point[0] - previous[0], point[1] - previous[1]) < 0.18 && Math.abs(value - previous[2]) < 0.02) return false;
    s.points.push(point); return true;
  }
}
