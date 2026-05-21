import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Home,
  List,
  Plus,
  Save,
  StickyNote,
  Trash2
} from 'lucide-react';
import {
  MEMO_COLORS,
  clamp,
  createChecklistItem,
  createEmptyMemo,
  getMemoPreview,
  isMemoVisibleOnBoard,
  normalizeMemo,
  sortMemos
} from './memoModel.js';
import { loadMemoData, saveMemoData } from './storage.js';

const COLOR_OPTIONS = Object.entries(MEMO_COLORS).map(([id, meta]) => ({ id, ...meta }));
const TODAY_MESSAGES = ['今日のメモがあるよ', '未完了メモがあるよ', 'ひとつずつ片づけよ'];

const createDraft = (patch = {}) => createEmptyMemo({
  x: 12 + Math.floor(Math.random() * 28),
  y: 14 + Math.floor(Math.random() * 34),
  ...patch
});

export default function App() {
  const [data, setData] = useState(loadMemoData);
  const [page, setPage] = useState('home');
  const [draft, setDraft] = useState(() => createDraft());

  useEffect(() => {
    saveMemoData(data);
  }, [data]);

  const visibleMemos = useMemo(
    () => sortMemos(data.memos.filter(isMemoVisibleOnBoard)),
    [data.memos]
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
    setPage('home');
    setDraft(createDraft());
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
    const confirmed = window.confirm('この付箋を削除しますか？');
    if (!confirmed) return;
    setData(current => ({
      ...current,
      memos: current.memos.filter(memo => memo.id !== id)
    }));
    setPage('list');
  };

  const openNewMemo = (type = 'note') => {
    setDraft(createDraft({
      type,
      checklist: type === 'checklist' ? [createChecklistItem()] : []
    }));
    setPage('create');
  };

  const openEditMemo = (memo) => {
    setDraft(normalizeMemo(memo));
    setPage('create');
  };

  return (
    <main className="phone-shell">
      {page === 'home' && (
        <HomePage
          memos={visibleMemos}
          onAdd={() => openNewMemo('note')}
          onOpenList={() => setPage('list')}
          onEdit={openEditMemo}
          onMove={patchMemo}
          onToggle={(id, patch) => patchMemo(id, patch)}
        />
      )}

      {page === 'create' && (
        <MemoCreatePage
          draft={draft}
          setDraft={setDraft}
          onBack={() => setPage('home')}
          onSave={saveMemo}
        />
      )}

      {page === 'list' && (
        <MemoListPage
          memos={allMemos}
          onBack={() => setPage('home')}
          onAdd={() => openNewMemo('note')}
          onEdit={openEditMemo}
          onDelete={deleteMemo}
          onPatch={patchMemo}
        />
      )}
    </main>
  );
}

