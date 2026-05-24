import { useEffect, useMemo, useRef, useState } from 'react';
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
  Map,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X
} from 'lucide-react';
import {
  MEMO_COLORS,
  PHOTO_CROP_RATIOS,
  clamp,
  createBoard,
  createChecklistItem,
  createEmptyMemo,
  createSticker,
  DEFAULT_BOARDS,
  isMemoVisibleOnBoard,
  normalizeMemo,
  sortMemos
} from './memoModel.js';
import { loadMemoData, saveMemoData } from './storage.js';

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

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const MAX_PHOTO_DATA_URL_LENGTH = 620000;
const PHOTO_CANVAS_BACKGROUND = '#f3eadc';
const BOARD_EDGE_HOTZONE = 34;
const BOARD_EDGE_SWITCH_DELAY = 600;

const resizeImageFile = async (file, maxWidth = 900) => {
  const dataUrl = await fileToDataUrl(file);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
  let scale = Math.min(1, maxWidth / image.width);
  let quality = 0.72;
  let output = '';
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  for (let attempt = 0; attempt < 8; attempt += 1) {
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = PHOTO_CANVAS_BACKGROUND;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    output = canvas.toDataURL('image/jpeg', quality);
    if (output.length <= MAX_PHOTO_DATA_URL_LENGTH) break;
    if (quality > 0.54) {
      quality -= 0.08;
    } else {
      scale *= 0.82;
    }
  }

  return {
    dataUrl: output,
    aspectRatio: canvas.width / canvas.height
  };
};

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

export default function App() {
  const [data, setData] = useState(loadMemoData);
  const [page, setPage] = useState('home');
  const [draft, setDraft] = useState(() => createDraft());
  const [now, setNow] = useState(() => new Date());
  const [activeBoardId, setActiveBoardId] = useState('home');
  const [storageError, setStorageError] = useState('');
  const boards = data.boards?.length ? data.boards : DEFAULT_BOARDS;

  useEffect(() => {
    const ok = saveMemoData(data);
    setStorageError(ok ? '' : '保存容量がいっぱいです。写真カードを減らすか、小さめの写真に差し替えてください。');
  }, [data]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (boards.some(board => board.id === activeBoardId)) return;
    setActiveBoardId(boards[0]?.id || 'home');
  }, [activeBoardId, boards]);

  const visibleMemos = useMemo(
    () => sortMemos(data.memos.filter(memo => (
      memo.boardId === activeBoardId && isMemoVisibleOnBoard(memo, now)
    ))),
    [activeBoardId, data.memos, now]
  );

  const allMemos = useMemo(() => sortMemos(data.memos), [data.memos]);

  const saveMemo = (memo) => {
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

  const deleteMemo = (id) => {
    setData(current => ({
      ...current,
      memos: current.memos.filter(memo => memo.id !== id)
    }));
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
      ]
    }));
    setActiveBoardId(nextBoard.id);
  };

  const deleteBoard = (boardId) => {
    const board = boards.find(item => item.id === boardId);
    if (!board || boards.length <= 1) {
      window.alert('ボードは1つ以上必要です。');
      return;
    }

    const fallbackBoard = boards.find(item => item.id !== boardId && item.id === 'home')
      || boards.find(item => item.id !== boardId);
    const confirmed = window.confirm(`「${board.label}」を削除しますか？カードは「${fallbackBoard.label}」へ移動します。`);
    if (!confirmed) return;

    setData(current => ({
      ...current,
      boards: current.boards.filter(item => item.id !== boardId),
      memos: current.memos.map(memo => (
        memo.boardId === boardId ? { ...memo, boardId: fallbackBoard.id } : memo
      ))
    }));
    if (activeBoardId === boardId) {
      setActiveBoardId(fallbackBoard.id);
    }
  };

  const openEditMemo = (memo) => {
    setDraft(normalizeMemo(memo));
    setPage('create');
  };

  return (
    <main className="phone-shell">
      {storageError && <p className="storage-toast">{storageError}</p>}

      {page === 'home' && (
        <HomePage
          activeBoardId={activeBoardId}
          boards={boards}
          memos={visibleMemos}
          onAdd={openNewCard}
          onBoardChange={setActiveBoardId}
          onOpenList={() => setPage('list')}
          onEdit={openEditMemo}
          onMove={patchMemo}
          onDeleteMemo={deleteMemo}
          onAddBoard={addBoard}
          onUpdateBoard={updateBoard}
          onDuplicateBoard={duplicateBoard}
          onDeleteBoard={deleteBoard}
        />
      )}

      {page === 'create' && (
        <MemoCreatePage
          boards={boards}
          draft={draft}
          setDraft={setDraft}
          onBack={() => setPage('home')}
          onSave={saveMemo}
        />
      )}

      {page === 'list' && (
        <BoardListPage
          boards={boards}
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
        />
      )}
    </main>
  );
}

