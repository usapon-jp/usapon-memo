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
  clamp,
  createBoard,
  createChecklistItem,
  createEmptyMemo,
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

const COLOR_ORDER = ['white', 'green', 'yellow', 'blue', 'pink'];
const COLOR_OPTIONS = COLOR_ORDER.map(id => ({ id, ...MEMO_COLORS[id] }));

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

const resizeImageFile = async (file, maxWidth = 1200) => {
  const dataUrl = await fileToDataUrl(file);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxWidth / image.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
};

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
    setStorageError(ok ? '' : '写真が大きくて保存できませんでした。画像を小さくしてもう一度試してください。');
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

  const openNewCard = (cardType = 'checklist') => {
    setDraft(createDraft({
      boardId: activeBoardId,
      cardType,
      type: cardType === 'checklist' ? 'checklist' : 'note',
      checklist: cardType === 'checklist' ? [createChecklistItem()] : [],
      color: cardType === 'photo' ? 'white' : 'green'
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

  const renameBoard = (boardId, label) => {
    const nextLabel = label.trim();
    if (!nextLabel) return;
    setData(current => ({
      ...current,
      boards: current.boards.map(board => (
        board.id === boardId ? { ...board, label: nextLabel } : board
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
          onAddBoard={addBoard}
          onRenameBoard={renameBoard}
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
          onRenameBoard={renameBoard}
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
  onAddBoard,
  onRenameBoard,
  onDuplicateBoard,
  onDeleteBoard
}) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [boardMenu, setBoardMenu] = useState(null);
  const boardRef = useRef(null);
  const swipeStartRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const activeBoard = boards.find(board => board.id === activeBoardId) || boards[0];

  useEffect(() => () => window.clearTimeout(longPressTimerRef.current), []);

  const handlePointerDown = (event, memo) => {
    if (!boardRef.current || event.target.closest('input')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = boardRef.current.getBoundingClientRect();

    const moveMemo = (moveEvent) => {
      const x = clamp(((moveEvent.clientX - rect.left) / rect.width) * 100, 1, 70);
      const y = clamp(((moveEvent.clientY - rect.top) / rect.height) * 100, 1, 80);
      onMove(memo.id, { x, y });
    };

    const stopMove = () => {
      window.removeEventListener('pointermove', moveMemo);
      window.removeEventListener('pointerup', stopMove);
      window.removeEventListener('pointercancel', stopMove);
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

  const renameFromMenu = () => {
    if (!boardMenu) return;
    const nextLabel = window.prompt('ボード名を変更', boardMenu.label);
    if (nextLabel !== null) onRenameBoard(boardMenu.id, nextLabel);
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
          <button type="button" role="menuitem" onClick={renameFromMenu}>
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
                onPointerDown={(event) => handlePointerDown(event, memo)}
                onEdit={() => onEdit(memo)}
              />
            ))
          )}
        </div>
      </section>

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
            <button type="button" onClick={() => chooseAddType('photo')}>
              <ImagePlus size={24} />
              写真
            </button>
            <button type="button" onClick={() => chooseAddType('checklist')}>
              <StickyNote size={24} />
              メモ
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function BoardMemo({ memo, onPointerDown, onEdit }) {
  const hasTitle = memo.title.trim().length > 0;
  const cardType = memo.cardType || (memo.type === 'checklist' ? 'checklist' : 'note');
  const style = {
    left: `${memo.x}%`,
    top: `${memo.y}%`,
    '--tilt': `${getCardTilt(memo.id)}deg`
  };

  return (
    <article
      className={`board-card board-memo ${MEMO_COLORS[memo.color].className} card-${cardType} ${memo.pinned ? 'is-pinned' : ''} ${memo.completed ? 'is-completed' : ''}`}
      style={style}
      onPointerDown={onPointerDown}
    >
      <span className="card-tape" aria-hidden="true" />

      {cardType === 'photo' ? (
        <div className="photo-card-body" role="button" tabIndex={0} onClick={onEdit} onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onEdit();
        }}>
          {memo.photoDataUrl ? (
            <img src={memo.photoDataUrl} alt={memo.caption || memo.title || '写真'} />
          ) : (
            <span className="photo-placeholder"><Camera size={27} />写真</span>
          )}
          <strong>{memo.caption || memo.title || '写真のメモ'}</strong>
        </div>
      ) : (
        <>
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
        </>
      )}
    </article>
  );
}

function MemoCreatePage({ boards, draft, setDraft, onBack, onSave }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const primaryInputRef = useRef(null);
  const titleInputRef = useRef(null);
  const checklistInputRefs = useRef({});
  const pendingFocusId = useRef(null);
  const canSave = draft.cardType === 'photo'
    ? Boolean(draft.photoDataUrl || draft.caption.trim() || draft.title.trim())
    : draft.cardType === 'schedule'
      ? Boolean(draft.title.trim() || draft.scheduleDate || draft.scheduleTime || draft.schedulePlace)
      : draft.cardType === 'checklist'
        ? draft.title.trim().length > 0 || draft.checklist.some(item => item.text.trim())
        : draft.title.trim().length > 0 || draft.text.trim().length > 0;
  const firstChecklistItem = draft.checklist[0] || null;

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
      color: cardType === 'photo' ? 'white' : current.color
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

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageBusy(true);
    try {
      const photoDataUrl = await resizeImageFile(file);
      setDraft(current => ({
        ...current,
        photoDataUrl,
        caption: current.caption || current.title
      }));
    } finally {
      setImageBusy(false);
      event.target.value = '';
    }
  };

  const cleanAndSave = () => {
    const nextDraft = normalizeMemo({
      ...draft,
      checklist: draft.checklist.filter(item => item.text.trim())
    });
    onSave(nextDraft);
  };

  return (
    <section className="create-page">
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

      <section className={`create-card ${MEMO_COLORS[draft.color].className} create-${draft.cardType}`}>
        <span className="memo-tape" aria-hidden="true" />
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
            <label className="photo-picker">
              <input type="file" accept="image/*" onChange={handlePhotoChange} />
              {draft.photoDataUrl ? (
                <img src={draft.photoDataUrl} alt="選択した写真" />
              ) : (
                <span><ImagePlus size={28} />{imageBusy ? '読み込み中' : '写真を選ぶ'}</span>
              )}
            </label>
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
                <input
                  ref={primaryInputRef}
                  type="text"
                  value={firstChecklistItem.text}
                  placeholder=""
                  aria-label="やること"
                  onChange={(event) => updateChecklistItem(firstChecklistItem.id, { text: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addChecklistItem();
                      return;
                    }
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
                <input
                  ref={(element) => {
                    if (element) {
                      checklistInputRefs.current[item.id] = element;
                    } else {
                      delete checklistInputRefs.current[item.id];
                    }
                  }}
                  type="text"
                  value={item.text}
                  placeholder=""
                  aria-label={`${index + 2}行目のやること`}
                  onChange={(event) => updateChecklistItem(item.id, { text: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addChecklistItem();
                      return;
                    }
                    handleChecklistBackspace(event, item);
                  }}
                />
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="memo-options">
        <div className="color-row" aria-label="メモ色">
          {COLOR_OPTIONS.map(color => (
            <button
              key={color.id}
              type="button"
              className={`${color.className} ${draft.color === color.id ? 'selected' : ''}`}
              onClick={() => setDraft(current => ({ ...current, color: color.id }))}
              aria-label={color.label}
            />
          ))}
        </div>

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

function BoardListPage({ boards, memos, activeBoardId, onBack, onSelect, onAddBoard, onRenameBoard, onDuplicateBoard, onDeleteBoard }) {
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
    onRenameBoard(boardId, nextLabel);
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
