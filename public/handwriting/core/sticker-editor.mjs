import { connectedColorRegion, photoPointFromClient, regionPreviewPixels } from './photo-edit.mjs?v=20260924-region-preview2';

const EDIT_EDGE = 2048;
export const EDITOR_STORAGE_KEY = 'usapon_handwriting_editor_v1';

export const fitImage = (width, height, edge = EDIT_EDGE) => {
  const scale = Math.min(1, edge / Math.max(width || 1, height || 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

const clone = value => structuredClone(value);
const imageFromUrl = src => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });
export const DEFAULT_TEXT_FONT = '-apple-system,"Hiragino Sans","Yu Gothic",sans-serif';
export const isBlankText = value => !String(value || '').trim();
export function wrapTextLines(text, maxWidth, measure) {
  const lines = [];
  for (const paragraph of String(text || '').replace(/\r/g, '').split('\n')) {
    if (!paragraph) { lines.push(''); continue; }
    let line = '';
    for (const character of paragraph) {
      const next = line + character;
      if (line && measure(next) > maxWidth) { lines.push(line); line = character; }
      else line = next;
    }
    lines.push(line);
  }
  return lines.length ? lines : [''];
}
function placeCaretAtEnd(node) {
  const range = document.createRange(), selection = window.getSelection();
  range.selectNodeContents(node); range.collapse(false); selection.removeAllRanges(); selection.addRange(range);
}
function insertLineBreak(node) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0); range.deleteContents();
  const fragment = document.createDocumentFragment(), br = document.createElement('br'), caret = document.createTextNode('\u200b'); fragment.append(br, caret); range.insertNode(fragment); range.setStartAfter(caret); range.collapse(true); selection.removeAllRanges(); selection.addRange(range);
  node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertLineBreak' }));
}

