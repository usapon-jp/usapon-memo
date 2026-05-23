import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  Clock,
  Folder,
  Home,
  ImagePlus,
  List,
  Map,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X
} from 'lucide-react';
import {
  MEMO_COLORS,
  clamp,
  createChecklistItem,
  createEmptyMemo,
  getMemoPreview,
  getReminderStatus,
  isMemoVisibleOnBoard,
  normalizeMemo,
  sortMemos
} from './memoModel.js';
import { loadMemoData, saveMemoData } from './storage.js';

const BOARDS = [
  { id: 'home', label: 'ホーム', icon: Home },
  { id: 'study', label: '勉強', icon: BookOpen },
  { id: 'places', label: '行きたい場所', icon: Map },
  { id: 'rabbit', label: 'うさぎ', icon: Camera }
];

const COLOR_ORDER = ['white', 'green', 'yellow', 'blue', 'pink'];
const COLOR_OPTIONS = COLOR_ORDER.map(id => ({ id, ...MEMO_COLORS[id] }));
const TODAY_MESSAGES = ['今日のメモがあるよ', '未完了メモがあるよ', 'ひとつずつ片づけよ'];

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

export default function App() {
  const [data, setData] = useState(loadMemoData);
  const [page, setPage] = useState('home');
  const [draft, setDraft] = useState(() => createDraft());
  const [now, setNow] = useState(() => new Date());
  const [activeBoardId, setActiveBoardId] = useState('home');
  const [storageError, setStorageError] = useState('');

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
    setDraft(createDraft({ boardId: activeBoardId }));
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
    const confirmed = window.confirm('このカードを削除しますか？');
    if (!confirmed) return;
    setData(current => ({
      ...current,
      memos: current.memos.filter(memo => memo.id !== id)
    }));
    setPage('list');
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
          boards={BOARDS}
          memos={visibleMemos}
          onAdd={openNewCard}
          onBoardChange={setActiveBoardId}
          onOpenList={() => setPage('list')}
          onEdit={openEditMemo}
          onMove={patchMemo}
          onToggle={(id, patch) => patchMemo(id, patch)}
        />
      )}

      {page === 'create' && (
        <MemoCreatePage
          boards={BOARDS}
          draft={draft}
          setDraft={setDraft}
          onBack={() => setPage('home')}
          onSave={saveMemo}
        />
      )}

      {page === 'list' && (
        <MemoListPage
          memos={allMemos}
          now={now}
          onBack={() => setPage('home')}
          onAdd={() => openNewCard('checklist')}
          onEdit={openEditMemo}
          onDelete={deleteMemo}
          onPatch={patchMemo}
        />
      )}
    </main>
  );
}

