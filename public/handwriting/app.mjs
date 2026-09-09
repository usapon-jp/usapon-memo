import { DrawingHistory, LIMITS, newDocument, validateDocument } from './core/document.mjs';
import { InputSession } from './core/input.mjs';
import { StrokeBuilder } from './core/stroke.mjs';
import { paintSegment, renderDocument, exportPng, exportStampPng, exportStampDataUrl, BrushStrokeRenderer } from './core/render.mjs';
import { sendToMemo } from './host-bridge.mjs';
const $ = id => document.getElementById(id);
const canvas = $('drawing'); const ctx = canvas.getContext('2d');
const mobileCanvas = matchMedia('(max-width: 480px)').matches;
const DRAFT_STORAGE_KEY = 'usapon_handwriting_draft_v1';
let initialDocument = mobileCanvas ? newDocument({ width: 1000, height: 1500 }) : newDocument();
try {
  const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
  if (saved) initialDocument = validateDocument(JSON.parse(saved));
} catch (error) {
  console.warn('Saved handwriting could not be restored.', error);
}
let history = new DrawingHistory(initialDocument); let stroke = null; let tool = 'pencil'; let dirty = false;
let activeBrush = null;
const strokeBase = document.createElement('canvas');
let painted = 0; let frame = 0; let builder = null; let started = 0;
let lastFrameMs = 0; let peakFrameMs = 0; let frameSamples = []; let failure = false;
const message = text => { $('status').textContent = text; };
const inputLog = [];
function trace(entry) {
  inputLog.push({ time: new Date().toLocaleTimeString(), ...entry });
  if (inputLog.length > 30) inputLog.shift();
  $('inputLog').textContent = inputLog.map(e => `${e.time} ${e.reason} / ${e.input} / ${e.action}`).join('\n');
}
function metrics() {
  const points = history.document.strokes.reduce((n, s) => n + s.points.length, 0);
  $('metrics').textContent = `${history.document.strokes.length}操作 / ${points}点 / Undo ${history.past.length} / 最終描画 ${lastFrameMs.toFixed(1)}ms / 最大 ${peakFrameMs.toFixed(1)}ms / Canvas ${canvas.width}×${canvas.height} / 原本版 ${history.document.revision}`;
  $('undo').disabled = !history.past.length || Boolean(stroke); $('redo').disabled = !history.future.length || Boolean(stroke);
  $('clear').disabled = !history.document.strokes.length || Boolean(stroke);
}
function redraw() {
  $('surface').style.aspectRatio = `${history.document.canvas.width} / ${history.document.canvas.height}`;
  renderDocument(canvas, history.document); metrics();
}
function schedule() { if (!frame) frame = requestAnimationFrame(paintPending); }
function paintPending() {
  frame = 0; if (!stroke) return;
  const before = performance.now();
  if (activeBrush) {
    activeBrush.append();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(strokeBase, 0, 0);
    ctx.restore(); activeBrush.composite(ctx);
  } else {
    for (let i = painted; i < stroke.points.length; i++) paintSegment(ctx, stroke, stroke.points[Math.max(0, i - 1)], stroke.points[i]);
  }
  painted = stroke.points.length;
  lastFrameMs = performance.now() - before; peakFrameMs = Math.max(peakFrameMs, lastFrameMs);
  frameSamples.push(lastFrameMs); if (frameSamples.length > 500) frameSamples.shift();
}
function addPoint(p) {
  if (!stroke || failure) return;
  const bounds = canvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(history.document.canvas.width, (p.x - bounds.left) * history.document.canvas.width / bounds.width));
  const y = Math.max(0, Math.min(history.document.canvas.height, (p.y - bounds.top) * history.document.canvas.height / bounds.height));
  if (stroke.points.length + started >= LIMITS.points) { failure = true; message('点数の上限です。この線を中止しました。原本を保存してください。'); return; }
  if (builder.sample({ x, y, time: p.time, pressure: p.pressure })) schedule();
}
function cancelStroke() {
  activeBrush?.dispose(); activeBrush = null;
  if (frame) cancelAnimationFrame(frame); frame = 0; stroke = null; builder = null; painted = 0; redraw();
}
function undo() { if (stroke) return; if (history.undo()) { dirty = true; redraw(); message('1操作戻しました'); } }
function redo() { if (stroke) return; if (history.redo()) { dirty = true; redraw(); message('1操作やり直しました'); } }
const input = new InputSession({
  begin(p) {
    failure = false; painted = 0;
    started = history.document.strokes.reduce((n, s) => n + s.points.length, 0);
    builder = new StrokeBuilder({ tool, input: p.type, color: $('color').value, size: +$('size').value, opacity: tool === 'eraser' ? 1 : +$('opacity').value / 100, time: p.time }); stroke = builder.stroke;
    activeBrush?.dispose(); activeBrush = null;
    if (tool !== 'eraser') {
      strokeBase.width = canvas.width; strokeBase.height = canvas.height;
      strokeBase.getContext('2d').drawImage(canvas, 0, 0);
      activeBrush = new BrushStrokeRenderer(canvas, history.document.canvas, stroke);
    }
    addPoint(p); metrics();
  },
  append: addPoint,
  finish() {
    if (!stroke) return;
    if (frame) cancelAnimationFrame(frame); frame = 0;
    if (failure) { cancelStroke(); return; }
    paintPending();
    try { history.commit(stroke); dirty = true; stroke = null; activeBrush?.dispose(); activeBrush = null; metrics(); message('未保存'); }
    catch (error) { cancelStroke(); message(error.message); }
  },
  cancel: cancelStroke, undo, trace
});
function point(e) { return { id: e.pointerId, type: ['pen', 'touch'].includes(e.pointerType) ? e.pointerType : 'mouse', x: e.clientX, y: e.clientY, time: e.timeStamp, pressure: e.pressure }; }
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault(); canvas.setPointerCapture(e.pointerId); input.down(point(e));
});
canvas.addEventListener('pointermove', e => {
  e.preventDefault(); const samples = e.getCoalescedEvents?.() || [];
  (samples.length ? samples : [e]).forEach(sample => input.move(point(sample)));
});
canvas.addEventListener('pointerup', e => { e.preventDefault(); input.up(point(e)); });
canvas.addEventListener('pointercancel', e => input.up(point(e), true));
canvas.addEventListener('lostpointercapture', e => { if (input.pointers.has(e.pointerId)) input.up(point(e), true, 'lostpointercapture'); });
window.addEventListener('blur', () => input.cancelAll('window-blur'));
document.addEventListener('visibilitychange', () => { if (document.hidden) input.cancelAll('document-hidden'); });
window.addEventListener('beforeunload', e => { if (dirty || stroke) { e.preventDefault(); e.returnValue = ''; } });
$('penOnly').addEventListener('change', () => { input.cancelAll(); input.penOnly = $('penOnly').checked; });
$('paper').addEventListener('change', () => $('surface').classList.toggle('paper', $('paper').checked));
const sizeControl = document.querySelector('.size');
for (const button of document.querySelectorAll('[data-drawing-tool]')) button.addEventListener('click', () => {
  input.cancelAll();
  const mode = button.dataset.drawingTool;
  tool = mode;
  document.querySelector('.opacity-adjust').hidden = tool === 'eraser';
  document.querySelectorAll('[data-drawing-tool]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  sizeControl.classList.add('is-open');
  message(`${button.getAttribute('aria-label')}を選択`);
});
$('drawing').addEventListener('pointerdown', () => sizeControl.classList.remove('is-open'));
$('surface').addEventListener('pointerdown', () => sizeControl.classList.remove('is-open'));
const moreMenu = document.querySelector('.more');
document.addEventListener('pointerdown', event => {
  if (moreMenu.open && !moreMenu.contains(event.target)) moreMenu.open = false;
  if (!pasteOptions.hidden && !pasteOptions.contains(event.target) && event.target !== $('paste')) closePasteOptions();
  if (sizeControl.classList.contains('is-open') && !sizeControl.contains(event.target) && !event.target.closest('[data-drawing-tool]')) sizeControl.classList.remove('is-open');
});
function updateSizeUi() {
  $('sizeValue').value = $('size').value;
  document.querySelectorAll('[data-size]').forEach(item => item.classList.toggle('is-selected', item.dataset.size === $('size').value));
}
$('size').addEventListener('input', updateSizeUi);
$('opacity').addEventListener('input', () => { $('opacityValue').textContent = `${$('opacity').value}%`; });
for (const preset of document.querySelectorAll('[data-size]')) preset.addEventListener('click', () => {
  $('size').value = preset.dataset.size;
  updateSizeUi();
});
$('sizeValue').addEventListener('input', () => {
  const value = Number($('sizeValue').value);
  if (Number.isFinite(value) && value >= 1 && value <= 32) {
    $('size').value = String(Math.round(value));
    document.querySelectorAll('[data-size]').forEach(item => item.classList.toggle('is-selected', item.dataset.size === $('size').value));
  }
});
$('sizeValue').addEventListener('change', () => {
  const value = Math.min(32, Math.max(1, Math.round(Number($('sizeValue').value) || 8)));
  $('size').value = String(value);
  updateSizeUi();
});
updateSizeUi();
for (const dot of document.querySelectorAll('.color-dot')) dot.addEventListener('click', () => {
  $('color').value = dot.dataset.color;
  document.querySelectorAll('.color-dot').forEach(item => item.classList.toggle('is-selected', item === dot));
});
$('color').addEventListener('input', () => document.querySelectorAll('.color-dot').forEach(item => item.classList.remove('is-selected')));
$('undo').addEventListener('click', undo); $('redo').addEventListener('click', redo);
$('clear').addEventListener('click', () => {
  if (stroke) return;
  if (history.clear()) { dirty = true; redraw(); message('全部消しました。「戻す」で復元できます（原本は未保存）'); }
});
document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); e.shiftKey ? redo() : undo(); } });
function download(blob, name) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function paintBackground(context, width, height, mode) {
  context.fillStyle = mode === 'dark' ? '#343438' : '#ffffff';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = '#e3e3df';
  context.lineWidth = Math.max(1, width / 1000);
  if (mode === 'ruled') {
    const step = Math.max(28, height * .044);
    for (let y = step; y < height; y += step) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  }
  if (mode === 'grid') {
    const step = Math.max(24, width * .04);
    for (let x = step; x < width; x += step) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
    for (let y = step; y < height; y += step) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  }
}
function exportWithBackground(maxEdge = 800) {
  const drawing = document.createElement('canvas');
  drawing.width = maxEdge;
  drawing.height = Math.round(maxEdge * history.document.canvas.height / history.document.canvas.width);
  renderDocument(drawing, history.document);
  const output = document.createElement('canvas');
  output.width = drawing.width; output.height = drawing.height;
  const context = output.getContext('2d');
  paintBackground(context, output.width, output.height, $('background')?.value || 'plain');
  context.drawImage(drawing, 0, 0);
  const result = { dataUrl: output.toDataURL('image/png'), width: output.width, height: output.height };
  drawing.width = drawing.height = output.width = output.height = 1;
  return result;
}
$('save').addEventListener('click', () => {
  input.cancelAll();
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(history.document));
    dirty = false;
    message('この端末に保存しました');
  } catch (error) {
    message('保存できませんでした。スタンプとして保存してから、まっさらにしてください。');
  }
});
$('load').addEventListener('click', () => {
  input.cancelAll();
  try {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!saved) { message('保存した手書きはまだありません'); return; }
    if (dirty && !window.confirm('今の未保存の手書きを、保存した内容に戻しますか？')) return;
    history = new DrawingHistory(validateDocument(JSON.parse(saved)));
    dirty = false;
    redraw();
    message('保存した続きを開きました');
  } catch (error) { message('保存した手書きを開けませんでした。今の絵は残っています。'); }
});
$('png').addEventListener('click', async () => {
  input.cancelAll(); $('png').disabled = true;
  try { const blob = await exportStampPng(history.document); download(blob, `stamp-${history.document.id}.png`); message('描いた部分をスタンプとして保存しました'); }
  catch (error) { message(error.message); } finally { $('png').disabled = false; }
});
const pasteOptions = $('pasteOptions');
const closePasteOptions = () => { pasteOptions.hidden = true; $('paste').setAttribute('aria-expanded', 'false'); };
$('paste').addEventListener('click', () => {
  const willOpen = pasteOptions.hidden;
  pasteOptions.hidden = !willOpen;
  $('paste').setAttribute('aria-expanded', String(willOpen));
});
for (const option of document.querySelectorAll('[data-paste-background]')) option.addEventListener('click', async () => {
  input.cancelAll(); closePasteOptions();
  document.querySelectorAll('[data-paste-background]').forEach(button => { button.disabled = true; });
  const backgroundIncluded = option.dataset.pasteBackground === 'true';
  message('貼り付ける画像を準備しています');
  try {
    const image = backgroundIncluded ? exportWithBackground() : exportStampDataUrl(history.document);
    const target = sendToMemo({ ...image, backgroundIncluded });
    message('メモを開いています');
    dirty = false;
    window.location.href = target;
  } catch (error) {
    message(error.message || '貼り付ける画像を作れませんでした。');
    document.querySelectorAll('[data-paste-background]').forEach(button => { button.disabled = false; });
  }
});
let oldWidth = 0;
new ResizeObserver(() => {
  const targetHeight = matchMedia('(max-width: 480px)').matches ? 1500 : 750;
  if (!dirty && !history.document.strokes.length && history.document.canvas.height !== targetHeight) {
    history = new DrawingHistory(newDocument({ width: 1000, height: targetHeight }));
    $('surface').style.aspectRatio = `${history.document.canvas.width} / ${history.document.canvas.height}`;
  }
  const cssWidth = canvas.getBoundingClientRect().width;
  const edge = Math.max(1, Math.min(1536, Math.round(cssWidth * Math.min(2, devicePixelRatio || 1))));
  const height = Math.round(edge * history.document.canvas.height / history.document.canvas.width);
  if (edge === oldWidth && canvas.height === height) return;
  input.cancelAll('canvas-resize'); oldWidth = edge; canvas.width = edge; canvas.height = height; redraw();
}).observe($('surface'));
// Explicit local test surface; no network, application storage or external APIs.
window.lab = { get document() { return structuredClone(history.document); }, get stats() { return { undo: history.past.length, redo: history.future.length, lastFrameMs, peakFrameMs, frameSamples: [...frameSamples] }; }, exportPng: () => exportPng(history.document) };
redraw();
