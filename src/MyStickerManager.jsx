import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Download, FolderPlus, Pencil, Trash2, Upload, X } from 'lucide-react';
import { MY_STICKER_UNFILED_ID } from './customStickers.js';

export default function MyStickerManager({
  stickers = [],
  folders = [],
  mediaUrls = {},
  onAddFolder,
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
  onUpdateSticker,
  onMoveSticker,
  onDeleteSticker,
  onExport,
  onImport,
  onShowToast
}) {
  const [editing, setEditing] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [selectedStickerId, setSelectedStickerId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const importRef = useRef(null);
  const selectedSticker = stickers.find(sticker => sticker.id === selectedStickerId) || null;
  const visibleStickers = useMemo(() => stickers
    .filter(sticker => selectedFolder === 'all' || sticker.folderId === selectedFolder)
    .sort((left, right) => left.order - right.order), [stickers, selectedFolder]);

  const createFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const id = onAddFolder(name);
    if (id) setSelectedFolder(id);
    setNewFolderName('');
    setAddingFolder(false);
  };

  const deleteFolder = (folder) => {
    if (!window.confirm(`「${folder.name}」を削除しますか？\n中のステッカーは未分類へ移動します。`)) return;
    onDeleteFolder(folder.id);
    setSelectedFolder('all');
    onShowToast?.('フォルダを削除し、中のステッカーを未分類へ移しました。');
  };

  const removeSticker = () => {
    if (!selectedSticker || !window.confirm(`「${selectedSticker.name}」をマイステッカーから削除しますか？\nボードやメモに配置済みのものは残ります。`)) return;
    onDeleteSticker(selectedSticker.id);
    setSelectedStickerId('');
    onShowToast?.('マイステッカーから削除しました。配置済みのものは残っています。');
  };

  return <section className="my-sticker-manager" aria-label="マイステッカー">
    <header className="my-sticker-manager-heading">
      <div><strong>マイステッカー</strong><span>{stickers.length}点</span></div>
      <button type="button" className="my-sticker-edit-toggle" aria-pressed={editing} onClick={() => { setEditing(current => !current); setSelectedStickerId(''); }}>
        {editing ? <Check size={17} /> : <Pencil size={16} />}{editing ? '完了' : '整理'}
      </button>
    </header>

    <div className="my-sticker-folder-bar" aria-label="フォルダ">
      <button type="button" aria-pressed={selectedFolder === 'all'} onClick={() => setSelectedFolder('all')}>すべて</button>
      <button type="button" aria-pressed={selectedFolder === MY_STICKER_UNFILED_ID} onClick={() => setSelectedFolder(MY_STICKER_UNFILED_ID)}>未分類</button>
      {folders.map(folder => <button key={folder.id} type="button" aria-pressed={selectedFolder === folder.id} onClick={() => setSelectedFolder(folder.id)}>{folder.name}</button>)}
      <button type="button" className="my-sticker-add-folder" aria-label="フォルダを追加" onClick={() => setAddingFolder(true)}><FolderPlus size={17} /></button>
    </div>

    {addingFolder && <form className="my-sticker-new-folder" onSubmit={event => { event.preventDefault(); createFolder(); }}>
      <input autoFocus maxLength={48} value={newFolderName} onChange={event => setNewFolderName(event.target.value)} placeholder="フォルダ名" aria-label="新しいフォルダ名" />
      <button type="submit" disabled={!newFolderName.trim()}>追加</button>
      <button type="button" aria-label="キャンセル" onClick={() => { setAddingFolder(false); setNewFolderName(''); }}><X size={17} /></button>
    </form>}

    {editing && selectedFolder !== 'all' && selectedFolder !== MY_STICKER_UNFILED_ID && (() => {
      const folder = folders.find(item => item.id === selectedFolder);
      if (!folder) return null;
      const index = folders.findIndex(item => item.id === folder.id);
      return <div className="my-sticker-folder-edit">
        <input aria-label="フォルダ名" maxLength={48} defaultValue={folder.name} key={`${folder.id}-${folder.name}`} onBlur={event => onRenameFolder(folder.id, event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
        <button type="button" disabled={index === 0} aria-label="フォルダを前へ" onClick={() => onMoveFolder(folder.id, -1)}><ArrowUp size={17} /></button>
        <button type="button" disabled={index === folders.length - 1} aria-label="フォルダを後ろへ" onClick={() => onMoveFolder(folder.id, 1)}><ArrowDown size={17} /></button>
        <button type="button" className="danger" aria-label="フォルダを削除" onClick={() => deleteFolder(folder)}><Trash2 size={17} /></button>
      </div>;
    })()}

    <div className="my-sticker-grid">
      {visibleStickers.map(sticker => <button key={sticker.id} type="button" className={selectedStickerId === sticker.id ? 'is-selected' : ''}
        aria-label={editing ? `${sticker.name}を整理` : sticker.name} onClick={() => editing && setSelectedStickerId(sticker.id)}>
        <img src={mediaUrls[sticker.mediaId]} alt="" />
      </button>)}
      {!visibleStickers.length && <p>このフォルダは空です。</p>}
    </div>

    {editing && selectedSticker && <div className="my-sticker-item-edit">
      <img src={mediaUrls[selectedSticker.mediaId]} alt="" />
      <label><span>名前</span><input maxLength={48} defaultValue={selectedSticker.name} key={`${selectedSticker.id}-${selectedSticker.name}`} onBlur={event => onUpdateSticker(selectedSticker.id, { name: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
      <label><span>保存先</span><select value={selectedSticker.folderId} onChange={event => { onUpdateSticker(selectedSticker.id, { folderId: event.target.value }); setSelectedFolder(event.target.value); }}><option value={MY_STICKER_UNFILED_ID}>未分類</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
      <div>
        <button type="button" aria-label="前へ" onClick={() => onMoveSticker(selectedSticker.id, -1)}><ArrowUp size={17} /></button>
        <button type="button" aria-label="後ろへ" onClick={() => onMoveSticker(selectedSticker.id, 1)}><ArrowDown size={17} /></button>
        <button type="button" className="danger" onClick={removeSticker}><Trash2 size={17} />削除</button>
      </div>
    </div>}

    <div className="my-sticker-transfer-actions">
      <button type="button" disabled={!stickers.length} onClick={onExport}><Download size={17} />他のアプリで使う</button>
      <button type="button" onClick={() => importRef.current?.click()}><Upload size={17} />読み込む</button>
    </div>
    <input ref={importRef} type="file" accept=".zip,.usapon-stickers.zip,application/zip" className="visually-hidden-file" onChange={async event => { await onImport(event.target.files?.[0]); event.target.value = ''; }} />
  </section>;
}
