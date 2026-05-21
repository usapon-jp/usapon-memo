const STORAGE_KEY = 'usapon_memo_data';

const createDefaultData = () => ({
  memos: []
});

export const getStorageKey = () => STORAGE_KEY;

const normalizeChecklist = (checklist) => (
  Array.isArray(checklist)
    ? checklist.map(item => ({
      id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
      text: typeof item.text === 'string' ? item.text : '',
      done: Boolean(item.done)
    })).filter(item => item.text.trim())
    : []
);

const normalizeMemo = (memo = {}) => ({
  id: typeof memo.id === 'string' ? memo.id : crypto.randomUUID(),
  title: typeof memo.title === 'string' && memo.title.trim() ? memo.title.trim() : 'やることリスト',
  category: ['todo', 'routine', 'relax', 'wakuwaku'].includes(memo.category) ? memo.category : 'relax',
  memo: typeof memo.memo === 'string' ? memo.memo : '',
  checklist: normalizeChecklist(memo.checklist),
  status: memo.status === 'archived' ? 'archived' : 'active',
  createdAt: typeof memo.createdAt === 'string' ? memo.createdAt : new Date().toISOString(),
  updatedAt: typeof memo.updatedAt === 'string' ? memo.updatedAt : new Date().toISOString()
});

export const normalizeData = (data = {}) => ({
  ...createDefaultData(),
  ...data,
  memos: Array.isArray(data.memos) ? data.memos.map(normalizeMemo) : []
});

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
  } catch (error) {
    console.error('Failed to save memo data', error);
  }
};