function HomePage({ activeBoardId, boards, memos, onAdd, onBoardChange, onOpenList, onEdit, onMove, onToggle }) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const boardRef = useRef(null);
  const swipeStartRef = useRef(null);
  const todayMemos = memos.filter(memo => memo.isToday && !memo.completed);
  const hasToday = todayMemos.length > 0;
  const message = hasToday ? TODAY_MESSAGES[Math.min(todayMemos.length - 1, TODAY_MESSAGES.length - 1)] : 'きょうもゆっくりいこう';
  const activeBoard = boards.find(board => board.id === activeBoardId) || boards[0];

  const handlePointerDown = (event, memo) => {
    if (!boardRef.current || event.target.closest('.memo-pin-row button, .complete-chip, input')) return;
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

  return (
    <section className="home-page cork-home">
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
          const Icon = board.icon;
          return (
            <button
              key={board.id}
              type="button"
              className={board.id === activeBoardId ? 'active' : ''}
              onClick={() => onBoardChange(board.id)}
            >
              <Icon size={18} />
              {board.label}
            </button>
          );
        })}
      </nav>

      <section
        className="cork-board-wrap"
        aria-label={`${activeBoard.label}のコルクボード`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="board-message">
          <span>{activeBoard.label}</span>
          <small>{message}</small>
        </div>
        <div className="dry-flower dry-flower-top" aria-hidden="true" />
        <div className="dry-flower dry-flower-bottom" aria-hidden="true" />
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
                onToggle={(patch) => onToggle(memo.id, patch)}
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

function BoardMemo({ memo, onPointerDown, onEdit, onToggle }) {
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
      <span className="card-pin" aria-hidden="true" />
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
          <div className="memo-pin-row">
            <button type="button" onClick={() => onToggle({ pinned: !memo.pinned })}>
              {memo.pinned ? 'ピン中' : 'ピン'}
            </button>
            <button type="button" onClick={() => onToggle({ isToday: !memo.isToday })}>
              {memo.isToday ? '今日' : '＋今日'}
            </button>
          </div>
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
          <button type="button" className="complete-chip" onClick={() => onToggle({ completed: !memo.completed })}>
            {memo.completed ? '完了' : '未完了'}
          </button>
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
  const firstChecklistItem = draft.checklist[0] || createChecklistItem();

  useEffect(() => {
    if (draft.cardType === 'checklist' && draft.checklist.length === 0) {
      setDraft(current => ({ ...current, type: 'checklist', checklist: [createChecklistItem()] }));
    }
  }, [draft.cardType, draft.checklist.length, setDraft]);

  useEffect(() => {
    if (!pendingFocusId.current) return;
    checklistInputRefs.current[pendingFocusId.current]?.focus();
    pendingFocusId.current = null;
  }, [draft.checklist.length]);

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

  const focusEditor = () => {
    titleInputRef.current?.focus();
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
                  }
                }}
              />
            </label>
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
                    }
                  }}
                />
              </label>
            ))}
          </div>
        )}
      </section>

      <button type="button" className="edit-pill" onClick={focusEditor}>
        編集する
      </button>

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

function MemoListPage({ memos, now, onBack, onAdd, onEdit, onDelete, onPatch }) {
  return (
    <section className="list-page">
      <header className="page-header">
        <button type="button" className="icon-button ghost" onClick={onBack} aria-label="ホームへ戻る">
          <ArrowLeft size={22} />
        </button>
        <div>
          <p className="eyebrow">メモ一覧</p>
          <h1>貼ったカード</h1>
        </div>
        <button type="button" className="icon-button primary" onClick={onAdd} aria-label="メモ追加">
          <Plus size={21} />
        </button>
      </header>

      {memos.length === 0 ? (
        <button type="button" className="list-empty" onClick={onAdd}>
          <StickyNote size={26} />
          まだカードがありません
        </button>
      ) : (
        <div className="memo-list">
          {memos.map(memo => (
            <article key={memo.id} className={`list-memo ${MEMO_COLORS[memo.color].className} ${memo.archived ? 'is-archived' : ''}`}>
              <button type="button" className="list-memo-main" onClick={() => onEdit(memo)}>
                <strong>{getMemoPreview(memo)}</strong>
                <span>{memo.cardType === 'schedule' ? 'スケジュール' : memo.cardType === 'photo' ? '写真' : memo.cardType === 'checklist' ? 'チェックリスト' : 'メモ'}</span>
                {memo.reminderAt && (
                  <small className={`reminder-label ${getReminderStatus(memo, now) === 'waiting' ? 'is-waiting' : 'is-due'}`}>
                    {getReminderStatus(memo, now) === 'waiting' ? '待機中' : 'ホームに表示中'}
                  </small>
                )}
              </button>
              <div className="list-memo-actions">
                <button type="button" onClick={() => onPatch(memo.id, { completed: !memo.completed })}>
                  <Check size={15} />
                  {memo.completed ? '戻す' : '完了'}
                </button>
                <button type="button" onClick={() => onPatch(memo.id, { isToday: !memo.isToday })}>
                  {memo.isToday ? '今日' : '今日にする'}
                </button>
                <button type="button" onClick={() => onPatch(memo.id, { pinned: !memo.pinned })}>
                  {memo.pinned ? 'ピン中' : 'ピン'}
                </button>
                <button type="button" className="danger" onClick={() => onDelete(memo.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
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
