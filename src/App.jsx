import html2canvas from 'html2canvas';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  Clock,
  Copy,
  Folder,
  Home,
  ImagePlus,
  Link as LinkIcon,
  Map,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  StickyNote,
  Trash2,
  Type,
  Upload,
  ArrowUp,
  ArrowDown,
  X
} from 'lucide-react';
import {
  MEMO_COLORS,
  PHOTO_CROP_RATIOS,
  clamp,
  createBoard,
  createBoardItem,
  createChecklistItem,
  createEmptyMemo,
  createSticker,
  DEFAULT_BOARDS,
  DEFAULT_APP_TITLE,
  DEFAULT_STICKY_TEXT_SIZE,
  DEFAULT_STICKY_TEXT_WEIGHT,
  isBoardItemVisible,
  isMemoVisibleOnBoard,
  normalizeBoardItem,
  normalizeData,
  normalizeMemo,
  STICKY_TEXT_SIZES,
  STICKY_TEXT_WEIGHTS,
  sortMemos
} from './memoModel.js';
import { LOCAL_STORAGE_QUOTA_BYTES, loadMemoData, saveMemoData } from './storage.js';

const BOARD_ICON_MAP = {
  home: Home,
  book: BookOpen,
  map: Map,
  camera: Camera,
  folder: Folder
};
const BOARD_ICON_OPTIONS = [
  { id: 'home', label: 'ホーム' },
  { id: 'book', label: '本' },
  { id: 'map', label: '地図' },
  { id: 'camera', label: '写真' },
  { id: 'folder', label: 'フォルダ' }
];
const STICKER_OPTIONS = [
  { id: 'usa', label: 'うさぎ', src: '/usapon-memo/assets/usa.png' },
  { id: 'piyo', label: 'ひよこ', src: '/usapon-memo/assets/piyo.png' },
  { id: 'pon', label: 'ぽん', src: '/usapon-memo/assets/pon.png' },
  { id: 'lemon', label: 'レモン', src: '/usapon-memo/assets/lemon.png' }
];
const STICKER_MAP = Object.fromEntries(STICKER_OPTIONS.map(sticker => [sticker.id, sticker]));

const COLOR_ORDER = ['white', 'green', 'yellow', 'blue', 'pink'];
const COLOR_OPTIONS = COLOR_ORDER.map(id => ({ id, ...MEMO_COLORS[id] }));
const STICKY_TEXT_SIZE_OPTIONS = [
  { id: 'small', label: '小さめ' },
  { id: 'standard', label: '標準' },
  { id: 'large', label: '大きめ' }
];
const STICKY_TEXT_WEIGHT_OPTIONS = [
  { id: 'soft', label: 'やさしい' },
  { id: 'standard', label: '標準' },
  { id: 'bold', label: 'はっきり' }
];
const TAPE_COLOR_MAP = {
  white: 'rgba(214, 203, 188, 0.66)',
  green: 'rgba(178, 204, 170, 0.76)',
  yellow: 'rgba(238, 204, 111, 0.76)',
  blue: 'rgba(169, 205, 222, 0.78)',
  pink: 'rgba(231, 178, 184, 0.76)'
};
const getTapeColor = (color = 'yellow') => TAPE_COLOR_MAP[color] || TAPE_COLOR_MAP.yellow;
const PHOTO_RATIO_CLASS = {
  square: 'is-square',
  custom: 'is-custom',
  landscape: 'is-landscape',
  portrait: 'is-portrait'
};

const toDatetimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
};

const fromDatetimeLocalValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toDateKey = (date = new Date()) => {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatDiaryCapturedAt = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const createDraft = (patch = {}) => {
  const cardType = patch.cardType || 'checklist';
  return createEmptyMemo({
    boardId: 'home',
    cardType,
    type: cardType === 'checklist' ? 'checklist' : 'note',
    color: cardType === 'photo' ? 'white' : 'green',
    tapeColor: cardType === 'photo' ? 'yellow' : 'green',
    checklist: cardType === 'checklist' ? [createChecklistItem()] : [],
    x: 10 + Math.floor(Math.random() * 46),
    y: 10 + Math.floor(Math.random() * 48),
    ...patch
  });
};

const MAX_PHOTO_DATA_URL_LENGTH = 620000;
const PHOTO_CANVAS_BACKGROUND = '#f3eadc';
const BACKUP_VERSION = 1;
const STORAGE_FULL_MESSAGE = '保存容量がいっぱいです。写真カードを減らすか、小さめの写真に差し替えてください。';
const ENABLE_CREATE_SETTINGS_PANEL = false;
const BOARD_SNAPSHOT_WIDTH = 800;
const BOARD_SNAPSHOT_RETRY_WIDTH = 640;

const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

const dataUrlByteLength = (dataUrl = '') => {
  const base64 = dataUrl.split(',')[1] || '';
  if (!base64) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

const formatBytes = (bytes = 0) => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
};

const formatCompressionMessage = (label, result) => {
  if (!result?.originalBytes || !result?.compressedBytes) return '';
  const savedPercent = Math.max(0, Math.round((1 - result.compressedBytes / result.originalBytes) * 100));
  return `${label}を圧縮しました: ${formatBytes(result.originalBytes)} → ${formatBytes(result.compressedBytes)}（${savedPercent}%削減）`;
};

const logImageCompressionDebug = (label, result) => {
  const debugInfo = {
    label,
    originalBytes: result.originalBytes || 0,
    compressedBytes: result.compressedBytes || 0,
    maxStorageBytes: LOCAL_STORAGE_QUOTA_BYTES,
    naturalWidth: result.naturalWidth || 0,
    naturalHeight: result.naturalHeight || 0,
    mimeType: result.mimeType || '',
    loggedAt: new Date().toISOString()
  };
  globalThis.__usaponLastImageCompression = debugInfo;
  console.log('[usapon-memo image compression]', debugInfo);
};

const normalizeLinkUrl = (value = '') => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return trimmed;
    }
  }
};

const getLinkHost = (value = '') => {
  try {
    return new URL(normalizeLinkUrl(value)).hostname.replace(/^www\./, '');
  } catch {
    return value.replace(/^https?:\/\//, '').split('/')[0] || 'リンク';
  }
};

const isCanvasLikelyTextHeavy = (sourceCanvas) => {
  const sample = document.createElement('canvas');
  const size = 48;
  sample.width = size;
  sample.height = size;
  const context = sample.getContext('2d');
  context.drawImage(sourceCanvas, 0, 0, size, size);
  const data = context.getImageData(0, 0, size, size).data;
  let edges = 0;
  let checks = 0;
  const luminance = (index) => (data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114);
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const current = (y * size + x) * 4;
      const right = (y * size + x + 1) * 4;
      const down = ((y + 1) * size + x) * 4;
      if (Math.abs(luminance(current) - luminance(right)) > 42) edges += 1;
      if (Math.abs(luminance(current) - luminance(down)) > 42) edges += 1;
      checks += 2;
    }
  }
  return checks > 0 && edges / checks > 0.16;
};

const canvasHasTransparency = (canvas) => {
  const context = canvas.getContext('2d');
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 3; index < data.length; index += 64) {
    if (data[index] < 250) return true;
  }
  return false;
};

const canvasToCompressedJpeg = (sourceCanvas, maxWidth = BOARD_SNAPSHOT_WIDTH, quality = 0.78, originalBytes = 0) => {
  const scale = Math.min(1, maxWidth / sourceCanvas.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
  canvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
  const context = canvas.getContext('2d');
  context.fillStyle = PHOTO_CANVAS_BACKGROUND;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return {
    dataUrl,
    originalBytes: originalBytes || dataUrlByteLength(dataUrl),
    compressedBytes: dataUrlByteLength(dataUrl),
    reductionRate: originalBytes ? Math.max(0, 1 - (dataUrlByteLength(dataUrl) / originalBytes)) : 0,
    mimeType: 'image/jpeg',
    naturalWidth: canvas.width,
    naturalHeight: canvas.height
  };
};

const captureBoardElement = async (element, options = {}) => {
  const canvas = await html2canvas(element, {
    backgroundColor: PHOTO_CANVAS_BACKGROUND,
    scale: 1,
    useCORS: true,
    logging: false
  });
  return canvasToCompressedJpeg(
    canvas,
    options.maxWidth || BOARD_SNAPSHOT_WIDTH,
    options.quality ?? 0.78,
    options.originalBytes || dataUrlByteLength(canvas.toDataURL('image/png'))
  );
};

const compressImageFile = async (file, options = {}) => {
  const preserveTransparency = Boolean(options.preserveTransparency);
  const maxLongSide = options.maxLongSide || 1200;
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = objectUrl;
  });
  const scale = Math.min(1, maxLongSide / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(image.src);

  const originalBytes = Number.isFinite(file.size) ? file.size : 0;
  const hasTransparency = preserveTransparency && canvasHasTransparency(canvas);
  if (hasTransparency) {
    const dataUrl = canvas.toDataURL('image/png');
    const compressedBytes = dataUrlByteLength(dataUrl);
    return {
      dataUrl,
      aspectRatio: canvas.width / canvas.height,
      mimeType: 'image/png',
      naturalWidth: canvas.width,
      naturalHeight: canvas.height,
      originalBytes,
      compressedBytes,
      reductionRate: originalBytes ? Math.max(0, 1 - compressedBytes / originalBytes) : 0
    };
  }

  const textHeavy = isCanvasLikelyTextHeavy(canvas);
  let scaleDown = 1;
  let quality = textHeavy ? 0.82 : 0.75;
  let output = '';
  let outputCanvas = canvas;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (scaleDown < 1) {
      outputCanvas = document.createElement('canvas');
      outputCanvas.width = Math.max(1, Math.round(canvas.width * scaleDown));
      outputCanvas.height = Math.max(1, Math.round(canvas.height * scaleDown));
      const outputContext = outputCanvas.getContext('2d');
      outputContext.fillStyle = PHOTO_CANVAS_BACKGROUND;
      outputContext.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
      outputContext.drawImage(canvas, 0, 0, outputCanvas.width, outputCanvas.height);
    } else {
      context.globalCompositeOperation = 'destination-over';
      context.fillStyle = PHOTO_CANVAS_BACKGROUND;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = 'source-over';
    }
    output = outputCanvas.toDataURL('image/jpeg', quality);
    if (output.length <= MAX_PHOTO_DATA_URL_LENGTH) break;
    if (quality > 0.56) quality -= 0.07;
    else scaleDown *= 0.86;
  }
  const compressedBytes = dataUrlByteLength(output);
  return {
    dataUrl: output,
    aspectRatio: outputCanvas.width / outputCanvas.height,
    mimeType: 'image/jpeg',
    naturalWidth: outputCanvas.width,
    naturalHeight: outputCanvas.height,
    originalBytes,
    compressedBytes,
    reductionRate: originalBytes ? Math.max(0, 1 - compressedBytes / originalBytes) : 0
  };
};

const resizeImageFile = async (file) => compressImageFile(file, { preserveTransparency: false, maxLongSide: 1200 });
const resizeFreeImageFile = async (file) => compressImageFile(file, { preserveTransparency: true, maxLongSide: 1200 });

const getPhotoCropClass = (ratio) => PHOTO_RATIO_CLASS[ratio] || PHOTO_RATIO_CLASS.landscape;
const getPhotoFrameRatio = (memo) => {
  if (memo.photoCropRatio === 'square') return 1;
  if (memo.photoCropRatio === 'portrait') return 0.78;
  if (memo.photoCropRatio === 'landscape') return 1 / 0.78;
  return memo.photoFrameRatio || memo.photoAspectRatio || 1;
};

const getPhotoImageStyle = (memo) => {
  const imageRatio = memo.photoAspectRatio || 1;
  const frameRatio = getPhotoFrameRatio(memo);
  return {
    '--photo-zoom': memo.photoZoom || 1,
    '--photo-x': `${memo.photoOffsetX || 0}px`,
    '--photo-y': `${memo.photoOffsetY || 0}px`,
    '--photo-rotation': `${memo.photoRotation || 0}deg`,
    '--photo-frame-ratio': frameRatio,
    '--photo-fit-width': imageRatio >= frameRatio ? '100%' : 'auto',
    '--photo-fit-height': imageRatio >= frameRatio ? 'auto' : '100%'
  };
};

const getPointerDistance = (first, second) => Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
const getPointerAngle = (first, second) => Math.atan2(second.clientY - first.clientY, second.clientX - first.clientX) * 180 / Math.PI;
const getPointerCenter = (first, second) => ({
  x: (first.clientX + second.clientX) / 2,
  y: (first.clientY + second.clientY) / 2
});

const getCardTilt = (id) => {
  const code = Array.from(id || 'memo').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (code % 9) - 4;
};

const getNextBoardName = (boards) => {
  const usedNumbers = new Set(
    boards
      .map(board => /^ボード(\d+)$/.exec(board.label.trim())?.[1])
      .filter(Boolean)
      .map(Number)
  );
  let index = 1;
  while (usedNumbers.has(index)) index += 1;
  return `ボード${index}`;
};

const isTimeCapsuleOpen = (board, now = new Date()) => {
  if (!board.isTimeCapsule) return true;
  if (!board.timeCapsuleAt) return false;
  const openAt = new Date(board.timeCapsuleAt);
  return !Number.isNaN(openAt.getTime()) && openAt.getTime() <= now.getTime();
};

const isBoardVisibleInLibrary = (board, now = new Date()) => (
  Boolean(board) && !board.archived && isTimeCapsuleOpen(board, now)
);

const getMemoSearchText = (memo = {}, board = {}) => [
  board.label,
  memo.title,
  memo.text,
  memo.caption,
  memo.linkTitle,
  memo.linkUrl,
  memo.scheduleDate,
  memo.scheduleTime,
  memo.schedulePlace,
  ...(memo.checklist || []).map(item => item.text)
].filter(Boolean).join(' ').toLowerCase();

const getBoardItemSearchText = (item = {}, board = {}) => [
  board.label,
  item.type === 'text' ? item.text : '画像'
].filter(Boolean).join(' ').toLowerCase();

const getMemoKindLabel = (memo) => {
  if (memo.cardType === 'photo') return '写真';
  if (memo.cardType === 'link') return 'リンク';
  if (memo.cardType === 'schedule') return '予定';
  if (memo.cardType === 'checklist') return 'リスト';
  return 'メモ';
};

const getMemoPrimaryText = (memo = {}) => {
  if (memo.cardType === 'photo') return memo.caption || memo.title || '写真';
  if (memo.cardType === 'link') return memo.linkTitle || memo.title || getLinkHost(memo.linkUrl) || 'リンク';
  if (memo.cardType === 'schedule') {
    return memo.title || memo.schedulePlace || [memo.scheduleDate, memo.scheduleTime].filter(Boolean).join(' ') || '予定';
  }
  if (memo.cardType === 'checklist') {
    return memo.title || (memo.checklist || []).map(item => item.text).filter(Boolean).join(' / ') || 'リスト';
  }
  return memo.title || memo.text || 'メモ';
};

const getStringBytes = (value = '') => new Blob([value]).size;

const getStorageBreakdown = (data = {}) => {
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
  const total = getStringBytes(JSON.stringify(normalizeData(data)));
  const imageTotal = photoCards + boardImages + diaryPhotos + boardSnapshots;
  return {
    total,
    photoCards,
    diaryPhotos,
    boardSnapshots,
    boardImages,
    imageTotal,
    other: Math.max(0, total - imageTotal)
  };
};

const createBackupPayload = (data) => ({
  version: BACKUP_VERSION,
  exportedAt: new Date().toISOString(),
  data: normalizeData(data)
});

