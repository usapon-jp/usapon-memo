export const MEMO_COLORS = {
  yellow: { label: 'きいろ', className: 'memo-yellow' },
  pink: { label: 'ピンク', className: 'memo-pink' },
  blue: { label: 'みずいろ', className: 'memo-blue' },
  green: { label: 'みどり', className: 'memo-green' }
};

const LEGACY_COLOR_MAP = {
  routine: 'yellow',
  wakuwaku: 'pink',
  todo: 'blue',
  relax: 'green'
};

const DEFAULT_POSITIONS = [
  { x: 8, y: 8 },
  { x: 48, y: 10 },
  { x: 18, y: 42 },
  { x: 56, y: 48 },
  { x: 32, y: 22 }
];

export const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const createId = () => crypto.randomUUID();

export const createChecklistItem = (text = '', completed = false, id = null) => ({
  id: id || createId(),
  text,
  completed
});

const nowIso = () => new Date().toISOString();

export const createEmptyMemo = (patch = {}) => {
  const now = nowIso();
  return normalizeMemo({
    id: createId(),
    type: 'note',
    text: '',
    checklist: [createChecklistItem()],
    color: 'yellow',
    x: 12,
    y: 12,
    pinned: false,
    isToday: false,
    completed: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...patch
  });
};

export const getMemoPreview = (memo) => {
  if (memo.type === 'checklist') {
    return memo.checklist.map(item => item.text).filter(Boolean).join(' / ') || 'チェックリスト';
  }
  return memo.text || '自由メモ';
};

export const isMemoVisibleOnBoard = (memo) => !memo.archived;

const normalizeChecklist = (checklist) => (
  Array.isArray(checklist)
    ? checklist.map(item => createChecklistItem(
      typeof item.text === 'string' ? item.text.trim() : '',
      Boolean(item.completed ?? item.done),
      typeof item.id === 'string' ? item.id : null
    )).filter(item => item.text)
    : []
);

const migrateLegacyMemo = (memo, index) => {
  const checklist = normalizeChecklist(memo.checklist);
  const fallbackText = typeof memo.memo === 'string' && memo.memo.trim()
    ? memo.memo.trim()
    : (typeof memo.title === 'string' ? memo.title.trim() : '');
  const position = DEFAULT_POSITIONS[index % DEFAULT_POSITIONS.length];

  return {
    id: typeof memo.id === 'string' ? memo.id : createId(),
    type: checklist.length > 0 ? 'checklist' : 'note',
    text: checklist.length > 0 ? '' : fallbackText,
    checklist,
    color: LEGACY_COLOR_MAP[memo.category] || 'yellow',
    x: position.x,
    y: position.y,
    pinned: false,
    isToday: false,
    completed: memo.status === 'completed',
    archived: memo.status === 'archived',
    createdAt: typeof memo.createdAt === 'string' ? memo.createdAt : nowIso(),
    updatedAt: typeof memo.updatedAt === 'string' ? memo.updatedAt : nowIso()
  };
};

export const normalizeMemo = (memo = {}, index = 0) => {
  if (!memo.type && (memo.category || memo.status || memo.memo !== undefined)) {
    return normalizeMemo(migrateLegacyMemo(memo, index), index);
  }

  const type = memo.type === 'checklist' ? 'checklist' : 'note';
  const checklist = normalizeChecklist(memo.checklist);
  const text = typeof memo.text === 'string' ? memo.text.trim() : '';
  const position = DEFAULT_POSITIONS[index % DEFAULT_POSITIONS.length];
  const createdAt = typeof memo.createdAt === 'string' ? memo.createdAt : nowIso();
  const updatedAt = typeof memo.updatedAt === 'string' ? memo.updatedAt : createdAt;

  return {
    id: typeof memo.id === 'string' ? memo.id : createId(),
    type,
    text: type === 'note' ? text : '',
    checklist: type === 'checklist' ? checklist : [],
    color: MEMO_COLORS[memo.color] ? memo.color : 'yellow',
    x: Number.isFinite(Number(memo.x)) ? clamp(Number(memo.x)) : position.x,
    y: Number.isFinite(Number(memo.y)) ? clamp(Number(memo.y)) : position.y,
    pinned: Boolean(memo.pinned),
    isToday: Boolean(memo.isToday),
    completed: Boolean(memo.completed),
    archived: Boolean(memo.archived),
    createdAt,
    updatedAt
  };
};

export const normalizeData = (data = {}) => ({
  memos: Array.isArray(data.memos) ? data.memos.map(normalizeMemo) : []
});

export const sortMemos = (memos) => [...memos].sort((a, b) => {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return new Date(b.updatedAt) - new Date(a.updatedAt);
});
