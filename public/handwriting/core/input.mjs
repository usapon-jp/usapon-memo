// No DOM, React, storage or app dependencies. Times and distances are CSS coordinates.
export class InputSession {
  constructor(callbacks) { this.callbacks = callbacks; this.pointers = new Map(); this.active = null; this.candidate = null; this.blocked = false; this.penOnly = false; }
  interrupt(reason) {
    if (!this.active) return;
    // Trackpad/mouse cancellation is not a touch gesture. Keep the points already
    // received, without appending a potentially invalid cancellation coordinate.
    const preserve = this.active.type === 'mouse';
    this.callbacks.trace?.({ reason, input: this.active.type, action: preserve ? 'preserved' : 'discarded' });
    if (preserve) this.callbacks.finish(); else this.callbacks.cancel();
    this.active = null;
  }
  down(p) {
    if (this.pointers.has(p.id)) return;
    // Palm contacts reported after an active stylus must never block the pen.
    if (p.type === 'touch' && this.active?.type === 'pen') return;
    this.pointers.set(p.id, { ...p, startX: p.x, startY: p.y, moved: 0 });
    if (p.type === 'pen') {
      if (this.active) this.callbacks.cancel();
      // A stylus takes priority over stale or accidental touch-only gestures.
      for (const [id, pointer] of this.pointers) {
        if (pointer.type === 'touch') this.pointers.delete(id);
      }
      this.candidate = null; this.blocked = false; this.active = p; this.callbacks.begin(p); return;
    }
    if (this.active?.type === 'pen' || this.blocked) return;
    const touches = [...this.pointers.values()].filter(e => e.type === 'touch');
    if (p.type === 'touch' && touches.length >= 2) {
      if (this.active) this.callbacks.cancel();
      this.active = null;
      if (touches.length === 2 && !this.candidate && touches.every(e => e.moved <= 12) && Math.abs(touches[0].time - touches[1].time) <= 150) {
        this.candidate = { ids: new Set(touches.map(e => e.id)), time: Math.min(...touches.map(e => e.time)) };
      } else { this.candidate = null; this.blocked = true; }
      return;
    }
    if (this.pointers.size === 1 && !(this.penOnly && p.type === 'touch')) {
      this.active = p; this.callbacks.begin(p);
    }
  }
  move(p) {
    const old = this.pointers.get(p.id); if (!old) return;
    old.moved = Math.max(old.moved, Math.hypot(p.x - old.startX, p.y - old.startY));
    if (this.candidate && (old.moved > 12 || p.time - this.candidate.time > 250)) { this.candidate = null; this.blocked = true; }
    if (this.active?.id === p.id) this.callbacks.append(p);
  }
  up(p, cancelled = false, reason = 'pointercancel') {
    if (!this.pointers.has(p.id)) return;
    if (!cancelled) this.move(p);
    this.pointers.delete(p.id);
    if (cancelled) {
      // A cancelled palm/secondary contact must not cancel the drawing pointer.
      if (this.active?.id === p.id) this.interrupt(reason);
      else this.callbacks.trace?.({ reason, input: p.type, action: 'ignored-secondary' });
      this.candidate = null; this.blocked = !this.active;
    } else if (this.active?.id === p.id) {
      this.callbacks.finish(); this.active = null;
      // Remaining contacts after a pen stroke may be a palm: wait for all to lift.
      if (this.pointers.size) this.blocked = true;
    }
    if (this.candidate && !this.pointers.size) {
      if (p.time - this.candidate.time <= 250) this.callbacks.undo();
      this.candidate = null;
    }
    if (!this.pointers.size) { this.blocked = false; this.candidate = null; }
  }
  cancelAll(reason = 'control-change') { this.interrupt(reason); this.candidate = null; this.pointers.clear(); this.blocked = false; }
  gesture() { this.candidate = null; this.blocked = true; }
}
