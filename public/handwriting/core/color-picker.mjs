const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function hexToHsv(hex) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '654c46';
  const [red, green, blue] = [0, 2, 4].map(index => Number.parseInt(normalized.slice(index, index + 2), 16) / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  return { h: (hue + 360) % 360, s: max ? delta / max : 0, v: max };
}

export function hsvToHex({ h, s, v }) {
  const chroma = v * s;
  const section = ((h % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs(section % 2 - 1));
  const [red, green, blue] = section < 1 ? [chroma, x, 0]
    : section < 2 ? [x, chroma, 0]
      : section < 3 ? [0, chroma, x]
        : section < 4 ? [0, x, chroma]
          : section < 5 ? [x, 0, chroma]
            : [chroma, 0, x];
  const match = v - chroma;
  const byte = channel => Math.round((channel + match) * 255).toString(16).padStart(2, '0');
  return `#${byte(red)}${byte(green)}${byte(blue)}`;
}

export function setupCircularColorPicker({ root, input, toggle, panel, wheel, brightness, brightnessValue, hex, confirm }) {
  let hsv = hexToHsv(input.value);
  let pointerMode = null;

  function draw() {
    if (panel.hidden) return;
    const size = 240;
    const scale = Math.min(2, devicePixelRatio || 1);
    wheel.width = size * scale;
    wheel.height = size * scale;
    const context = wheel.getContext('2d');
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
    const hueColor = hsvToHex({ h: hsv.h, s: 1, v: hsv.v });
    const gradient = context.createRadialGradient(center, center, 0, center, center, 78);
    gradient.addColorStop(0, hsvToHex({ h: hsv.h, s: 0, v: hsv.v }));
    gradient.addColorStop(1, hueColor);
    context.beginPath();
    context.arc(center, center, 78, 0, Math.PI * 2);
    context.fillStyle = gradient;
    context.fill();

    const hueRadians = (hsv.h - 90) * Math.PI / 180;
    context.beginPath();
    context.arc(center + Math.cos(hueRadians) * 100, center + Math.sin(hueRadians) * 100, 7, 0, Math.PI * 2);
    context.lineWidth = 3;
    context.strokeStyle = '#fff';
    context.stroke();
    context.beginPath();
    context.arc(center + hsv.s * 78, center, 7, 0, Math.PI * 2);
    context.fillStyle = hsvToHex(hsv);
    context.fill();
    context.lineWidth = 3;
    context.strokeStyle = '#fff';
    context.stroke();
  }

  function syncFields() {
    brightness.value = String(hsv.v);
    brightnessValue.textContent = `${Math.round(hsv.v * 100)}%`;
    hex.value = input.value.toUpperCase();
  }

  function setColor(next) {
    hsv = { h: (next.h + 360) % 360, s: clamp(next.s, 0, 1), v: clamp(next.v, 0, 1) };
    input.value = hsvToHex(hsv);
    syncFields();
    draw();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function updateFromPointer(event) {
    const bounds = wheel.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * 240 / bounds.width - 120;
    const y = (event.clientY - bounds.top) * 240 / bounds.height - 120;
    const radius = Math.hypot(x, y);
    pointerMode ||= radius >= 86 ? 'hue' : 'saturation';
    if (pointerMode === 'hue') setColor({ ...hsv, h: (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360 });
    else setColor({ ...hsv, s: clamp(radius / 78, 0, 1) });
  }

  function open() {
    hsv = hexToHsv(input.value);
    syncFields();
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(draw);
  }

  function close() {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', event => {
    event.stopPropagation();
    panel.hidden ? open() : close();
  });
  confirm.addEventListener('click', close);
  brightness.addEventListener('input', () => setColor({ ...hsv, v: Number(brightness.value) }));
  hex.addEventListener('input', () => {
    if (!/^#[0-9a-f]{6}$/i.test(hex.value)) return;
    hsv = hexToHsv(hex.value);
    input.value = hex.value.toLowerCase();
    syncFields();
    draw();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  hex.addEventListener('blur', syncFields);
  input.addEventListener('input', () => {
    const current = hsvToHex(hsv);
    if (current.toLowerCase() === input.value.toLowerCase()) return;
    hsv = hexToHsv(input.value);
    syncFields();
    draw();
  });
  wheel.addEventListener('pointerdown', event => {
    event.preventDefault();
    wheel.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  });
  wheel.addEventListener('pointermove', event => {
    if (wheel.hasPointerCapture(event.pointerId)) updateFromPointer(event);
  });
  const finishPointer = event => {
    pointerMode = null;
    if (wheel.hasPointerCapture(event.pointerId)) wheel.releasePointerCapture(event.pointerId);
  };
  wheel.addEventListener('pointerup', finishPointer);
  wheel.addEventListener('pointercancel', finishPointer);
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !root.contains(event.target)) close();
  });
// Named palette sets use a separate store; these are the quick-access colors.
  const preview = document.createElement('span');
  preview.className = 'current-color-preview';
  preview.setAttribute('aria-label', '現在の色');
  hex.parentElement.insertBefore(preview, hex);
  const quickRow = document.querySelector('.palette');
  let quickColors = [];
  try {
    const saved = JSON.parse(localStorage.getItem('usapon_quick_colors_v1') || '[]');
    if (Array.isArray(saved)) quickColors = [...new Set(saved.filter(c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)).map(c => c.toLowerCase()))];
  } catch {}
  const trash = document.createElement('button');
  trash.type = 'button'; trash.className = 'quick-color-trash'; trash.hidden = true;
  trash.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/></svg>';
  trash.setAttribute('aria-label', 'この色を削除');
  document.body.append(trash);
  let deleteColor = null;
  function saveQuick() {
    try { localStorage.setItem('usapon_quick_colors_v1', JSON.stringify(quickColors)); }
    catch { document.getElementById('status').textContent = '色を保存できませんでした'; }
  }
  function renderQuick() {
    quickRow.querySelectorAll('[data-quick-color]').forEach(n => n.remove());
    quickColors.forEach(color => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'quick-color'; b.dataset.quickColor = color;
      b.style.background = color; b.setAttribute('aria-label', color + 'を使う。長押しで削除');
      let timer, held = false, start;
      const cancel = () => { clearTimeout(timer); };
      const showTrash = () => {
        held = true; deleteColor = color;
        const r = b.getBoundingClientRect();
        trash.style.left = Math.min(innerWidth - 48, Math.max(4, r.left)) + 'px';
        trash.style.top = Math.max(4, r.top - 48) + 'px'; trash.hidden = false;
      };
      b.addEventListener('pointerdown', e => {
        held = false; start = { x:e.clientX, y:e.clientY };
        timer = setTimeout(showTrash, 550);
      });
      b.addEventListener('pointermove', e => { if (start && Math.hypot(e.clientX-start.x,e.clientY-start.y)>8) cancel(); });
      ['pointerup','pointercancel','pointerleave'].forEach(event => b.addEventListener(event, cancel));
      b.addEventListener('contextmenu', e => { e.preventDefault(); cancel(); showTrash(); });
      b.addEventListener('click', () => {
        if (held) return;
        input.value = color; input.dispatchEvent(new Event('input', { bubbles:true }));
      });
      b.addEventListener('keydown', e => {
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); showTrash(); }
      });
      quickRow.append(b);
    });
  }
  trash.addEventListener('click', () => {
    quickColors = quickColors.filter(c => c !== deleteColor);
    saveQuick(); renderQuick(); trash.hidden = true;
  });
  document.addEventListener('pointerdown', e => {
    if (!trash.contains(e.target)) trash.hidden = true;
  });
  const syncPreview = () => { preview.style.background = input.value; preview.title = input.value; };
  input.addEventListener('input', syncPreview);
  confirm.addEventListener('click', () => {
    const color = input.value.toLowerCase();
    if (!quickColors.includes(color)) { quickColors.push(color); saveQuick(); renderQuick(); }
  });
  renderQuick(); syncPreview();
  syncFields();
  return { open, close };
}
