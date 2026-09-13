import { useEffect, useRef, useState } from 'react';
import { Sticker, ChevronDown, Pencil, Undo2, Redo2, Sparkles } from 'lucide-react';
import { DrawingHistory, newDocument } from '../public/handwriting/core/document.mjs';
import { InputSession } from '../public/handwriting/core/input.mjs';
import { BRUSH_SIZES } from '../public/handwriting/core/brush-sizes.mjs';
import { StrokeBuilder } from '../public/handwriting/core/stroke.mjs';
import { renderDocument, paintStroke } from '../public/handwriting/core/render.mjs';
import { hexToHsv, hsvToHex } from '../public/handwriting/core/color-picker.mjs';
import { isShortTap } from './boardDrawingInteraction.js';
import './boardDrawing.css';

const TOOLS = [
  ['pen', 'ペン', 4], ['pencil', 'えんぴつ', 5], ['marker', 'マーカー', 18],
  ['crayon', 'クレヨン', 16], ['watercolor', '水彩', 24], ['eraser', '消しゴム', 28]
];
const stop = event => event.stopPropagation();
const PALETTE = [
  ['#654c46', 'こげ茶'], ['#df8e9c', 'ピンク'], ['#e9bdaf', '薄桃'],
  ['#eddda5', '黄色'], ['#a8bd99', '緑'], ['#99bacb', '水色'],
  ['#885744', '茶色'], ['#bc7044', '橙'], ['#dba747', '山吹'],
  ['#82916b', '深緑'], ['#735679', '紫'], ['#41434f', '墨色']
];

const sameDocumentRevision = (left, right) => (
  left === right || Boolean(left && right && left.id === right.id && left.revision === right.revision)
);

function BrushSettings({ tool, size, opacity, onSizeChange, onOpacityChange }) {
  const config = BRUSH_SIZES[tool];
  return <section className="board-brush-settings" role="dialog" aria-label={`${TOOLS.find(([id]) => id === tool)?.[1] || 'ペン'}の設定`}>
    <div className="board-stroke-presets" aria-label="基本の太さ">
      {config.presets.map(preset => <button key={preset} type="button" className={size === preset ? 'is-selected' : ''}
        aria-label={`${preset}の太さ`} onClick={() => onSizeChange(preset)}>
        <svg viewBox="0 0 48 28" aria-hidden="true"><path d="M4 18c8-13 13 8 21-3s11-5 19 2" /></svg>
      </button>)}
    </div>
    <div className="board-size-adjust">
      <span aria-hidden="true">●</span>
      <input type="range" aria-label="太さを微調整" min={config.min} max={config.max} value={size}
        onChange={event => onSizeChange(Number(event.target.value))} />
      <input className="board-size-number" type="number" inputMode="numeric" aria-label="太さを数値で入力"
        min={config.min} max={config.max} value={size} onChange={event => onSizeChange(Math.max(config.min, Math.min(config.max, Number(event.target.value) || config.min)))} />
    </div>
    {tool !== 'eraser' && <label className="board-opacity-adjust">
      <span>不透明度</span>
      <input type="range" min="1" max="100" value={Math.round(opacity * 100)} aria-label="不透明度"
        onChange={event => onOpacityChange(Number(event.target.value) / 100)} />
      <output>{Math.round(opacity * 100)}%</output>
    </label>}
  </section>;
}

