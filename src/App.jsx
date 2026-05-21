import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckSquare,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { loadMemoData, saveMemoData } from './storage.js';

const CATEGORIES = [
  { id: 'relax', color: '#EAF5E8', label: 'のんびり', buddy: 'piyo.png', alt: 'ひよこ' },
  { id: 'wakuwaku', color: '#FFF5BD', label: 'わくわく', buddy: 'lemon.png', alt: 'レモン' },
  { id: 'todo', color: '#E8F4FA', label: 'TODO', buddy: 'usa.png', alt: 'グレーのうさぎ' },
  { id: 'routine', color: '#FFF8E8', label: 'ルーティン', buddy: 'pon.png', alt: '茶色のうさぎ' }
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(category => [category.id, category]));

const createChecklistItem = (text = '', done = false) => ({
  id: crypto.randomUUID(),
  text,
  done
});

const createEmptyDraft = () => ({
  id: null,
  title: '',
  category: 'routine',
  memo: '',
  checklist: [createChecklistItem(), createChecklistItem()],
  status: 'active'
});

const cleanChecklist = (items) => items
  .map(item => ({ ...item, text: item.text.trim() }))
  .filter(item => item.text);

const getTitleFromDraft = (draft) => {
  const explicitTitle = draft.title.trim();
  if (explicitTitle) return explicitTitle;
  return cleanChecklist(draft.checklist)[0]?.text || 'やることリスト';
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

export default function App() {
  const [data, setData] = useState(loadMemoData);
  const [screen, setScreen] = useState('editor');
  const [draft, setDraft] = useState(createEmptyDraft);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    saveMemoData(data);
  }, [data]);

  const activeMemos = useMemo(() => (
    data.memos
      .filter(memo => showArchived ? memo.status === 'archived' : memo.status !== 'archived')
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  ), [data.memos, showArchived]);

  const openNewMemo = () => {
    setDraft(createEmptyDraft());
    setScreen('editor');
  };

  const openMemo = (memo) => {
    setDraft({
      ...memo,
      checklist: memo.checklist.length ? memo.checklist.map(item => ({ ...item })) : [createChecklistItem()]
    });
    setScreen('editor');
  };

  const saveDraft = (status = 'active') => {
    const checklist = cleanChecklist(draft.checklist);
    const memoText = draft.memo.trim();
    if (!draft.title.trim() && checklist.length === 0 && !memoText) return;

    const now = new Date().toISOString();
    const nextMemo = {
      id: draft.id || crypto.randomUUID(),
      title: getTitleFromDraft(draft),
      category: draft.category,
      memo: memoText,
      checklist,
      status,
      createdAt: draft.createdAt || now,
      updatedAt: now
    };

    const isEditing = Boolean(draft.id);
    setData(current => ({
      ...current,
      memos: draft.id
        ? current.memos.map(memo => memo.id === draft.id ? nextMemo : memo)
        : [nextMemo, ...current.memos]
    }));
    if (isEditing) {
      setScreen('list');
      return;
    }
    setDraft(createEmptyDraft());
    setScreen('editor');
  };

  const resetDraft = () => {
    setDraft(createEmptyDraft());
  };

  const archiveMemo = (memoId) => {
    setData(current => ({
      ...current,
      memos: current.memos.map(memo => (
        memo.id === memoId ? { ...memo, status: 'archived', updatedAt: new Date().toISOString() } : memo
      ))
    }));
  };

  const restoreMemo = (memoId) => {
    setData(current => ({
      ...current,
      memos: current.memos.map(memo => (
        memo.id === memoId ? { ...memo, status: 'active', updatedAt: new Date().toISOString() } : memo
      ))
    }));
  };

  const deleteMemo = (memoId) => {
    const confirmed = window.confirm('このメモを削除しますか？');
    if (!confirmed) return;
    setData(current => ({
      ...current,
      memos: current.memos.filter(memo => memo.id !== memoId)
    }));
    setScreen('list');
  };

  if (screen === 'editor') {
    return (
      <MemoEditor
        draft={draft}
        setDraft={setDraft}
        onBack={() => setScreen('list')}
        onOpenList={() => setScreen('list')}
        onSave={saveDraft}
        onReset={resetDraft}
        onDelete={draft.id ? () => deleteMemo(draft.id) : null}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="list-header">
        <div>
          <p className="eyebrow">うさぽんメモ</p>
          <h1>やることリスト</h1>
        </div>
        <button className="icon-button primary" type="button" onClick={openNewMemo} aria-label="メモを追加">
          <Plus size={24} />
        </button>
      </header>

      <section className="list-hero">
        <img src={`${import.meta.env.BASE_URL}assets/piyo.png`} alt="ピヨ" />
        <div>
          <p>思いついたことを、軽く置いておく場所。</p>
          <button type="button" onClick={openNewMemo}>新しいメモを書く</button>
        </div>
      </section>

      <div className="segmented-control" aria-label="表示切り替え">
        <button type="button" className={!showArchived ? 'active' : ''} onClick={() => setShowArchived(false)}>
          メモ
        </button>
        <button type="button" className={showArchived ? 'active' : ''} onClick={() => setShowArchived(true)}>
          アーカイブ
        </button>
      </div>

      {activeMemos.length === 0 ? (
        <button className="empty-state" type="button" onClick={openNewMemo}>
          <CheckSquare size={24} />
          <strong>{showArchived ? 'アーカイブはまだ空です' : 'メモはまだありません'}</strong>
          <span>{showArchived ? '使わないメモをしまうとここに残ります。' : 'チェック付きメモを作ってみましょう。'}</span>
        </button>
      ) : (
        <section className="memo-grid" aria-label={showArchived ? 'アーカイブ済みメモ' : '保存済みメモ'}>
          {activeMemos.map(memo => (
            <MemoCard
              key={memo.id}
              memo={memo}
              onOpen={() => openMemo(memo)}
              onArchive={() => archiveMemo(memo.id)}
              onRestore={() => restoreMemo(memo.id)}
              onDelete={() => deleteMemo(memo.id)}
              isArchived={showArchived}
            />
          ))}
        </section>
      )}
    </main>
  );
}

