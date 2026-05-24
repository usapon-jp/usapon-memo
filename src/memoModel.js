export const MEMO_COLORS = {
  white: { label: 'しろ', className: 'memo-white' },
  yellow: { label: 'きいろ', className: 'memo-yellow' },
  pink: { label: 'ピンク', className: 'memo-pink' },
  blue: { label: 'みずいろ', className: 'memo-blue' },
  green: { label: 'みどり', className: 'memo-green' }
};

export const CARD_TYPES = {
  note: 'note',
  checklist: 'checklist',
  photo: 'photo',
  schedule: 'schedule'
};

export const PHOTO_CROP_RATIOS = {
  landscape: 'landscape',
  square: 'square',
  portrait: 'portrait'
};

export const DEFAULT_BOARDS = [
  { id: 'home', label: 'ホーム', icon: 'home' },
  { id: 'study', label: '勉強', icon: 'book' },
  { id: 'places', label: '行きたい場所', icon: 'map' },
  { id: 'rabbit', label: 'うさぎ', icon: 'camera' }
];

const BOARD_ICONS = new Set(['home', 'book', 'map', 'camera', 'folder']);
const STICKER_ASSETS = new Set(['usa', 'piyo', 'pon', 'lemon']);

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

export const createBoard = (label = '新しいボード') => ({
  id: `board-${createId()}`,
  label: label.trim() || '新しいボード',
  icon: 'folder'
});

export const createChecklistItem = (text = '', completed = false, id = null) => ({
  id: id || createId(),
  text,
  completed
});

export const createSticker = (assetId = 'usa', patch = {}) => ({
  id: patch.id || createId(),
  assetId: STICKER_ASSETS.has(assetId) ? assetId : 'usa',
  x: Number.isFinite(Number(patch.x)) ? clamp(Number(patch.x)) : 50,
  y: Number.isFinite(Number(patch.y)) ? clamp(Number(patch.y)) : 62,
  size: Number.isFinite(Number(patch.size)) ? clamp(Number(patch.size), 28, 72) : 42
});

const nowIso = () => new Date().toISOString();

export const createEmptyMemo = (patch = {}) => {
  const now = nowIso();
  return normalizeMemo({
    id: createId(),
    boardId: 'home',
    cardType: 'note',
    title: '',
    type: 'note',
    text: '',
    checklist: [createChecklistItem()],
    photoDataUrl: '',
    caption: '',
    photoCropRatio: 'landscape',
    photoZoom: 1,
    photoOffsetX: 0,
    photoOffsetY: 0,
    photoRotation: 0,
    scheduleDate: '',
    scheduleTime: '',
    schedulePlace: '',
    color: 'yellow',
    x: 12,
    y: 12,
    pinned: false,
    isToday: false,
    completed: false,
    archived: false,
    reminderAt: null,
    stickers: [],
    createdAt: now,
    updatedAt: now,
    ...patch
  });
};

export const getMemoPreview = (memo) => {
  if (memo.title) return memo.title;
  if (memo.cardType === 'photo') return memo.caption || '写真';
  if (memo.cardType === 'schedule') return memo.schedulePlace || memo.scheduleDate || '予定';
  if (memo.cardType === 'checklist' || memo.type === 'checklist') {
    return memo.checklist.map(item => item.text).filter(Boolean).join(' / ') || 'チェックリスト';
  }
  return memo.text || '自由メモ';
};

const normalizeBoard = (board = {}, index = 0, usedIds = new Set()) => {
  const defaultBoard = DEFAULT_BOARDS[index] || {};
  const rawId = typeof board.id === 'string' && board.id.trim()
    ? board.id.trim()
    : defaultBoard.id || `board-${createId()}`;
  const id = usedIds.has(rawId) ? `board-${createId()}` : rawId;
  usedIds.add(id);

  const label = typeof board.label === 'string' && board.label.trim()
    ? board.label.trim()
    : defaultBoard.label || `ボード${index + 1}`;
  const icon = typeof board.icon === 'string' && BOARD_ICONS.has(board.icon)
    ? board.icon
    : defaultBoard.icon || 'folder';

  return { id, label, icon };
};

const normalizeBoards = (boards) => {
  const source = Array.isArray(boards) && boards.length > 0 ? boards : DEFAULT_BOARDS;
  const usedIds = new Set();
  const normalized = source.map((board, index) => normalizeBoard(board, index, usedIds));
  return normalized.length > 0 ? normalized : DEFAULT_BOARDS.map((board, index) => normalizeBoard(board, index, usedIds));
};

export const isReminderDue = (memo, now = new Date()) => {
  if (!memo.reminderAt) return true;
  const reminderDate = new Date(memo.reminderAt);
  if (Number.isNaN(reminderDate.getTime())) return true;
  return reminderDate.getTime() <= now.getTime();
};

export const getReminderStatus = (memo, now = new Date()) => {
  if (!memo.reminderAt) return null;
  return isReminderDue(memo, now) ? 'due' : 'waiting';
};

