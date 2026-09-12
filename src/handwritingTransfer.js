export const HANDWRITING_TRANSFER_KEY = 'usapon_handwriting_transfer_v1';
const MAX_TRANSFER_CHARS = 6_000_000;

export const parseHandwritingTransfer = (raw) => {
  if (typeof raw !== 'string' || !raw || raw.length > MAX_TRANSFER_CHARS) return null;
  try {
    const value = JSON.parse(raw);
    if (
      ![1, 2].includes(value?.version)
      || typeof value.dataUrl !== 'string'
      || !value.dataUrl.startsWith('data:image/png;base64,')
      || !Number.isInteger(value.width)
      || !Number.isInteger(value.height)
      || value.width < 1
      || value.height < 1
      || value.width > 4096
      || value.height > 4096
    ) return null;
    const finish = value.version === 2 && ['white-outline', 'transparent', 'paper'].includes(value.finish)
      ? value.finish
      : (value.backgroundIncluded ? 'paper' : 'transparent');
    return {
      dataUrl: value.dataUrl,
      width: value.width,
      height: value.height,
      backgroundIncluded: finish === 'paper',
      finish,
      saveToMyStickers: finish !== 'paper' && Boolean(value.saveToMyStickers),
      stickerName: typeof value.stickerName === 'string' ? value.stickerName.trim().slice(0, 48) : '',
      stickerFolderId: typeof value.stickerFolderId === 'string' ? value.stickerFolderId.slice(0, 80) : 'unfiled'
    };
  } catch {
    return null;
  }
};