function MemoCard({ memo, onOpen, onArchive, onRestore, onDelete, isArchived }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const category = CATEGORY_MAP[memo.category] || CATEGORY_MAP.relax;
  const checklist = memo.checklist.filter(item => item.text.trim());
  const doneCount = checklist.filter(item => item.done).length;

  return (
    <article className={`memo-card sticky-note ${memo.category || 'relax'}`}>
      <button className="memo-card-main" type="button" onClick={onOpen}>
        <span className="memo-card-label">{category.label}</span>
        <strong>{memo.title}</strong>
        <span className="memo-card-date">{formatDate(memo.updatedAt)}</span>
        <span className="memo-card-lines">
          {checklist.slice(0, 4).map(item => (
            <span key={item.id} className={item.done ? 'is-done' : ''}>
              <i aria-hidden="true" />
              {item.text}
            </span>
          ))}
          {checklist.length === 0 && memo.memo && (
            <span>
              <i aria-hidden="true" />
              {memo.memo}
            </span>
          )}
        </span>
        {checklist.length > 0 && <small>{doneCount}/{checklist.length}</small>}
        <img src={`${import.meta.env.BASE_URL}assets/${category.buddy}`} alt={category.alt} />
      </button>
      <button className="card-menu-button" type="button" onClick={() => setIsMenuOpen(value => !value)} aria-label="メニュー">
        <MoreHorizontal size={18} />
      </button>
      {isMenuOpen && (
        <div className="card-menu">
          <button type="button" onClick={onOpen}>編集</button>
          {isArchived ? (
            <button type="button" onClick={onRestore}>戻す</button>
          ) : (
            <button type="button" onClick={onArchive}>アーカイブ</button>
          )}
          <button type="button" className="danger" onClick={onDelete}>削除</button>
        </div>
      )}
    </article>
  );
}

