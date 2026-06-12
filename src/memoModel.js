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
  schedule: 'schedule',
  link: 'link'
};

export const PHOTO_CROP_RATIOS = {
  square: 'square',
  custom: 'custom',
  landscape: 'landscape',
  portrait: 'portrait'
};

export const DEFAULT_BOARDS = [
  { id: 'home', label: 'ホーム', icon: 'home' },
  { id: 'study', label: '勉強', icon: 'book' },
  { id: 'places', label: '行きたい場所', icon: 'map' },
  { id: 'rabbit', label: 'うさぎ', icon: 'camera' }
];

export const DEFAULT_APP_TITLE = 'うさぽんメモ';
export const DEFAULT_STICKY_TEXT_SIZE = 'standard';
export const DEFAULT_STICKY_TEXT_WEIGHT = 'standard';
export const DEFAULT_BOARD_TEXT_COLOR = 'milkWhite';
export const DEFAULT_BOARD_TEXT_SIZE = 'standard';
export const DEFAULT_BOARD_TEXT_WEIGHT = 'standard';
export const DEFAULT_NOTE_WIDTH = 238;
export const DEFAULT_NOTE_HEIGHT = 198;
export const DEFAULT_PHOTO_CARD_WIDTH = 238;
export const DEFAULT_PHOTO_CARD_HEIGHT = 300;
export const PHOTO_OFFSET_LIMIT = 260;
export const PHOTO_ROTATION_LIMIT = 180;
export const BOARD_ITEM_MAX_Y = 88;
export const MEMO_CARD_MAX_Y = 88;
export const STICKY_TEXT_SIZES = new Set(['small', 'standard', 'large']);
export const STICKY_TEXT_WEIGHTS = new Set(['soft', 'standard', 'bold']);
export const BOARD_TEXT_COLORS = {
  milkWhite: { label: 'ミルクホワイト', value: '#fff8ea' },
  forest: { label: '深緑', value: '#2f5f4a' },
  rose: { label: 'ピンク', value: '#f28aa6' },
  sky: { label: '水色', value: '#83cbe4' },
  cocoa: { label: 'こげ茶', value: '#4f3325' }
};
export const BOARD_TEXT_SIZES = new Set(['small', 'standard', 'large']);
export const BOARD_TEXT_WEIGHTS = new Set(['soft', 'standard', 'bold']);

const BOARD_ICONS = new Set(['home', 'book', 'map', 'camera', 'folder']);
export const STICKER_CATALOG = [
  { id: 'usa', label: 'うさぎ', src: '/usapon-memo/assets/usa.png', packId: 'default' },
  { id: 'piyo', label: 'ひよこ', src: '/usapon-memo/assets/piyo.png', packId: 'default' },
  { id: 'pon', label: 'ぽん', src: '/usapon-memo/assets/pon.png', packId: 'default' },
  { id: 'lemon', label: 'レモン', src: '/usapon-memo/assets/lemon.png', packId: 'default' },
  { id: 'ochun', label: 'おチュン', src: '/usapon-memo/assets/stickers/ochun.png', packId: 'mogumogu' },
  { id: 'moguGoods', label: 'もぐくん', src: '/usapon-memo/assets/stickers/mogu-goods.png', packId: 'mogumogu' },
  { id: 'layer', label: 'レイヤー', src: '/usapon-memo/assets/stickers/layer.png', packId: 'mogumogu' },
  { id: 'osakaMogu', label: '大阪もぐくん', src: '/usapon-memo/assets/stickers/osaka-mogu.png', packId: 'mogumogu' },
  { id: 'kumamotoMogu', label: '熊本もぐくん', src: '/usapon-memo/assets/stickers/kumamoto-mogu.png', packId: 'mogumogu' }
];
export const DEFAULT_STICKER_IDS = STICKER_CATALOG.filter(sticker => sticker.packId === 'default').map(sticker => sticker.id);
export const STICKER_PACKS = {
  default: {
    label: '基本',
    stickerIds: DEFAULT_STICKER_IDS
  },
  mogumogu: {
    label: 'もぐもぐセット',
    code: 'mogumogu',
    stickerIds: STICKER_CATALOG.filter(sticker => sticker.packId === 'mogumogu').map(sticker => sticker.id)
  }
};
export const MAX_VISIBLE_STICKERS = 15;
const STICKER_ASSETS = new Set(STICKER_CATALOG.map(sticker => sticker.id));

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

