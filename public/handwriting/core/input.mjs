// No DOM, React, storage or app dependencies. Times and distances are CSS coordinates.
export class InputSession {
  constructor(callbacks) { this.callbacks = callbacks; this.pointers = new Map(); this.active = null; this.candidate = null; this.blocked = false; this.penOnly = false; }
  interrupt(reason) {
    if (!this.active) return;
    // A cancelled pen stream may still contain a real stroke. Keep the points
    // already received, without appending the cancellation coordinate.
    const preserve = this.active.type === 'mouse' || this.active.type === 'pen';
    this.callbacks.trace?.({ reason, input: this.active.type, action: preserve ? 'preserved' : 'discarded' });
    if (preserve) this.callbacks.finish(); else this.callbacks.cancel();
    this.active = null;
  }
  down(p) {
    if (this.pointers.has(p.id)) {
      if (p.type !== 'pen') return;
      // Browsers may reuse a stylus pointer ID after its end event was missed.
      // A new pointerdown starts a new contact; the old entry must not eat it.
      this.pointers.delete(p.id);
      if (this.active?.id === p.id) this.interrupt('next-pen-down');
    }
    // Palm contacts reported after an active stylus must never block the pen.
    if (p.type === 'touch' && this.active?.type === 'pen') return;
    this.pointers.set(p.id, { ...p, startX: p.x, startY: p.y, moved: 0 });
    if (p.type === 'pen') {
      if (this.active) this.interrupt('pen-takes-priority');
      // A stylus takes priority over stale contacts and accidental palm input.
      for (const id of this.pointers.keys()) {
        if (id !== p.id) this.pointers.delete(id);
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
    let old = this.pointers.get(p.id);
    if (!old && p.type === 'pen' && ((p.buttons & 1) || p.pressure > 0)) {
      // A contact move still means the Pencil is down even if its down event
      // was swallowed before it reached this surface.
      this.callbacks.trace?.({ reason: 'pen-move-without-down', input: 'pen', action: 'recovered' });
      this.down(p);
      old = this.pointers.get(p.id);
    }
    if (!old) return;
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