const cloneMemoForBoard = (memo, boardId, position = {}) => normalizeMemo({
  ...memo,
  id: crypto.randomUUID(),
  boardId,
  x: Number.isFinite(Number(position.x)) ? position.x : memo.x,
  y: Number.isFinite(Number(position.y)) ? position.y : memo.y,
  checklist: (memo.checklist || []).map(item => ({ ...item, id: crypto.randomUUID() })),
  stickers: (memo.stickers || []).map(sticker => ({ ...sticker, id: crypto.randomUUID() })),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

const getBoardOpenLabel = (board) => {
  if (!board.isTimeCapsule) return '通常ボード';
  if (!board.timeCapsuleAt) return '日時未設定';
  return isTimeCapsuleOpen(board) ? '公開中' : `${toDatetimeLocalValue(board.timeCapsuleAt).replace('T', ' ')}に公開`;
};

export default function App() {
  const [data, setData] = useState(loadMemoData);
  const [page, setPage] = useState('home');
  const [draft, setDraft] = useState(() => createDraft());
  const [now, setNow] = useState(() => new Date());
  const [activeBoardId, setActiveBoardId] = useState('home');
  const [storageError, setStorageError] = useState('');
  const [appToast, setAppToast] = useState('');
  const [undoAction, setUndoAction] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [snapshotRequest, setSnapshotRequest] = useState(null);
  const [storageEstimate, setStorageEstimate] = useState(null);
  const initializedBoardRef = useRef(false);
  const snapshotStageRef = useRef(null);
  const appTitle = data.appTitle || DEFAULT_APP_TITLE;
  const stickyTextSize = STICKY_TEXT_SIZES.has(data.stickyTextSize) ? data.stickyTextSize : DEFAULT_STICKY_TEXT_SIZE;
  const stickyTextWeight = STICKY_TEXT_WEIGHTS.has(data.stickyTextWeight) ? data.stickyTextWeight : DEFAULT_STICKY_TEXT_WEIGHT;
  const boards = data.boards?.length ? data.boards : DEFAULT_BOARDS;
  const homeBoards = useMemo(() => {
    const visibleBoards = boards.filter(board => !board.archived && isTimeCapsuleOpen(board, now));
    const openCapsules = visibleBoards.filter(board => board.isTimeCapsule);
    const normalBoards = visibleBoards.filter(board => !board.isTimeCapsule);
    return [...openCapsules, ...normalBoards];
  }, [boards, now]);
  const managementBoards = useMemo(() => boards.filter(board => !board.archived), [boards]);
  const storageBreakdown = useMemo(() => getStorageBreakdown(data), [data]);
  const diaryAttachableBoards = useMemo(
    () => boards.filter(board => !board.isTimeCapsule || isTimeCapsuleOpen(board, now)),
    [boards, now]
  );

  useEffect(() => {
    const ok = saveMemoData(data, { reason: 'autosave' });
    if (!ok) {
      setStorageError(STORAGE_FULL_MESSAGE);
    } else {
      setStorageError(current => current === STORAGE_FULL_MESSAGE ? '' : current);
    }
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    const updateEstimate = async () => {
      if (!navigator.storage?.estimate) {
        setStorageEstimate(null);
        return;
      }
      try {
        const estimate = await navigator.storage.estimate();
        if (!cancelled) setStorageEstimate(estimate);
      } catch {
        if (!cancelled) setStorageEstimate(null);
      }
    };
    updateEstimate();
    return () => {
      cancelled = true;
    };
  }, [storageBreakdown.total]);

  useEffect(() => {
    if (!appToast) return undefined;
    const timer = window.setTimeout(() => setAppToast(''), 3600);
    return () => window.clearTimeout(timer);
  }, [appToast]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (initializedBoardRef.current) return;
    initializedBoardRef.current = true;
    if (homeBoards[0]) setActiveBoardId(homeBoards[0].id);
  }, [homeBoards]);

  useEffect(() => {
    if (homeBoards.some(board => board.id === activeBoardId)) return;
    setActiveBoardId(homeBoards[0]?.id || 'home');
  }, [activeBoardId, homeBoards]);

  const visibleMemos = useMemo(
    () => sortMemos(data.memos.filter(memo => (
      memo.boardId === activeBoardId && isMemoVisibleOnBoard(memo, now)
    ))),
    [activeBoardId, data.memos, now]
  );

  const allMemos = useMemo(() => sortMemos(data.memos), [data.memos]);
  const allBoardItems = useMemo(() => data.boardItems || [], [data.boardItems]);
  const visibleBoardItems = useMemo(
    () => allBoardItems.filter(item => item.boardId === activeBoardId && isBoardItemVisible(item)),
    [activeBoardId, allBoardItems]
  );
  const boardById = useMemo(() => Object.fromEntries(boards.map(board => [board.id, board])), [boards]);
  const snapshotBoard = snapshotRequest ? boardById[snapshotRequest.boardId] : null;
  const snapshotMemos = useMemo(
    () => snapshotRequest
      ? sortMemos(data.memos.filter(memo => (
        memo.boardId === snapshotRequest.boardId && isMemoVisibleOnBoard(memo, now)
      )))
      : [],
    [data.memos, now, snapshotRequest]
  );
  const snapshotBoardItems = useMemo(
    () => snapshotRequest
      ? allBoardItems.filter(item => item.boardId === snapshotRequest.boardId && isBoardItemVisible(item))
      : [],
    [allBoardItems, snapshotRequest]
  );

  useEffect(() => {
    if (!snapshotRequest || !snapshotBoard) return undefined;
    let cancelled = false;

    const persistSnapshot = (snapshotResult) => {
      const capturedAt = new Date().toISOString();
      const record = data.diaryRecords?.[snapshotRequest.dateKey] || { text: '', photos: [], boards: [] };
      const nextSnapshot = {
        id: crypto.randomUUID(),
        boardId: snapshotBoard.id,
        label: snapshotBoard.label,
        icon: snapshotBoard.icon,
        archived: Boolean(snapshotBoard.archived),
        capturedAt,
        snapshotDataUrl: snapshotResult.dataUrl,
        memoCount: snapshotMemos.length,
        photoCount: snapshotMemos.filter(memo => memo.cardType === 'photo').length,
        itemCount: snapshotBoardItems.length
      };
      const nextRecord = {
        ...record,
        boards: [nextSnapshot, ...(record.boards || [])],
        createdAt: record.createdAt || capturedAt,
        updatedAt: capturedAt
      };
      const nextData = {
        ...data,
        diaryRecords: {
          ...(data.diaryRecords || {}),
          [snapshotRequest.dateKey]: nextRecord
        }
      };
      if (!saveMemoData(nextData, {
        reason: 'diary-board-snapshot',
        attemptedSingleImageBytes: snapshotResult.compressedBytes || dataUrlByteLength(snapshotResult.dataUrl)
      })) return false;
      setSnapshotRequest(null);
      setAppToast(formatCompressionMessage('ボード', snapshotResult));
      captureUndo('ボードスナップショットの追加');
      setData(nextData);
      return true;
    };

    const runCapture = async () => {
      await nextFrame();
      await nextFrame();
      if (cancelled) return;
      const boardElement = snapshotStageRef.current?.querySelector('.cork-board');
      if (!boardElement) {
        setSnapshotRequest(null);
        setStorageError('ボードのスクショを作れませんでした。もう一度試してください。');
        return;
      }

      try {
        const firstSnapshot = await captureBoardElement(boardElement);
        if (!cancelled && persistSnapshot(firstSnapshot)) return;

        const retrySnapshot = await captureBoardElement(boardElement, {
          maxWidth: BOARD_SNAPSHOT_RETRY_WIDTH,
          quality: 0.58
        });
        if (!cancelled && persistSnapshot(retrySnapshot)) return;

        setSnapshotRequest(null);
        setStorageError('保存容量がいっぱいです。日記の写真やボード画像を減らしてから、もう一度試してください。');
      } catch (error) {
        console.error('Failed to capture board snapshot', error);
        setSnapshotRequest(null);
        setStorageError('ボードのスクショを作れませんでした。画像を読み込んでからもう一度試してください。');
      }
    };

    runCapture();
    return () => {
      cancelled = true;
    };
  }, [data, snapshotBoard, snapshotBoardItems, snapshotMemos, snapshotRequest]);

  useEffect(() => {
    const releasedBoards = boards.filter(board => (
      board.isTimeCapsule
      && isTimeCapsuleOpen(board, now)
      && !data.notifiedTimeCapsuleBoardIds?.includes(board.id)
    ));
    if (!releasedBoards.length) return;

    const nextNotifications = releasedBoards.map(board => ({
      id: `time-${board.id}-${Date.now()}`,
      type: 'timeCapsule',
      title: '表示されたタイムカプセルがあります',
      body: `「${board.label}」が開きました`,
      boardId: board.id,
      createdAt: new Date().toISOString()
    }));
    setNotifications(current => [...nextNotifications, ...current]);
    setHasUnreadNotifications(true);
    setNotificationsOpen(false);
    if (globalThis.Notification?.permission === 'granted') {
      nextNotifications.forEach(item => {
        try {
          new Notification(item.title, { body: item.body });
        } catch (error) {
          console.warn('Notification failed', error);
        }
      });
    }
    setData(current => ({
      ...current,
      notifiedTimeCapsuleBoardIds: [
        ...new Set([...(current.notifiedTimeCapsuleBoardIds || []), ...releasedBoards.map(board => board.id)])
      ]
    }));
  }, [boards, data.notifiedTimeCapsuleBoardIds, now]);

  const captureUndo = (label) => {
    setUndoAction({ label, data });
  };

  const undoLastAction = () => {
    if (!undoAction) return;
    setData(undoAction.data);
    setAppToast('元に戻しました。');
    setUndoAction(null);
  };

  const saveMemo = (memo) => {
    captureUndo('メモの保存');
    const nextMemo = normalizeMemo({
      ...memo,
      updatedAt: new Date().toISOString()
    });

    setData(current => {
      const exists = current.memos.some(item => item.id === nextMemo.id);
      return {
        ...current,
        memos: exists
          ? current.memos.map(item => item.id === nextMemo.id ? nextMemo : item)
          : [nextMemo, ...current.memos]
      };
    });
    setActiveBoardId(nextMemo.boardId);
    setPage('home');
    setDraft(createDraft({ boardId: nextMemo.boardId }));
  };

  const patchMemo = (id, patch) => {
    setData(current => ({
      ...current,
      memos: current.memos.map(memo => (
        memo.id === id
          ? normalizeMemo({ ...memo, ...patch, updatedAt: new Date().toISOString() })
          : memo
      ))
    }));
  };

  const pasteMemoCopy = (memo, boardId, position) => {
    if (!memo) return;
    captureUndo('メモのコピー');
    const nextMemo = cloneMemoForBoard(memo, boardId, position);
    setData(current => ({
      ...current,
      memos: [nextMemo, ...current.memos]
    }));
    setActiveBoardId(boardId);
  };

  const beginMove = (label = '移動') => {
    captureUndo(label);
  };

  const toggleChecklistItem = (memoId, itemId) => {
    const memo = data.memos.find(item => item.id === memoId);
    const item = memo?.checklist.find(check => check.id === itemId);
    if (!memo || !item) return;

    patchMemo(memoId, {
      checklist: memo.checklist.map(check => (
        check.id === itemId ? { ...check, completed: !check.completed } : check
      ))
    });
  };

  const deleteMemo = (id) => {
    captureUndo('メモの削除');
    setData(current => ({
      ...current,
      memos: current.memos.filter(memo => memo.id !== id)
    }));
  };

  const addBoardItem = (patch) => {
    captureUndo(patch.type === 'image' ? '画像の追加' : 'テキストの追加');
    const nextItem = createBoardItem(patch);
    setData(current => ({
      ...current,
      boardItems: [nextItem, ...(current.boardItems || [])]
    }));
    return nextItem;
  };

  const patchBoardItem = (id, patch) => {
    setData(current => ({
      ...current,
      boardItems: (current.boardItems || []).map(item => (
        item.id === id
          ? normalizeBoardItem({ ...item, ...patch, updatedAt: new Date().toISOString() })
          : item
      ))
    }));
  };

  const deleteBoardItem = (id) => {
    captureUndo('アイテムの削除');
    setData(current => ({
      ...current,
      boardItems: (current.boardItems || []).filter(item => item.id !== id)
    }));
  };

  const updateDiaryRecord = (dateKey, patch) => {
    setData(current => {
      const currentRecord = current.diaryRecords?.[dateKey] || { text: '', photos: [] };
      return {
        ...current,
        diaryRecords: {
          ...(current.diaryRecords || {}),
          [dateKey]: {
            ...currentRecord,
            ...patch,
            updatedAt: new Date().toISOString(),
            createdAt: currentRecord.createdAt || new Date().toISOString()
          }
        }
      };
    });
  };

  const attachBoardSnapshotToDiary = (dateKey, boardId) => {
    if (!boardById[boardId]) return;
    setStorageError('');
    setSnapshotRequest({ dateKey, boardId, requestedAt: Date.now() });
  };

  const updateAppTitle = (nextTitle) => {
    const appTitle = nextTitle.trim() || DEFAULT_APP_TITLE;
    setData(current => ({
      ...current,
      appTitle
    }));
  };

  const updateStickyTextSettings = (patch) => {
    setData(current => ({
      ...current,
      stickyTextSize: STICKY_TEXT_SIZES.has(patch.stickyTextSize)
        ? patch.stickyTextSize
        : (STICKY_TEXT_SIZES.has(current.stickyTextSize) ? current.stickyTextSize : DEFAULT_STICKY_TEXT_SIZE),
      stickyTextWeight: STICKY_TEXT_WEIGHTS.has(patch.stickyTextWeight)
        ? patch.stickyTextWeight
        : (STICKY_TEXT_WEIGHTS.has(current.stickyTextWeight) ? current.stickyTextWeight : DEFAULT_STICKY_TEXT_WEIGHT)
    }));
  };

  const exportBackup = () => {
    const payload = createBackupPayload(data);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `usapon-memo-backup-${toDateKey(new Date())}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setAppToast(`バックアップを書き出しました（${formatBytes(blob.size)}）`);
  };

  const importBackup = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedData = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      const normalized = normalizeData(importedData);
      const confirmed = window.confirm('現在のデータをバックアップ内容で上書きします。よろしいですか？');
      if (!confirmed) return;
      if (!saveMemoData(normalized, { reason: 'backup-import' })) {
        setStorageError('バックアップの容量が大きすぎて読み込めませんでした。');
        return;
      }
      setStorageError('');
      setData(normalized);
      setActiveBoardId(normalized.boards[0]?.id || 'home');
      setAppToast('バックアップを読み込みました。');
    } catch (error) {
      console.error('Backup import failed', error);
      setStorageError('バックアップを読み込めませんでした。JSONファイルを確認してください。');
    }
  };

  const requestBrowserNotifications = async () => {
    if (!('Notification' in globalThis)) {
      window.alert('このブラウザでは通知に対応していません。');
      return;
    }
    const permission = await Notification.requestPermission();
    setAppToast(permission === 'granted'
      ? 'ブラウザ通知を許可しました。'
      : 'ブラウザ通知はオフです。アプリ内通知はそのまま使えます。');
  };

  const toggleNotifications = () => {
    setNotificationsOpen(current => {
      const nextOpen = !current;
      if (nextOpen) {
        setHasUnreadNotifications(false);
      }
      return nextOpen;
    });
  };

  const closeNotifications = () => {
    setNotificationsOpen(false);
  };

  const openNewCard = (cardType = 'checklist') => {
    setDraft(createDraft({
      boardId: activeBoardId,
      cardType,
      type: cardType === 'checklist' ? 'checklist' : 'note',
      checklist: cardType === 'checklist' ? [createChecklistItem()] : [],
      color: cardType === 'photo' ? 'white' : 'green',
      tapeColor: cardType === 'photo' ? 'yellow' : 'green'
    }));
    setPage('create');
  };

  const addBoard = (label = '') => {
    const nextBoard = createBoard(label.trim() || getNextBoardName(boards));
    setData(current => ({
      ...current,
      boards: [...current.boards, nextBoard]
    }));
    setActiveBoardId(nextBoard.id);
    return nextBoard.id;
  };

  const updateBoard = (boardId, patch) => {
    captureUndo('ボードの変更');
    setData(current => ({
      ...current,
      boards: current.boards.map(board => (
        board.id === boardId
          ? {
            ...board,
            ...patch,
            label: typeof patch.label === 'string' && patch.label.trim() ? patch.label.trim() : board.label
          }
          : board
      ))
    }));
  };

  const duplicateBoard = (boardId) => {
    const sourceBoard = boards.find(item => item.id === boardId);
    if (!sourceBoard) return;

    const nextBoard = createBoard(`${sourceBoard.label} コピー`);
    captureUndo('ボードの複製');
    setData(current => ({
      ...current,
      boards: [...current.boards, nextBoard],
      memos: [
        ...current.memos,
        ...current.memos
          .filter(memo => memo.boardId === boardId)
          .map(memo => normalizeMemo({
            ...memo,
            id: crypto.randomUUID(),
            boardId: nextBoard.id,
            checklist: memo.checklist.map(item => ({ ...item, id: crypto.randomUUID() })),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }))
      ],
      boardItems: [
        ...(current.boardItems || []),
        ...(current.boardItems || [])
          .filter(item => item.boardId === boardId)
          .map(item => normalizeBoardItem({
            ...item,
            id: crypto.randomUUID(),
            boardId: nextBoard.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }))
      ]
    }));
    setActiveBoardId(nextBoard.id);
  };

  const moveBoard = (boardId, direction) => {
    captureUndo('ボードの並び替え');
    setData(current => {
      const index = current.boards.findIndex(board => board.id === boardId);
      const offset = direction === 'prev' || direction === 'up' ? -1 : 1;
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.boards.length) return current;
      const nextBoards = [...current.boards];
      const [board] = nextBoards.splice(index, 1);
      nextBoards.splice(nextIndex, 0, board);
      return {
        ...current,
        boards: nextBoards
      };
    });
  };

  const deleteBoard = (boardId) => {
    const board = boards.find(item => item.id === boardId);
    const activeBoards = boards.filter(item => !item.archived);
    if (!board || activeBoards.length <= 1) {
      window.alert('ボードは1つ以上必要です。');
      return;
    }

    const fallbackBoard = homeBoards.find(item => item.id !== boardId && item.id === 'home')
      || homeBoards.find(item => item.id !== boardId)
      || activeBoards.find(item => item.id !== boardId);
    const confirmed = window.confirm(`「${board.label}」をアーカイブしますか？中のカードもアーカイブ画面から復元できます。`);
    if (!confirmed) return;

    captureUndo('ボードのアーカイブ');
    setData(current => ({
      ...current,
      boards: current.boards.map(item => (
        item.id === boardId ? { ...item, archived: true } : item
      ))
    }));
    if (fallbackBoard && activeBoardId === boardId) {
      setActiveBoardId(fallbackBoard.id);
    }
  };

  const archiveMemo = (id) => {
    captureUndo('メモのアーカイブ');
    patchMemo(id, { archived: true });
  };

  const restoreMemo = (id) => {
    captureUndo('メモの復元');
    patchMemo(id, { archived: false });
  };

  const restoreBoard = (boardId) => {
    captureUndo('ボードの復元');
    updateBoard(boardId, { archived: false });
    setActiveBoardId(boardId);
    setPage('home');
  };

  const openEditMemo = (memo) => {
    setDraft(normalizeMemo(memo));
    setPage('create');
  };

  const openMemoFromList = (memo) => {
    const board = boardById[memo.boardId];
    if (board && !board.archived) setActiveBoardId(board.id);
    openEditMemo(memo);
  };

  return (
    <main className="phone-shell">
      {(storageError || appToast) && <p className="storage-toast">{storageError || appToast}</p>}

      {page === 'home' && (
        <HomePage
          appTitle={appTitle}
          stickyTextSize={stickyTextSize}
          stickyTextWeight={stickyTextWeight}
          activeBoardId={activeBoardId}
          boards={homeBoards}
          allBoards={boards}
          allMemos={allMemos}
          allBoardItems={allBoardItems}
          boardItems={visibleBoardItems}
          memos={visibleMemos}
          notifications={notifications}
          hasUnreadNotification={hasUnreadNotifications}
          notificationsOpen={notificationsOpen}
          undoAction={undoAction}
          onAdd={openNewCard}
          onAddBoardItem={addBoardItem}
          onBoardChange={setActiveBoardId}
          onOpenList={() => setPage('list')}
          onOpenPage={setPage}
          onEdit={openEditMemo}
          onBeginMove={beginMove}
          onMove={patchMemo}
          onPasteMemoCopy={pasteMemoCopy}
          onMoveBoardItem={patchBoardItem}
          onDeleteMemo={deleteMemo}
          onDeleteBoardItem={deleteBoardItem}
          onToggleChecklistItem={toggleChecklistItem}
          onAddBoard={addBoard}
          onUpdateBoard={updateBoard}
          onDuplicateBoard={duplicateBoard}
          onDeleteBoard={deleteBoard}
          onMoveBoard={moveBoard}
          onUpdateAppTitle={updateAppTitle}
          onUndo={undoLastAction}
          onShowToast={setAppToast}
          onToggleNotifications={toggleNotifications}
          onCloseNotifications={closeNotifications}
        />
      )}

      {page === 'create' && (
        <MemoCreatePage
          boards={boards}
          draft={draft}
          stickyTextSize={stickyTextSize}
          stickyTextWeight={stickyTextWeight}
          setDraft={setDraft}
          onBack={() => setPage('home')}
          onSave={saveMemo}
          onShowToast={setAppToast}
        />
      )}

      {page === 'list' && (
        <BoardListPage
          boards={managementBoards}
          memos={allMemos}
          activeBoardId={activeBoardId}
          onBack={() => setPage('home')}
          onSelect={(boardId) => {
            setActiveBoardId(boardId);
            setPage('home');
          }}
          onAddBoard={addBoard}
          onUpdateBoard={updateBoard}
          onDuplicateBoard={duplicateBoard}
          onDeleteBoard={deleteBoard}
          onMoveBoard={moveBoard}
        />
      )}

      {page === 'memos' && (
        <MemoListPage
          title="メモ一覧"
          memos={allMemos.filter(memo => (
            !memo.archived
            && memo.cardType !== 'photo'
            && isBoardVisibleInLibrary(boardById[memo.boardId], now)
          ))}
          boards={boards}
          onBack={() => setPage('home')}
          onOpen={openMemoFromList}
          onArchive={archiveMemo}
        />
      )}

      {page === 'photos' && (
        <PhotoListPage
          memos={allMemos.filter(memo => (
            !memo.archived
            && memo.cardType === 'photo'
            && isBoardVisibleInLibrary(boardById[memo.boardId], now)
          ))}
          boards={boards}
          onBack={() => setPage('home')}
          onOpen={openMemoFromList}
          onArchive={archiveMemo}
        />
      )}

      {page === 'archive' && (
        <ArchivePage
          boards={boards}
          memos={allMemos}
          onBack={() => setPage('home')}
          onRestoreMemo={restoreMemo}
          onRestoreBoard={restoreBoard}
        />
      )}

      {page === 'settings' && (
        <SettingsPage
          appTitle={appTitle}
          stickyTextSize={stickyTextSize}
          stickyTextWeight={stickyTextWeight}
          storageBreakdown={storageBreakdown}
          storageEstimate={storageEstimate}
          onBack={() => setPage('home')}
          onUpdateAppTitle={updateAppTitle}
          onUpdateStickyTextSettings={updateStickyTextSettings}
          onRequestNotifications={requestBrowserNotifications}
          onExportBackup={exportBackup}
          onImportBackup={importBackup}
        />
      )}

      {page === 'timeCapsule' && (
        <TimeCapsulePage
          boards={managementBoards}
          onBack={() => setPage('home')}
          onUpdateBoard={updateBoard}
        />
      )}

      {page === 'diary' && (
        <DiaryPage
          boards={diaryAttachableBoards}
          records={data.diaryRecords || {}}
          onBack={() => setPage('home')}
          onUpdateRecord={updateDiaryRecord}
          onAttachBoardSnapshot={attachBoardSnapshotToDiary}
          onShowToast={setAppToast}
        />
      )}

      {snapshotRequest && snapshotBoard && (
        <BoardSnapshotStage
          refTarget={snapshotStageRef}
          board={snapshotBoard}
          memos={snapshotMemos}
          boardItems={snapshotBoardItems}
          stickyTextSize={stickyTextSize}
          stickyTextWeight={stickyTextWeight}
        />
      )}
    </main>
  );
}

function BoardSnapshotStage({ refTarget, board, memos, boardItems, stickyTextSize, stickyTextWeight }) {
  return (
    <div className="snapshot-capture-stage" ref={refTarget} aria-hidden="true">
      <div className="sticky-board cork-board">
        {memos.map(memo => (
          <BoardMemo
            key={memo.id}
            memo={memo}
            stickyTextSize={stickyTextSize}
            stickyTextWeight={stickyTextWeight}
            isDragging={false}
            onPointerDown={() => {}}
            onEdit={() => {}}
            onToggleChecklistItem={() => {}}
          />
        ))}
        {boardItems.map(item => (
          <BoardFreeItem
            key={item.id}
            item={item}
            isDragging={false}
            onPointerDown={() => {}}
          />
        ))}
        {memos.length === 0 && boardItems.length === 0 && (
          <div className="board-empty cork-empty snapshot-empty">
            <StickyNote size={28} />
            <strong>{board.label}</strong>
            <span>まだ貼り付けはありません</span>
          </div>
        )}
      </div>
    </div>
  );
}

function HomePage({
  appTitle,
  stickyTextSize,
  stickyTextWeight,
  activeBoardId,
  boards,
  allBoards,
  allMemos,
  allBoardItems,
  boardItems,
  memos,
  notifications,
  hasUnreadNotification,
  notificationsOpen,
  undoAction,
  onAdd,
  onAddBoardItem,
  onBoardChange,
  onOpenList,
  onOpenPage,
  onEdit,
  onBeginMove,
  onMove,
  onPasteMemoCopy,
  onMoveBoardItem,
  onDeleteMemo,
  onDeleteBoardItem,
  onToggleChecklistItem,
  onAddBoard,
  onUpdateBoard,
  onDuplicateBoard,
  onDeleteBoard,
  onMoveBoard,
  onUpdateAppTitle,
  onUndo,
  onShowToast,
  onToggleNotifications,
  onCloseNotifications
}) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [boardMenu, setBoardMenu] = useState(null);
  const [memoMenu, setMemoMenu] = useState(null);
  const [copiedMemo, setCopiedMemo] = useState(null);
  const [editingBoard, setEditingBoard] = useState(null);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(appTitle);
  const [draggingMemoId, setDraggingMemoId] = useState(null);
  const [draggingBoardItemId, setDraggingBoardItemId] = useState(null);
  const [boardReorderMode, setBoardReorderMode] = useState(false);
  const [trashActive, setTrashActive] = useState(false);
  const [quickAdd, setQuickAdd] = useState(null);
  const [directText, setDirectText] = useState(null);
  const [pasteMenu, setPasteMenu] = useState(null);
  const boardRef = useRef(null);
  const trashRef = useRef(null);
  const directImageInputRef = useRef(null);
  const activeCardRef = useRef(null);
  const cardPointersRef = useRef(new globalThis.Map());
  const cardGestureRef = useRef(null);
  const activeBoardIdRef = useRef(activeBoardId);
  const boardsRef = useRef(boards);
  const dragMemoRef = useRef(null);
  const trashActiveRef = useRef(false);
  const swipeStartRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const boardPressTimerRef = useRef(null);
  const boardPressOriginRef = useRef(null);
  const boardLongPressFiredRef = useRef(false);
  const longPressFiredRef = useRef(false);
  const memoLongPressTimerRef = useRef(null);
  const memoLongPressOriginRef = useRef(null);
  const memoLongPressFiredRef = useRef(false);
  const boardReorderDragRef = useRef(null);
  const activeBoard = boards.find(board => board.id === activeBoardId) || boards[0] || { id: 'home', label: 'ホーム' };

  activeBoardIdRef.current = activeBoardId;
  boardsRef.current = boards;

  useEffect(() => {
    if (!titleEditing) setTitleDraft(appTitle);
  }, [appTitle, titleEditing]);

  useEffect(() => () => {
    window.clearTimeout(longPressTimerRef.current);
    window.clearTimeout(boardPressTimerRef.current);
    window.clearTimeout(memoLongPressTimerRef.current);
  }, []);

  const commitAppTitle = () => {
    const nextTitle = titleDraft.trim() || DEFAULT_APP_TITLE;
    setTitleDraft(nextTitle);
    setTitleEditing(false);
    onUpdateAppTitle(nextTitle);
  };

  const setTrashHover = (isActive) => {
    trashActiveRef.current = isActive;
    setTrashActive(isActive);
  };

  const updateDragMemo = (patch) => {
    dragMemoRef.current = {
      ...(dragMemoRef.current || {}),
      ...patch
    };
  };

  const patchDraggedMemo = (id, patch) => {
    updateDragMemo(patch);
    onMove(id, patch);
  };

  const patchDraggedBoardItem = (id, patch) => {
    updateDragMemo(patch);
    onMoveBoardItem(id, patch);
  };

  const getMemoPointPatch = (clientX, clientY, gesture) => ({
    x: clamp(((clientX - gesture.grabOffsetX - gesture.boardRect.left) / gesture.boardRect.width) * 100, 1, 70),
    y: clamp(((clientY - gesture.grabOffsetY - gesture.boardRect.top) / gesture.boardRect.height) * 100, 1, 80)
  });

  const updateTrashHover = () => {
    const trashRect = trashRef.current?.getBoundingClientRect();
    const cardRect = activeCardRef.current?.getBoundingClientRect();
    if (!trashRect || !cardRect) {
      setTrashHover(false);
      return;
    }

    setTrashHover(
      cardRect.left < trashRect.right
      && cardRect.right > trashRect.left
      && cardRect.top < trashRect.bottom
      && cardRect.bottom > trashRect.top
    );
  };

  const createDragGesture = (event, memo) => {
    if (!boardRef.current) return null;
    const boardRect = boardRef.current.getBoundingClientRect();
    const cardRect = event.currentTarget.getBoundingClientRect();
    return {
      type: 'drag',
      memoId: memo.id,
      boardRect,
      grabOffsetX: event.clientX - cardRect.left,
      grabOffsetY: event.clientY - cardRect.top
    };
  };

  const createPinchGesture = (memo) => {
    if (!boardRef.current || cardPointersRef.current.size < 2) return null;
    const points = Array.from(cardPointersRef.current.values()).slice(0, 2);
    const center = getPointerCenter(points[0], points[1]);
    const currentMemo = dragMemoRef.current || memo;
    return {
      type: 'pinch',
      memoId: currentMemo.id,
      boardRect: boardRef.current.getBoundingClientRect(),
      center,
      distance: Math.max(getPointerDistance(points[0], points[1]), 1),
      angle: getPointerAngle(points[0], points[1]),
      x: currentMemo.x,
      y: currentMemo.y,
      scale: currentMemo.scale || 1,
      rotation: currentMemo.rotation || 0
    };
  };

  const handlePointerDown = (event, memo) => {
    if (!boardRef.current || event.target.closest('input, textarea, button')) return;
    event.preventDefault();
    window.clearTimeout(memoLongPressTimerRef.current);
    memoLongPressFiredRef.current = false;
    memoLongPressOriginRef.current = { clientX: event.clientX, clientY: event.clientY };
    onBeginMove('メモの移動');
    setDraggingMemoId(memo.id);
    dragMemoRef.current = { ...memo };
    activeCardRef.current = event.currentTarget;
    cardPointersRef.current.set(event.pointerId, {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY
    });
    event.currentTarget.setPointerCapture(event.pointerId);

    if (cardGestureRef.current?.memoId === memo.id) {
      if (cardPointersRef.current.size >= 2) {
        cardGestureRef.current = createPinchGesture(memo);
      }
      return;
    }

    cardGestureRef.current = cardPointersRef.current.size >= 2
      ? createPinchGesture(memo)
      : createDragGesture(event, memo);

    memoLongPressTimerRef.current = window.setTimeout(() => {
      memoLongPressFiredRef.current = true;
      setDraggingMemoId(null);
      setTrashHover(false);
      activeCardRef.current = null;
      cardGestureRef.current = null;
      dragMemoRef.current = null;
      cardPointersRef.current.clear();
      setMemoMenu({ id: memo.id, x: event.clientX || 0, y: event.clientY || 0 });
      setBoardMenu(null);
    }, 560);

    const moveMemo = (moveEvent) => {
      if (!cardPointersRef.current.has(moveEvent.pointerId)) return;
      const origin = memoLongPressOriginRef.current;
      if (origin && Math.hypot(moveEvent.clientX - origin.clientX, moveEvent.clientY - origin.clientY) > 10) {
        window.clearTimeout(memoLongPressTimerRef.current);
      }
      cardPointersRef.current.set(moveEvent.pointerId, {
        pointerId: moveEvent.pointerId,
        clientX: moveEvent.clientX,
        clientY: moveEvent.clientY
      });

      if (cardPointersRef.current.size >= 2) {
        if (cardGestureRef.current?.type !== 'pinch') {
          cardGestureRef.current = createPinchGesture(memo);
        }
        const gesture = cardGestureRef.current;
        const points = Array.from(cardPointersRef.current.values()).slice(0, 2);
        const center = getPointerCenter(points[0], points[1]);
        const nextScale = clamp(gesture.scale * (getPointerDistance(points[0], points[1]) / gesture.distance), 0.55, 2.4);
        const nextRotation = clamp(gesture.rotation + getPointerAngle(points[0], points[1]) - gesture.angle, -180, 180);
        const patch = {
          x: clamp(gesture.x + ((center.x - gesture.center.x) / gesture.boardRect.width) * 100, -8, 88),
          y: clamp(gesture.y + ((center.y - gesture.center.y) / gesture.boardRect.height) * 100, -8, 88),
          scale: nextScale,
          rotation: nextRotation
        };
        patchDraggedMemo(memo.id, patch);
      } else if (cardGestureRef.current?.type === 'drag') {
        patchDraggedMemo(memo.id, getMemoPointPatch(moveEvent.clientX, moveEvent.clientY, cardGestureRef.current));
      }
      window.requestAnimationFrame(updateTrashHover);
    };

    const stopMove = (stopEvent) => {
      window.clearTimeout(memoLongPressTimerRef.current);
      memoLongPressOriginRef.current = null;
      cardPointersRef.current.delete(stopEvent.pointerId);
      if (cardPointersRef.current.size >= 2) {
        cardGestureRef.current = createPinchGesture(memo);
        return;
      }
      if (cardPointersRef.current.size === 1) {
        const point = Array.from(cardPointersRef.current.values())[0];
        const cardRect = activeCardRef.current?.getBoundingClientRect();
        if (boardRef.current && cardRect) {
          cardGestureRef.current = {
            type: 'drag',
            memoId: memo.id,
            boardRect: boardRef.current.getBoundingClientRect(),
            grabOffsetX: point.clientX - cardRect.left,
            grabOffsetY: point.clientY - cardRect.top
          };
        }
        return;
      }

      const shouldDelete = trashActiveRef.current;
      setDraggingMemoId(null);
      setTrashHover(false);
      activeCardRef.current = null;
      cardGestureRef.current = null;
      dragMemoRef.current = null;
      window.removeEventListener('pointermove', moveMemo);
      window.removeEventListener('pointerup', stopMove);
      window.removeEventListener('pointercancel', stopMove);
      if (shouldDelete) onDeleteMemo(memo.id);
    };

    window.addEventListener('pointermove', moveMemo);
    window.addEventListener('pointerup', stopMove);
    window.addEventListener('pointercancel', stopMove);
  };

  const handleBoardItemPointerDown = (event, item) => {
    if (!boardRef.current || event.target.closest('input, textarea, button')) return;
    event.preventDefault();
    onBeginMove(item.type === 'image' ? '画像の移動' : 'テキストの移動');
    setDraggingBoardItemId(item.id);
    dragMemoRef.current = { ...item };
    activeCardRef.current = event.currentTarget;
    cardPointersRef.current.set(event.pointerId, {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY
    });
    event.currentTarget.setPointerCapture(event.pointerId);

    cardGestureRef.current = cardPointersRef.current.size >= 2
      ? createPinchGesture(item)
      : createDragGesture(event, item);

    const moveItem = (moveEvent) => {
      if (!cardPointersRef.current.has(moveEvent.pointerId)) return;
      cardPointersRef.current.set(moveEvent.pointerId, {
        pointerId: moveEvent.pointerId,
        clientX: moveEvent.clientX,
        clientY: moveEvent.clientY
      });

      if (cardPointersRef.current.size >= 2) {
        if (cardGestureRef.current?.type !== 'pinch') {
          cardGestureRef.current = createPinchGesture(item);
        }
        const gesture = cardGestureRef.current;
        const points = Array.from(cardPointersRef.current.values()).slice(0, 2);
        const center = getPointerCenter(points[0], points[1]);
        patchDraggedBoardItem(item.id, {
          x: clamp(gesture.x + ((center.x - gesture.center.x) / gesture.boardRect.width) * 100, -8, 88),
          y: clamp(gesture.y + ((center.y - gesture.center.y) / gesture.boardRect.height) * 100, -8, 88),
          scale: clamp(gesture.scale * (getPointerDistance(points[0], points[1]) / gesture.distance), 0.3, 3.2),
          rotation: clamp(gesture.rotation + getPointerAngle(points[0], points[1]) - gesture.angle, -180, 180)
        });
      } else if (cardGestureRef.current?.type === 'drag') {
        patchDraggedBoardItem(item.id, getMemoPointPatch(moveEvent.clientX, moveEvent.clientY, cardGestureRef.current));
      }
      window.requestAnimationFrame(updateTrashHover);
    };

    const stopItem = (stopEvent) => {
      cardPointersRef.current.delete(stopEvent.pointerId);
      if (cardPointersRef.current.size > 0) return;
      const shouldDelete = trashActiveRef.current;
      setDraggingBoardItemId(null);
      setTrashHover(false);
      activeCardRef.current = null;
      cardGestureRef.current = null;
      dragMemoRef.current = null;
      window.removeEventListener('pointermove', moveItem);
      window.removeEventListener('pointerup', stopItem);
      window.removeEventListener('pointercancel', stopItem);
      if (shouldDelete) onDeleteBoardItem(item.id);
    };

    window.addEventListener('pointermove', moveItem);
    window.addEventListener('pointerup', stopItem);
    window.addEventListener('pointercancel', stopItem);
  };

  const getBoardPositionFromEvent = (event) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return { x: 18, y: 18 };
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 88),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 88)
    };
  };

  const startBoardPress = (event) => {
    if (event.target.closest('.board-card, .board-item, input, textarea')) return;
    window.clearTimeout(boardPressTimerRef.current);
    boardLongPressFiredRef.current = false;
    const position = getBoardPositionFromEvent(event);
    boardPressOriginRef.current = { clientX: event.clientX, clientY: event.clientY };
    boardPressTimerRef.current = window.setTimeout(() => {
      boardLongPressFiredRef.current = true;
      setQuickAdd(null);
      setPasteMenu({ ...position, clientX: event.clientX, clientY: event.clientY });
    }, 620);
  };

  const moveBoardPress = (event) => {
    const origin = boardPressOriginRef.current;
    if (!origin) return;
    if (Math.hypot(event.clientX - origin.clientX, event.clientY - origin.clientY) > 12) {
      clearBoardPress();
    }
  };

  const clearBoardPress = () => {
    window.clearTimeout(boardPressTimerRef.current);
    boardPressOriginRef.current = null;
  };

  const commitDirectText = () => {
    const text = directText?.text?.trim();
    if (text) {
      onAddBoardItem({
        type: 'text',
        boardId: activeBoardId,
        text,
        x: directText.x,
        y: directText.y
      });
    }
    setDirectText(null);
  };

  const startDirectText = () => {
    const position = quickAdd || pasteMenu;
    if (!position) return;
    setDirectText({ x: position.x, y: position.y, text: '' });
    setQuickAdd(null);
    setPasteMenu(null);
  };

  const createImageBoardItem = async (file, position = quickAdd) => {
    if (!file || !position) return;
    const image = await resizeFreeImageFile(file);
    logImageCompressionDebug('ボード画像', image);
    onAddBoardItem({
      type: 'image',
      boardId: activeBoardId,
      imageDataUrl: image.dataUrl,
      imageMimeType: image.mimeType,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      x: position.x,
      y: position.y
    });
    onShowToast?.(formatCompressionMessage('画像', image));
    setQuickAdd(null);
    setPasteMenu(null);
  };

  const pasteFromClipboard = async () => {
    const position = pasteMenu || quickAdd;
    if (!position) return;
    if (copiedMemo) {
      onPasteMemoCopy(copiedMemo, activeBoardId, {
        x: position.x,
        y: position.y
      });
      setPasteMenu(null);
      setQuickAdd(null);
      return;
    }
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find(type => type.startsWith('image/'));
          if (imageType) {
            await createImageBoardItem(await item.getType(imageType), position);
            return;
          }
        }
      }
      const text = await navigator.clipboard?.readText?.();
      if (text?.trim()) {
        onAddBoardItem({
          type: 'text',
          boardId: activeBoardId,
          text: text.trim(),
          x: position.x,
          y: position.y
        });
        setPasteMenu(null);
      } else {
        directImageInputRef.current?.click();
      }
    } catch (error) {
      console.warn('Clipboard paste failed', error);
      directImageInputRef.current?.click();
    }
  };

  const handleTouchStart = (event) => {
    if (boardReorderMode || event.target.closest('.board-card, .board-item, input, textarea')) return;
    const touch = event.touches[0];
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  };

  const handleTouchEnd = (event) => {
    if (swipeStartRef.current === null) return;
    const touch = event.changedTouches[0];
    const distance = touch.clientX - swipeStartRef.current.x;
    const verticalDistance = touch.clientY - swipeStartRef.current.y;
    const elapsed = Date.now() - swipeStartRef.current.time;
    swipeStartRef.current = null;
    if (
      Math.abs(distance) < 90
      || Math.abs(verticalDistance) > 46
      || Math.abs(distance) < Math.abs(verticalDistance) * 1.8
      || elapsed > 850
    ) return;
    const currentIndex = boards.findIndex(board => board.id === activeBoardId);
    const nextIndex = distance < 0
      ? Math.min(boards.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);
    onBoardChange(boards[nextIndex].id);
  };

  const chooseAddType = (cardType) => {
    setAddMenuOpen(false);
    onAdd(cardType);
  };

  const openMenuPage = (page) => {
    setMainMenuOpen(false);
    onOpenPage(page);
  };

  const clearBoardLongPress = () => {
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const openBoardMenu = (event, board) => {
    event.preventDefault();
    clearBoardLongPress();
    setBoardReorderMode(false);
    setBoardMenu({
      id: board.id,
      label: board.label,
      x: event.clientX || 0,
      y: event.clientY || 0
    });
  };

  const startBoardLongPress = (event, board) => {
    if (boardReorderMode) {
      if (!event.target.closest('.board-tab-label')) setBoardReorderMode(false);
      return;
    }
    clearBoardLongPress();
    longPressFiredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      setBoardMenu({
        id: board.id,
        label: board.label,
        x: event.clientX || 0,
        y: event.clientY || 0
      });
    }, 560);
  };

  const handleBoardClick = (event, board) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (boardReorderMode) return;
    setBoardMenu(null);
    onBoardChange(board.id);
  };

  const reorderFromMenu = () => {
    setBoardReorderMode(true);
    setBoardMenu(null);
  };

  const startBoardReorderDrag = (event, board) => {
    if (!boardReorderMode) return;
    event.preventDefault();
    event.stopPropagation();
    const chipElement = event.currentTarget;
    const chipWidth = Math.max(88, chipElement.getBoundingClientRect().width);
    chipElement.setPointerCapture(event.pointerId);
    boardReorderDragRef.current = {
      id: board.id,
      lastClientX: event.clientX
    };

    const moveBoardChip = (moveEvent) => {
      const state = boardReorderDragRef.current;
      if (!state || state.id !== board.id) return;
      const currentBoards = boardsRef.current;
      const index = currentBoards.findIndex(item => item.id === board.id);
      if (index < 0) return;
      const delta = moveEvent.clientX - state.lastClientX;
      if (delta > chipWidth * 0.45 && index < currentBoards.length - 1) {
        onMoveBoard(board.id, 'next');
        state.lastClientX = moveEvent.clientX;
      } else if (delta < -chipWidth * 0.45 && index > 0) {
        onMoveBoard(board.id, 'prev');
        state.lastClientX = moveEvent.clientX;
      }
    };

    const stopBoardChip = () => {
      boardReorderDragRef.current = null;
      window.removeEventListener('pointermove', moveBoardChip);
      window.removeEventListener('pointerup', stopBoardChip);
      window.removeEventListener('pointercancel', stopBoardChip);
    };

    window.addEventListener('pointermove', moveBoardChip);
    window.addEventListener('pointerup', stopBoardChip);
    window.addEventListener('pointercancel', stopBoardChip);
  };

  const maybeFinishBoardReorder = (event) => {
    if (!boardReorderMode) return;
    if (boardReorderDragRef.current) return;
    if (event.target.closest('.board-tab-label')) return;
    setBoardReorderMode(false);
  };

  const editFromMenu = () => {
    if (!boardMenu) return;
    const board = boards.find(item => item.id === boardMenu.id);
    if (board) setEditingBoard(board);
    setBoardMenu(null);
  };

  const duplicateFromMenu = () => {
    if (!boardMenu) return;
    onDuplicateBoard(boardMenu.id);
    setBoardMenu(null);
  };

  const deleteFromMenu = () => {
    if (!boardMenu) return;
    onDeleteBoard(boardMenu.id);
    setBoardMenu(null);
  };

  const openMemoMenu = (event, memo) => {
    event.preventDefault();
    event.stopPropagation();
    setMemoMenu({
      id: memo.id,
      x: event.clientX || 0,
      y: event.clientY || 0
    });
    setBoardMenu(null);
  };

  const copyMemoFromMenu = () => {
    if (!memoMenu) return;
    const memo = allMemos.find(item => item.id === memoMenu.id);
    if (memo) {
      setCopiedMemo(memo);
      onShowToast?.('メモをコピーしました。貼りたいボードの空白を長押ししてペーストできます。');
    }
    setMemoMenu(null);
  };

  const editMemoFromMenu = () => {
    if (!memoMenu) return;
    const memo = allMemos.find(item => item.id === memoMenu.id);
    if (memo) onEdit(memo);
    setMemoMenu(null);
  };

  const deleteMemoFromMenu = () => {
    if (!memoMenu) return;
    onDeleteMemo(memoMenu.id);
    setMemoMenu(null);
  };

  return (
    <section
      className="home-page cork-home"
      onClick={(event) => {
        if (boardMenu) setBoardMenu(null);
        if (memoMenu) setMemoMenu(null);
        maybeFinishBoardReorder(event);
      }}
    >
      <header className="cork-header">
        <button type="button" className="plain-icon" onClick={() => setMainMenuOpen(true)} aria-label="メニュー">
          <Menu size={27} />
        </button>
        {titleEditing ? (
          <input
            className="app-title-input"
            value={titleDraft}
            aria-label="アプリタイトル"
            autoFocus
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitAppTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                setTitleDraft(appTitle);
                setTitleEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="app-title-button"
            onClick={(event) => {
              event.stopPropagation();
              setTitleDraft(appTitle);
              setTitleEditing(true);
            }}
            aria-label="アプリタイトルを編集"
          >
            {appTitle}
          </button>
        )}
        <div className="header-tools">
          {undoAction && (
            <button type="button" className="plain-icon" onClick={onUndo} aria-label="戻る">
              <RotateCcw size={24} />
            </button>
          )}
          <button type="button" className="plain-icon" onClick={() => setSearchOpen(true)} aria-label="検索">
            <Search size={27} />
          </button>
          <button type="button" className={`plain-icon ${hasUnreadNotification ? 'has-dot' : ''}`} onClick={onToggleNotifications} aria-label="通知">
            <Bell size={25} />
          </button>
        </div>
      </header>

      <nav className="board-tabs" aria-label="ボード切替">
        {boards.map((board, index) => {
          const Icon = BOARD_ICON_MAP[board.icon] || Folder;
          return (
            <button
              key={board.id}
              type="button"
              className={`${board.id === activeBoardId ? 'active' : ''} ${boardReorderMode ? 'is-wiggling' : ''}`}
              onPointerDown={(event) => startBoardLongPress(event, board)}
              onPointerUp={clearBoardLongPress}
              onPointerLeave={clearBoardLongPress}
              onPointerCancel={clearBoardLongPress}
              onContextMenu={(event) => openBoardMenu(event, board)}
              onClick={(event) => {
                event.stopPropagation();
                handleBoardClick(event, board);
              }}
            >
              <Icon size={18} />
              <span
                className="board-tab-label"
                onPointerDown={(event) => startBoardReorderDrag(event, board)}
              >
                {board.label}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className="board-add-tab"
          onClick={(event) => {
            event.stopPropagation();
            setBoardMenu(null);
            setBoardReorderMode(false);
            onAddBoard();
          }}
          aria-label="ボード追加"
        >
          <Plus size={20} />
        </button>
      </nav>

      {boardMenu && (
        <div
          className="board-tab-menu"
          role="menu"
          style={{ '--menu-x': `${boardMenu.x}px`, '--menu-y': `${boardMenu.y}px` }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={reorderFromMenu}>
            <Menu size={16} />
            並び替え
          </button>
          <button type="button" role="menuitem" onClick={editFromMenu}>
            <Pencil size={16} />
            名前の変更
          </button>
          <button type="button" role="menuitem" onClick={duplicateFromMenu}>
            <Copy size={16} />
            複製
          </button>
          <button type="button" role="menuitem" className="danger" onClick={deleteFromMenu} disabled={boards.length <= 1}>
            <Trash2 size={16} />
            削除
          </button>
        </div>
      )}

      {memoMenu && (
        <div
          className="board-tab-menu memo-action-menu"
          role="menu"
          style={{ '--menu-x': `${memoMenu.x}px`, '--menu-y': `${memoMenu.y}px` }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={copyMemoFromMenu}>
            <Copy size={16} />
            コピー
          </button>
          <button type="button" role="menuitem" onClick={editMemoFromMenu}>
            <Pencil size={16} />
            編集
          </button>
          <button type="button" role="menuitem" className="danger" onClick={deleteMemoFromMenu}>
            <Trash2 size={16} />
            削除
          </button>
        </div>
      )}

      {editingBoard && (
        <BoardEditSheet
          board={editingBoard}
          onClose={() => setEditingBoard(null)}
          onSave={(patch) => {
            onUpdateBoard(editingBoard.id, patch);
            setEditingBoard(null);
          }}
        />
      )}

      {mainMenuOpen && (
        <div className="menu-drawer" role="dialog" aria-label="メニュー">
          <button type="button" className="sheet-close" onClick={() => setMainMenuOpen(false)} aria-label="閉じる">
            <X size={20} />
          </button>
          <p>メニュー</p>
          <button type="button" onClick={() => openMenuPage('settings')}>
            <MoreHorizontal size={19} />
            設定
          </button>
          <button type="button" onClick={() => openMenuPage('memos')}>
            <StickyNote size={19} />
            メモ一覧
          </button>
          <button type="button" onClick={() => openMenuPage('photos')}>
            <Camera size={19} />
            写真一覧
          </button>
          <button type="button" onClick={() => openMenuPage('timeCapsule')}>
            <Clock size={19} />
            タイムカプセル
          </button>
          <button type="button" onClick={() => openMenuPage('diary')}>
            <BookOpen size={19} />
            日記
          </button>
          <button type="button" onClick={() => openMenuPage('archive')}>
            <Trash2 size={19} />
            アーカイブ
          </button>
        </div>
      )}

      {searchOpen && (
        <SearchSheet
          boards={allBoards}
          memos={allMemos}
          boardItems={allBoardItems}
          onClose={() => setSearchOpen(false)}
          onOpenMemo={(memo) => {
            setSearchOpen(false);
            onBoardChange(memo.boardId);
            onEdit(memo);
          }}
        />
      )}

      {notificationsOpen && (
        <NotificationSheet
          notifications={notifications}
          undoAction={undoAction}
          onUndo={onUndo}
          onClose={onCloseNotifications}
          onOpenBoard={(boardId) => {
            onBoardChange(boardId);
            onCloseNotifications();
          }}
        />
      )}

      <section
        className="cork-board-wrap"
        aria-label={`${activeBoard.label}のコルクボード`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onPointerDown={startBoardPress}
        onPointerMove={moveBoardPress}
        onPointerUp={clearBoardPress}
        onPointerCancel={clearBoardPress}
        onPointerLeave={clearBoardPress}
      >
        <div ref={boardRef} className="sticky-board cork-board" onClick={(event) => {
          if (boardLongPressFiredRef.current) {
            boardLongPressFiredRef.current = false;
            return;
          }
        }}>
          {memos.length === 0 && boardItems.length === 0 ? (
            <button type="button" className="board-empty cork-empty" onClick={(event) => {
              event.stopPropagation();
            }}>
              <StickyNote size={28} />
              <strong>ここに貼っていこう</strong>
              <span>写真やメモを、少しずつ集めるボードです</span>
            </button>
          ) : (
            memos.map(memo => (
              <BoardMemo
                key={memo.id}
                memo={memo}
                stickyTextSize={stickyTextSize}
                stickyTextWeight={stickyTextWeight}
                isDragging={draggingMemoId === memo.id}
                onPointerDown={(event) => handlePointerDown(event, memo)}
                onContextMenu={(event) => openMemoMenu(event, memo)}
                onEdit={() => onEdit(memo)}
                onToggleChecklistItem={onToggleChecklistItem}
              />
            ))
          )}
          {boardItems.map(item => (
            <BoardFreeItem
              key={item.id}
              item={item}
              isDragging={draggingBoardItemId === item.id}
              onPointerDown={(event) => handleBoardItemPointerDown(event, item)}
            />
          ))}
          {directText && (
            <form
              className="direct-text-editor"
              style={{ left: `${directText.x}%`, top: `${directText.y}%` }}
              onSubmit={(event) => {
                event.preventDefault();
                commitDirectText();
              }}
            >
              <textarea
                autoFocus
                value={directText.text}
                placeholder="文字を入力"
                onChange={(event) => setDirectText(current => ({ ...current, text: event.target.value }))}
                onBlur={commitDirectText}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setDirectText(null);
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    commitDirectText();
                  }
                }}
              />
            </form>
          )}
        </div>
      </section>

      {(draggingMemoId || draggingBoardItemId) && (
        <div ref={trashRef} className={`memo-trash ${trashActive ? 'is-active' : ''}`} aria-hidden="true">
          <Trash2 size={26} />
        </div>
      )}

      <footer className="cork-footer" aria-label="主要操作">
        <button type="button" onClick={onOpenList}>
          <Folder size={22} />
          ボード一覧
        </button>
        <button type="button" onClick={() => setAddMenuOpen(true)}>
          <Plus size={22} />
          新規追加
        </button>
        <button type="button" onClick={() => onOpenPage('diary')}>
          <BookOpen size={22} />
          日記
        </button>
      </footer>

      {addMenuOpen && (
        <div className="add-sheet" role="dialog" aria-label="追加するカードを選択">
          <button type="button" className="sheet-close" onClick={() => setAddMenuOpen(false)} aria-label="閉じる">
            <X size={20} />
          </button>
          <p>なにを貼る？</p>
          <div>
            <button type="button" onClick={() => chooseAddType('checklist')}>
              <StickyNote size={24} />
              メモ
            </button>
            <button type="button" onClick={() => chooseAddType('photo')}>
              <ImagePlus size={24} />
              写真
            </button>
            <button type="button" onClick={() => chooseAddType('link')}>
              <LinkIcon size={24} />
              リンク
            </button>
          </div>
        </div>
      )}

      {quickAdd && (
        <div className="quick-add-menu" style={{ left: `${quickAdd.clientX}px`, top: `${quickAdd.clientY}px` }} role="dialog" aria-label="直接追加">
          <button type="button" onClick={startDirectText}>
            <Type size={18} />
            テキスト
          </button>
          <button type="button" onClick={() => directImageInputRef.current?.click()}>
            <Upload size={18} />
            画像
          </button>
        </div>
      )}

      {pasteMenu && (
        <div className="quick-add-menu paste-menu" style={{ left: `${pasteMenu.clientX}px`, top: `${pasteMenu.clientY}px` }} role="dialog" aria-label="空白に追加">
          <button type="button" onClick={startDirectText}>
            <Type size={18} />
            テキスト
          </button>
          <button type="button" onClick={() => directImageInputRef.current?.click()}>
            <Upload size={18} />
            画像
          </button>
          <button type="button" onClick={pasteFromClipboard}>
            <Copy size={18} />
            {copiedMemo ? 'メモを貼る' : 'ペースト'}
          </button>
        </div>
      )}

      <input
        ref={directImageInputRef}
        type="file"
        accept="image/*"
        className="visually-hidden-file"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          await createImageBoardItem(file, quickAdd || pasteMenu || { x: 24, y: 24 });
          event.target.value = '';
        }}
      />
    </section>
  );
}

function BoardEditSheet({ board, onClose, onSave }) {
  const [label, setLabel] = useState(board.label);
  const [icon, setIcon] = useState(board.icon || 'folder');

  const submit = (event) => {
    event.preventDefault();
    onSave({ label, icon });
  };

  return (
    <div className="board-edit-sheet" role="dialog" aria-label="ボード編集">
      <button type="button" className="sheet-close" onClick={onClose} aria-label="閉じる">
        <X size={20} />
      </button>
      <form onSubmit={submit}>
        <p>ボードを編集</p>
        <label className="board-edit-name">
          <span>名前</span>
          <input value={label} onChange={(event) => setLabel(event.target.value)} aria-label="ボード名" />
        </label>
        <div className="board-icon-picker" aria-label="ボードアイコン">
          {BOARD_ICON_OPTIONS.map(option => {
            const Icon = BOARD_ICON_MAP[option.id] || Folder;
            return (
              <button
                key={option.id}
                type="button"
                className={icon === option.id ? 'active' : ''}
                onClick={() => setIcon(option.id)}
                aria-label={option.label}
              >
                <Icon size={20} />
              </button>
            );
          })}
        </div>
        <button type="submit" className="board-edit-save">保存</button>
      </form>
    </div>
  );
}

function StickerLayer({
  stickers = [],
  onStickerPointerDown = null,
  selectedStickerId = '',
  movingStickerId = '',
  onDeleteSticker = null
}) {
  if (!stickers.length) return null;

  return (
    <div className="sticker-layer" aria-hidden={!onStickerPointerDown}>
      {stickers.map(sticker => {
        const asset = STICKER_MAP[sticker.assetId];
        if (!asset) return null;
        const isSelected = selectedStickerId === sticker.id;
        return (
          <span
            key={sticker.id}
            className={[
              onStickerPointerDown ? 'memo-sticker-wrap is-editable' : 'memo-sticker-wrap',
              movingStickerId === sticker.id ? 'is-moving' : ''
            ].filter(Boolean).join(' ')}
            style={{
              left: `${sticker.x}%`,
              top: `${sticker.y}%`,
              width: `${sticker.size}px`
            }}
            onPointerDown={onStickerPointerDown ? (event) => onStickerPointerDown(event, sticker) : undefined}
          >
            <img
              className="memo-sticker"
              src={asset.src}
              alt={asset.label}
              draggable={false}
            />
            {isSelected && onDeleteSticker && (
              <button
                type="button"
                className="sticker-delete"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteSticker(sticker.id);
                }}
                aria-label={`${asset.label}を削除`}
              >
                <X size={12} />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

const StickyNoteCard = forwardRef(function StickyNoteCard({
  as: Component = 'section',
  mode = 'edit',
  color = 'green',
  cardType = 'note',
  textSize = DEFAULT_STICKY_TEXT_SIZE,
  textWeight = DEFAULT_STICKY_TEXT_WEIGHT,
  className = '',
  style,
  children,
  stickerLayer,
  ...props
}, ref) {
  const safeColor = MEMO_COLORS[color] ? color : 'green';
  const safeTextSize = STICKY_TEXT_SIZES.has(textSize) ? textSize : DEFAULT_STICKY_TEXT_SIZE;
  const safeTextWeight = STICKY_TEXT_WEIGHTS.has(textWeight) ? textWeight : DEFAULT_STICKY_TEXT_WEIGHT;

  return (
    <Component
      className={`sticky-note-card sticky-note-${mode} sticky-text-${safeTextSize} sticky-weight-${safeTextWeight} ${MEMO_COLORS[safeColor].className} card-${cardType} ${className}`.trim()}
      ref={ref}
      style={style}
      {...props}
    >
      <span className="card-tape memo-tape" aria-hidden="true" />
      {stickerLayer}
      {children}
    </Component>
  );
});

function BoardMemo({
  memo,
  stickyTextSize,
  stickyTextWeight,
  isDragging,
  onPointerDown,
  onContextMenu,
  onEdit,
  onToggleChecklistItem
}) {
  const hasTitle = memo.title.trim().length > 0;
  const cardType = memo.cardType || (memo.type === 'checklist' ? 'checklist' : 'note');
  const style = {
    left: `${memo.x}%`,
    top: `${memo.y}%`,
    '--rotation': `${memo.rotation || 0}deg`,
    '--scale': memo.scale || 1,
    '--memo-tape-color': getTapeColor(memo.color),
    '--photo-tape-color': getTapeColor(memo.tapeColor || memo.color)
  };
  const dragClassName = isDragging ? 'is-dragging' : '';

  if (cardType === 'photo') {
    return (
      <article
        className={`board-card photo-card ${dragClassName}`}
        data-memo-id={memo.id}
        style={style}
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
      >
        <span className="photo-tape" aria-hidden="true" />
        <div className="photo-card-inner" role="button" tabIndex={0} onClick={onEdit} onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onEdit();
        }}>
          {memo.photoDataUrl ? (
            <span className={`photo-card-frame photo-crop-frame ${getPhotoCropClass(memo.photoCropRatio)}`} style={{ '--photo-frame-ratio': getPhotoFrameRatio(memo) }}>
              <img className="photo-card-image" src={memo.photoDataUrl} alt={memo.caption || memo.title || '写真'} style={getPhotoImageStyle(memo)} />
            </span>
          ) : (
            <span className="photo-card-frame photo-placeholder"><Camera size={27} />写真</span>
          )}
          {memo.caption && <div className="photo-card-caption">{memo.caption}</div>}
        </div>
      </article>
    );
  }

  return (
    <StickyNoteCard
      as="article"
      mode="board"
      color={memo.color}
      cardType={cardType}
      textSize={stickyTextSize}
      textWeight={stickyTextWeight}
      className={`board-card board-memo ${memo.pinned ? 'is-pinned' : ''} ${memo.completed ? 'is-completed' : ''} ${dragClassName}`}
      data-memo-id={memo.id}
      style={style}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      stickerLayer={<StickerLayer stickers={memo.stickers} />}
    >
      <div className="board-memo-body" role="button" tabIndex={0} onClick={onEdit} onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onEdit();
      }}>
        {hasTitle && <strong className="board-memo-title">{memo.title}</strong>}
        {cardType === 'schedule' ? (
          <span className="schedule-preview">
            <small>{memo.scheduleDate || '日付未定'}</small>
            <span>{memo.scheduleTime || '時間未定'}</span>
            <em>{memo.schedulePlace || '場所未定'}</em>
          </span>
        ) : cardType === 'link' ? (
          <span
            className="link-preview"
            role="link"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              if (memo.linkUrl) window.open(normalizeLinkUrl(memo.linkUrl), '_blank', 'noopener,noreferrer');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                if (memo.linkUrl) window.open(normalizeLinkUrl(memo.linkUrl), '_blank', 'noopener,noreferrer');
              }
            }}
          >
            <LinkIcon size={18} />
            <span>{memo.linkTitle || getLinkHost(memo.linkUrl)}</span>
            <small>{memo.linkUrl}</small>
          </span>
        ) : cardType === 'checklist' ? (
          <span className="mini-checklist">
            {memo.checklist.slice(0, 4).map(item => {
              const hasText = item.text.trim().length > 0;
              if (!hasText) {
                return <span key={item.id} className="mini-checklist-spacer" aria-hidden="true" />;
              }
              return (
                <span key={item.id} className={item.completed ? 'done' : ''}>
                  <button
                    type="button"
                    className="mini-check-toggle"
                    aria-label={item.completed ? `${item.text}を未完了にする` : `${item.text}を完了にする`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleChecklistItem(memo.id, item.id);
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                  />
                  {item.text}
                </span>
              );
            })}
          </span>
        ) : (
          <span>{memo.text || '自由メモ'}</span>
        )}
      </div>
    </StickyNoteCard>
  );
}

function BoardFreeItem({ item, isDragging, onPointerDown }) {
  const style = {
    left: `${item.x}%`,
    top: `${item.y}%`,
    '--rotation': `${item.rotation || 0}deg`,
    '--scale': item.scale || 1
  };

  return (
    <article
      className={`board-item board-free-${item.type} ${isDragging ? 'is-dragging' : ''}`}
      data-memo-id={item.id}
      data-board-item-id={item.id}
      style={style}
      onPointerDown={onPointerDown}
    >
      {item.type === 'image' ? (
        <img src={item.imageDataUrl} alt="" draggable={false} />
      ) : (
        <span>{item.text}</span>
      )}
    </article>
  );
}

function SettingsPanel({ boards, draft, setDraft, updateCardType }) {
  return (
    <div className="create-settings">
      <div className="type-tabs card-type-tabs" aria-label="カードの種類">
        <button type="button" className={draft.cardType === 'note' ? 'active' : ''} onClick={() => updateCardType('note')}>メモ</button>
        <button type="button" className={draft.cardType === 'checklist' ? 'active' : ''} onClick={() => updateCardType('checklist')}>リスト</button>
        <button type="button" className={draft.cardType === 'schedule' ? 'active' : ''} onClick={() => updateCardType('schedule')}>予定</button>
      </div>

      <label className="board-select">
        <span>貼るボード</span>
        <select value={draft.boardId} onChange={(event) => setDraft(current => ({ ...current, boardId: event.target.value }))}>
          {boards.map(board => (
            <option key={board.id} value={board.id}>{board.label}</option>
          ))}
        </select>
      </label>

      <div className="flag-grid">
        <ToggleButton label="ピン留め" active={draft.pinned} onClick={() => setDraft(current => ({ ...current, pinned: !current.pinned }))} />
        <ToggleButton label="今日のメモ" active={draft.isToday} onClick={() => setDraft(current => ({ ...current, isToday: !current.isToday }))} />
        <ToggleButton label="完了" active={draft.completed} onClick={() => setDraft(current => ({ ...current, completed: !current.completed }))} />
      </div>

      <div className="reminder-field">
        <label>
          <span>
            <Clock size={16} />
            リマインダー
          </span>
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(draft.reminderAt)}
            onChange={(event) => setDraft(current => ({ ...current, reminderAt: fromDatetimeLocalValue(event.target.value) }))}
          />
        </label>
        <button
          type="button"
          onClick={() => setDraft(current => ({ ...current, reminderAt: null }))}
          disabled={!draft.reminderAt}
        >
          解除
        </button>
      </div>
    </div>
  );
}

function MemoCreatePage({
  boards,
  draft,
  stickyTextSize,
  stickyTextWeight,
  setDraft,
  onBack,
  onSave,
  onShowToast
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [selectedStickerId, setSelectedStickerId] = useState('');
  const [movingStickerId, setMovingStickerId] = useState('');
  const [draggingSticker, setDraggingSticker] = useState(null);
  const [photoToolsOpen, setPhotoToolsOpen] = useState(true);
  const primaryInputRef = useRef(null);
  const titleInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const createCardRef = useRef(null);
  const photoPointersRef = useRef(new globalThis.Map());
  const photoGestureRef = useRef(null);
  const checklistInputRefs = useRef({});
  const pendingFocusId = useRef(null);
  const canSave = draft.cardType === 'photo'
    ? Boolean(draft.photoDataUrl || draft.caption.trim() || draft.title.trim())
    : draft.cardType === 'schedule'
      ? Boolean(draft.title.trim() || draft.scheduleDate || draft.scheduleTime || draft.schedulePlace || draft.stickers.length)
      : draft.cardType === 'link'
        ? draft.linkUrl.trim().length > 0
        : draft.cardType === 'checklist'
          ? draft.title.trim().length > 0 || draft.checklist.some(item => item.text.trim()) || draft.stickers.length > 0
          : draft.title.trim().length > 0 || draft.text.trim().length > 0 || draft.stickers.length > 0;
  const firstChecklistItem = draft.checklist[0] || null;
  const selectedPaletteColor = draft.cardType === 'photo' ? draft.tapeColor : draft.color;
  const paletteLabel = draft.cardType === 'photo' ? 'マステ色' : 'メモ色';
  const createCardStyle = {
    '--memo-tape-color': getTapeColor(draft.cardType === 'photo' ? draft.tapeColor : draft.color),
    '--photo-tape-color': getTapeColor(draft.tapeColor || draft.color)
  };

  const resizeChecklistTextarea = (element) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    if (!pendingFocusId.current) return;
    if (pendingFocusId.current === 'title') {
      titleInputRef.current?.focus();
    } else if (pendingFocusId.current === draft.checklist[0]?.id) {
      primaryInputRef.current?.focus();
    } else {
      checklistInputRefs.current[pendingFocusId.current]?.focus();
    }
    pendingFocusId.current = null;
  }, [draft.checklist]);

  useEffect(() => {
    if (draft.cardType !== 'checklist') return;
    resizeChecklistTextarea(primaryInputRef.current);
    Object.values(checklistInputRefs.current).forEach(resizeChecklistTextarea);
  }, [draft.cardType, draft.checklist]);

  const updateCardType = (cardType) => {
    setDraft(current => ({
      ...current,
      cardType,
      type: cardType === 'checklist' ? 'checklist' : 'note',
      checklist: cardType === 'checklist'
        ? (current.checklist.length ? current.checklist : [createChecklistItem()])
        : current.checklist,
      color: cardType === 'photo' ? 'white' : (current.color === 'white' ? 'green' : current.color),
      tapeColor: cardType === 'photo' ? (current.tapeColor || current.color || 'yellow') : current.tapeColor
    }));
  };

  const updateChecklistItem = (id, patch) => {
    setDraft(current => ({
      ...current,
      checklist: current.checklist.map(item => item.id === id ? { ...item, ...patch } : item)
    }));
  };

  const addChecklistItem = () => {
    const nextItem = createChecklistItem();
    pendingFocusId.current = nextItem.id;
    setDraft(current => ({
      ...current,
      checklist: [...current.checklist, nextItem]
    }));
  };

  const removeChecklistItem = (id) => {
    setDraft(current => {
      const index = current.checklist.findIndex(item => item.id === id);
      const nextChecklist = current.checklist.filter(item => item.id !== id);
      const nextFocus = nextChecklist[Math.max(0, index - 1)] || nextChecklist[0];
      pendingFocusId.current = nextFocus?.id || 'title';
      return {
        ...current,
        checklist: nextChecklist
      };
    });
  };

  const handleChecklistBackspace = (event, item) => {
    if (event.key !== 'Backspace') return;

    const nativeEvent = event.nativeEvent || {};
    if (nativeEvent.isComposing || nativeEvent.keyCode === 229) return;

    const target = event.currentTarget;
    const hasSelection = target.selectionStart !== target.selectionEnd;
    if (hasSelection || target.value.length > 0) return;

    event.preventDefault();
    removeChecklistItem(item.id);
  };

  const handleChecklistEnter = (event) => {
    const nativeEvent = event.nativeEvent || {};
    if (nativeEvent.isComposing || nativeEvent.keyCode === 229) return false;
    if (event.key !== 'Enter') return false;
    event.preventDefault();
    addChecklistItem();
    return true;
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageBusy(true);
    try {
      const image = await resizeImageFile(file);
      logImageCompressionDebug('写真', image);
      setDraft(current => ({
        ...current,
        photoDataUrl: image.dataUrl,
        caption: current.caption || current.title,
        photoCropRatio: 'custom',
        photoZoom: 1,
        photoOffsetX: 0,
        photoOffsetY: 0,
        photoRotation: 0,
        photoAspectRatio: image.aspectRatio,
        photoFrameRatio: image.aspectRatio
      }));
      onShowToast?.(formatCompressionMessage('写真', image));
      setPhotoToolsOpen(false);
    } finally {
      setImageBusy(false);
      event.target.value = '';
    }
  };

  const removePhoto = () => {
    setDraft(current => ({
      ...current,
      photoDataUrl: '',
      photoZoom: 1,
      photoOffsetX: 0,
      photoOffsetY: 0,
      photoRotation: 0,
      photoFrameRatio: current.photoAspectRatio || 1
    }));
  };

  const updatePhotoCrop = (patch) => {
    setDraft(current => ({
      ...current,
      ...patch
    }));
  };

  const resetPhotoGesture = () => {
    const pointers = [...photoPointersRef.current.values()];
    if (pointers.length === 1) {
      const [pointer] = pointers;
      photoGestureRef.current = {
        mode: 'drag',
        startX: pointer.clientX,
        startY: pointer.clientY,
        offsetX: draft.photoOffsetX,
        offsetY: draft.photoOffsetY
      };
      return;
    }

    if (pointers.length >= 2) {
      const [first, second] = pointers;
      photoGestureRef.current = {
        mode: 'pinch',
        distance: getPointerDistance(first, second),
        angle: getPointerAngle(first, second),
        center: getPointerCenter(first, second),
        zoom: draft.photoZoom,
        rotation: draft.photoRotation,
        offsetX: draft.photoOffsetX,
        offsetY: draft.photoOffsetY
      };
      return;
    }

    photoGestureRef.current = null;
  };

  const startPhotoDrag = (event) => {
    if (!draft.photoDataUrl) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    photoPointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    resetPhotoGesture();
  };

  const movePhotoDrag = (event) => {
    if (!photoPointersRef.current.has(event.pointerId)) return;
    photoPointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    const gesture = photoGestureRef.current;
    if (!gesture) return;

    const pointers = [...photoPointersRef.current.values()];
    if (gesture.mode === 'drag' && pointers.length === 1) {
      const [pointer] = pointers;
      updatePhotoCrop({
        photoOffsetX: clamp(gesture.offsetX + pointer.clientX - gesture.startX, -160, 160),
        photoOffsetY: clamp(gesture.offsetY + pointer.clientY - gesture.startY, -160, 160)
      });
      return;
    }

    if (gesture.mode === 'pinch' && pointers.length >= 2) {
      const [first, second] = pointers;
      const distance = getPointerDistance(first, second);
      const center = getPointerCenter(first, second);
      updatePhotoCrop({
        photoZoom: clamp(gesture.zoom * (distance / Math.max(gesture.distance, 1)), 1, 4),
        photoRotation: clamp(gesture.rotation + getPointerAngle(first, second) - gesture.angle, -35, 35),
        photoOffsetX: clamp(gesture.offsetX + center.x - gesture.center.x, -160, 160),
        photoOffsetY: clamp(gesture.offsetY + center.y - gesture.center.y, -160, 160)
      });
    }
  };

  const stopPhotoDrag = (event) => {
    photoPointersRef.current.delete(event.pointerId);
    resetPhotoGesture();
  };

  const addSticker = (assetId, position = {}) => {
    const sticker = createSticker(assetId, position);
    setDraft(current => ({
      ...current,
      stickers: [...current.stickers, sticker]
    }));
    setSelectedStickerId(sticker.id);
  };

  const getStickerPositionFromPoint = (clientX, clientY) => {
    if (!createCardRef.current) return { x: 50, y: 62 };
    const rect = createCardRef.current.getBoundingClientRect();
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 6, 94),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 10, 92)
    };
  };

  const getStickerPositionFromEvent = (event) => getStickerPositionFromPoint(event.clientX, event.clientY);

  const isPointInsideCreateCard = (clientX, clientY) => {
    if (!createCardRef.current) return false;
    const rect = createCardRef.current.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  };

  const startStickerMove = (event, sticker) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedStickerId(sticker.id);
    setMovingStickerId(sticker.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = createCardRef.current?.getBoundingClientRect();
    const stickerCenter = rect
      ? {
        x: rect.left + (sticker.x / 100) * rect.width,
        y: rect.top + (sticker.y / 100) * rect.height
      }
      : { x: event.clientX, y: event.clientY };
    const grabOffset = {
      x: event.clientX - stickerCenter.x,
      y: event.clientY - stickerCenter.y
    };

    const moveSticker = (moveEvent) => {
      const position = getStickerPositionFromPoint(
        moveEvent.clientX - grabOffset.x,
        moveEvent.clientY - grabOffset.y
      );
      setDraft(current => ({
        ...current,
        stickers: current.stickers.map(item => (
          item.id === sticker.id ? { ...item, ...position } : item
        ))
      }));
    };

    const stopStickerMove = () => {
      setMovingStickerId('');
      window.removeEventListener('pointermove', moveSticker);
      window.removeEventListener('pointerup', stopStickerMove);
      window.removeEventListener('pointercancel', stopStickerMove);
    };

    window.addEventListener('pointermove', moveSticker);
    window.addEventListener('pointerup', stopStickerMove);
    window.addEventListener('pointercancel', stopStickerMove);
  };

  const startStickerAdd = (event, assetId) => {
    if (draft.cardType === 'photo' || !STICKER_MAP[assetId]) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedStickerId('');
    setDraggingSticker({ assetId, x: event.clientX, y: event.clientY });

    const moveStickerPreview = (moveEvent) => {
      setDraggingSticker({ assetId, x: moveEvent.clientX, y: moveEvent.clientY });
    };

    const stopStickerAdd = (upEvent) => {
      if (isPointInsideCreateCard(upEvent.clientX, upEvent.clientY)) {
        addSticker(assetId, getStickerPositionFromPoint(upEvent.clientX, upEvent.clientY));
      }
      setDraggingSticker(null);
      window.removeEventListener('pointermove', moveStickerPreview);
      window.removeEventListener('pointerup', stopStickerAdd);
      window.removeEventListener('pointercancel', stopStickerAdd);
    };

    window.addEventListener('pointermove', moveStickerPreview);
    window.addEventListener('pointerup', stopStickerAdd);
    window.addEventListener('pointercancel', stopStickerAdd);
  };

  const dropSticker = (event) => {
    const assetId = event.dataTransfer.getData('text/plain');
    if (!STICKER_MAP[assetId]) return;
    event.preventDefault();
    addSticker(assetId, getStickerPositionFromEvent(event));
  };

  const deleteSticker = (id) => {
    setDraft(current => ({
      ...current,
      stickers: current.stickers.filter(sticker => sticker.id !== id)
    }));
    setSelectedStickerId(current => current === id ? '' : current);
  };

  const cleanAndSave = () => {
    const nextDraft = normalizeMemo({
      ...draft,
      linkUrl: draft.cardType === 'link' ? normalizeLinkUrl(draft.linkUrl) : draft.linkUrl,
      linkTitle: draft.cardType === 'link' ? (draft.linkTitle.trim() || getLinkHost(draft.linkUrl)) : draft.linkTitle,
      checklist: draft.cardType === 'checklist'
        ? draft.checklist
        : draft.checklist.filter(item => item.text.trim())
    });
    onSave(nextDraft);
  };

  return (
    <section
      className="create-page"
      onPointerDown={(event) => {
        if (
          draft.cardType === 'photo'
          && draft.photoDataUrl
          && !event.target.closest('.photo-picker')
          && !event.target.closest('.photo-tools')
        ) {
          setPhotoToolsOpen(false);
        }
      }}
    >
      <header className="create-topbar">
        <button type="button" className="create-nav-button" onClick={onBack} aria-label="ホームへ戻る">
          <ArrowLeft size={34} strokeWidth={2.4} />
        </button>
        <h1 className="create-title">{draft.cardType === 'photo' ? '写真カード' : draft.cardType === 'schedule' ? '予定カード' : draft.cardType === 'link' ? 'リンクカード' : 'やることリスト'}</h1>
        {ENABLE_CREATE_SETTINGS_PANEL ? (
          <button
            type="button"
            className="create-nav-button"
            onClick={() => setSettingsOpen(current => !current)}
            aria-label="詳細設定"
            aria-expanded={settingsOpen}
          >
            <MoreHorizontal size={32} strokeWidth={3} />
          </button>
        ) : (
          <span className="create-nav-spacer" aria-hidden="true" />
        )}
      </header>

      <StickyNoteCard
        as="section"
        mode="edit"
        ref={createCardRef}
        color={draft.color}
        cardType={draft.cardType}
        textSize={stickyTextSize}
        textWeight={stickyTextWeight}
        className={`create-card create-${draft.cardType}`}
        style={createCardStyle}
        onDragOver={(event) => draft.cardType !== 'photo' && event.preventDefault()}
        onDrop={(event) => draft.cardType !== 'photo' && dropSticker(event)}
        stickerLayer={draft.cardType !== 'photo' ? (
          <StickerLayer
            stickers={draft.stickers}
            onStickerPointerDown={startStickerMove}
            selectedStickerId={selectedStickerId}
            movingStickerId={movingStickerId}
            onDeleteSticker={deleteSticker}
          />
        ) : null}
      >
        {draft.cardType !== 'photo' && (
          <input
            ref={titleInputRef}
            className="memo-title-input"
            type="text"
            value={draft.title}
            placeholder="見出し"
            aria-label="メモの見出し"
            onChange={(event) => setDraft(current => ({ ...current, title: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                primaryInputRef.current?.focus();
              }
            }}
          />
        )}

        {draft.cardType === 'photo' ? (
          <div className="photo-editor">
            <div
              className={`photo-picker photo-crop-frame ${getPhotoCropClass(draft.photoCropRatio)}`}
              style={{ '--photo-frame-ratio': getPhotoFrameRatio(draft) }}
              role="button"
              tabIndex={0}
              aria-label={draft.photoDataUrl ? '写真の切り抜き位置を調整' : '写真を選ぶ'}
              onClick={() => {
                if (draft.photoDataUrl) {
                  setPhotoToolsOpen(true);
                } else {
                  photoInputRef.current?.click();
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (!draft.photoDataUrl) photoInputRef.current?.click();
                }
              }}
              onPointerDown={startPhotoDrag}
              onPointerMove={movePhotoDrag}
              onPointerUp={stopPhotoDrag}
              onPointerCancel={stopPhotoDrag}
            >
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} />
              {draft.photoDataUrl ? (
                <>
                  <img src={draft.photoDataUrl} alt="選択した写真" style={getPhotoImageStyle(draft)} draggable="false" />
                </>
              ) : (
                <span><ImagePlus size={28} />{imageBusy ? '読み込み中' : '写真を選ぶ'}</span>
              )}
            </div>
            {draft.photoDataUrl && photoToolsOpen && (
              <div className="photo-tools" aria-label="写真操作">
                <div className="photo-tool-actions">
                  <button type="button" onClick={() => photoInputRef.current?.click()}>差し替え</button>
                  <button type="button" onClick={removePhoto}>削除</button>
                </div>
              </div>
            )}
            <input
              ref={primaryInputRef}
              type="text"
              value={draft.caption}
              placeholder="キャプション"
              aria-label="写真のキャプション"
              onChange={(event) => setDraft(current => ({ ...current, caption: event.target.value }))}
            />
          </div>
        ) : draft.cardType === 'link' ? (
          <div className="link-editor">
            <label>
              <LinkIcon size={17} />
              <input
                ref={primaryInputRef}
                type="url"
                value={draft.linkUrl}
                placeholder="https://example.com"
                aria-label="リンクURL"
                onChange={(event) => setDraft(current => ({
                  ...current,
                  linkUrl: event.target.value,
                  linkTitle: current.linkTitle || getLinkHost(event.target.value)
                }))}
                onBlur={(event) => setDraft(current => ({
                  ...current,
                  linkUrl: normalizeLinkUrl(event.target.value),
                  linkTitle: current.linkTitle || getLinkHost(event.target.value)
                }))}
              />
            </label>
            <input
              type="text"
              value={draft.linkTitle}
              placeholder="リンクのタイトル"
              aria-label="リンクタイトル"
              onChange={(event) => setDraft(current => ({ ...current, linkTitle: event.target.value }))}
            />
          </div>
        ) : draft.cardType === 'schedule' ? (
          <div className="schedule-editor">
            <label>
              <CalendarDays size={16} />
              <input
                ref={primaryInputRef}
                type="date"
                value={draft.scheduleDate}
                onChange={(event) => setDraft(current => ({ ...current, scheduleDate: event.target.value }))}
                aria-label="日付"
              />
            </label>
            <label>
              <Clock size={16} />
              <input
                type="time"
                value={draft.scheduleTime}
                onChange={(event) => setDraft(current => ({ ...current, scheduleTime: event.target.value }))}
                aria-label="時間"
              />
            </label>
            <input
              type="text"
              value={draft.schedulePlace}
              placeholder="場所"
              aria-label="場所"
              onChange={(event) => setDraft(current => ({ ...current, schedulePlace: event.target.value }))}
            />
          </div>
        ) : draft.cardType === 'note' ? (
          <textarea
            ref={primaryInputRef}
            value={draft.text}
            placeholder=""
            aria-label="メモ本文"
            onChange={(event) => setDraft(current => ({ ...current, text: event.target.value }))}
          />
        ) : (
          <div className="checklist-form">
            {firstChecklistItem ? (
              <label className="checklist-form-row">
                <input
                  type="checkbox"
                  checked={firstChecklistItem.completed}
                  onChange={(event) => updateChecklistItem(firstChecklistItem.id, { completed: event.target.checked })}
                  aria-label="1行目を完了"
                />
                <textarea
                  ref={primaryInputRef}
                  rows={1}
                  value={firstChecklistItem.text}
                  placeholder=""
                  aria-label="やること"
                  onChange={(event) => {
                    resizeChecklistTextarea(event.currentTarget);
                    updateChecklistItem(firstChecklistItem.id, { text: event.target.value });
                  }}
                  onKeyDown={(event) => {
                    if (handleChecklistEnter(event)) return;
                    handleChecklistBackspace(event, firstChecklistItem);
                  }}
                />
              </label>
            ) : (
              <button type="button" className="checklist-add-empty" onClick={addChecklistItem}>
                <Plus size={18} />
                項目を追加
              </button>
            )}
            {draft.checklist.slice(1).map((item, index) => (
              <label key={item.id} className="checklist-form-row is-secondary">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={(event) => updateChecklistItem(item.id, { completed: event.target.checked })}
                  aria-label={`${index + 2}行目を完了`}
                />
                <textarea
                  ref={(element) => {
                    if (element) {
                      checklistInputRefs.current[item.id] = element;
                    } else {
                      delete checklistInputRefs.current[item.id];
                    }
                  }}
                  rows={1}
                  value={item.text}
                  placeholder=""
                  aria-label={`${index + 2}行目のやること`}
                  onChange={(event) => {
                    resizeChecklistTextarea(event.currentTarget);
                    updateChecklistItem(item.id, { text: event.target.value });
                  }}
                  onKeyDown={(event) => {
                    if (handleChecklistEnter(event)) return;
                    handleChecklistBackspace(event, item);
                  }}
                />
              </label>
            ))}
          </div>
        )}
      </StickyNoteCard>

      <section className="memo-options">
        <div className="color-row" aria-label={paletteLabel}>
          {COLOR_OPTIONS.map(color => (
            <button
              key={color.id}
              type="button"
              className={`${color.className} ${selectedPaletteColor === color.id ? 'selected' : ''}`}
              onClick={() => setDraft(current => (
                current.cardType === 'photo'
                  ? { ...current, tapeColor: color.id }
                  : { ...current, color: color.id }
              ))}
              aria-label={draft.cardType === 'photo' ? `${color.label}のマステ` : color.label}
            />
          ))}
        </div>

        {draft.cardType !== 'photo' && (
          <div className="sticker-palette" aria-label="スタンプ">
            {STICKER_OPTIONS.map(sticker => (
              <button
                key={sticker.id}
                type="button"
                draggable={false}
                onPointerDown={(event) => startStickerAdd(event, sticker.id)}
                aria-label={`${sticker.label}を追加`}
              >
                <img src={sticker.src} alt="" draggable={false} />
              </button>
            ))}
          </div>
        )}

        {ENABLE_CREATE_SETTINGS_PANEL && settingsOpen && (
          <SettingsPanel
            boards={boards}
            draft={draft}
            setDraft={setDraft}
            updateCardType={updateCardType}
          />
        )}
      </section>

      {draggingSticker && STICKER_MAP[draggingSticker.assetId] && (
        <div
          className="sticker-drag-preview"
          style={{ left: `${draggingSticker.x}px`, top: `${draggingSticker.y}px` }}
          aria-hidden="true"
        >
          <img src={STICKER_MAP[draggingSticker.assetId].src} alt="" />
        </div>
      )}

      <footer className="create-actions">
        <button type="button" onClick={cleanAndSave} disabled={!canSave || imageBusy}>
          <Check size={23} strokeWidth={2.6} />
          ホームに追加
        </button>
      </footer>
    </section>
  );
}

function SearchSheet({ boards, memos, boardItems = [], onClose, onOpenMemo }) {
  const [query, setQuery] = useState('');
  const boardById = useMemo(() => Object.fromEntries(boards.map(board => [board.id, board])), [boards]);
  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return { memos: [], items: [] };
    const memoResults = memos
      .filter(memo => {
        const board = boardById[memo.boardId];
        if (!isBoardVisibleInLibrary(board) || memo.archived) return false;
        return getMemoSearchText(memo, board).includes(normalizedQuery);
      })
      .slice(0, 24);
    const itemResults = boardItems
      .filter(item => {
        const board = boardById[item.boardId];
        if (!isBoardVisibleInLibrary(board) || item.archived) return false;
        return getBoardItemSearchText(item, board).includes(normalizedQuery);
      })
      .slice(0, 12);
    return { memos: memoResults, items: itemResults };
  }, [boardById, boardItems, memos, query]);

  return (
    <div className="search-sheet" role="dialog" aria-label="検索">
      <button type="button" className="sheet-close" onClick={onClose} aria-label="閉じる">
        <X size={20} />
      </button>
      <p>検索</p>
      <label className="search-field">
        <Search size={18} />
        <input
          autoFocus
          value={query}
          placeholder="メモ、写真、予定を探す"
          aria-label="検索キーワード"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="compact-list">
        {query.trim() && results.memos.length === 0 && results.items.length === 0 && <span className="list-empty-text">見つかりませんでした</span>}
        {results.memos.map(memo => (
          <MemoResultRow
            key={memo.id}
            memo={memo}
            board={boardById[memo.boardId]}
            onOpen={() => onOpenMemo(memo)}
          />
        ))}
        {results.items.map(item => (
          <div key={item.id} className="memo-result-row is-static">
            <span>{item.type === 'image' ? '画像' : '文字'}</span>
            <strong>{item.type === 'image' ? '画像' : item.text}</strong>
            <small>{boardById[item.boardId]?.label || 'ボードなし'}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationSheet({ notifications, undoAction, onUndo, onClose, onOpenBoard }) {
  return (
    <div className="notification-sheet" role="dialog" aria-label="通知">
      <button type="button" className="sheet-close" onClick={onClose} aria-label="閉じる">
        <X size={20} />
      </button>
      <p>通知</p>
      {undoAction && (
        <button type="button" className="notification-row" onClick={onUndo}>
          <RotateCcw size={18} />
          <span>
            <strong>戻せます</strong>
            <small>{undoAction.label}</small>
          </span>
        </button>
      )}
      {notifications.length === 0 && !undoAction && <span className="list-empty-text">通知はありません</span>}
      {notifications.map(item => (
        <button
          key={item.id}
          type="button"
          className="notification-row"
          onClick={() => item.boardId ? onOpenBoard(item.boardId) : undefined}
        >
          <Bell size={18} />
          <span>
            <strong>{item.title}</strong>
            <small>{item.body}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function MemoResultRow({ memo, board, onOpen }) {
  return (
    <button type="button" className="memo-result-row" onClick={onOpen}>
      <span>{getMemoKindLabel(memo)}</span>
      <strong>{getMemoPrimaryText(memo)}</strong>
      <small>{board?.label || 'ボードなし'}</small>
    </button>
  );
}

function MemoListPage({ title, memos, boards, onBack, onOpen, onArchive }) {
  const boardById = useMemo(() => Object.fromEntries(boards.map(board => [board.id, board])), [boards]);
  return (
    <section className="list-page">
      <SimplePageHeader title={title} eyebrow="カード" onBack={onBack} />
      <div className="plain-list">
        {memos.length === 0 && <p className="list-empty-text">まだありません</p>}
        {memos.map(memo => (
          <article key={memo.id} className="list-item-card">
            <button type="button" onClick={() => onOpen(memo)}>
              <span>{getMemoKindLabel(memo)} / {boardById[memo.boardId]?.label || 'ボードなし'}</span>
              <strong>{getMemoPrimaryText(memo)}</strong>
            </button>
            <button type="button" className="subtle-action" onClick={() => onArchive(memo.id)}>アーカイブ</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function PhotoListPage({ memos, boards, onBack, onOpen, onArchive }) {
  const boardById = useMemo(() => Object.fromEntries(boards.map(board => [board.id, board])), [boards]);
  return (
    <section className="list-page">
      <SimplePageHeader title="写真一覧" eyebrow="アルバム" onBack={onBack} />
      <div className="photo-grid-list">
        {memos.length === 0 && <p className="list-empty-text">写真はまだありません</p>}
        {memos.map(memo => (
          <article key={memo.id} className="photo-list-card">
            <button type="button" onClick={() => onOpen(memo)}>
              {memo.photoDataUrl ? <img src={memo.photoDataUrl} alt={memo.caption || '写真'} /> : <Camera size={28} />}
              <strong>{getMemoPrimaryText(memo)}</strong>
              <small>{boardById[memo.boardId]?.label || 'ボードなし'}</small>
            </button>
            <button type="button" className="subtle-action" onClick={() => onArchive(memo.id)}>アーカイブ</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function SettingsPage({
  appTitle,
  stickyTextSize,
  stickyTextWeight,
  storageBreakdown,
  storageEstimate,
  onBack,
  onUpdateAppTitle,
  onUpdateStickyTextSettings,
  onRequestNotifications,
  onExportBackup,
  onImportBackup
}) {
  const [title, setTitle] = useState(appTitle);
  const backupInputRef = useRef(null);
  const quota = LOCAL_STORAGE_QUOTA_BYTES;
  const remaining = Math.max(0, quota - storageBreakdown.total);
  const browserQuota = storageEstimate?.quota || 0;
  const imagePercent = storageBreakdown.total
    ? Math.round((storageBreakdown.imageTotal / storageBreakdown.total) * 100)
    : 0;

  const saveTitle = () => {
    onUpdateAppTitle(title);
  };

  return (
    <section className="list-page">
      <SimplePageHeader title="設定" eyebrow="アプリ" onBack={onBack} />
      <div className="settings-card">
        <label>
          <span>タイトル</span>
          <input
            value={title}
            aria-label="アプリタイトル"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          />
        </label>
        <button type="button" className="subtle-action settings-wide-action" onClick={onRequestNotifications}>
          ブラウザ通知を許可
        </button>
      </div>

      <div className="settings-card sticky-display-card">
        <strong>付箋の表示</strong>
        <div className="setting-segment-group">
          <span>付箋の文字サイズ</span>
          <div className="setting-segments" role="group" aria-label="付箋の文字サイズ">
            {STICKY_TEXT_SIZE_OPTIONS.map(option => (
              <button
                key={option.id}
                type="button"
                className={stickyTextSize === option.id ? 'active' : ''}
                onClick={() => onUpdateStickyTextSettings({ stickyTextSize: option.id })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-segment-group">
          <span>文字の太さ</span>
          <div className="setting-segments" role="group" aria-label="文字の太さ">
            {STICKY_TEXT_WEIGHT_OPTIONS.map(option => (
              <button
                key={option.id}
                type="button"
                className={stickyTextWeight === option.id ? 'active' : ''}
                onClick={() => onUpdateStickyTextSettings({ stickyTextWeight: option.id })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-card storage-info-card">
        <strong>保存容量</strong>
        <div className="storage-meter" aria-label="保存容量">
          <span style={{ width: `${Math.min(100, (storageBreakdown.total / quota) * 100)}%` }} />
        </div>
        <dl className="storage-stats">
          <div><dt>現在の使用容量</dt><dd>{formatBytes(storageBreakdown.total)}</dd></div>
          <div><dt>残り容量の目安</dt><dd>{formatBytes(remaining)}</dd></div>
          <div><dt>写真・画像の割合</dt><dd>{imagePercent}%</dd></div>
          {browserQuota > quota && (
            <div><dt>ブラウザ全体の保存枠</dt><dd>{formatBytes(browserQuota)}</dd></div>
          )}
        </dl>
        <div className="storage-breakdown">
          <span>写真カード <b>{formatBytes(storageBreakdown.photoCards)}</b></span>
          <span>日記写真 <b>{formatBytes(storageBreakdown.diaryPhotos)}</b></span>
          <span>ボード画像 <b>{formatBytes(storageBreakdown.boardImages)}</b></span>
          <span>ボードスクショ <b>{formatBytes(storageBreakdown.boardSnapshots)}</b></span>
          <span>その他 <b>{formatBytes(storageBreakdown.other)}</b></span>
        </div>
      </div>

      <div className="settings-card backup-card">
        <strong>バックアップ</strong>
        <p>メモ、写真、日記、ボード、設定をJSONファイルにまとめます。</p>
        <div className="backup-actions">
          <button type="button" className="subtle-action" onClick={onExportBackup}>
            バックアップを書き出す
          </button>
          <button type="button" className="subtle-action" onClick={() => backupInputRef.current?.click()}>
            バックアップを読み込む
          </button>
        </div>
        <input
          ref={backupInputRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden-file"
          onChange={async (event) => {
            await onImportBackup(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
    </section>
  );
}

function DiaryPage({ boards, records, onBack, onUpdateRecord, onAttachBoardSnapshot, onShowToast }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [pasteOpen, setPasteOpen] = useState(false);
  const fileInputRef = useRef(null);
  const dateKey = toDateKey(selectedDate);
  const record = records[dateKey] || { text: '', photos: [], boards: [] };
  const boardChoices = boards;

  const updateText = (text) => {
    onUpdateRecord(dateKey, { ...record, text });
  };

  const updatePhotos = (photos) => {
    onUpdateRecord(dateKey, { ...record, photos });
  };

  const updateBoards = (nextBoards) => {
    onUpdateRecord(dateKey, { ...record, boards: nextBoards });
  };

  const addDiaryPhotos = async (files) => {
    const nextPhotos = [];
    let originalBytes = 0;
    let compressedBytes = 0;
    for (const file of files) {
      const image = await compressImageFile(file, { preserveTransparency: false, maxLongSide: 1200 });
      logImageCompressionDebug('日記写真', image);
      originalBytes += image.originalBytes || 0;
      compressedBytes += image.compressedBytes || 0;
      nextPhotos.push({
        id: crypto.randomUUID(),
        url: image.dataUrl,
        comment: '',
        originalBytes: image.originalBytes,
        compressedBytes: image.compressedBytes,
        mimeType: image.mimeType
      });
    }
    if (nextPhotos.length > 0) {
      onShowToast?.(formatCompressionMessage('日記写真', { originalBytes, compressedBytes }));
    }
    updatePhotos([...(record.photos || []), ...nextPhotos]);
  };

  return (
    <section className="list-page diary-page">
      <SimplePageHeader title="日記" eyebrow="きょうの記録" onBack={onBack} />
      <div className="diary-date-row">
        <button type="button" onClick={() => setSelectedDate(current => addDays(current, -1))}>‹</button>
        <strong>{dateKey}</strong>
        <button type="button" onClick={() => setSelectedDate(current => addDays(current, 1))}>›</button>
      </div>

      <section className="diary-card">
        <label>
          <span>ひとこと日記</span>
          <textarea
            value={record.text || ''}
            placeholder="今日はどんな日だった？"
            onChange={(event) => updateText(event.target.value)}
          />
        </label>
      </section>

      <section className="diary-card">
        <div className="diary-section-title">
          <span>思い出の写真</span>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={17} />
            追加
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="visually-hidden-file"
          onChange={async (event) => {
            await addDiaryPhotos(Array.from(event.target.files || []));
            event.target.value = '';
          }}
        />
        <div className="diary-photo-list">
          {(record.photos || []).map((photo, index) => (
            <article key={photo.id || index} className="diary-photo-card">
              <img src={photo.url} alt="" />
              <input
                value={photo.comment || ''}
                placeholder="コメント"
                onChange={(event) => {
                  const nextPhotos = [...(record.photos || [])];
                  nextPhotos[index] = { ...photo, comment: event.target.value };
                  updatePhotos(nextPhotos);
                }}
              />
              <button
                type="button"
                onClick={() => updatePhotos((record.photos || []).filter((_, photoIndex) => photoIndex !== index))}
              >
                削除
              </button>
            </article>
          ))}
          {(record.photos || []).length === 0 && <p className="list-empty-text">写真はまだありません</p>}
        </div>
      </section>

      <section className="diary-card">
        <div className="diary-section-title">
          <span>貼り付けたボード</span>
          <button type="button" onClick={() => setPasteOpen(current => !current)}>
            <ImagePlus size={17} />
            ボードを貼る
          </button>
        </div>
        <div className="diary-board-snapshot-list">
          {(record.boards || []).map(snapshot => (
            <article key={snapshot.id} className="diary-board-snapshot-card">
              <img src={snapshot.snapshotDataUrl} alt={`${snapshot.label}のスクショ`} />
              <div>
                <strong>{snapshot.label}{snapshot.archived ? '（アーカイブ）' : ''}</strong>
                <span>{formatDiaryCapturedAt(snapshot.capturedAt)}</span>
                <small>
                  メモ {snapshot.memoCount} / 写真 {snapshot.photoCount} / アイテム {snapshot.itemCount}
                </small>
              </div>
              <button
                type="button"
                onClick={() => updateBoards((record.boards || []).filter(item => item.id !== snapshot.id))}
              >
                削除
              </button>
            </article>
          ))}
          {(record.boards || []).length === 0 && <p className="list-empty-text">貼り付けたボードはまだありません</p>}
        </div>
      </section>

      {pasteOpen && (
        <div className="diary-board-sheet" role="dialog" aria-label="貼り付けるボード">
          <button type="button" className="sheet-close" onClick={() => setPasteOpen(false)} aria-label="閉じる">
            <X size={20} />
          </button>
          <p>貼り付けるボード</p>
          {boardChoices.map(board => (
            <button key={board.id} type="button" onClick={() => {
              onAttachBoardSnapshot(dateKey, board.id);
              setPasteOpen(false);
            }}>
              {board.label}{board.archived ? '（アーカイブ）' : ''}
            </button>
          ))}
          {boardChoices.length === 0 && <span className="diary-sheet-empty">貼れるボードがありません</span>}
        </div>
      )}
    </section>
  );
}

function TimeCapsulePage({ boards, onBack, onUpdateBoard }) {
  return (
    <section className="list-page">
      <SimplePageHeader title="タイムカプセル" eyebrow="ボード予約" onBack={onBack} />
      <div className="plain-list">
        {boards.map(board => (
          <article key={board.id} className="list-item-card time-capsule-card">
            <div>
              <span>{getBoardOpenLabel(board)}</span>
              <strong>{board.label}</strong>
            </div>
            <label>
              <span>公開日時</span>
              <input
                type="datetime-local"
                value={toDatetimeLocalValue(board.timeCapsuleAt)}
                onChange={(event) => onUpdateBoard(board.id, {
                  isTimeCapsule: Boolean(event.target.value),
                  timeCapsuleAt: fromDatetimeLocalValue(event.target.value)
                })}
              />
            </label>
            <button
              type="button"
              className="subtle-action"
              onClick={() => onUpdateBoard(board.id, { isTimeCapsule: false, timeCapsuleAt: null })}
              disabled={!board.isTimeCapsule}
            >
              解除
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ArchivePage({ boards, memos, onBack, onRestoreMemo, onRestoreBoard }) {
  const [tab, setTab] = useState('memos');
  const archivedMemos = memos.filter(memo => memo.archived && memo.cardType !== 'photo');
  const archivedPhotos = memos.filter(memo => memo.archived && memo.cardType === 'photo');
  const archivedBoards = boards.filter(board => board.archived);

  return (
    <section className="list-page">
      <SimplePageHeader title="アーカイブ" eyebrow="復元" onBack={onBack} />
      <div className="archive-tabs" aria-label="アーカイブ種別">
        <button type="button" className={tab === 'memos' ? 'active' : ''} onClick={() => setTab('memos')}>メモ</button>
        <button type="button" className={tab === 'photos' ? 'active' : ''} onClick={() => setTab('photos')}>写真</button>
        <button type="button" className={tab === 'boards' ? 'active' : ''} onClick={() => setTab('boards')}>ボード</button>
      </div>
      <div className="plain-list">
        {tab === 'memos' && archivedMemos.length === 0 && <p className="list-empty-text">アーカイブ済みメモはありません</p>}
        {tab === 'photos' && archivedPhotos.length === 0 && <p className="list-empty-text">アーカイブ済み写真はありません</p>}
        {tab === 'boards' && archivedBoards.length === 0 && <p className="list-empty-text">アーカイブ済みボードはありません</p>}
        {tab === 'memos' && archivedMemos.map(memo => (
          <ArchiveItem key={memo.id} title={getMemoPrimaryText(memo)} meta={getMemoKindLabel(memo)} onRestore={() => onRestoreMemo(memo.id)} />
        ))}
        {tab === 'photos' && archivedPhotos.map(memo => (
          <ArchiveItem key={memo.id} title={getMemoPrimaryText(memo)} meta="写真" onRestore={() => onRestoreMemo(memo.id)} />
        ))}
        {tab === 'boards' && archivedBoards.map(board => (
          <ArchiveItem key={board.id} title={board.label} meta="ボード" onRestore={() => onRestoreBoard(board.id)} />
        ))}
      </div>
    </section>
  );
}

function ArchiveItem({ title, meta, onRestore }) {
  return (
    <article className="list-item-card">
      <div>
        <span>{meta}</span>
        <strong>{title}</strong>
      </div>
      <button type="button" className="subtle-action" onClick={onRestore}>復元</button>
    </article>
  );
}

function SimplePageHeader({ title, eyebrow, onBack }) {
  return (
    <header className="page-header">
      <button type="button" className="icon-button ghost" onClick={onBack} aria-label="ホームへ戻る">
        <ArrowLeft size={22} />
      </button>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <span className="header-spacer" />
    </header>
  );
}

function BoardListPage({ boards, memos, activeBoardId, onBack, onSelect, onAddBoard, onUpdateBoard, onDuplicateBoard, onDeleteBoard, onMoveBoard }) {
  const [newBoardName, setNewBoardName] = useState('');
  const [boardNames, setBoardNames] = useState(() => Object.fromEntries(boards.map(board => [board.id, board.label])));
  const addInputRef = useRef(null);
  const memoCounts = useMemo(() => boards.reduce((counts, board) => ({
    ...counts,
    [board.id]: memos.filter(memo => memo.boardId === board.id && !memo.archived).length
  }), {}), [boards, memos]);

  useEffect(() => {
    setBoardNames(Object.fromEntries(boards.map(board => [board.id, board.label])));
  }, [boards]);

  const saveBoardName = (boardId) => {
    const board = boards.find(item => item.id === boardId);
    const nextLabel = (boardNames[boardId] || '').trim();
    if (!nextLabel) {
      setBoardNames(current => ({
        ...current,
        [boardId]: board?.label || ''
      }));
      return;
    }
    onUpdateBoard(boardId, { label: nextLabel });
  };

  const submitNewBoard = (event) => {
    event.preventDefault();
    const label = newBoardName.trim() || getNextBoardName(boards);
    onAddBoard(label);
    setNewBoardName('');
  };

  return (
    <section className="list-page board-list-page">
      <header className="page-header">
        <button type="button" className="icon-button ghost" onClick={onBack} aria-label="ホームへ戻る">
          <ArrowLeft size={22} />
        </button>
        <div>
          <p className="eyebrow">コルクボード</p>
          <h1>ボード一覧</h1>
        </div>
        <button type="button" className="icon-button primary" onClick={() => addInputRef.current?.focus()} aria-label="ボード追加">
          <Plus size={21} />
        </button>
      </header>

      <form className="board-add-form" onSubmit={submitNewBoard}>
        <Folder size={22} />
        <input
          ref={addInputRef}
          type="text"
          value={newBoardName}
          placeholder="新しいボード名"
          aria-label="新しいボード名"
          onChange={(event) => setNewBoardName(event.target.value)}
        />
        <button type="submit">追加</button>
      </form>

      <div className="board-manager-list">
        {boards.map((board, index) => {
          const Icon = BOARD_ICON_MAP[board.icon] || Folder;
          return (
            <article key={board.id} className={`board-manager-card ${board.id === activeBoardId ? 'is-active' : ''}`}>
              <button type="button" className="board-open-button" onClick={() => onSelect(board.id)}>
                <span className="board-icon-badge"><Icon size={22} /></span>
                <span>
                  <strong>{board.label}</strong>
                  <small>{memoCounts[board.id] || 0}枚のカード</small>
                </span>
              </button>

              <label className="board-name-field">
                <Pencil size={15} />
                <input
                  type="text"
                  value={boardNames[board.id] || ''}
                  aria-label={`${board.label}の名前`}
                  onChange={(event) => setBoardNames(current => ({
                    ...current,
                    [board.id]: event.target.value
                  }))}
                  onBlur={() => saveBoardName(board.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                />
              </label>

              <div className="board-icon-row" aria-label={`${board.label}のアイコン`}>
                {BOARD_ICON_OPTIONS.map(option => {
                  const Icon = BOARD_ICON_MAP[option.id] || Folder;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={board.icon === option.id ? 'active' : ''}
                      onClick={() => onUpdateBoard(board.id, { icon: option.id })}
                      aria-label={option.label}
                    >
                      <Icon size={17} />
                    </button>
                  );
                })}
              </div>

              <div className="board-card-actions">
                <button type="button" onClick={() => onSelect(board.id)}>開く</button>
                <button
                  type="button"
                  className="board-order-button"
                  onClick={() => onMoveBoard(board.id, 'up')}
                  disabled={index === 0}
                  aria-label={`${board.label}を上へ移動`}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  className="board-order-button"
                  onClick={() => onMoveBoard(board.id, 'down')}
                  disabled={index === boards.length - 1}
                  aria-label={`${board.label}を下へ移動`}
                >
                  <ArrowDown size={15} />
                </button>
                <button type="button" onClick={() => onDuplicateBoard(board.id)}>
                  <Copy size={15} />
                  複製
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => onDeleteBoard(board.id)}
                  disabled={boards.length <= 1}
                >
                  <Trash2 size={15} />
                  削除
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ToggleButton({ label, active, onClick }) {
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onClick}>
      {label}
    </button>
  );
}