function MemoEditor({ draft, setDraft, onBack, onOpenList, onSave, onReset, onDelete }) {
  const inputRefs = useRef({});
  const category = CATEGORY_MAP[draft.category] || CATEGORY_MAP.relax;
  const canSave = draft.title.trim() || draft.memo.trim() || cleanChecklist(draft.checklist).length > 0;

  const updateChecklistItem = (id, patch) => {
    setDraft(current => ({
      ...current,
      checklist: current.checklist.map(item => item.id === id ? { ...item, ...patch } : item)
    }));
  };

  const focusItem = (id) => {
    window.setTimeout(() => inputRefs.current[id]?.focus(), 0);
  };

  const addItem = (afterId = null) => {
    const nextItem = createChecklistItem();
    setDraft(current => {
      const index = current.checklist.findIndex(item => item.id === afterId);
      const checklist = index === -1
        ? [...current.checklist, nextItem]
        : [...current.checklist.slice(0, index + 1), nextItem, ...current.checklist.slice(index + 1)];
      return { ...current, checklist };
    });
    focusItem(nextItem.id);
  };

  const removeItem = (itemId, focusTarget) => {
    setDraft(current => ({
      ...current,
      checklist: current.checklist.filter(item => item.id !== itemId)
    }));
    if (focusTarget) focusItem(focusTarget);
  };

  const handleKeyDown = (event, item, index) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addItem(item.id);
      return;
    }

    if (event.key === 'Backspace' && item.text === '' && draft.checklist.length > 1) {
      event.preventDefault();
      const focusTarget = draft.checklist[index - 1]?.id || draft.checklist[index + 1]?.id;
      removeItem(item.id, focusTarget);
    }
  };

  return (
    <main className="editor-shell">
      <header className="editor-header">
        <button className="icon-button ghost" type="button" onClick={onBack} aria-label="一覧へ戻る">
          <ArrowLeft size={22} />
        </button>
        <button className="icon-button ghost" type="button" onClick={onOpenList} aria-label="一覧を開く">
          <MoreHorizontal size={24} />
        </button>
      </header>

      <section className="editor-title">
        <h1>やることリスト <span aria-hidden="true">☘</span></h1>
      </section>

      <section className="editor-stage">
        <section className={`editor-note sticky-note ${draft.category}`}>
          <span className="memo-tape" aria-hidden="true" />

          <div className="checklist-editor">
            {draft.checklist.map((item, index) => (
              <label key={item.id} className="checklist-row">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(event) => updateChecklistItem(item.id, { done: event.target.checked })}
                  aria-label={`${index + 1}行目をチェック`}
                />
                <input
                  type="text"
                  ref={(element) => {
                    if (element) inputRefs.current[item.id] = element;
                  }}
                  value={item.text}
                  placeholder={index === 0 ? '買い物' : 'やること'}
                  onChange={(event) => updateChecklistItem(item.id, { text: event.target.value })}
                  onKeyDown={(event) => handleKeyDown(event, item, index)}
                />
              </label>
            ))}
          </div>

          <img src={`${import.meta.env.BASE_URL}assets/${category.buddy}`} alt={category.alt} />
        </section>

        <button className="memo-edit-button" type="button" onClick={() => focusItem(draft.checklist[0]?.id)}>
          編集する
        </button>
      </section>

      <div className="swatches" aria-label="メモの色">
        {CATEGORIES.map(item => (
          <button
            key={item.id}
            type="button"
            className={draft.category === item.id ? 'selected' : ''}
            style={{ background: item.color }}
            onClick={() => setDraft(current => ({ ...current, category: item.id }))}
            aria-label={item.label}
          />
        ))}
      </div>

      {onDelete && (
        <div className="editor-danger-zone">
          <button type="button" onClick={onDelete}>
            <Trash2 size={17} />
            削除
          </button>
        </div>
      )}

      <div className="editor-actions">
        <button className="primary-action" type="button" onClick={() => onSave('active')} disabled={!canSave}>
          保存
        </button>
        <button className="secondary-action" type="button" onClick={() => onSave('draft')} disabled={!canSave}>
          下書きに追加
        </button>
        <button className="tertiary-action" type="button" onClick={onReset}>
          <RotateCcw size={17} />
          リセット
        </button>
      </div>
    </main>
  );
}
