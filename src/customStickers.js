export const MY_STICKER_UNFILED_ID = 'unfiled';
export const MY_STICKER_PACK_FORMAT = 'usapon-sticker-pack';
export const MY_STICKER_PACK_VERSION = 1;
export const MY_STICKER_LIMIT = 100;
export const MY_STICKER_FOLDER_LIMIT = 24;

const cleanText = (value, fallback = '', maxLength = 48) => (
  typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback
);

export function normalizeCustomStickerFolders(value = []) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).flatMap((folder, index) => {
    const id = cleanText(folder?.id, '', 80);
    if (!id || id === MY_STICKER_UNFILED_ID || seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      name: cleanText(folder?.name, `フォルダ${index + 1}`),
      order: Number.isFinite(Number(folder?.order)) ? Number(folder.order) : index,
      createdAt: typeof folder?.createdAt === 'string' ? folder.createdAt : new Date(0).toISOString()
    }];
  }).sort((left, right) => left.order - right.order)
    .slice(0, MY_STICKER_FOLDER_LIMIT)
    .map((folder, order) => ({ ...folder, order }));
}
export function normalizeCustomStickers(value = [], folders = []) {
  const folderIds = new Set(folders.map(folder => folder.id));
  const seen = new Set();
  return (Array.isArray(value) ? value : []).flatMap((sticker, index) => {
    const id = cleanText(sticker?.id, '', 100);
    const mediaId = cleanText(sticker?.mediaId, '', 120);
    if (!id || !mediaId || seen.has(id)) return [];
    seen.add(id);
    const folderId = folderIds.has(sticker?.folderId) ? sticker.folderId : MY_STICKER_UNFILED_ID;
    return [{
      id,
      name: cleanText(sticker?.name, `マイステッカー${index + 1}`),
      folderId,
      mediaId,
      contentHash: cleanText(sticker?.contentHash, '', 128),
      width: Number.isFinite(Number(sticker?.width)) ? Math.max(1, Number(sticker.width)) : 1,
      height: Number.isFinite(Number(sticker?.height)) ? Math.max(1, Number(sticker.height)) : 1,
      finish: ['white-outline', 'transparent'].includes(sticker?.finish) ? sticker.finish : 'transparent',
      order: Number.isFinite(Number(sticker?.order)) ? Number(sticker.order) : index,
      createdAt: typeof sticker?.createdAt === 'string' ? sticker.createdAt : new Date(0).toISOString(),
      updatedAt: typeof sticker?.updatedAt === 'string' ? sticker.updatedAt : (typeof sticker?.createdAt === 'string' ? sticker.createdAt : new Date(0).toISOString())
    }];
  }).slice(0, MY_STICKER_LIMIT)
    .sort((left, right) => left.order - right.order)
    .map((sticker, order) => ({ ...sticker, order }));
}

export function normalizeCustomStickerLibrary(data = {}) {
  const folders = normalizeCustomStickerFolders(data.customStickerFolders);
  return {
    customStickerFolders: folders,
    customStickers: normalizeCustomStickers(data.customStickers, folders)
  };
}

export function nextStickerOrder(stickers = []) {
  return stickers.reduce((maximum, sticker) => Math.max(maximum, Number(sticker.order) || 0), -1) + 1;
}

export function safeStickerFileName(name, id) {
  const base = cleanText(name, `sticker-${id}`, 60)
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return `${base || `sticker-${id}`}.png`;
}
