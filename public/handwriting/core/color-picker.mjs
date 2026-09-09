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
  syncFields();
  return { open, close };
}

