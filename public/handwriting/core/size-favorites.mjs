import { BRUSH_SIZES } from './brush-sizes.mjs';
const KEY = 'usapon_size_favorites_v1';
export function cleanSizeFavorites(value) {
  return Object.fromEntries(Object.entries(BRUSH_SIZES).map(([tool, range]) =>
    [tool, [...new Set((Array.isArray(value?.[tool]) ? value[tool] : [])
      .filter(n => Number.isInteger(n) && n >= range.min && n <= range.max))].slice(0, 2)]));
}
export function setupSizeFavorites({ slider, getTool, onChange, message }) {
  let stored;
  try { stored = JSON.parse(localStorage.getItem(KEY)); } catch {}
  const favorites = cleanSizeFavorites(stored);
  const marks = document.createElement('div');
  marks.className = 'size-favorites';
  marks.setAttribute('aria-hidden', 'true');
  slider.parentElement.append(marks);
  slider.title = '長押しで太さをキープ（2つまで）。印を長押しで解除';
  let gesture = null;
  const bounds = () => {
    const rect = slider.getBoundingClientRect();
    return { left: rect.left + 8, width: Math.max(1, rect.width - 16) };
  };
  const position = value => {
    const {min, max} = BRUSH_SIZES[getTool()];
    return (value - min) / (max - min);
  };
  const nearest = x => {
    const b = bounds();
    return favorites[getTool()].find(n => Math.abs(b.left + position(n) * b.width - x) <= 12);
  };
  const set = value => { slider.value = String(value); onChange(); };
  const at = x => {
    const b = bounds(), range = BRUSH_SIZES[getTool()];
    return Math.round(Math.max(range.min, Math.min(range.max, range.min + (x - b.left) / b.width * (range.max - range.min))));
  };
  function render() {
    marks.replaceChildren(...favorites[getTool()].map(value => {
      const dot = document.createElement('i');
      dot.style.left = `calc(8px + (100% - 16px) * ${position(value)})`;
      return dot;
    }));
  }
  function toggle(value) {
    const list = favorites[getTool()];
    if (list.includes(value)) {
      list.splice(list.indexOf(value), 1);
      message('太さのキープを解除しました');
    } else if (list.length < 2) {
      list.push(value); message(`太さ ${value} をキープしました`);
    } else {
      message('キープは2つまで。印を長押しすると解除できます');
      return;
    }
    try { localStorage.setItem(KEY, JSON.stringify(favorites)); }
    catch { message('このブラウザでは保存できません。画面を閉じるまでキープします'); }
    render();
  }
  function cancel() {
    if (gesture) clearTimeout(gesture.timer);
    gesture = null;
  }
  slider.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !e.isPrimary) return;
    e.preventDefault();
    cancel();
    const b = bounds();
    const near = nearest(e.clientX);
    const onThumb = Math.abs(b.left + position(Number(slider.value)) * b.width - e.clientX) <= 12;
    set(near ?? (onThumb ? Number(slider.value) : at(e.clientX)));
    const g = gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, held: false };
    slider.setPointerCapture(e.pointerId);
    g.timer = setTimeout(() => {
      if (gesture !== g) return;
      g.held = true;
      toggle(Number(slider.value));
    }, 550);
  });
  slider.addEventListener('pointermove', e => {
    const g = gesture;
    if (!g || g.id !== e.pointerId || g.held) return;
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 7) {
      g.moved = true; clearTimeout(g.timer);
    }
    if (g.moved) set(at(e.clientX));
  });
  slider.addEventListener('pointerup', e => {
    if (!gesture || gesture.id !== e.pointerId) return;
    if (!gesture.moved && !gesture.held) set(nearest(e.clientX) ?? Number(slider.value));
    cancel();
  });
  slider.addEventListener('pointercancel', cancel);
  slider.addEventListener('lostpointercapture', cancel);
  slider.addEventListener('contextmenu', e => e.preventDefault());
  slider.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); toggle(Number(slider.value)); }
  });
  window.addEventListener('blur', cancel);
  render();
  return { refresh() { cancel(); render(); } };
}
