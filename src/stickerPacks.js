import { STICKER_CATALOG, STICKER_PACKS } from './memoModel.js';
// Receipts decide availability; the old 15-item display preference does not.
export function availableStickerPacks(availableIds, preferences = {}, includeHidden = false) {
  const available = new Set(availableIds);
  const known = new Set(STICKER_CATALOG.map(sticker => sticker.id));
  const order = [...new Set([...(preferences.order || []), ...Object.keys(STICKER_PACKS)])];
  const hidden = new Set(preferences.hidden || []);
  return Object.entries(STICKER_PACKS).map(([id, pack]) => ({
    id, label: pack.label,
    stickerIds: pack.stickerIds.filter(id => available.has(id) && known.has(id))
  })).filter(pack => pack.stickerIds.length && (includeHidden || !hidden.has(pack.id)))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
