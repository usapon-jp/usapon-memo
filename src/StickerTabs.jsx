import { useId, useState } from 'react';
import { STICKER_CATALOG } from './memoModel';
import { availableStickerPacks } from './stickerPacks';

export default function StickerTabs({ stickerIds, initialPack = 'default', onSelect, preferences = {}, onPreferencesChange }) {
  const prefix = useId();
  const [selected, setSelected] = useState(initialPack);
  const packs = availableStickerPacks(stickerIds, preferences, Boolean(onPreferencesChange));
  const active = packs.find(pack => pack.id === selected) || packs[0];
  const paletteRows = Math.max(1, ...packs.map(pack => Math.ceil(pack.stickerIds.length / 4)));
  function move(id, delta) {
    const order = packs.map(p => p.id); const index = order.indexOf(id); const next = index + delta;
    if (next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    onPreferencesChange({ ...preferences, order });
  }
  return <div className="sticker-library all-sticker-library">
    {onPreferencesChange && <div className="sticker-set-management">{packs.map((pack, index) => <div className="sticker-set-row" key={pack.id}>
      <button type="button" className="sticker-set-name" onClick={() => setSelected(pack.id)} aria-pressed={active?.id === pack.id}><img src={STICKER_CATALOG.find(s=>s.id===pack.stickerIds[0])?.src} alt="" /><span>{pack.label}</span></button>
      <label><input type="checkbox" checked={!(preferences.hidden || []).includes(pack.id)} onChange={event => onPreferencesChange({ ...preferences, hidden: event.target.checked ? (preferences.hidden || []).filter(id=>id!==pack.id) : [...(preferences.hidden || []), pack.id] })} />表示</label>
      <button type="button" aria-label={`${pack.label}を前へ`} disabled={index===0} onClick={()=>move(pack.id,-1)}>↑</button>
      <button type="button" aria-label={`${pack.label}を後ろへ`} disabled={index===packs.length-1} onClick={()=>move(pack.id,1)}>↓</button>
    </div>)}</div>}
    {!onPreferencesChange && <div className="sticker-set-tabs" role="tablist" aria-label="ステッカーの種類">
      {packs.map(pack => <button key={pack.id} id={`${prefix}-${pack.id}`} type="button" role="tab" aria-label={pack.label} aria-selected={active?.id === pack.id} aria-controls={`${prefix}-panel`} onClick={() => setSelected(pack.id)}>
        <img src={STICKER_CATALOG.find(s => s.id === pack.stickerIds[0])?.src} alt="" draggable={false} /><span>{pack.label}</span>
      </button>)}
    </div>}
    <div className="sticker-palette" style={{ height: `min(48dvh, ${paletteRows * 90 + 6}px)` }} id={`${prefix}-panel`} role="tabpanel" aria-labelledby={!onPreferencesChange && active ? `${prefix}-${active.id}` : undefined} aria-label={onPreferencesChange ? active?.label : undefined}>
      {(active?.stickerIds || []).map(id => { const sticker = STICKER_CATALOG.find(s => s.id === id); return onSelect
        ? <button key={id} type="button" aria-label={`${sticker.label}を貼る`} onClick={event => onSelect(id, event)}><img src={sticker.src} alt="" draggable={false} /></button>
        : <div className="sticker-preview-tile" key={id}><img src={sticker.src} alt={sticker.label} draggable={false} /></div>; })}
    </div>
    {!active && <p>使える素材はまだありません。</p>}
  </div>;
}