export class StickerEditor {
  constructor({ layer, onChange, onCommit, onNotice, onPreviewChange, getCanvas = () => ({ width: 1400, height: 1400 }) }) { this.layer = layer; this.onChange = onChange; this.onCommit = onCommit; this.onNotice = onNotice; this.onPreviewChange = onPreviewChange; this.getCanvas = getCanvas; this.elements = []; this.selectedId = ''; this.editingTextId = ''; this.past = []; this.future = []; this.mode = 'draw'; this.eraseRadius = 34; this.restoreImage = null; this.restoreOriginalId = ''; this.photoGestureActive = false; this.pendingRegion = null; this.regionRequest = 0; }
  snapshot() { return this.elements.map(item => ({ ...item })); }
  commit() { this.clearPendingRegion(); this.past.push(this.snapshot()); if (this.past.length > 50) this.past.shift(); this.future = []; this.onCommit?.(); }
  changed() { this.render(); this.onChange?.(); }
  setElements(elements = []) { this.clearPendingRegion(); this.elements = Array.isArray(elements) ? elements.filter(e => e?.id && ['image', 'text'].includes(e.type)) : []; this.selectedId = ''; this.changed(); }
  serialize() { return { version: 1, elements: this.elements }; }
  select(id) { if (id !== this.selectedId) this.clearPendingRegion(); this.selectedId = id; this.render(); this.onChange?.(); }
  selected() { return this.elements.find(item => item.id === this.selectedId) || null; }
  addText() { this.commit(); const canvas = this.getCanvas(); const element = { id: crypto.randomUUID(), type: 'text', text: '', x: canvas.width / 2, y: canvas.height / 2, width: canvas.width * .72, scale: 1, rotation: 0, color: '#654c46', size: 54, weight: 700, font: DEFAULT_TEXT_FONT, stroke: 0, z: this.elements.length }; this.elements.push(element); this.selectedId = element.id; this.editingTextId = element.id; this.mode = 'text'; this.changed(); return element; }
  async addFiles(files) { for (const file of files) { const originalId = crypto.randomUUID(); await putOriginal(originalId, file); const source = await resizeFile(file); this.commit(); const canvas = this.getCanvas(); const element = { id: crypto.randomUUID(), type: 'image', source, originalId, x: canvas.width / 2, y: canvas.height / 2, width: Math.min(canvas.width * .62, 720), scale: 1, rotation: 0, z: this.elements.length, removedBackground: false }; this.elements.push(element); this.select(element.id); } }
  patch(id, patch) { const index = this.elements.findIndex(item => item.id === id); if (index < 0) return; this.commit(); this.elements[index] = { ...this.elements[index], ...patch }; this.changed(); }
  replaceSelectedImage(source) { const index = this.elements.findIndex(item => item.id === this.selectedId && item.type === 'image'); if (index < 0 || !source) return false; this.commit(); this.elements[index] = { ...this.elements[index], source, removedBackground: true }; this.changed(); return true; }
  liveTextPatch(patch) { const index = this.elements.findIndex(item => item.id === this.editingTextId && item.type === 'text'); if (index < 0) return; this.elements[index] = { ...this.elements[index], ...patch }; const item = this.elements[index], node = this.layer.querySelector(`[data-element-id="${item.id}"]`), scale = this.layer.clientWidth / Math.max(1, this.getCanvas().width); if (node) { node.style.color = item.color; node.style.fontSize = `${item.size * scale}px`; node.style.fontFamily = item.font; node.style.fontWeight = item.weight || 700; node.style.webkitTextStroke = `${(item.stroke || 0) * scale}px white`; } this.onChange?.(); }
  livePatchSelected(patch) { const index = this.elements.findIndex(item => item.id === this.selectedId); if (index < 0) return; this.elements[index] = { ...this.elements[index], ...patch }; this.render(); this.onChange?.(); }
  editText(id) { const item = this.elements.find(element => element.id === id && element.type === 'text'); if (!item) return; this.commit(); this.selectedId = id; this.editingTextId = id; this.mode = 'text'; this.changed(); requestAnimationFrame(() => { const node = this.layer.querySelector(`[data-element-id="${id}"]`); node?.focus({ preventScroll: true }); if (node) placeCaretAtEnd(node); }); }
  finishTextEdit() { const item = this.selected(); const empty = item?.type === 'text' && isBlankText(item.text); if (empty) { this.elements = this.elements.filter(element => element.id !== item.id); this.selectedId = ''; } this.editingTextId = ''; this.mode = 'draw'; this.changed(); return Boolean(empty); }
  duplicate() { const item = this.selected(); if (!item) return; this.commit(); const next = { ...clone(item), id: crypto.randomUUID(), x: item.x + 45, y: item.y + 45, z: this.elements.length }; this.elements.push(next); this.select(next.id); }
  remove() { const item = this.selected(); if (!item) return; this.commit(); this.elements = this.elements.filter(e => e.id !== item.id); this.selectedId = ''; this.changed(); }
  moveLayer(offset) { const item = this.selected(); if (!item) return; this.commit(); const ordered = [...this.elements].sort((a,b) => a.z - b.z); const index = ordered.findIndex(e => e.id === item.id), target = index + offset; if (target >= 0 && target < ordered.length) [ordered[index].z, ordered[target].z] = [ordered[target].z, ordered[index].z]; this.changed(); }
  undo(preserveSelection = false) { if (!this.past.length) return false; this.clearPendingRegion(); const selectedId = this.selectedId; this.future.push(this.snapshot()); this.elements = this.past.pop(); this.selectedId = preserveSelection && this.elements.some(item => item.id === selectedId) ? selectedId : ''; this.changed(); return true; }
  redo(preserveSelection = false) { if (!this.future.length) return false; this.clearPendingRegion(); const selectedId = this.selectedId; this.past.push(this.snapshot()); this.elements = this.future.pop(); this.selectedId = preserveSelection && this.elements.some(item => item.id === selectedId) ? selectedId : ''; this.changed(); return true; }
  async restoreOriginal() { const item = this.selected(); if (!item?.originalId) return false; const blob = await getOriginal(item.originalId); if (!blob) return false; const source = await resizeFile(blob); this.patch(item.id, { source, removedBackground: false }); return true; }
  async prepareRestore() {
    const item = this.selected();
    if (item?.type !== 'image' || !item.originalId) return false;
    const blob = await getOriginal(item.originalId);
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    try { this.restoreImage = await imageFromUrl(url); }
    finally { URL.revokeObjectURL(url); }
    this.restoreOriginalId = item.originalId;
    this.mode = 'restore';
    this.changed();
    return true;
  }
  photoGeometry(node, item) {
    const bounds = node.getBoundingClientRect();
    const layerScale = this.layer.getBoundingClientRect().width / Math.max(1, this.layer.clientWidth);
    const imageRatio = node.naturalWidth / Math.max(1, node.naturalHeight);
    const contentWidth = Math.min(node.offsetWidth, node.offsetHeight * imageRatio);
    const contentHeight = Math.min(node.offsetHeight, node.offsetWidth / imageRatio);
    return {
      centerX: bounds.left + bounds.width / 2,
      centerY: bounds.top + bounds.height / 2,
      displayWidth: contentWidth * (item.scale || 1) * layerScale,
      displayHeight: contentHeight * (item.scale || 1) * layerScale,
      rotation: item.rotation || 0,
      imageWidth: node.naturalWidth,
      imageHeight: node.naturalHeight
    };
  }
  clearPendingRegion() {
    this.regionRequest += 1;
    if (!this.pendingRegion) return;
    this.pendingRegion.overlay.remove();
    this.pendingRegion = null;
    this.onPreviewChange?.();
  }
  renderPendingRegion() {
    const pending = this.pendingRegion;
    if (!pending || this.mode !== 'tap-erase' || this.selectedId !== pending.itemId) return;
    const node = this.layer.querySelector(`[data-element-id="${pending.itemId}"]`);
    if (!node?.naturalWidth || !node?.naturalHeight) return;
    const ratio = node.naturalWidth / node.naturalHeight;
    pending.overlay.style.left = node.style.left;
    pending.overlay.style.top = node.style.top;
    pending.overlay.style.width = `${Math.min(node.offsetWidth, node.offsetHeight * ratio)}px`;
    pending.overlay.style.height = `${Math.min(node.offsetHeight, node.offsetWidth / ratio)}px`;
    pending.overlay.style.transform = node.style.transform;
    pending.overlay.style.zIndex = 1000;
    this.layer.append(pending.overlay);
  }
  async previewConnectedRegion(item, clientX, clientY, node) {
    this.clearPendingRegion();
    const request = this.regionRequest;
    const geometry = this.photoGeometry(node, item);
    const point = photoPointFromClient(clientX, clientY, geometry);
    if (!point) return;
    const image = await imageFromUrl(item.source);
    if (request !== this.regionRequest || this.mode !== 'tap-erase' || this.selectedId !== item.id || this.elements.find(element => element.id === item.id)?.source !== item.source) return;
    const work = document.createElement('canvas');
    work.width = image.width; work.height = image.height;
    const context = work.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, work.width, work.height);
    const region = connectedColorRegion(imageData.data, work.width, work.height, point.x, point.y, { tolerance: 50, maxFraction: 1 });
    if (!region.count) { this.onNotice?.('ここはすでに透明か、消せる範囲がありません'); return; }
    const overlay = document.createElement('canvas');
    overlay.className = 'sticker-element photo-region-preview';
    overlay.width = work.width; overlay.height = work.height;
    const previewContext = overlay.getContext('2d');
    const previewData = previewContext.createImageData(work.width, work.height);
    regionPreviewPixels(region.mask, work.width, work.height, Math.ceil(2 * work.width / Math.max(1, geometry.displayWidth)), previewData.data);
    previewContext.putImageData(previewData, 0, 0);
    this.pendingRegion = { itemId: item.id, source: item.source, mask: region.mask, imageData, work, overlay };
    this.renderPendingRegion();
    this.onPreviewChange?.();
  }
  confirmConnectedRegion() {
    const pending = this.pendingRegion;
    if (!pending || this.mode !== 'tap-erase' || this.selectedId !== pending.itemId || this.selected()?.source !== pending.source) return false;
    this.clearPendingRegion();
    for (let i = 0; i < pending.mask.length; i++) if (pending.mask[i]) pending.imageData.data[i * 4 + 3] = 0;
    pending.work.getContext('2d').putImageData(pending.imageData, 0, 0);
    this.commit();
    const index = this.elements.findIndex(element => element.id === pending.itemId);
    if (index < 0) return false;
    this.elements[index] = { ...this.elements[index], source: pending.work.toDataURL('image/png'), removedBackground: true };
    this.changed();
    this.onNotice?.('選んだ範囲を消しました');
    return true;
  }
  async eraseAt(item, clientX, clientY, radius = 34) {
    const node = this.layer.querySelector(`[data-element-id="${item.id}"]`);
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    const x = (clientX - bounds.left) / Math.max(1, bounds.width);
    const y = (clientY - bounds.top) / Math.max(1, bounds.height);
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    const image = await imageFromUrl(item.source), canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); context.globalCompositeOperation = 'destination-out'; context.beginPath(); context.arc(x * canvas.width, y * canvas.height, radius * canvas.width / Math.max(1, bounds.width), 0, Math.PI * 2); context.fill();
    const index = this.elements.findIndex(element => element.id === item.id); if (index >= 0) { this.elements[index] = { ...item, source: canvas.toDataURL('image/png'), removedBackground: true }; this.render(); this.onChange?.(); }
  }
  render() {
    this.layer.replaceChildren();
    const canvas = this.getCanvas(), displayScale = this.layer.clientWidth / Math.max(1, canvas.width);
    for (const item of [...this.elements].sort((a,b) => a.z - b.z)) {
      const node = document.createElement(item.type === 'image' ? 'img' : 'div'); node.className = `sticker-element sticker-${item.type}${item.id === this.selectedId ? ' is-selected' : ''}`;
      node.dataset.elementId = item.id; node.style.left = `${item.x / canvas.width * 100}%`; node.style.top = `${item.y / canvas.height * 100}%`; node.style.zIndex = item.z; node.style.transform = `translate(-50%,-50%) rotate(${item.rotation || 0}deg) scale(${item.scale || 1})`;
      if (item.type === 'image') { node.style.width = `${(item.width || 560) / canvas.width * 100}%`; node.src = item.source; node.alt = ''; node.draggable = false; } else { node.style.width = `${(item.width || canvas.width * .72) / canvas.width * 100}%`; node.textContent = item.text; node.style.color = item.color; node.style.fontSize = `${item.size * displayScale}px`; node.style.fontFamily = item.font || DEFAULT_TEXT_FONT; node.style.fontWeight = item.weight || 700; node.style.webkitTextStroke = `${(item.stroke || 0) * displayScale}px white`; node.style.paintOrder = 'stroke fill'; if (item.id === this.editingTextId) { node.setAttribute('contenteditable', 'true'); node.spellcheck = false; node.dataset.placeholder = '文字を入力'; node.setAttribute('role', 'textbox'); node.setAttribute('aria-label', '文字を入力'); node.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); insertLineBreak(node); } }); node.addEventListener('input', () => { const current = this.elements.find(element => element.id === item.id); if (current) current.text = node.innerText.replace(/[\r\u200b]/g, '').slice(0, 500); this.onChange?.(); }); } }
      node.addEventListener('pointerdown', event => this.beginGesture(event, item)); this.layer.append(node);
    }
    this.renderPendingRegion();
  }
  beginGesture(event, item) {
    if (item.type === 'image' && this.mode === 'tap-erase') {
      event.preventDefault(); event.stopPropagation();
      const node = event.currentTarget;
      const origin = { x: event.clientX, y: event.clientY };
      const end = e => {
        if (e.pointerId !== event.pointerId) return;
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        if (e.type === 'pointercancel' || Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 8) return;
        void this.previewConnectedRegion(item, e.clientX, e.clientY, node).catch(() => this.onNotice?.('タップした範囲を選べませんでした'));
      };
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      return;
    }
    if (item.type === 'image' && ['erase', 'restore'].includes(this.mode)) {
      event.preventDefault(); event.stopPropagation();
      if (this.photoGestureActive) return;
      const restoring = this.mode === 'restore';
      if (restoring && (item.id !== this.selectedId || item.originalId !== this.restoreOriginalId || !this.restoreImage)) return;
      const node = event.currentTarget;
      if (!node.naturalWidth || !node.naturalHeight) return;
      this.photoGestureActive = true;
      this.selectedId = item.id;
      const work = document.createElement('canvas');
      work.width = node.naturalWidth; work.height = node.naturalHeight;
      const context = work.getContext('2d');
      context.drawImage(node, 0, 0);
      let frame = 0;
      let lastPoint = null;
      let changed = false;
      const paintCircle = (x, y, radius) => {
        context.save();
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        if (restoring) {
          context.clip();
          context.drawImage(this.restoreImage, 0, 0, work.width, work.height);
        } else {
          context.globalCompositeOperation = 'destination-out';
          context.fill();
        }
        context.restore();
      };
      const paint = e => {
        if (e.pointerId !== event.pointerId) return;
        const geometry = this.photoGeometry(node, item);
        const point = photoPointFromClient(e.clientX, e.clientY, geometry);
        if (!point) { lastPoint = null; return; }
        if (!changed) { this.commit(); changed = true; }
        const radius = this.eraseRadius * work.width / Math.max(1, geometry.displayWidth);
        const distance = lastPoint ? Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) : 0;
        const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius * 0.5)));
        for (let step = 1; step <= steps; step++) {
          const part = step / steps;
          paintCircle(lastPoint ? lastPoint.x + (point.x - lastPoint.x) * part : point.x,
            lastPoint ? lastPoint.y + (point.y - lastPoint.y) * part : point.y, radius);
        }
        lastPoint = point;
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; node.src = work.toDataURL('image/png'); });
      };
      const end = e => {
        if (e.pointerId !== event.pointerId) return;
        if (frame) cancelAnimationFrame(frame);
        this.photoGestureActive = false;
        if (changed) {
          const index = this.elements.findIndex(element => element.id === item.id);
          if (index >= 0) this.elements[index] = { ...this.elements[index], source: work.toDataURL('image/png'), removedBackground: true };
          this.changed();
        }
        window.removeEventListener('pointermove', paint);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
      };
      paint(event);
      window.addEventListener('pointermove', paint);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      return;
    }
    if (this.mode !== 'select') return;
    event.preventDefault(); event.stopPropagation(); this.selectedId = item.id; event.currentTarget.classList.add('is-selected'); this.onChange?.(); const origin = { x: event.clientX, y: event.clientY, item: clone(item), moved: false }; event.currentTarget.setPointerCapture?.(event.pointerId);
    const move = e => { if (e.pointerId !== event.pointerId) return; const dx = e.clientX - origin.x, dy = e.clientY - origin.y; if (Math.hypot(dx,dy) > 3) origin.moved = true; const canvas = this.getCanvas(), bounds = this.layer.getBoundingClientRect(), logicalX = canvas.width / bounds.width, logicalY = canvas.height / bounds.height; const index = this.elements.findIndex(x => x.id === item.id); if (index >= 0) { this.elements[index] = { ...origin.item, x: origin.item.x + dx * logicalX, y: origin.item.y + dy * logicalY }; this.render(); } };
    const end = e => { if (e.pointerId !== event.pointerId) return; if (origin.moved) { this.past.push(this.elements.map(x => x.id === item.id ? origin.item : { ...x })); if (this.past.length > 50) this.past.shift(); this.future = []; this.onCommit?.(); this.onChange?.(); } else if (item.type === 'text') this.editText(item.id); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  }
  async drawOn(context, width, height) { const canvas = this.getCanvas(), sx = width / canvas.width, sy = height / canvas.height; for (const item of [...this.elements].sort((a,b) => a.z - b.z)) { context.save(); context.translate(item.x * sx, item.y * sy); context.rotate((item.rotation || 0) * Math.PI / 180); context.scale((item.scale || 1) * sx, (item.scale || 1) * sy); if (item.type === 'image') { const image = await imageFromUrl(item.source); const drawWidth = item.width || 560, drawHeight = drawWidth * image.height / image.width; context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight); } else { context.font = `${item.weight || 700} ${item.size}px ${item.font || DEFAULT_TEXT_FONT}`; const maxWidth = item.width || canvas.width * .72, lines = wrapTextLines(item.text, maxWidth, value => context.measureText(value).width), lineHeight = item.size * 1.15; context.textAlign = 'center'; context.textBaseline = 'middle'; context.lineJoin = 'round'; context.lineWidth = item.stroke || 0; context.strokeStyle = '#fff'; context.fillStyle = item.color; lines.forEach((line, index) => { const y = (index - (lines.length - 1) / 2) * lineHeight; if (item.stroke) context.strokeText(line, 0, y); context.fillText(line, 0, y); }); } context.restore(); } }
}

