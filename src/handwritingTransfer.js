export const HANDWRITING_TRANSFER_KEY = 'usapon_handwriting_transfer_v1';
const MAX_TRANSFER_CHARS = 6_000_000;

export const parseHandwritingTransfer = (raw) => {
  if (typeof raw !== 'string' || !raw || raw.length > MAX_TRANSFER_CHARS) return null;
  try {
    const value = JSON.parse(raw);
    if (
      value?.version !== 1
      || typeof value.dataUrl !== 'string'
      || !value.dataUrl.startsWith('data:image/png;base64,')
      || !Number.isInteger(value.width)
      || !Number.isInteger(value.height)
      || value.width < 1
      || value.height < 1
      || value.width > 4096
      || value.height > 4096
    ) return null;
    return {
      dataUrl: value.dataUrl,
      width: value.width,
      height: value.height,
      backgroundIncluded: Boolean(value.backgroundIncluded)
    };
  } catch {
    return null;
  }
};
