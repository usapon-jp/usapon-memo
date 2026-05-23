import { normalizeData } from './memoModel.js';

const STORAGE_KEY = 'usapon_memo_data';

const createDefaultData = () => ({
  memos: []
});

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

export const saveMemoData = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeData(data)));
    return true;
  } catch (error) {
    console.error('Failed to save memo data', error);
    return false;
  }
};