export async function resizeFile(file) { const url = URL.createObjectURL(file); try { const image = await imageFromUrl(url); const size = fitImage(image.width, image.height); const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height; canvas.getContext('2d').drawImage(image, 0, 0, size.width, size.height); return canvas.toDataURL('image/png'); } finally { URL.revokeObjectURL(url); } }

const DB = 'usapon_handwriting_editor', ORIGINALS = 'originals', DRAFTS = 'drafts', IMAGES = 'images';
const openDb = () => new Promise((resolve, reject) => { const request = indexedDB.open(DB, 2); request.onupgradeneeded = () => { const db = request.result; for (const name of [ORIGINALS, DRAFTS, IMAGES]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name); }; request.onerror = () => reject(request.error); request.onsuccess = () => resolve(request.result); });
const withStores = async (names, mode, action) => { const db = await openDb(); return new Promise((resolve, reject) => { const tx = db.transaction(names, mode); let result; try { result = action(Object.fromEntries(names.map(name => [name, tx.objectStore(name)]))); } catch (error) { reject(error); return; } tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }).finally(() => db.close()); };
const requestValue = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); });
const dataUrlToBlob = async dataUrl => (await fetch(dataUrl)).blob();
const blobToDataUrl = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
export const putOriginal = (id, blob) => withStores([ORIGINALS], 'readwrite', stores => stores[ORIGINALS].put(blob, id));
export const getOriginal = id => withStores([ORIGINALS], 'readonly', stores => requestValue(stores[ORIGINALS].get(id)));
export async function saveEditorDraft({ id, document, elements, createdAt, title, preview }) {
  const imageEntries = await Promise.all(elements.filter(item => item.type === 'image' && item.source).map(async item => [`${id}:edited-${item.id}`, await dataUrlToBlob(item.source)]));
  const savedAt = new Date().toISOString(), draft = { id, version: 2, title: String(title || '').trim().slice(0, 48) || '無題の作品', preview: preview || null, document, elements: elements.map(item => item.type === 'image' ? { ...item, source: '', sourceId: `${id}:edited-${item.id}` } : { ...item }), createdAt: createdAt || savedAt, updatedAt: savedAt };
  await withStores([DRAFTS, IMAGES], 'readwrite', stores => { for (const [key, blob] of imageEntries) stores[IMAGES].put(blob, key); stores[DRAFTS].put(draft, id); });
  return draft;
}
export async function listEditorDrafts() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const drafts = [], tx = db.transaction([DRAFTS], 'readonly');
    const request = tx.objectStore(DRAFTS).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const { id, title, preview, createdAt, updatedAt } = cursor.value;
      drafts.push({ id, title: title || '以前の保存', preview: preview || null, createdAt, updatedAt });
      cursor.continue();
    };
    tx.oncomplete = () => { db.close(); resolve(drafts.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
export async function renameEditorDraft(id, title) {
  const name = String(title || '').trim().slice(0, 48) || '無題の作品';
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([DRAFTS], 'readwrite'), store = tx.objectStore(DRAFTS);
    const request = store.get(id);
    request.onsuccess = () => { if (request.result) store.put({ ...request.result, title: name }, id); };
    tx.oncomplete = () => { db.close(); resolve(name); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
export async function loadEditorDraft(id) {
  if (!id) return null;
  const draft = await withStores([DRAFTS], 'readonly', stores => requestValue(stores[DRAFTS].get(id))); if (!draft) return null;
  const elements = await Promise.all((draft.elements || []).map(async item => item.type === 'image' && item.sourceId ? { ...item, source: await withStores([IMAGES], 'readonly', stores => requestValue(stores[IMAGES].get(item.sourceId))).then(blob => blob ? blobToDataUrl(blob) : '') } : item));
  return { ...draft, elements };
}
