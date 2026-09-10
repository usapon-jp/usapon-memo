import { useEffect, useRef, useState } from 'react';
import { Sticker, Check, Pencil, Undo2, Redo2, Sparkles } from 'lucide-react';
import { newDocument, validateDocument, LIMITS } from '../public/handwriting/core/document.mjs';
import { StrokeBuilder } from '../public/handwriting/core/stroke.mjs';
import { renderDocument, paintStroke } from '../public/handwriting/core/render.mjs';
import { hexToHsv, hsvToHex } from '../public/handwriting/core/color-picker.mjs';
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

function CircularColorPicker({ color, onChange, onClose }) {
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
      onPointerUp={event => { pointerMode.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { pointerMode.current = null; }} />
    <label className="board-color-brightness" aria-label="明るさ">
      <input type="range" min="0" max="1" step="0.01" value={hsv.v} onChange={event => apply({ ...hsv, v: Number(event.target.value) })} />
    </label>
    <div className="board-color-palette" aria-label="パレット">
      {PALETTE.map(([value, label]) => <button key={value} type="button" aria-label={label} aria-pressed={color.toLowerCase() === value}
        style={{ '--palette-color': value }} onClick={() => apply(hexToHsv(value))} />)}
    </div>
    <button type="button" className="board-color-confirm" onClick={onClose}><Check size={18}/><span>この色に決定</span></button>
  </section>;
}

export default function BoardDrawing({ value, onChange, onModeChange, onError, onStickers, readOnly = false }) {
  const canvasRef = useRef(null);
  const live = useRef({ value, stroke: null, pointer: null, frame: null });
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState(null);
  const [color, setColor] = useState('#594536');
  const [colorOpen, setColorOpen] = useState(false);
  const [size, setSize] = useState(4);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const expectedValue = useRef(value);
  live.current.value = value;
  const publish = next => {
    expectedValue.current = next;
    onChange(next);
  };
  const commit = next => {
    setPast(current => [...current.slice(-(LIMITS.undo - 1)), value]);
    setFuture([]);
    publish(next);
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
    // A global undo or restored backup invalidates this drawing's redo stack.
    if (value !== expectedValue.current) {
      setPast([]);
      setFuture([]);
    }
    expectedValue.current = value;
    live.current.refresh?.();
  }, [value]);
  useEffect(() => { onModeChange?.(Boolean(tool)); }, [tool, onModeChange]);
  useEffect(() => () => onModeChange?.(false), [onModeChange]);

  const sample = event => {
    const state = live.current;
    if (!state.stroke || state.pointer !== event.pointerId) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const { document: doc, builder } = state.stroke;
    const remaining = LIMITS.points - doc.strokes.reduce((n, s) => n + s.points.length, 0);
    const events = event.nativeEvent?.getCoalescedEvents?.() || [event];
    for (const point of events.length ? events : [event]) {
      if (builder.stroke.points.length >= remaining) break;
      builder.sample({
        x: Math.max(0, Math.min(doc.canvas.width, (point.clientX - rect.left) / rect.width * doc.canvas.width)),
        y: Math.max(0, Math.min(doc.canvas.height, (point.clientY - rect.top) / rect.height * doc.canvas.height)),
        time: point.timeStamp, pressure: point.pressure
      });
    }
    if (!state.frame) state.frame = requestAnimationFrame(() => { state.frame = null; state.redraw(); });
  };
  const start = event => {
    event.stopPropagation();
    if (!tool || live.current.pointer !== null || event.button !== 0) return;
    event.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const doc = value || newDocument({ width: Math.max(320, Math.min(4096, Math.round(rect.width))), height: Math.max(320, Math.min(4096, Math.round(rect.height))) });
    if (doc.strokes.length >= LIMITS.strokes || doc.strokes.reduce((n, s) => n + s.points.length, 0) >= LIMITS.points) {
      onError?.('このボードの手書きがいっぱいです。別のボードをご利用ください。');
      return;
    }
    live.current.pointer = event.pointerId;
    live.current.stroke = { document: doc, builder: new StrokeBuilder({ tool, color, size, input: event.pointerType, time: event.timeStamp }) };
    event.currentTarget.setPointerCapture(event.pointerId);
    sample(event);
  };
  const finish = (event, cancelled = false) => {
    event.stopPropagation();
    const state = live.current;
    if (state.pointer !== event.pointerId || !state.stroke) return;
    if (!cancelled) sample(event);
    const { document: doc, builder } = state.stroke;
    state.stroke = null;
    state.pointer = null;
    if (!cancelled && builder.stroke.points.length) {
      const next = validateDocument({ ...doc, revision: doc.revision + 1, strokes: [...doc.strokes, builder.stroke] });
      state.value = next;
      commit(next);
    }
    state.refresh();
  };
  const close = () => { setOpen(false); setTool(null); setColorOpen(false); };
  return <>
    <canvas ref={canvasRef} className="board-ink" aria-hidden="true" />
    {!readOnly && tool && <div className="board-ink-input" aria-label="ボードに手書き"
      onPointerDown={start} onPointerMove={sample} onPointerUp={finish}
      onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}
      onClick={stop} onContextMenu={event => event.preventDefault()} onTouchStart={stop} onTouchEnd={stop} />}
    {!readOnly && <div className="board-drawing-tools" onPointerDown={stop} onClick={stop} onTouchStart={stop} onTouchEnd={stop}
      onKeyDown={event => { if (event.key === 'Escape') colorOpen ? setColorOpen(false) : close(); }}>
      {colorOpen && tool !== 'eraser' && <CircularColorPicker color={color} onChange={setColor} onClose={() => setColorOpen(false)} />}
      {open && <div className="board-drawing-menu" role="toolbar" aria-label="手書きの文房具">
        {onStickers && <button type="button" title="ステッカー" aria-label="ボードにステッカーを貼る" onClick={() => { close(); onStickers(); }}><Sticker size={27} /></button>}
        {TOOLS.map(([id, label, defaultSize]) => <button key={id} type="button" title={label} aria-label={label} aria-pressed={tool === id}
          onClick={() => { setTool(id); setSize(defaultSize); }}>
          <img alt="" draggable="false" src={`${import.meta.env.BASE_URL}handwriting/assets/tools/${id === 'eraser' ? 'eraser-block' : id}-icon.png`} />
        </button>)}
        {tool && <div className="board-drawing-options">
          <button type="button" className="board-color-toggle" aria-label="線の色" aria-expanded={colorOpen} disabled={tool === 'eraser'}
            style={{ '--current-color': color }} onClick={() => setColorOpen(current => !current)} />
          <input type="range" aria-label="線の太さ" min="1" max="32" value={size} onChange={event => setSize(Number(event.target.value))} />
        </div>}
      </div>}
      {open && <div className="board-drawing-actions">
        <div className="board-drawing-history">
          <button type="button" aria-label="手書きを取り消す" disabled={!past.length} onClick={() => {
            const previous = past.at(-1);
            setPast(current => current.slice(0, -1));
            setFuture(current => [...current.slice(-(LIMITS.undo - 1)), value]);
            publish(previous);
          }}><Undo2 size={18}/></button>
          <button type="button" aria-label="手書きをやり直す" disabled={!future.length} onClick={() => {
            const next = future.at(-1);
            setFuture(current => current.slice(0, -1));
            setPast(current => [...current.slice(-(LIMITS.undo - 1)), value]);
            publish(next);
          }}><Redo2 size={18}/></button>
        </div>
        <button type="button" className="board-drawing-clear" aria-label="手書きをまっさらにする"
          disabled={!value?.strokes.length} onClick={() => commit({ ...value, revision: value.revision + 1, strokes: [] })}>
          <Sparkles size={16}/><small>まっさら</small>
        </button>
      </div>}
      <button type="button" className="board-drawing-toggle" aria-label={open ? '手書きを終了' : 'ボードに手書きする'} aria-expanded={open}
        onClick={() => open ? close() : setOpen(true)}>{open ? <Check size={22}/> : <Pencil size={21}/>}</button>
    </div>}
  </>;
}
