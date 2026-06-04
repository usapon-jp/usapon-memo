const MEDIA_DB_NAME = 'usapon_memo_media';
const MEDIA_DB_VERSION = 1;
const MEDIA_STORE_NAME = 'media';

export const MEDIA_KINDS = {
  photoCard: 'photo-card',
  boardImage: 'board-image',
  diaryPhoto: 'diary-photo',
  boardSnapshot: 'board-snapshot'
};

export const dataUrlByteLength = (dataUrl = '') => {
  const base64 = dataUrl.split(',')[1] || '';
  if (!base64) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

const openMediaDb = () => new Promise((resolve, reject) => {
  if (!('indexedDB' in globalThis)) {
    reject(new Error('IndexedDB is not available'));
    return;
  }

  const request = indexedDB.open(MEDIA_DB_NAME, MEDIA_DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) {
      db.createObjectStore(MEDIA_STORE_NAME, { keyPath: 'id' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const withMediaStore = async (mode, callback) => {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MEDIA_STORE_NAME, mode);
    const store = transaction.objectStore(MEDIA_STORE_NAME);
    let result;

    try {
      result = callback(store);
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }).finally(() => db.close());
};

export const createMediaId = (prefix = 'media') => `${prefix}-${crypto.randomUUID()}`;

export const putMediaRecord = async (record) => {
  const now = new Date().toISOString();
  const nextRecord = {
    id: record.id || createMediaId(record.kind || 'media'),
    kind: record.kind || 'media',
    dataUrl: record.dataUrl || '',
    thumbnailDataUrl: record.thumbnailDataUrl || '',
    mimeType: record.mimeType || '',
    width: Number.isFinite(Number(record.width)) ? Number(record.width) : 0,
    height: Number.isFinite(Number(record.height)) ? Number(record.height) : 0,
    createdAt: record.createdAt || now,
    updatedAt: now
  };

  await withMediaStore('readwrite', store => store.put(nextRecord));
  return nextRecord;
};

export const putMediaRecords = async (records = []) => {
  const normalizedRecords = records.filter(record => record?.id && record?.dataUrl);
  if (!normalizedRecords.length) return [];
  await withMediaStore('readwrite', store => {
    normalizedRecords.forEach(record => {
      store.put({
        ...record,
        updatedAt: record.updatedAt || new Date().toISOString()
      });
    });
  });
  return normalizedRecords;
};

export const getMediaRecord = async (id) => {
  if (!id) return null;
  return withMediaStore('readonly', store => new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  }));
};

export const getAllMediaRecords = async () => (
  withMediaStore('readonly', store => new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  }))
);

export const clearMediaRecords = async () => {
  await withMediaStore('readwrite', store => store.clear());
};

export const getMediaBreakdown = async () => {
  const records = await getAllMediaRecords();
  const breakdown = {
    total: 0,
    photoCards: 0,
    boardImages: 0,
    diaryPhotos: 0,
    boardSnapshots: 0
  };

  records.forEach(record => {
    const bytes = dataUrlByteLength(record.dataUrl) + dataUrlByteLength(record.thumbnailDataUrl);
    breakdown.total += bytes;
    if (record.kind === MEDIA_KINDS.photoCard) breakdown.photoCards += bytes;
    else if (record.kind === MEDIA_KINDS.boardImage) breakdown.boardImages += bytes;
    else if (record.kind === MEDIA_KINDS.diaryPhoto) breakdown.diaryPhotos += bytes;
    else if (record.kind === MEDIA_KINDS.boardSnapshot) breakdown.boardSnapshots += bytes;
  });

  return breakdown;
};