export const createBoardItem = (patch = {}) => normalizeBoardItem({
  id: createId(),
  type: 'text',
  boardId: 'home',
  text: '',
  assetId: '',
  imageDataUrl: '',
  imageId: '',
  imageMimeType: '',
  naturalWidth: 0,
  naturalHeight: 0,
  x: 24,
  y: 24,
  scale: 1,
  rotation: 0,
  textColor: DEFAULT_BOARD_TEXT_COLOR,
  textSize: DEFAULT_BOARD_TEXT_SIZE,
  textWeight: DEFAULT_BOARD_TEXT_WEIGHT,
  archived: false,
  createdAt: nowIso(),
  updatedAt: nowIso(),
  ...patch
});

export const createBoard = (label = '新しいボード') => ({
  id: `board-${createId()}`,
  label: label.trim() || '新しいボード',
  icon: 'folder',
  archived: false,
  isTimeCapsule: false,
  timeCapsuleAt: null
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
  size: Number.isFinite(Number(patch.size)) ? clamp(Number(patch.size), 44, 150) : 58,
  rotation: Number.isFinite(Number(patch.rotation)) ? clamp(Number(patch.rotation), -180, 180) : 0
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
    photoImageId: '',
    caption: '',
    photoCropRatio: 'custom',
    photoZoom: 1,
    photoOffsetX: 0,
    photoOffsetY: 0,
    photoRotation: 0,
    photoAspectRatio: 1,
    photoFrameRatio: 1,
    cardWidth: DEFAULT_PHOTO_CARD_WIDTH,
    cardHeight: DEFAULT_PHOTO_CARD_HEIGHT,
    imageFit: 'cover',
    scheduleDate: '',
    scheduleTime: '',
    schedulePlace: '',
    linkUrl: '',
    linkTitle: '',
    color: 'yellow',
    tapeColor: patch.tapeColor || patch.color || 'yellow',
    x: 12,
    y: 12,
    scale: 1,
    rotation: 0,
    noteWidth: DEFAULT_NOTE_WIDTH,
    noteHeight: DEFAULT_NOTE_HEIGHT,
    contentOffsetX: 0,
    contentOffsetY: 0,
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
  if (memo.cardType === 'link') return memo.linkTitle || memo.linkUrl || 'リンク';
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
  const timeCapsuleDate = board.timeCapsuleAt ? new Date(board.timeCapsuleAt) : null;
  const timeCapsuleAt = timeCapsuleDate && !Number.isNaN(timeCapsuleDate.getTime())
    ? timeCapsuleDate.toISOString()
    : null;

  return {
    id,
    label,
    icon,
    archived: Boolean(board.archived),
    isTimeCapsule: Boolean(board.isTimeCapsule),
    timeCapsuleAt
  };
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

export const isBoardItemVisible = (item) => !item.archived;

const normalizeChecklist = (checklist) => (
  Array.isArray(checklist)
    ? checklist.map(item => createChecklistItem(
      typeof item.text === 'string' ? item.text.trim() : '',
      Boolean(item.completed ?? item.done),
      typeof item.id === 'string' ? item.id : null
    ))
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
    photoImageId: '',
    caption: '',
    photoCropRatio: 'custom',
    photoZoom: 1,
    photoOffsetX: 0,
    photoOffsetY: 0,
    photoRotation: 0,
    photoAspectRatio: 1,
    photoFrameRatio: 1,
    cardWidth: DEFAULT_PHOTO_CARD_WIDTH,
    cardHeight: DEFAULT_PHOTO_CARD_HEIGHT,
    imageFit: 'cover',
    scheduleDate: '',
    scheduleTime: '',
    schedulePlace: '',
    linkUrl: '',
    linkTitle: '',
    color: LEGACY_COLOR_MAP[memo.category] || 'yellow',
    tapeColor: LEGACY_COLOR_MAP[memo.category] || 'yellow',
    x: position.x,
    y: position.y,
    scale: 1,
    rotation: 0,
    noteWidth: DEFAULT_NOTE_WIDTH,
    noteHeight: DEFAULT_NOTE_HEIGHT,
    contentOffsetX: 0,
    contentOffsetY: 0,
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
  const photoImageId = typeof memo.photoImageId === 'string' ? memo.photoImageId : '';
  const caption = typeof memo.caption === 'string' ? memo.caption.trim() : '';
  const photoCropRatio = PHOTO_CROP_RATIOS[memo.photoCropRatio] ? memo.photoCropRatio : 'custom';
  const photoZoom = Number.isFinite(Number(memo.photoZoom)) ? clamp(Number(memo.photoZoom), 1, 4) : 1;
  const photoOffsetX = Number.isFinite(Number(memo.photoOffsetX)) ? clamp(Number(memo.photoOffsetX), -PHOTO_OFFSET_LIMIT, PHOTO_OFFSET_LIMIT) : 0;
  const photoOffsetY = Number.isFinite(Number(memo.photoOffsetY)) ? clamp(Number(memo.photoOffsetY), -PHOTO_OFFSET_LIMIT, PHOTO_OFFSET_LIMIT) : 0;
  const photoRotation = Number.isFinite(Number(memo.photoRotation)) ? clamp(Number(memo.photoRotation), -PHOTO_ROTATION_LIMIT, PHOTO_ROTATION_LIMIT) : 0;
  const photoAspectRatio = Number.isFinite(Number(memo.photoAspectRatio)) && Number(memo.photoAspectRatio) > 0
    ? clamp(Number(memo.photoAspectRatio), 0.1, 10)
    : 1;
  const photoFrameRatio = Number.isFinite(Number(memo.photoFrameRatio)) && Number(memo.photoFrameRatio) > 0
    ? clamp(Number(memo.photoFrameRatio), 0.35, 2.2)
    : (photoCropRatio === 'custom' ? photoAspectRatio : 1);
  const cardWidth = Number.isFinite(Number(memo.cardWidth))
    ? clamp(Number(memo.cardWidth), 190, 360)
    : DEFAULT_PHOTO_CARD_WIDTH;
  const cardHeight = Number.isFinite(Number(memo.cardHeight))
    ? clamp(Number(memo.cardHeight), 230, 540)
    : DEFAULT_PHOTO_CARD_HEIGHT;
  const imageFit = memo.imageFit === 'contain' ? 'contain' : 'cover';
  const noteWidth = Number.isFinite(Number(memo.noteWidth))
    ? clamp(Number(memo.noteWidth), 190, 340)
    : DEFAULT_NOTE_WIDTH;
  const noteHeight = Number.isFinite(Number(memo.noteHeight))
    ? clamp(Number(memo.noteHeight), 160, 460)
    : DEFAULT_NOTE_HEIGHT;
  const scheduleDate = typeof memo.scheduleDate === 'string' ? memo.scheduleDate.trim() : '';
  const scheduleTime = typeof memo.scheduleTime === 'string' ? memo.scheduleTime.trim() : '';
  const schedulePlace = typeof memo.schedulePlace === 'string' ? memo.schedulePlace.trim() : '';
  const linkUrl = typeof memo.linkUrl === 'string' ? memo.linkUrl.trim() : '';
  const linkTitle = typeof memo.linkTitle === 'string' ? memo.linkTitle.trim() : '';
  const tapeColor = MEMO_COLORS[memo.tapeColor]
    ? memo.tapeColor
    : (MEMO_COLORS[memo.color] ? memo.color : 'yellow');
  const position = DEFAULT_POSITIONS[index % DEFAULT_POSITIONS.length];
  const createdAt = typeof memo.createdAt === 'string' ? memo.createdAt : nowIso();
  const updatedAt = typeof memo.updatedAt === 'string' ? memo.updatedAt : createdAt;
  const reminderDate = memo.reminderAt ? new Date(memo.reminderAt) : null;
  const stickers = Array.isArray(memo.stickers)
    ? memo.stickers
      .map(sticker => createSticker(sticker.assetId, sticker))
      .filter(sticker => STICKER_ASSETS.has(sticker.assetId))
    : [];
  const contentOffsetX = Number.isFinite(Number(memo.contentOffsetX))
    ? clamp(Number(memo.contentOffsetX), -90, 90)
    : 0;
  const contentOffsetY = Number.isFinite(Number(memo.contentOffsetY))
    ? clamp(Number(memo.contentOffsetY), -90, 90)
    : 0;

  return {
    id: typeof memo.id === 'string' ? memo.id : createId(),
    boardId,
    cardType,
    title,
    type,
    text: type === 'note' ? text : '',
    checklist: type === 'checklist' ? checklist : [],
    photoDataUrl,
    photoImageId,
    caption,
    photoCropRatio,
    photoZoom,
    photoOffsetX,
    photoOffsetY,
    photoRotation,
    photoAspectRatio,
    photoFrameRatio,
    cardWidth,
    cardHeight,
    imageFit,
    scheduleDate,
    scheduleTime,
    schedulePlace,
    linkUrl,
    linkTitle,
    color: MEMO_COLORS[memo.color] ? memo.color : 'yellow',
    tapeColor,
    x: Number.isFinite(Number(memo.x)) ? clamp(Number(memo.x)) : position.x,
    y: Number.isFinite(Number(memo.y)) ? clamp(Number(memo.y)) : position.y,
    scale: Number.isFinite(Number(memo.scale)) ? clamp(Number(memo.scale), 0.55, 2.4) : 1,
    rotation: Number.isFinite(Number(memo.rotation)) ? clamp(Number(memo.rotation), -180, 180) : 0,
    noteWidth,
    noteHeight,
    contentOffsetX,
    contentOffsetY,
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

export const normalizeBoardItem = (item = {}, index = 0) => {
  const position = DEFAULT_POSITIONS[index % DEFAULT_POSITIONS.length];
  const type = ['image', 'sticker'].includes(item.type) ? item.type : 'text';
  const createdAt = typeof item.createdAt === 'string' ? item.createdAt : nowIso();
  const updatedAt = typeof item.updatedAt === 'string' ? item.updatedAt : createdAt;
  const textColor = BOARD_TEXT_COLORS[item.textColor]
    ? item.textColor
    : DEFAULT_BOARD_TEXT_COLOR;
  const textSize = BOARD_TEXT_SIZES.has(item.textSize)
    ? item.textSize
    : DEFAULT_BOARD_TEXT_SIZE;
  const textWeight = BOARD_TEXT_WEIGHTS.has(item.textWeight)
    ? item.textWeight
    : DEFAULT_BOARD_TEXT_WEIGHT;

  return {
    id: typeof item.id === 'string' ? item.id : createId(),
    type,
    boardId: typeof item.boardId === 'string' && item.boardId.trim() ? item.boardId.trim() : 'home',
    text: typeof item.text === 'string' ? item.text : '',
    assetId: STICKER_ASSETS.has(item.assetId) ? item.assetId : '',
    imageDataUrl: typeof item.imageDataUrl === 'string' ? item.imageDataUrl : '',
    imageId: typeof item.imageId === 'string' ? item.imageId : '',
    imageMimeType: typeof item.imageMimeType === 'string' ? item.imageMimeType : '',
    naturalWidth: Number.isFinite(Number(item.naturalWidth)) ? Number(item.naturalWidth) : 0,
    naturalHeight: Number.isFinite(Number(item.naturalHeight)) ? Number(item.naturalHeight) : 0,
    x: Number.isFinite(Number(item.x)) ? clamp(Number(item.x), -8, 96) : position.x,
    y: Number.isFinite(Number(item.y)) ? clamp(Number(item.y), -8, BOARD_ITEM_MAX_Y) : position.y,
    scale: Number.isFinite(Number(item.scale)) ? clamp(Number(item.scale), 0.3, 3.2) : 1,
    rotation: Number.isFinite(Number(item.rotation)) ? clamp(Number(item.rotation), -180, 180) : 0,
    textColor,
    textSize,
    textWeight,
    archived: Boolean(item.archived),
    createdAt,
    updatedAt
  };
};

const normalizeDiaryPhoto = (photo = {}) => ({
  id: typeof photo.id === 'string' ? photo.id : createId(),
  url: typeof photo.url === 'string' ? photo.url : '',
  imageId: typeof photo.imageId === 'string' ? photo.imageId : '',
  comment: typeof photo.comment === 'string' ? photo.comment : '',
  zoom: Number.isFinite(Number(photo.zoom)) ? clamp(Number(photo.zoom), 1, 4) : 1,
  offsetX: Number.isFinite(Number(photo.offsetX)) ? clamp(Number(photo.offsetX), -PHOTO_OFFSET_LIMIT, PHOTO_OFFSET_LIMIT) : 0,
  offsetY: Number.isFinite(Number(photo.offsetY)) ? clamp(Number(photo.offsetY), -PHOTO_OFFSET_LIMIT, PHOTO_OFFSET_LIMIT) : 0,
  rotation: Number.isFinite(Number(photo.rotation)) ? clamp(Number(photo.rotation), -PHOTO_ROTATION_LIMIT, PHOTO_ROTATION_LIMIT) : 0,
  originalBytes: Number.isFinite(Number(photo.originalBytes)) ? Math.max(0, Number(photo.originalBytes)) : 0,
  compressedBytes: Number.isFinite(Number(photo.compressedBytes)) ? Math.max(0, Number(photo.compressedBytes)) : 0,
  mimeType: typeof photo.mimeType === 'string' ? photo.mimeType : ''
});

const normalizeDiaryBoardSnapshot = (snapshot = {}) => {
  const capturedAt = typeof snapshot.capturedAt === 'string' ? snapshot.capturedAt : nowIso();

  return {
    id: typeof snapshot.id === 'string' ? snapshot.id : createId(),
    boardId: typeof snapshot.boardId === 'string' ? snapshot.boardId : '',
    label: typeof snapshot.label === 'string' ? snapshot.label : 'ボード',
    icon: typeof snapshot.icon === 'string' && BOARD_ICONS.has(snapshot.icon) ? snapshot.icon : 'folder',
    archived: Boolean(snapshot.archived),
    capturedAt,
    snapshotDataUrl: typeof snapshot.snapshotDataUrl === 'string' ? snapshot.snapshotDataUrl : '',
    snapshotImageId: typeof snapshot.snapshotImageId === 'string' ? snapshot.snapshotImageId : '',
    memoCount: Number.isFinite(Number(snapshot.memoCount)) ? Math.max(0, Number(snapshot.memoCount)) : 0,
    photoCount: Number.isFinite(Number(snapshot.photoCount)) ? Math.max(0, Number(snapshot.photoCount)) : 0,
    itemCount: Number.isFinite(Number(snapshot.itemCount)) ? Math.max(0, Number(snapshot.itemCount)) : 0
  };
};

const normalizeDiaryRecord = (record = {}) => {
  const createdAt = typeof record.createdAt === 'string' ? record.createdAt : nowIso();
  return {
    text: typeof record.text === 'string' ? record.text : '',
    photos: Array.isArray(record.photos)
      ? record.photos.map(normalizeDiaryPhoto).filter(photo => photo.url || photo.imageId)
      : [],
    boards: Array.isArray(record.boards)
      ? record.boards.map(normalizeDiaryBoardSnapshot).filter(snapshot => snapshot.snapshotDataUrl || snapshot.snapshotImageId)
      : [],
    createdAt,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : createdAt
  };
};

export const normalizeData = (data = {}) => {
  const appTitle = typeof data.appTitle === 'string' && data.appTitle.trim()
    ? data.appTitle.trim()
    : DEFAULT_APP_TITLE;
  const stickyTextSize = STICKY_TEXT_SIZES.has(data.stickyTextSize)
    ? data.stickyTextSize
    : DEFAULT_STICKY_TEXT_SIZE;
  const stickyTextWeight = STICKY_TEXT_WEIGHTS.has(data.stickyTextWeight)
    ? data.stickyTextWeight
    : DEFAULT_STICKY_TEXT_WEIGHT;
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
  const boardItems = Array.isArray(data.boardItems)
    ? data.boardItems.map((item, index) => {
      const normalized = normalizeBoardItem(item, index);
      return boardIds.has(normalized.boardId)
        ? normalized
        : { ...normalized, boardId: fallbackBoardId };
    })
    : [];
  const diaryRecords = data.diaryRecords && typeof data.diaryRecords === 'object'
    ? Object.fromEntries(Object.entries(data.diaryRecords).map(([dateKey, record]) => [dateKey, normalizeDiaryRecord(record)]))
    : {};
  const notifiedTimeCapsuleBoardIds = Array.isArray(data.notifiedTimeCapsuleBoardIds)
    ? data.notifiedTimeCapsuleBoardIds.filter(id => typeof id === 'string')
    : [];
  const unlockedStickerSet = new Set([
    ...DEFAULT_STICKER_IDS,
    ...(Array.isArray(data.unlockedStickerIds) ? data.unlockedStickerIds : [])
  ].filter(id => STICKER_ASSETS.has(id)));
  const unlockedStickerIds = STICKER_CATALOG
    .map(sticker => sticker.id)
    .filter(id => unlockedStickerSet.has(id));
  const visibleStickerSource = Array.isArray(data.visibleStickerIds)
    ? data.visibleStickerIds
    : DEFAULT_STICKER_IDS;
  const visibleStickerIds = [...new Set(visibleStickerSource)]
    .filter(id => unlockedStickerSet.has(id) && STICKER_ASSETS.has(id))
    .slice(0, MAX_VISIBLE_STICKERS);
  const diaryPhotoTransformRecoveryVersion = Number.isFinite(Number(data.diaryPhotoTransformRecoveryVersion))
    ? Math.max(0, Number(data.diaryPhotoTransformRecoveryVersion))
    : 0;

  return {
    appTitle,
    stickyTextSize,
    stickyTextWeight,
    boards,
    memos,
    boardItems,
    diaryRecords,
    notifiedTimeCapsuleBoardIds,
    unlockedStickerIds,
    visibleStickerIds,
    diaryPhotoTransformRecoveryVersion
  };
};

export const sortMemos = (memos) => [...memos].sort((a, b) => {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return new Date(b.updatedAt) - new Date(a.updatedAt);
});
