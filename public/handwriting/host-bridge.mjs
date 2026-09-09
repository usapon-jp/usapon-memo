const TRANSFER_KEY = 'usapon_handwriting_transfer_v1';
const MAX_TRANSFER_CHARS = 6_000_000;

export function sendToMemo(transfer) {
  const payload = JSON.stringify({ version: 1, createdAt: new Date().toISOString(), ...transfer });
  if (payload.length > MAX_TRANSFER_CHARS) throw new Error('画像が大きすぎます。背景なしで試してください。');
  window.sessionStorage.setItem(TRANSFER_KEY, payload);
  return new URL('../?handwritingPaste=1', window.location.href).href;
}
