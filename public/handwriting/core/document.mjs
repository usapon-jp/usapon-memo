export const LIMITS = Object.freeze({ strokes: 2000, points: 100000, undo: 50, jsonBytes: 12 * 1024 * 1024 });
export const BRUSHES = Object.freeze(['pen', 'eraser', 'pencil', 'marker', 'crayon', 'watercolor']);
export function newDocument(canvas = { width: 1000, height: 750 }) {
  return { schemaVersion: 1, rendererVersion: 'round-pen-v1', id: crypto.randomUUID(), revision: 0,
    canvas: { width: canvas.width, height: canvas.height, coordinateSpace: 'logical-px' }, layers: [{id:'base',name:'レイヤー1',visible:true,opacity:1,clip:false}], strokes: [] };
}
export function validateDocument(value) {
  const fail = () => { throw new Error('原本の形式・バージョンまたは容量を確認してください。'); };
  const finite = (n, lo, hi) => Number.isFinite(n) && n >= lo && n <= hi;
  if (!value || value.schemaVersion !== 1 || value.rendererVersion !== 'round-pen-v1' || typeof value.id !== 'string' || value.id.length > 100 || !Number.isInteger(value.revision) || value.revision < 0) fail();
  if (value.canvas?.coordinateSpace !== 'logical-px' || !finite(value.canvas.width, 320, 4096) || !finite(value.canvas.height, 320, 4096) || !Array.isArray(value.strokes) || value.strokes.length > LIMITS.strokes) fail();
  let count = 0;
  const layers = value.layers ?? [{id:'base',name:'レイヤー1',visible:true,opacity:1,clip:false}];
  if (!Array.isArray(layers) || !layers.length || layers.length > 3) fail();
  const layerIds = new Set();
  for (const [index, layer] of layers.entries()) {
    if (!layer || typeof layer.id !== 'string' || layer.id.length > 100 || layerIds.has(layer.id) || typeof layer.name !== 'string' || layer.name.length > 50 || typeof layer.visible !== 'boolean' || !finite(layer.opacity,0,1) || typeof layer.clip !== 'boolean' || (index === 0 && layer.clip)) fail();
    layerIds.add(layer.id);
  }
  const ids = new Set();
  const strokes = value.strokes.map(s => {
    if (!s || typeof s.id !== 'string' || ids.has(s.id) || s.id.length > 100 || !BRUSHES.includes(s.tool) || !['pen', 'touch', 'mouse'].includes(s.input) || !/^#[0-9a-f]{6}$/i.test(s.color) || !finite(s.size, 1, 60) || !(s.brushVersion === 1 || (['pencil', 'marker', 'watercolor', 'crayon'].includes(s.tool) && s.brushVersion === 2) || (['pencil', 'watercolor', 'crayon'].includes(s.tool) && s.brushVersion === 3)) || (s.opacity !== undefined && !finite(s.opacity, 0, 1)) || !finite(s.smoothingMs, 0, 100) || !Array.isArray(s.points) || !s.points.length) fail();
    ids.add(s.id); count += s.points.length;
    if (!layerIds.has(s.layerId ?? layers[0].id)) fail();
    if (count > LIMITS.points) fail();
    let lastTime = -1;
    const points = s.points.map(p => {
      if (!Array.isArray(p) || p.length !== 4 || !finite(p[0], 0, value.canvas.width) || !finite(p[1], 0, value.canvas.height) || !finite(p[2], 0, 1) || !finite(p[3], lastTime, 3600000)) fail();
      lastTime = p[3]; return [...p];
    });
    return { id: s.id, layerId:s.layerId ?? layers[0].id, tool: s.tool, input: s.input, color: s.color, size: s.size, ...(s.opacity === undefined ? {} : {opacity: s.opacity}), brushVersion: s.brushVersion, smoothingMs: s.smoothingMs, points };
  });
  return { schemaVersion: 1, rendererVersion: 'round-pen-v1', id: value.id, revision: value.revision, canvas: { ...value.canvas }, layers:layers.map(l=>({...l})), strokes };
}
// Structural sharing keeps undo bounded without duplicating the full drawing per point.
export class DrawingHistory {
  constructor(document = newDocument()) { this.document = validateDocument(document); this.past = []; this.future = []; }
  snapshot() { return {strokes:this.document.strokes,layers:this.document.layers}; }
  changeLayers(layers) {
    const next = validateDocument({...this.document,layers});
    this.past.push(this.snapshot()); if(this.past.length>LIMITS.undo)this.past.shift();
    this.future=[]; this.document={...next,revision:this.document.revision+1};
  }
  commit(stroke) {
    const checked = validateDocument({ ...this.document, strokes: [stroke] }).strokes[0];
    if (this.document.strokes.length >= LIMITS.strokes || this.document.strokes.some(s => s.id === checked.id) || this.document.strokes.reduce((n, s) => n + s.points.length, checked.points.length) > LIMITS.points) throw new Error('原本の操作数または点数が上限です。');
    this.past.push(this.snapshot()); if (this.past.length > LIMITS.undo) this.past.shift();
    this.future = []; this.document = { ...this.document, strokes: [...this.document.strokes, checked], revision: this.document.revision + 1 };
  }
  clear() {
    if (!this.document.strokes.length) return false;
    this.past.push(this.snapshot()); if (this.past.length > LIMITS.undo) this.past.shift();
    this.future = [];
    this.document = { ...this.document, strokes: [], revision: this.document.revision + 1 }; return true;
  }
  undo() {
    if (!this.past.length) return false;
    this.future.push(this.snapshot());
    this.document = { ...this.document, ...this.past.pop(), revision: this.document.revision + 1 }; return true;
  }
  redo() {
    if (!this.future.length) return false;
    this.past.push(this.snapshot());
    this.document = { ...this.document, ...this.future.pop(), revision: this.document.revision + 1 }; return true;
  }
}
export function strokeRadius(stroke, pressure) {
  return stroke.size / 2 * (stroke.tool === 'eraser' ? 1 : 0.25 + pressure * 0.75);
}