function CircularColorPicker({ color, onChange, onSelect }) {
  const wheelRef = useRef(null);
  const pointerMode = useRef(null);
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const apply = next => {
    const safe = {
      h: (next.h + 360) % 360,
      s: Math.max(0, Math.min(1, next.s)),
      v: Math.max(0, Math.min(1, next.v))
    };
    setHsv(safe);
    onChange(hsvToHex(safe));
  };
  useEffect(() => {
    const canvas = wheelRef.current;
    const context = canvas.getContext('2d');
    const scale = Math.min(2, window.devicePixelRatio || 1);
    const size = 240;
    canvas.width = size * scale;
    canvas.height = size * scale;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, size, size);
    const center = size / 2;
    for (let degree = 0; degree < 360; degree += 2) {
      const start = (degree - 92) * Math.PI / 180;
      const end = (degree - 88) * Math.PI / 180;
      context.beginPath();
      context.arc(center, center, 112, start, end);
      context.arc(center, center, 88, end, start, true);
      context.closePath();
      context.fillStyle = `hsl(${degree} 100% 50%)`;
      context.fill();
    }
    const gradient = context.createRadialGradient(center, center, 0, center, center, 78);
    gradient.addColorStop(0, hsvToHex({ h: hsv.h, s: 0, v: hsv.v }));
    gradient.addColorStop(1, hsvToHex({ h: hsv.h, s: 1, v: hsv.v }));
    context.beginPath();
    context.arc(center, center, 78, 0, Math.PI * 2);
    context.fillStyle = gradient;
    context.fill();
    const hueRadians = (hsv.h - 90) * Math.PI / 180;
    for (const [x, y, fill] of [
      [center + Math.cos(hueRadians) * 100, center + Math.sin(hueRadians) * 100, null],
      [center + hsv.s * 78, center, hsvToHex(hsv)]
    ]) {
      context.beginPath();
      context.arc(x, y, 7, 0, Math.PI * 2);
      if (fill) { context.fillStyle = fill; context.fill(); }
      context.lineWidth = 3;
      context.strokeStyle = '#fff';
      context.stroke();
    }
  }, [hsv]);
  const updateWheel = event => {
    const bounds = wheelRef.current.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * 240 / bounds.width - 120;
    const y = (event.clientY - bounds.top) * 240 / bounds.height - 120;
    const radius = Math.hypot(x, y);
    pointerMode.current ||= radius >= 86 ? 'hue' : 'saturation';
    apply(pointerMode.current === 'hue'
      ? { ...hsv, h: (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360 }
      : { ...hsv, s: Math.min(1, radius / 78) });
  };
  return <section className="board-color-panel" role="dialog" aria-label="線の色を調整">
    <canvas ref={wheelRef} className="board-color-wheel" role="slider" tabIndex="0" aria-label="色相と鮮やかさ"
      onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); updateWheel(event); }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateWheel(event); }}
      onPointerUp={event => { pointerMode.current = null; event.currentTarget.releasePointerCapture(event.pointerId); onSelect(); }}
      onPointerCancel={() => { pointerMode.current = null; }} />
    <label className="board-color-brightness" aria-label="明るさ">
      <input type="range" min="0" max="1" step="0.01" value={hsv.v}
        onChange={event => apply({ ...hsv, v: Number(event.target.value) })} onPointerUp={onSelect} />
    </label>
    <div className="board-color-palette" aria-label="パレット">
      {PALETTE.map(([value, label]) => <button key={value} type="button" aria-label={label} aria-pressed={color.toLowerCase() === value}
        style={{ '--palette-color': value }} onClick={() => { apply(hexToHsv(value)); onSelect(); }} />)}
    </div>
  </section>;
}