function HomePage({ memos, onAdd, onOpenList, onEdit, onMove, onToggle }) {
  const boardRef = useRef(null);
  const todayMemos = memos.filter(memo => memo.isToday && !memo.completed);
  const hasToday = todayMemos.length > 0;
  const message = hasToday ? TODAY_MESSAGES[Math.min(todayMemos.length - 1, TODAY_MESSAGES.length - 1)] : 'きょうもゆっくりいこう';

  const handlePointerDown = (event, memo) => {
    if (!boardRef.current || event.target.closest('.memo-pin-row button, .complete-chip, input')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = boardRef.current.getBoundingClientRect();

    const moveMemo = (moveEvent) => {
      const x = clamp(((moveEvent.clientX - rect.left) / rect.width) * 100, 0, 74);
      const y = clamp(((moveEvent.clientY - rect.top) / rect.height) * 100, 0, 78);
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

  return (
    <section className="home-page">
      <header className="home-rabbit">
        <img src={`${import.meta.env.BASE_URL}assets/usa.png`} alt="うさぎ" />
        <div className={`rabbit-bubble ${hasToday ? 'is-active' : ''}`}>
          <span>{message}</span>
        </div>
        <button type="button" className="round-tool" onClick={onOpenList} aria-label="メモ一覧">
          <List size={21} />
        </button>
      </header>

      <section className="board-wrap" aria-label="うさぎの付箋ボード">
        <div className="board-title">
          <span>うさぎの付箋ボード</span>
          <small>{memos.length} notes</small>
        </div>
        <div ref={boardRef} className="sticky-board">
          {memos.length === 0 ? (
            <button type="button" className="board-empty" onClick={onAdd}>
              <StickyNote size={28} />
              <strong>付箋を貼ってみよう</strong>
              <span>右下のボタンから追加できます</span>
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

      <footer className="home-footer">
        <button type="button" className="add-memo-button" onClick={onAdd}>
          <Plus size={22} />
          新規メモ
        </button>
      </footer>
    </section>
  );
}

function BoardMemo({ memo, onPointerDown, onEdit, onToggle }) {
  return (
    <article
      className={`board-memo ${MEMO_COLORS[memo.color].className} ${memo.pinned ? 'is-pinned' : ''} ${memo.completed ? 'is-completed' : ''}`}
      style={{ left: `${memo.x}%`, top: `${memo.y}%` }}
      onPointerDown={onPointerDown}
    >
      <div className="memo-pin-row">
        <button type="button" onClick={() => onToggle({ pinned: !memo.pinned })}>
          {memo.pinned ? '📌' : '○'}
        </button>
        <button type="button" onClick={() => onToggle({ isToday: !memo.isToday })}>
          {memo.isToday ? '今日' : '＋今日'}
        </button>
      </div>
      <div
        className="board-memo-body"
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onEdit();
        }}
      >
        {memo.type === 'checklist' ? (
          <span className="mini-checklist">
            {memo.checklist.slice(0, 3).map(item => (
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
    </article>
  );
}

function MemoCreatePage({ draft, setDraft, onBack, onSave }) {
  const canSave = draft.type === 'checklist'
    ? draft.checklist.some(item => item.text.trim())
    : draft.text.trim().length > 0;

  const updateChecklistItem = (id, patch) => {
    setDraft(current => ({
      ...current,
      checklist: current.checklist.map(item => item.id === id ? { ...item, ...patch } : item)
    }));
  };

  const addChecklistItem = () => {
    setDraft(current => ({
      ...current,
      checklist: [...current.checklist, createChecklistItem()]
    }));
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
      <header className="page-header">
        <button type="button" className="icon-button ghost" onClick={onBack} aria-label="ホームへ戻る">
          <ArrowLeft size={22} />
        </button>
        <div>
          <p className="eyebrow">メモ作成</p>
          <h1>付箋を書く</h1>
        </div>
        <span className="header-spacer" />
      </header>

      <div className="type-tabs" aria-label="メモの種類">
        <button
          type="button"
          className={draft.type === 'note' ? 'active' : ''}
          onClick={() => setDraft(current => ({ ...current, type: 'note', checklist: [] }))}
        >
          自由メモ
        </button>
        <button
          type="button"
          className={draft.type === 'checklist' ? 'active' : ''}
          onClick={() => setDraft(current => ({
            ...current,
            type: 'checklist',
            checklist: current.checklist.length ? current.checklist : [createChecklistItem()]
          }))}
        >
          チェックリスト
        </button>
      </div>

      <section className={`create-card ${MEMO_COLORS[draft.color].className}`}>
        <span className="memo-tape" aria-hidden="true" />
        {draft.type === 'note' ? (
          <textarea
            value={draft.text}
            placeholder="ここにメモを書く"
            onChange={(event) => setDraft(current => ({ ...current, text: event.target.value }))}
          />
        ) : (
          <div className="checklist-form">
            {draft.checklist.map((item, index) => (
              <label key={item.id} className="checklist-form-row">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={(event) => updateChecklistItem(item.id, { completed: event.target.checked })}
                  aria-label={`${index + 1}行目を完了`}
                />
                <input
                  type="text"
                  value={item.text}
                  placeholder={index === 0 ? '買い物' : 'やること'}
                  onChange={(event) => updateChecklistItem(item.id, { text: event.target.value })}
                />
              </label>
            ))}
            <button type="button" className="line-add" onClick={addChecklistItem}>
              <Plus size={16} />
              行を追加
            </button>
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

        <div className="flag-grid">
          <ToggleButton label="ピン留め" active={draft.pinned} onClick={() => setDraft(current => ({ ...current, pinned: !current.pinned }))} />
          <ToggleButton label="今日のメモ" active={draft.isToday} onClick={() => setDraft(current => ({ ...current, isToday: !current.isToday }))} />
          <ToggleButton label="完了" active={draft.completed} onClick={() => setDraft(current => ({ ...current, completed: !current.completed }))} />
        </div>
      </section>

      <footer className="create-actions">
        <button type="button" onClick={cleanAndSave} disabled={!canSave}>
          <Save size={18} />
          保存する
        </button>
      </footer>
    </section>
  );
}

function MemoListPage({ memos, onBack, onAdd, onEdit, onDelete, onPatch }) {
  return (
    <section className="list-page">
      <header className="page-header">
        <button type="button" className="icon-button ghost" onClick={onBack} aria-label="ホームへ戻る">
          <ArrowLeft size={22} />
        </button>
        <div>
          <p className="eyebrow">メモ一覧</p>
          <h1>貼った付箋</h1>
        </div>
        <button type="button" className="icon-button primary" onClick={onAdd} aria-label="メモ追加">
          <Plus size={21} />
        </button>
      </header>

      {memos.length === 0 ? (
        <button type="button" className="list-empty" onClick={onAdd}>
          <StickyNote size={26} />
          まだ付箋がありません
        </button>
      ) : (
        <div className="memo-list">
          {memos.map(memo => (
            <article key={memo.id} className={`list-memo ${MEMO_COLORS[memo.color].className} ${memo.archived ? 'is-archived' : ''}`}>
              <button type="button" className="list-memo-main" onClick={() => onEdit(memo)}>
                <strong>{getMemoPreview(memo)}</strong>
                <span>{memo.type === 'checklist' ? 'チェックリスト' : '自由メモ'}</span>
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
