export const PHOTO_FLOW_CONTEXT_KEY = 'usapon_photo_flow_context_v1';
export const PHOTO_FLOW_RESULT_KEY = 'usapon_photo_flow_result_v1';

export function parsePhotoFlowContext(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 200_000) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || value.draft?.cardType !== 'photo'
      || typeof value.mediaId !== 'string' || !value.mediaId || value.mediaId.length > 120
      || !['card', 'image'].includes(value.placement)) return null;
    return value;
  } catch { return null; }
}

export function parsePhotoFlowResult(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 500) return null;
  try {
    const value = JSON.parse(raw);
    return value?.version === 1 && typeof value.mediaId === 'string'
      && value.mediaId.startsWith('photo-flow-') && value.mediaId.length <= 120 ? value : null;
  } catch { return null; }
}
