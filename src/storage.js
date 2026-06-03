import { normalizeData } from './memoModel.js';

const STORAGE_KEY = 'usapon_memo_data';
export const LOCAL_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;

const createDefaultData = () => normalizeData({});

const getStringBytes = (value = '') => new Blob([value]).size;

const dataUrlByteLength = (dataUrl = '') => {
  const base64 = dataUrl.split(',')[1] || '';
  if (!base64) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

const getImagePayloadBytes = (data = {}) => {
  const photoCards = (data.memos || [])
    .filter(memo => memo.cardType === 'photo')
    .reduce((sum, memo) => sum + dataUrlByteLength(memo.photoDataUrl), 0);
  const boardImages = (data.boardItems || [])
    .filter(item => item.type === 'image')
    .reduce((sum, item) => sum + dataUrlByteLength(item.imageDataUrl), 0);
  const diaryPhotos = Object.values(data.diaryRecords || {})
    .flatMap(record => record.photos || [])
    .reduce((sum, photo) => sum + dataUrlByteLength(photo.url), 0);
  const boardSnapshots = Object.values(data.diaryRecords || {})
    .flatMap(record => record.boards || [])
    .reduce((sum, snapshot) => sum + dataUrlByteLength(snapshot.snapshotDataUrl), 0);
  return photoCards + boardImages + diaryPhotos + boardSnapshots;
};

export const getMemoStorageDebugInfo = (data, extra = {}) => {
  const normalized = normalizeData(data);
  const nextRaw = JSON.stringify(normalized);
  const currentRaw = localStorage.getItem(STORAGE_KEY) || '';
  const currentUsageBytes = getStringBytes(currentRaw);
  const attemptedSaveBytes = getStringBytes(nextRaw);
  const lastImageCompression = globalThis.__usaponLastImageCompression || null;
  return {
    reason: extra.reason || 'save',
    currentUsageBytes,
    maxStorageBytes: LOCAL_STORAGE_QUOTA_BYTES,
    attemptedSaveBytes,
    attemptedIncreaseBytes: Math.max(0, attemptedSaveBytes - currentUsageBytes),
    attemptedImageBytes: getImagePayloadBytes(normalized),
    attemptedSingleImageBytes: extra.attemptedSingleImageBytes || lastImageCompression?.compressedBytes || 0,
    lastImageCompression,
    storageKey: STORAGE_KEY
  };
};

export const getStorageKey = () => STORAGE_KEY;

export const loadMemoData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultData();
    return normalizeData(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to load memo data', error);
    return createDefaultData();
  }
};

export const saveMemoData = (data, debugContext = {}) => {
  const normalized = normalizeData(data);
  const debugInfo = getMemoStorageDebugInfo(normalized, debugContext);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    if (debugContext.logSuccess) {
      console.log('[usapon-memo storage ok]', debugInfo);
    }
    return true;
  } catch (error) {
    console.error('Failed to save memo data', error);
    console.log('[usapon-memo storage failed]', debugInfo);
    return false;
  }
};