export default function BoardDrawing({ value, onChange, onModeChange, onError, onStickers, onZoomChange, zoom = 1, readOnly = false }) {
  const canvasRef = useRef(null);
  const live = useRef({ value, stroke: null, frame: null });
  const historyRef = useRef(value ? new DrawingHistory(value) : null);
  const handlersRef = useRef({});
  const inputRef = useRef(null);
  const gestureTouchesRef = useRef(new globalThis.Map());
  const pinchRef = useRef(null);
  const configRef = useRef({ tool: null, color: '#594536', size: 4, opacity: 1 });
  const toolSizesRef = useRef(Object.fromEntries(TOOLS.map(([id, , defaultSize]) => [id, defaultSize])));
  const pendingStickerTapRef = useRef(null);
  const [, setHistoryVersion] = useState(0);
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState(null);
  const [color, setColor] = useState('#594536');
  const [colorOpen, setColorOpen] = useState(false);
  const [size, setSize] = useState(4);
  const [opacity, setOpacity] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmStickerEdit, setConfirmStickerEdit] = useState(false);
  const expectedValue = useRef(value);
  configRef.current = { tool, color, size, opacity };
  live.current.value = historyRef.current?.document || value;
  const publish = next => {
    expectedValue.current = next;
    live.current.value = next;
    onChange(next);
  };
  const refreshHistoryControls = () => {
    setHistoryVersion(current => current + 1);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const base = document.createElement('canvas');
    const preview = document.createElement('canvas');
    const state = live.current;
    const redraw = () => {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(base, 0, 0);
      if (!state.stroke) return;
      const doc = state.stroke.document;
      const stroke = state.stroke.builder.stroke;
      if (stroke.tool === 'eraser') {
        ctx.save();
        ctx.scale(canvas.width / doc.canvas.width, canvas.height / doc.canvas.height);
        paintStroke(ctx, stroke);
        ctx.restore();
      } else {
        renderDocument(preview, { ...doc, strokes: [stroke] });
        ctx.drawImage(preview, 0, 0);
      }
    };
    state.redraw = redraw;
    state.refresh = () => {
      if (state.value) renderDocument(base, state.value);
      else base.getContext('2d').clearRect(0, 0, base.width, base.height);
      redraw();
    };
    const observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const target of [canvas, base, preview]) {
        target.width = Math.max(1, Math.round(rect.width * dpr));
        target.height = Math.max(1, Math.round(rect.height * dpr));
      }
      state.refresh();
    });
    observer.observe(canvas);
    return () => { observer.disconnect(); cancelAnimationFrame(state.frame); };
  }, []);

  useEffect(() => {
    // An unrelated restore replaces the board document and starts a fresh local history.
    // Matching by document revision keeps the local history intact when React gives us
    // a structurally cloned version of the just-published drawing.
    if (!sameDocumentRevision(value, expectedValue.current)) {
      inputRef.current?.cancelAll('external-document-change');
      historyRef.current = value ? new DrawingHistory(value) : null;
      refreshHistoryControls();
    }
    expectedValue.current = value;
    live.current.value = historyRef.current?.document || value;
    live.current.refresh?.();
  }, [value]);
  useEffect(() => { onModeChange?.(Boolean(tool)); }, [tool, onModeChange]);
  useEffect(() => () => {
    inputRef.current?.cancelAll('drawing-unmounted');
    gestureTouchesRef.current.clear();
    onModeChange?.(false);
  }, [onModeChange]);
  useEffect(() => {
    const resetInterruptedInput = reason => {
      gestureTouchesRef.current.clear();
      pinchRef.current = null;
      inputRef.current?.cancelAll(reason);
    };
    const handleBlur = () => resetInterruptedInput('window-blur');
    const handleVisibilityChange = () => {
      if (document.hidden) resetInterruptedInput('document-hidden');
    };
    const handlePageHide = () => resetInterruptedInput('page-hidden');
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const appendPoint = point => {
    const state = live.current;
    if (!state.stroke) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const { document: doc, builder } = state.stroke;
    builder.sample({
      x: Math.max(0, Math.min(doc.canvas.width, (point.x - rect.left) / rect.width * doc.canvas.width)),
      y: Math.max(0, Math.min(doc.canvas.height, (point.y - rect.top) / rect.height * doc.canvas.height)),
      time: point.time, pressure: point.pressure
    });
    if (!state.frame) state.frame = requestAnimationFrame(() => { state.frame = null; state.redraw(); });
  };
  const beginStroke = point => {
    const { tool: nextTool, color: nextColor, size: nextSize, opacity: nextOpacity } = configRef.current;
    if (!nextTool || live.current.stroke) return;
    const rect = canvasRef.current.getBoundingClientRect();
    if (!historyRef.current) {
      historyRef.current = new DrawingHistory(newDocument({
        width: Math.max(320, Math.min(4096, Math.round(rect.width))),
        height: Math.max(320, Math.min(4096, Math.round(rect.height)))
      }));
    }
    const doc = historyRef.current.document;
    live.current.stroke = { document: doc, builder: new StrokeBuilder({ tool: nextTool, color: nextColor, size: nextSize, opacity: nextTool === 'eraser' ? 1 : nextOpacity, input: point.type, time: point.time }) };
    appendPoint(point);
  };
  const cancelStroke = () => {
    const state = live.current;
    if (!state.stroke) return;
    state.stroke = null;
    state.refresh();
  };
  const finishStroke = () => {
    const state = live.current;
    if (!state.stroke) return;
    const { builder } = state.stroke;
    state.stroke = null;
    if (!builder.stroke.points.length) {
      state.refresh();
      return;
    }
    try {
      historyRef.current.commit(builder.stroke);
      publish(historyRef.current.document);
      refreshHistoryControls();
    } catch (error) {
      onError?.(error.message || '手書きを保存できませんでした。');
    }
    state.refresh();
  };
  const undo = () => {
    const history = historyRef.current;
    if (live.current.stroke || !history?.undo()) return;
    publish(history.document);
    refreshHistoryControls();
  };
  const redo = () => {
    const history = historyRef.current;
    if (live.current.stroke || !history?.redo()) return;
    publish(history.document);
    refreshHistoryControls();
  };
  const clear = () => {
    const history = historyRef.current;
    if (!history?.clear()) return;
    publish(history.document);
    refreshHistoryControls();
  };
  handlersRef.current = { begin: beginStroke, append: appendPoint, finish: finishStroke, cancel: cancelStroke, undo };
  if (!inputRef.current) {
    inputRef.current = new InputSession({
      begin: point => handlersRef.current.begin(point),
      append: point => handlersRef.current.append(point),
      finish: () => handlersRef.current.finish(),
      cancel: () => handlersRef.current.cancel(),
      undo: () => handlersRef.current.undo()
    });
  }
  const pointFromEvent = event => ({
    id: event.pointerId,
    type: ['pen', 'touch'].includes(event.pointerType) ? event.pointerType : 'mouse',
    x: event.clientX,
    y: event.clientY,
    time: event.timeStamp,
    pressure: event.pressure
  });
  const stampAtPoint = (x, y) => [...document.querySelectorAll('.board-free-sticker, .memo-sticker-wrap')].find(element => {
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
  const isStampAtPoint = (x, y) => Boolean(stampAtPoint(x, y));
  const updatePinch = (point, onZoomChange, zoom) => {
    if (point.type !== 'touch' || !gestureTouchesRef.current.has(point.id)) return;
    gestureTouchesRef.current.set(point.id, point);
    const touches = [...gestureTouchesRef.current.values()];
    const pinch = pinchRef.current;
    if (!pinch || pinch.blocked || touches.length < 2) return;
    const [first, second] = touches;
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    if (!pinch.engaged && Math.abs(distance - pinch.distance) > 8) {
      pinch.engaged = true;
      inputRef.current.gesture();
    }
    if (!pinch.engaged) return;
    const nextZoom = Math.max(1, Math.min(2.2, pinch.zoom * distance / pinch.distance));
    onZoomChange?.({ zoom: nextZoom, origin: pinch.origin });
  };
  const start = (event, onZoomChange, zoom) => {
    event.stopPropagation();
    if (!tool || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    setColorOpen(false);
    setSettingsOpen(false);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = pointFromEvent(event);
    if (point.type === 'pen') {
      gestureTouchesRef.current.clear();
      pinchRef.current = null;
    }
    if (point.type === 'touch' && inputRef.current.active?.type === 'pen') return;
    if (point.type !== 'pen' && gestureTouchesRef.current.size === 0 && stampAtPoint(point.x, point.y)) {
      pendingStickerTapRef.current = { id: point.id, start: point };
      return;
    }
    if (point.type === 'touch') {
      gestureTouchesRef.current.set(point.id, point);
      const touches = [...gestureTouchesRef.current.values()];
      if (touches.length === 2) {
        const [first, second] = touches;
        const rect = canvasRef.current.getBoundingClientRect();
        pinchRef.current = {
          blocked: isStampAtPoint(first.x, first.y) || isStampAtPoint(second.x, second.y),
          distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)),
          zoom,
          engaged: false,
          origin: {
            x: Math.max(0, Math.min(100, ((first.x + second.x) / 2 - rect.left) / rect.width * 100)),
            y: Math.max(0, Math.min(100, ((first.y + second.y) / 2 - rect.top) / rect.height * 100))
          }
        };
      }
    }
    inputRef.current.down(point);
  };
  const sample = (event, onZoomChange, zoom) => {
    event.stopPropagation();
    event.preventDefault();
    const pendingTap = pendingStickerTapRef.current;
    if (pendingTap?.id === event.pointerId) {
      const current = pointFromEvent(event);
      if (isShortTap(pendingTap.start, current)) return;
      pendingStickerTapRef.current = null;
      inputRef.current.down(pendingTap.start);
    }
    const samples = event.nativeEvent?.getCoalescedEvents?.() || [event];
    for (const sampleEvent of samples.length ? samples : [event]) {
      const point = pointFromEvent(sampleEvent);
      updatePinch(point, onZoomChange, zoom);
      inputRef.current.move(point);
    }
  };
  const finish = (event, cancelled = false) => {
    event.stopPropagation();
    const point = pointFromEvent(event);
    if (pendingStickerTapRef.current?.id === point.id) {
      pendingStickerTapRef.current = null;
      gestureTouchesRef.current.delete(point.id);
      if (!cancelled) setConfirmStickerEdit(true);
      return;
    }
    gestureTouchesRef.current.delete(point.id);
    if (gestureTouchesRef.current.size < 2) pinchRef.current = null;
    inputRef.current.up(point, cancelled, cancelled ? 'pointercancel' : 'pointerup');
  };
  const close = () => {
    pendingStickerTapRef.current = null;
    inputRef.current.cancelAll('drawing-closed');
    setOpen(false); setTool(null); setColorOpen(false); setSettingsOpen(false); setConfirmStickerEdit(false);
  };
  const changeSize = nextSize => {
    toolSizesRef.current[tool] = nextSize;
    setSize(nextSize);
  };
  const selectTool = (id, defaultSize) => {
    if (tool === id) {
      setColorOpen(false);
      setSettingsOpen(current => !current);
      return;
    }
    setTool(id);
    setSize(toolSizesRef.current[id] || defaultSize);
    setColorOpen(false);
    setSettingsOpen(false);
  };
  return <>
    <canvas ref={canvasRef} className="board-ink" aria-hidden="true" />
    {!readOnly && tool && <div className="board-ink-input" aria-label="ボードに手書き"
      onPointerDown={event => start(event, onZoomChange, zoom)} onPointerMove={event => sample(event, onZoomChange, zoom)} onPointerUp={finish}
      onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}
      onClick={stop} onContextMenu={event => event.preventDefault()} onTouchStart={stop} onTouchEnd={stop} />}
    {!readOnly && <div className="board-drawing-tools" onPointerDown={stop} onClick={stop} onTouchStart={stop} onTouchEnd={stop}
      onKeyDown={event => { if (event.key === 'Escape') settingsOpen ? setSettingsOpen(false) : colorOpen ? setColorOpen(false) : close(); }}>
      {colorOpen && tool !== 'eraser' && <CircularColorPicker color={color} onChange={setColor} onSelect={() => setColorOpen(false)} />}
      {settingsOpen && tool && <BrushSettings tool={tool} size={size} opacity={opacity} onSizeChange={changeSize} onOpacityChange={setOpacity} />}
      {open && <div className="board-drawing-menu" role="toolbar" aria-label="手書きの文房具">
        {onStickers && <button type="button" title="ステッカー" aria-label="ボードにステッカーを貼る" onClick={() => { close(); onStickers(); }}><Sticker size={27} /></button>}
        {TOOLS.map(([id, label, defaultSize]) => <button key={id} type="button" title={label} aria-label={label} aria-pressed={tool === id}
          onClick={() => selectTool(id, defaultSize)}>
          <img alt="" draggable="false" src={`${import.meta.env.BASE_URL}handwriting/assets/tools/${id === 'eraser' ? 'eraser-block' : id}-icon.png`} />
        </button>)}
        {tool && <div className="board-drawing-options">
          <button type="button" className="board-color-toggle" aria-label="線の色" aria-expanded={colorOpen} disabled={tool === 'eraser'}
            style={{ '--current-color': color }} onClick={() => { setSettingsOpen(false); setColorOpen(current => !current); }} />
        </div>}
      </div>}
      {open && <div className="board-drawing-actions">
        <div className="board-drawing-history">
          <button type="button" aria-label="手書きを取り消す" disabled={!historyRef.current?.past.length} onClick={undo}><Undo2 size={18}/></button>
          <button type="button" aria-label="手書きをやり直す" disabled={!historyRef.current?.future.length} onClick={redo}><Redo2 size={18}/></button>
        </div>
        <button type="button" className="board-drawing-clear" aria-label="手書きをまっさらにする"
          disabled={!historyRef.current?.document.strokes.length} onClick={clear}>
          <Sparkles size={16}/><small>まっさら</small>
        </button>
      </div>}
      <button type="button" className="board-drawing-toggle" aria-label={open ? '手書きを終了' : 'ボードに手書きする'} aria-expanded={open}
        onClick={() => open ? close() : setOpen(true)}>{open ? <ChevronDown size={22}/> : <Pencil size={21}/>}</button>
    </div>}
    {confirmStickerEdit && <div className="board-drawing-confirm-backdrop" role="presentation" onPointerDown={stop} onClick={stop}>
      <section className="board-drawing-confirm" role="dialog" aria-modal="true" aria-label="手書きモードを終了">
        <p>手書きを終了してステッカーを編集しますか？</p>
        <div>
          <button type="button" className="confirm" onClick={close}>はい</button>
          <button type="button" onClick={() => setConfirmStickerEdit(false)}>このまま描く</button>
        </div>
      </section>
    </div>}
  </>;
}