function HomePage({
  activeBoardId,
  boards,
  memos,
  onAdd,
  onBoardChange,
  onOpenList,
  onEdit,
  onMove,
  onDeleteMemo,
  onAddBoard,
  onUpdateBoard,
  onDuplicateBoard,
  onDeleteBoard
}) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [boardMenu, setBoardMenu] = useState(null);
  const [editingBoard, setEditingBoard] = useState(null);
  const [draggingMemoId, setDraggingMemoId] = useState(null);
  const [trashActive, setTrashActive] = useState(false);
  const boardRef = useRef(null);
  const trashRef = useRef(null);
  const activeCardRef = useRef(null);
  const cardPointersRef = useRef(new globalThis.Map());
  const cardGestureRef = useRef(null);
  const activeBoardIdRef = useRef(activeBoardId);
  const boardsRef = useRef(boards);
  const dragMemoRef = useRef(null);
  const edgeSwitchRef = useRef({ direction: null, timer: null, lastSwitchAt: 0 });
  const trashActiveRef = useRef(false);
  const swipeStartRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const activeBoard = boards.find(board => board.id === activeBoardId) || boards[0];

  activeBoardIdRef.current = activeBoardId;
  boardsRef.current = boards;

  useEffect(() => () => {
    window.clearTimeout(longPressTimerRef.current);
    window.clearTimeout(edgeSwitchRef.current.timer);
  }, []);

  const setTrashHover = (isActive) => {
    trashActiveRef.current = isActive;
    setTrashActive(isActive);
  };

  const clearEdgeSwitch = () => {
    window.clearTimeout(edgeSwitchRef.current.timer);
    edgeSwitchRef.current.timer = null;
    edgeSwitchRef.current.direction = null;
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

  const getMemoPointPatch = (clientX, clientY, gesture) => ({
    x: clamp(((clientX - gesture.grabOffsetX - gesture.boardRect.left) / gesture.boardRect.width) * 100, 1, 70),
    y: clamp(((clientY - gesture.grabOffsetY - gesture.boardRect.top) / gesture.boardRect.height) * 100, 1, 80)
  });

  const refreshDragGestureAfterBoardSwitch = () => {
    const memo = dragMemoRef.current;
    if (!memo || !boardRef.current || cardPointersRef.current.size !== 1) return;
    window.requestAnimationFrame(() => {
      const nextCard = document.querySelector(`[data-memo-id="${memo.id}"]`);
      const point = Array.from(cardPointersRef.current.values())[0];
      if (!nextCard || !point || !boardRef.current) return;
      activeCardRef.current = nextCard;
      const cardRect = nextCard.getBoundingClientRect();
      cardGestureRef.current = {
        type: 'drag',
        memoId: memo.id,
        boardRect: boardRef.current.getBoundingClientRect(),
        grabOffsetX: point.clientX - cardRect.left,
        grabOffsetY: point.clientY - cardRect.top
      };
      window.requestAnimationFrame(updateTrashHover);
    });
  };

  const switchBoardDuringDrag = (direction) => {
    const memo = dragMemoRef.current;
    const currentBoards = boardsRef.current;
    const currentIndex = currentBoards.findIndex(board => board.id === activeBoardIdRef.current);
    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    const nextBoard = currentBoards[nextIndex];
    if (!memo || !nextBoard) return;

    const nextX = direction === 'next' ? 4 : 82;
    clearEdgeSwitch();
    edgeSwitchRef.current.lastSwitchAt = Date.now();
    patchDraggedMemo(memo.id, {
      boardId: nextBoard.id,
      x: nextX,
      y: clamp(memo.y ?? 12, 1, 80)
    });
    activeBoardIdRef.current = nextBoard.id;
    onBoardChange(nextBoard.id);
    setTrashHover(false);
    refreshDragGestureAfterBoardSwitch();
  };

  const updateBoardEdgeHover = (clientX) => {
    if (!boardRef.current || !dragMemoRef.current) return;
    const boardRect = boardRef.current.getBoundingClientRect();
    const currentBoards = boardsRef.current;
    const currentIndex = currentBoards.findIndex(board => board.id === activeBoardIdRef.current);
    let direction = null;
    if (clientX <= boardRect.left + BOARD_EDGE_HOTZONE && currentIndex > 0) {
      direction = 'prev';
    } else if (clientX >= boardRect.right - BOARD_EDGE_HOTZONE && currentIndex < currentBoards.length - 1) {
      direction = 'next';
    }

    if (!direction) {
      clearEdgeSwitch();
      return;
    }

    if (edgeSwitchRef.current.direction === direction && edgeSwitchRef.current.timer) return;
    if (Date.now() - edgeSwitchRef.current.lastSwitchAt < 700) return;
    clearEdgeSwitch();
    edgeSwitchRef.current.direction = direction;
    edgeSwitchRef.current.timer = window.setTimeout(() => {
      switchBoardDuringDrag(direction);
    }, BOARD_EDGE_SWITCH_DELAY);
  };

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

    const moveMemo = (moveEvent) => {
      if (!cardPointersRef.current.has(moveEvent.pointerId)) return;
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
        updateBoardEdgeHover(center.x);
      } else if (cardGestureRef.current?.type === 'drag') {
        patchDraggedMemo(memo.id, getMemoPointPatch(moveEvent.clientX, moveEvent.clientY, cardGestureRef.current));
        updateBoardEdgeHover(moveEvent.clientX);
      }
      window.requestAnimationFrame(updateTrashHover);
    };

    const stopMove = (stopEvent) => {
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
      clearEdgeSwitch();
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

  const handleTouchStart = (event) => {
    if (event.target.closest('.board-card')) return;
    swipeStartRef.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event) => {
    if (swipeStartRef.current === null) return;
    const distance = event.changedTouches[0].clientX - swipeStartRef.current;
    swipeStartRef.current = null;
    if (Math.abs(distance) < 70) return;
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

  const clearBoardLongPress = () => {
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const openBoardMenu = (event, board) => {
    event.preventDefault();
    clearBoardLongPress();
    longPressFiredRef.current = true;
    setBoardMenu({
      id: board.id,
      label: board.label,
      x: event.clientX || 0,
      y: event.clientY || 0
    });
  };

  const startBoardLongPress = (event, board) => {
    clearBoardLongPress();
    longPressFiredRef.current = false;
    const point = {
      preventDefault: () => event.preventDefault(),
      clientX: event.clientX,
      clientY: event.clientY
    };
    longPressTimerRef.current = window.setTimeout(() => {
      openBoardMenu(point, board);
    }, 560);
  };

  const handleBoardClick = (boardId) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    setBoardMenu(null);
    onBoardChange(boardId);
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

  return (
    <section className="home-page cork-home" onClick={() => boardMenu && setBoardMenu(null)}>
      <header className="cork-header">
        <button type="button" className="plain-icon" aria-label="メニュー">
          <Menu size={27} />
        </button>
        <h1>うさぽんメモ</h1>
        <div className="header-tools">
          <button type="button" className="plain-icon" aria-label="検索">
            <Search size={27} />
          </button>
          <button type="button" className="plain-icon has-dot" aria-label="通知">
            <Bell size={25} />
          </button>
        </div>
      </header>

      <nav className="board-tabs" aria-label="ボード切替">
        {boards.map(board => {
          const Icon = BOARD_ICON_MAP[board.icon] || Folder;
          return (
            <button
              key={board.id}
              type="button"
              className={board.id === activeBoardId ? 'active' : ''}
              onPointerDown={(event) => startBoardLongPress(event, board)}
              onPointerUp={clearBoardLongPress}
              onPointerLeave={clearBoardLongPress}
              onPointerCancel={clearBoardLongPress}
              onContextMenu={(event) => openBoardMenu(event, board)}
              onClick={(event) => {
                event.stopPropagation();
                handleBoardClick(board.id);
              }}
            >
              <Icon size={18} />
              {board.label}
            </button>
          );
        })}
        <button
          type="button"
          className="board-add-tab"
          onClick={(event) => {
            event.stopPropagation();
            setBoardMenu(null);
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

      <section
        className="cork-board-wrap"
        aria-label={`${activeBoard.label}のコルクボード`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div ref={boardRef} className="sticky-board cork-board">
          {memos.length === 0 ? (
            <button type="button" className="board-empty cork-empty" onClick={() => onAdd('checklist')}>
              <StickyNote size={28} />
              <strong>ここに貼っていこう</strong>
              <span>写真やメモを、少しずつ集めるボードです</span>
            </button>
          ) : (
            memos.map(memo => (
              <BoardMemo
                key={memo.id}
                memo={memo}
                isDragging={draggingMemoId === memo.id}
                onPointerDown={(event) => handlePointerDown(event, memo)}
                onEdit={() => onEdit(memo)}
              />
            ))
          )}
        </div>
      </section>

      {draggingMemoId && (
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
        <button type="button">
          <MoreHorizontal size={22} />
          設定
        </button>
      </footer>

      <button type="button" className="floating-add" onClick={() => setAddMenuOpen(true)} aria-label="新規追加">
        <Plus size={33} />
      </button>

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
          </div>
        </div>
      )}
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

function StickerLayer({ stickers = [], onStickerPointerDown = null, selectedStickerId = '', onDeleteSticker = null }) {
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
            className={onStickerPointerDown ? 'memo-sticker-wrap is-editable' : 'memo-sticker-wrap'}
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

function BoardMemo({ memo, isDragging, onPointerDown, onEdit }) {
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
    <article
      className={`board-card board-memo ${MEMO_COLORS[memo.color].className} card-${cardType} ${memo.pinned ? 'is-pinned' : ''} ${memo.completed ? 'is-completed' : ''} ${dragClassName}`}
      data-memo-id={memo.id}
      style={style}
      onPointerDown={onPointerDown}
    >
      <span className="card-tape" aria-hidden="true" />
      {cardType !== 'photo' && <StickerLayer stickers={memo.stickers} />}
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
        ) : cardType === 'checklist' ? (
          <span className="mini-checklist">
            {memo.checklist.slice(0, 4).map(item => (
              <span key={item.id} className={item.completed ? 'done' : ''}>
                <i aria-hidden="true" />
                {item.text}
              </span>
            ))}
          </span>
        ) : (
          <span>{memo.text || '自由メモ'}</span>
        )}
      </div>
    </article>
  );
}

function MemoCreatePage({ boards, draft, setDraft, onBack, onSave }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [selectedStickerId, setSelectedStickerId] = useState('');
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
    event.preventDefault();
    if (item.text.length > 0) {
      updateChecklistItem(item.id, { text: '' });
      return;
    }
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
      const { dataUrl: photoDataUrl, aspectRatio } = await resizeImageFile(file);
      setDraft(current => ({
        ...current,
        photoDataUrl,
        caption: current.caption || current.title,
        photoCropRatio: 'custom',
        photoZoom: 1,
        photoOffsetX: 0,
        photoOffsetY: 0,
        photoRotation: 0,
        photoAspectRatio: aspectRatio,
        photoFrameRatio: aspectRatio
      }));
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

  const getStickerPositionFromEvent = (event) => {
    if (!createCardRef.current) return { x: 50, y: 62 };
    const rect = createCardRef.current.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 6, 94),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 10, 92)
    };
  };

  const startStickerMove = (event, sticker) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedStickerId(sticker.id);
    event.currentTarget.setPointerCapture(event.pointerId);

    const moveSticker = (moveEvent) => {
      const position = getStickerPositionFromEvent(moveEvent);
      setDraft(current => ({
        ...current,
        stickers: current.stickers.map(item => (
          item.id === sticker.id ? { ...item, ...position } : item
        ))
      }));
    };

    const stopStickerMove = () => {
      window.removeEventListener('pointermove', moveSticker);
      window.removeEventListener('pointerup', stopStickerMove);
      window.removeEventListener('pointercancel', stopStickerMove);
    };

    window.addEventListener('pointermove', moveSticker);
    window.addEventListener('pointerup', stopStickerMove);
    window.addEventListener('pointercancel', stopStickerMove);
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
      checklist: draft.checklist.filter(item => item.text.trim())
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
        <h1 className="create-title">{draft.cardType === 'photo' ? '写真カード' : draft.cardType === 'schedule' ? '予定カード' : 'やることリスト'}</h1>
        <button
          type="button"
          className="create-nav-button"
          onClick={() => setSettingsOpen(current => !current)}
          aria-label="詳細設定"
          aria-expanded={settingsOpen}
        >
          <MoreHorizontal size={32} strokeWidth={3} />
        </button>
      </header>

      <section
        ref={createCardRef}
        className={`create-card ${MEMO_COLORS[draft.color].className} create-${draft.cardType}`}
        style={createCardStyle}
        onDragOver={(event) => draft.cardType !== 'photo' && event.preventDefault()}
        onDrop={(event) => draft.cardType !== 'photo' && dropSticker(event)}
      >
        <span className="memo-tape" aria-hidden="true" />
        {draft.cardType !== 'photo' && (
          <StickerLayer
            stickers={draft.stickers}
            onStickerPointerDown={startStickerMove}
            selectedStickerId={selectedStickerId}
            onDeleteSticker={deleteSticker}
          />
        )}
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
                  onChange={(event) => updateChecklistItem(firstChecklistItem.id, { text: event.target.value })}
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
                  onChange={(event) => updateChecklistItem(item.id, { text: event.target.value })}
                  onKeyDown={(event) => {
                    if (handleChecklistEnter(event)) return;
                    handleChecklistBackspace(event, item);
                  }}
                />
              </label>
            ))}
          </div>
        )}
      </section>

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
                draggable
                onClick={() => addSticker(sticker.id)}
                onDragStart={(event) => event.dataTransfer.setData('text/plain', sticker.id)}
                aria-label={`${sticker.label}を追加`}
              >
                <img src={sticker.src} alt="" draggable={false} />
              </button>
            ))}
          </div>
        )}

        {settingsOpen && (
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
        )}
      </section>

      <footer className="create-actions">
        <button type="button" onClick={cleanAndSave} disabled={!canSave || imageBusy}>
          <Check size={23} strokeWidth={2.6} />
          ホームに追加
        </button>
      </footer>
    </section>
  );
}

function BoardListPage({ boards, memos, activeBoardId, onBack, onSelect, onAddBoard, onUpdateBoard, onDuplicateBoard, onDeleteBoard }) {
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
        {boards.map((board) => {
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
