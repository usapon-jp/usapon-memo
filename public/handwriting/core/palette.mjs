const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const MAX_PALETTES = 5;
const MAX_COLORS = 8;

export function normalizePalettes(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_PALETTES).map((item, index) => ({
    id: typeof item?.id === 'string' ? item.id.slice(0, 60) : `palette-${index + 1}`,
    colors: Array.isArray(item?.colors) ? [...new Set(item.colors.filter(color => COLOR_PATTERN.test(color)).map(color => color.toLowerCase()))].slice(0, MAX_COLORS) : []
  }));
}

export function setupColorPalettes({ input, holders, addButton, panel, title, colors, addColor, deleteButton, closeButton, storageKey = 'usapon_color_palettes_v1' }) {
  let palettes = [];
  let activeId = null;
  try { palettes = normalizePalettes(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch { palettes = []; }

  const save = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(palettes)); } catch { /* The picker still works without storage. */ }
  };
  const activePalette = () => palettes.find(item => item.id === activeId);

  function chooseColor(color) {
    input.value = color;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function renderPanel() {
    const palette = activePalette();
    if (!palette) { panel.hidden = true; return; }
    title.textContent = `パレット ${palettes.indexOf(palette) + 1}`;
    colors.replaceChildren();
    if (!palette.colors.length) {
      const empty = document.createElement('span');
      empty.className = 'palette-empty';
      empty.textContent = '今の色を追加できます';
      colors.append(empty);
    }
    for (const color of palette.colors) {
      const item = document.createElement('span');
      item.className = 'palette-color-item';
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'palette-color';
      select.style.setProperty('--palette-color', color);
      select.setAttribute('aria-label', `${color}を使う`);
      select.addEventListener('click', () => chooseColor(color));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'palette-color-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `${color}をパレットから外す`);
      remove.addEventListener('click', () => {
        palette.colors = palette.colors.filter(value => value !== color);
        save(); render();
      });
      item.append(select, remove);
      colors.append(item);
    }
    addColor.disabled = palette.colors.includes(input.value.toLowerCase()) || palette.colors.length >= MAX_COLORS;
  }

  function open(id) {
    activeId = id;
    panel.hidden = false;
    renderPanel();
  }

  function close() {
    activeId = null;
    panel.hidden = true;
  }

  function render() {
    holders.replaceChildren();
    palettes.forEach((palette, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'palette-holder';
      button.setAttribute('aria-label', `パレット ${index + 1}を開く、${palette.colors.length}色`);
      const previews = palette.colors.slice(0, 4);
      if (!previews.length) {
        const empty = document.createElement('i');
        empty.className = 'palette-holder-empty';
        button.append(empty);
      } else {
        previews.forEach(color => {
          const dot = document.createElement('i');
          dot.style.setProperty('--palette-color', color);
          button.append(dot);
        });
      }
      button.addEventListener('click', () => open(palette.id));
      holders.append(button);
    });
    addButton.hidden = palettes.length >= MAX_PALETTES;
    if (!panel.hidden) renderPanel();
  }

  addButton.addEventListener('click', () => {
    if (palettes.length >= MAX_PALETTES) return;
    const id = `palette-${Date.now()}-${palettes.length}`;
    palettes.push({ id, colors: [] });
    save(); render(); open(id);
  });
  addColor.addEventListener('click', () => {
    const palette = activePalette();
    const color = input.value.toLowerCase();
    if (!palette || palette.colors.includes(color) || palette.colors.length >= MAX_COLORS) return;
    palette.colors.push(color);
    save(); render();
  });
  deleteButton.addEventListener('click', () => {
    if (!activeId) return;
    palettes = palettes.filter(item => item.id !== activeId);
    save(); close(); render();
  });
  closeButton.addEventListener('click', close);
  input.addEventListener('input', () => { if (!panel.hidden) renderPanel(); });
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !panel.contains(event.target) && !holders.contains(event.target) && event.target !== addButton) close();
  });
  render();
  return { close };
}