export const isMemoVisibleOnBoard = (memo, now = new Date()) => !memo.archived && isReminderDue(memo, now);

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
    boardId: 'home',
    cardType: checklist.length > 0 ? 'checklist' : 'note',
    title: '',
    type: checklist.length > 0 ? 'checklist' : 'note',
    text: checklist.length > 0 ? '' : fallbackText,
    checklist,
    photoDataUrl: '',
    caption: '',
    photoCropRatio: 'landscape',
    photoZoom: 1,
    photoOffsetX: 0,
    photoOffsetY: 0,
    photoRotation: 0,
    scheduleDate: '',
    scheduleTime: '',
    schedulePlace: '',
    color: LEGACY_COLOR_MAP[memo.category] || 'yellow',
    x: position.x,
    y: position.y,
    pinned: false,
    isToday: false,
    completed: memo.status === 'completed',
    archived: memo.status === 'archived',
    reminderAt: null,
    stickers: [],
    createdAt: typeof memo.createdAt === 'string' ? memo.createdAt : nowIso(),
    updatedAt: typeof memo.updatedAt === 'string' ? memo.updatedAt : nowIso()
  };
};

export const normalizeMemo = (memo = {}, index = 0) => {
  if (!memo.type && (memo.category || memo.status || memo.memo !== undefined)) {
    return normalizeMemo(migrateLegacyMemo(memo, index), index);
  }

  const rawCardType = CARD_TYPES[memo.cardType]
    ? memo.cardType
    : (memo.type === 'checklist' ? 'checklist' : 'note');
  const cardType = rawCardType;
  const type = cardType === 'checklist' ? 'checklist' : 'note';
  const boardId = typeof memo.boardId === 'string' && memo.boardId.trim() ? memo.boardId.trim() : 'home';
  const title = typeof memo.title === 'string' ? memo.title.trim() : '';
  const checklist = normalizeChecklist(memo.checklist);
  const text = typeof memo.text === 'string' ? memo.text.trim() : '';
  const photoDataUrl = typeof memo.photoDataUrl === 'string' ? memo.photoDataUrl : '';
  const caption = typeof memo.caption === 'string' ? memo.caption.trim() : '';
  const photoCropRatio = PHOTO_CROP_RATIOS[memo.photoCropRatio] ? memo.photoCropRatio : 'landscape';
  const photoZoom = Number.isFinite(Number(memo.photoZoom)) ? clamp(Number(memo.photoZoom), 1, 4) : 1;
  const photoOffsetX = Number.isFinite(Number(memo.photoOffsetX)) ? clamp(Number(memo.photoOffsetX), -160, 160) : 0;
  const photoOffsetY = Number.isFinite(Number(memo.photoOffsetY)) ? clamp(Number(memo.photoOffsetY), -160, 160) : 0;
  const photoRotation = Number.isFinite(Number(memo.photoRotation)) ? clamp(Number(memo.photoRotation), -35, 35) : 0;
  const scheduleDate = typeof memo.scheduleDate === 'string' ? memo.scheduleDate.trim() : '';
  const scheduleTime = typeof memo.scheduleTime === 'string' ? memo.scheduleTime.trim() : '';
  const schedulePlace = typeof memo.schedulePlace === 'string' ? memo.schedulePlace.trim() : '';
  const position = DEFAULT_POSITIONS[index % DEFAULT_POSITIONS.length];
  const createdAt = typeof memo.createdAt === 'string' ? memo.createdAt : nowIso();
  const updatedAt = typeof memo.updatedAt === 'string' ? memo.updatedAt : createdAt;
  const reminderDate = memo.reminderAt ? new Date(memo.reminderAt) : null;
  const stickers = Array.isArray(memo.stickers)
    ? memo.stickers
      .map(sticker => createSticker(sticker.assetId, sticker))
      .filter(sticker => STICKER_ASSETS.has(sticker.assetId))
    : [];

  return {
    id: typeof memo.id === 'string' ? memo.id : createId(),
    boardId,
    cardType,
    title,
    type,
    text: type === 'note' ? text : '',
    checklist: type === 'checklist' ? checklist : [],
    photoDataUrl,
    caption,
    photoCropRatio,
    photoZoom,
    photoOffsetX,
    photoOffsetY,
    photoRotation,
    scheduleDate,
    scheduleTime,
    schedulePlace,
    color: MEMO_COLORS[memo.color] ? memo.color : 'yellow',
    x: Number.isFinite(Number(memo.x)) ? clamp(Number(memo.x)) : position.x,
    y: Number.isFinite(Number(memo.y)) ? clamp(Number(memo.y)) : position.y,
    pinned: Boolean(memo.pinned),
    isToday: Boolean(memo.isToday),
    completed: Boolean(memo.completed),
    archived: Boolean(memo.archived),
    reminderAt: reminderDate && !Number.isNaN(reminderDate.getTime()) ? reminderDate.toISOString() : null,
    stickers,
    createdAt,
    updatedAt
  };
};

export const normalizeData = (data = {}) => {
  const boards = normalizeBoards(data.boards);
  const boardIds = new Set(boards.map(board => board.id));
  const fallbackBoardId = boardIds.has('home') ? 'home' : boards[0].id;
  const memos = Array.isArray(data.memos)
    ? data.memos.map((memo, index) => {
      const normalized = normalizeMemo(memo, index);
      return boardIds.has(normalized.boardId)
        ? normalized
        : { ...normalized, boardId: fallbackBoardId };
    })
    : [];

  return { boards, memos };
};

export const sortMemos = (memos) => [...memos].sort((a, b) => {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return new Date(b.updatedAt) - new Date(a.updatedAt);
});
