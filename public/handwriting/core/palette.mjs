const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const PRESETS = [
  { id: 'autumn', name: '秋の色', colors: ['#885744','#bc7044','#dba747','#e8cc91','#82916b','#644c55'] },
  { id: 'soft', name: 'やさしい色', colors: ['#df8e9c','#e9bdaf','#eddda5','#a8bd99','#99bacb','#b9a6c7'] },
  { id: 'halloween', name: 'ハロウィン', colors: ['#e39a44','#735679','#41434f','#a5b67a','#f4e4b7','#b96b78'] }
];
export function normalizePalettes(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((item, index) => ({
    id: typeof item?.id === 'string' ? item.id.slice(0, 60) : `palette-${index + 1}`,
    name: typeof item?.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 30) : `パレット ${index + 1}`,
    colors: Array.isArray(item?.colors) ? [...new Set(item.colors.filter(color => typeof color === 'string' && COLOR_PATTERN.test(color)).map(color => color.toLowerCase()))].slice(0, 16) : []
  }));
}
export function setupColorPalettes({ input, holders, addButton, panel, title, colors, addColor, deleteButton, closeButton, storageKey = 'usapon_color_palettes_v1' }) {
  // Escape the dock's backdrop-filter containing block.
  document.body.append(panel);
  function positionPanel() {
    if (panel.hidden) return;
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const left = viewport?.offsetLeft ?? 0;
    const width = viewport?.width ?? innerWidth;
    const height = viewport?.height ?? innerHeight;
    const anchor = addButton.getBoundingClientRect();
    const bottomEdge = Math.max(top + 80, Math.min(anchor.top - 8, top + height - 12));
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';
    panel.style.width = Math.min(350, width - 24) + 'px';
    panel.style.maxHeight = Math.max(60, bottomEdge - top - 12) + 'px';
    panel.style.left = Math.max(left + 12, Math.min(anchor.right - panel.offsetWidth, left + width - panel.offsetWidth - 12)) + 'px';
    panel.style.top = Math.max(top + 12, bottomEdge - panel.offsetHeight) + 'px';
  }
  window.addEventListener('resize', positionPanel);
  window.addEventListener('scroll', positionPanel, {passive:true});
  window.visualViewport?.addEventListener('resize', positionPanel);
  window.visualViewport?.addEventListener('scroll', positionPanel);
  new ResizeObserver(positionPanel).observe(panel);
  let palettes = [], stock = [], selected = 'autumn';
  try { palettes = normalizePalettes(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch {}
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey + '_stock') || '[]');
    stock = normalizePalettes([{ colors: saved }])[0].colors;
    selected = localStorage.getItem(storageKey + '_selected') || selected;
  } catch {}
  if (![...PRESETS, ...palettes].some(p => p.id === selected)) selected = 'autumn';
  let chosen = new Set();
  const all = () => [...PRESETS, ...palettes];
  const current = () => all().find(p => p.id === selected) || PRESETS[0];
  const notice = document.createElement('p');
  notice.className = 'palette-notice';
  notice.setAttribute('role', 'status');
  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(palettes));
      localStorage.setItem(storageKey + '_stock', JSON.stringify(stock));
      localStorage.setItem(storageKey + '_selected', selected);
      notice.textContent = '';
    } catch { notice.textContent = '保存できませんでした。この画面を閉じると変更が失われます。'; }
  }
  function button(label, className, action) {
    const node = document.createElement('button');
    node.type = 'button'; node.className = className; node.textContent = label;
    node.addEventListener('click', action);
    return node;
  }
  function swatch(color, action) {
    const node = button('', 'palette-color', action);
    node.style.setProperty('--palette-color', color);
    node.setAttribute('aria-label', color);
    return node;
  }
  function close() { panel.hidden = true; addButton.setAttribute('aria-expanded', 'false'); }
  function renderRow() {
    holders.replaceChildren();
    holders.setAttribute('aria-label', current().name);
    current().colors.forEach(color => {
      const node = swatch(color, () => { input.value = color; input.dispatchEvent(new Event('input', { bubbles: true })); });
      node.setAttribute('aria-pressed', String(input.value.toLowerCase() === color));
      enableColorActions(node,color,current().id);
      holders.append(node);
    });
    addButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.7 3 3 6.8 3 11.7c0 5 3.8 9.3 8.4 9.3 2 0 3-1.1 2.2-2.7-.8-1.7.1-3.1 2-3.1h2.2c2.2 0 3.2-1.5 3.2-3.7C21 6.7 17 3 12 3Z"/><circle cx="7" cy="10" r="1.5" fill="#df8e9c" stroke="none"/><circle cx="10" cy="6.8" r="1.5" fill="#dfbd6e" stroke="none"/><circle cx="14.5" cy="7" r="1.5" fill="#8cae81" stroke="none"/><circle cx="17.4" cy="10.4" r="1.5" fill="#6da9c6" stroke="none"/><circle cx="7.5" cy="15" r="1.4" fill="#fffdf8"/></svg>';
    addButton.className = 'palette-switch';
    addButton.setAttribute('aria-label', 'パレットを選ぶ：' + current().name);
    addButton.title = current().name + '（パレットを選ぶ）';
  }
  title.textContent = 'パレット';
  colors.className = 'palette-library';
  addColor.textContent = '今の色をストック';
  deleteButton.hidden = true;
  const stockLabel = document.createElement('strong'); stockLabel.textContent = '色のストック';
  const stockGrid = document.createElement('div'); stockGrid.className = 'palette-stock';
  const hint = document.createElement('p'); hint.className = 'palette-notice'; hint.textContent = '色を選んで、名前をつけて保存';
  const name = document.createElement('input');
  name.type = 'text'; name.maxLength = 30; name.placeholder = 'パレットの名前'; name.setAttribute('aria-label', 'パレットの名前');
  const create = button('パレットを保存', 'palette-save', () => {
    if (!name.value.trim() || !chosen.size) { name.focus(); return; }
    if (palettes.length >= 30) { notice.textContent = 'パレットは30個まで保存できます。'; return; }
    const palette = { id: 'custom-' + crypto.randomUUID(), name: name.value.trim(), colors: [...chosen] };
    palettes.push(palette); selected = palette.id; name.value = ''; chosen.clear();
    save(); renderRow(); renderLibrary(); renderStock(); close();
  });
  const editor = document.createElement('div'); editor.className = 'palette-create';
  editor.append(stockLabel, stockGrid, hint, name, create, notice);
  panel.append(editor);
  function renderLibrary() {
    colors.replaceChildren();
    all().forEach(palette => {
      const entry = document.createElement('div'); entry.className = 'palette-entry';
      const select = button('', 'palette-set', () => { selected = palette.id; save(); renderRow(); close(); });
      select.setAttribute('aria-label', palette.name + 'を使う');
      select.setAttribute('aria-pressed', String(selected === palette.id));
      const label = document.createElement('span'); label.textContent = palette.name;
      const preview = document.createElement('span'); preview.className = 'palette-preview';
      palette.colors.forEach(color => { const dot = document.createElement('i'); dot.style.background = color; enableColorActions(dot,color,palette.id); preview.append(dot); });
      select.append(label, preview); entry.append(select);
      if (!PRESETS.some(p => p.id === palette.id)) {
        entry.append(button('×', 'palette-remove-set', () => {
          if (!confirm('「' + palette.name + '」を削除しますか？')) return;
          palettes = palettes.filter(p => p.id !== palette.id);
          if (selected === palette.id) selected = 'autumn';
          save(); renderRow(); renderLibrary();
        }));
        entry.lastChild.setAttribute('aria-label', palette.name + 'を削除');
      }
      colors.append(entry);
    });
  }
  function renderStock() {
    stockGrid.replaceChildren();
    stock.forEach(color => {
      const node = swatch(color, () => {
        chosen.has(color) ? chosen.delete(color) : chosen.add(color);
        renderStock();
      });
      node.setAttribute('aria-label', color + 'をセットに選ぶ');
      node.setAttribute('aria-pressed', String(chosen.has(color)));
      stockGrid.append(node);
    });
    create.disabled = !chosen.size || !name.value.trim();
    addColor.disabled = stock.includes(input.value.toLowerCase());
  }
  addButton.addEventListener('click', () => {
    if (!panel.hidden) { close(); return; }
    panel.hidden = false; addButton.setAttribute('aria-expanded', 'true');
    renderLibrary(); renderStock();
    positionPanel();
  });
  closeButton.addEventListener('click', close);
  name.addEventListener('input', () => { create.disabled = !chosen.size || !name.value.trim(); });
  addColor.addEventListener('click', () => {
    const color = input.value.toLowerCase();
    if (!COLOR_PATTERN.test(color) || stock.includes(color)) return;
    if (stock.length >= 16) { notice.textContent = 'ストックは16色までです。'; return; }
    stock.push(color); chosen.add(color); save(); renderStock();
  });
  input.addEventListener('input', () => { renderRow(); renderStock(); });
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !panel.contains(event.target) && !addButton.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
const colorMenu=document.createElement('div');
  colorMenu.className='palette-color-menu';colorMenu.hidden=true;
  colorMenu.setAttribute('role','dialog');colorMenu.setAttribute('aria-label','色の操作');
  document.body.append(colorMenu);
  function dismissColorMenu(){colorMenu.hidden=true;}
  function locateColorMenu(anchor){
    const v=window.visualViewport, left=v?.offsetLeft??0,top=v?.offsetTop??0;
    const width=v?.width??innerWidth,height=v?.height??innerHeight;
    colorMenu.style.maxHeight=Math.max(80,height-24)+'px';
    colorMenu.style.left=Math.max(left+12,Math.min(anchor.left,left+width-colorMenu.offsetWidth-12))+'px';
    colorMenu.style.top=Math.max(top+12,Math.min(anchor.top-colorMenu.offsetHeight-8,top+height-colorMenu.offsetHeight-12))+'px';
  }
  function editablePalette(source){
    if(!PRESETS.some(p=>p.id===source.id))return source;
    if(palettes.length>=30){document.getElementById('status').textContent='パレットは30個までです';return null;}
    const copy={...source,id:'custom-'+crypto.randomUUID(),name:source.name+'（マイ）',colors:[...source.colors]};
    palettes.push(copy);return copy;
  }
  function colorActions(color,sourceId,anchor){
    colorMenu.replaceChildren();colorMenu.hidden=false;
    const dismiss=button('閉じる','palette-menu-close',dismissColorMenu);
    const add=button('上の色欄に追加','',()=>{
      document.dispatchEvent(new CustomEvent('usapon-quick-color-add',{detail:{color}}));
      dismissColorMenu();
    });
    const remove=button('このパレットから削除','palette-menu-delete',()=>{
      const source=all().find(p=>p.id===sourceId);if(!source)return;
      const target=editablePalette(source);if(!target)return;
      target.colors=target.colors.filter(c=>c!==color);
      if(selected===sourceId)selected=target.id;
      save();renderRow();if(!panel.hidden)renderLibrary();dismissColorMenu();
      document.getElementById('status').textContent='パレットから色を外しました';
    });
    remove.insertAdjacentHTML('afterbegin','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/></svg>');
    colorMenu.append(add,remove,dismiss);locateColorMenu(anchor);
  }
  function enableColorActions(node,color,sourceId){
    let timer=null,held=false,start=null;
    const cancel=()=>{clearTimeout(timer);timer=null;};
    const show=()=>{cancel();held=true;colorActions(color,sourceId,node.getBoundingClientRect());};
    node.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      held=false;start={x:e.clientX,y:e.clientY};timer=setTimeout(show,550);
    });
    node.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)cancel();});
    ['pointerup','pointercancel','pointerleave','lostpointercapture'].forEach(t=>node.addEventListener(t,cancel));
    node.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();show();});
    node.addEventListener('click',e=>{if(held){e.preventDefault();e.stopImmediatePropagation();held=false;}},true);
    node.addEventListener('keydown',e=>{if((e.shiftKey&&e.key==='F10')||e.key==='ContextMenu'){e.preventDefault();show();}});
  }
  document.addEventListener('pointerdown',e=>{if(!colorMenu.contains(e.target))dismissColorMenu();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')dismissColorMenu();});
  window.addEventListener('resize',dismissColorMenu);
  window.addEventListener('scroll',dismissColorMenu,{passive:true});
  renderRow(); renderStock();
  document.addEventListener('usapon-palette-drop', event => {
    const color = event.detail?.color;
    if (typeof color !== 'string' || !COLOR_PATTERN.test(color)) return;
    let target = current();
    if (target.colors.includes(color)) { event.detail.accepted = true; return; }
    if (target.colors.length >= 16) {
      document.getElementById('status').textContent = 'パレットは16色までです'; return;
    }
    if (PRESETS.some(p => p.id === target.id)) {
      if (palettes.length >= 30) { document.getElementById('status').textContent = 'パレットは30個までです'; return; }
      target = { id: 'custom-' + crypto.randomUUID(), name: target.name + '（マイ）', colors: [...target.colors] };
      palettes.push(target); selected = target.id;
    }
    target.colors.push(color);
    save(); renderRow();
    event.detail.accepted = true;
    if (!panel.hidden) renderLibrary();
    document.getElementById('status').textContent = 'パレットに色を追加しました';
  });
  return { close };
}
