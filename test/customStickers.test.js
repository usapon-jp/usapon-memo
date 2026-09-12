import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCustomStickerLibrary, MY_STICKER_UNFILED_ID } from '../src/customStickers.js';

test('マイステッカーは不明な保存先を未分類へ戻し、順番を詰め直す', () => {
  const result = normalizeCustomStickerLibrary({
    customStickerFolders: [{ id: 'animals', name: 'どうぶつ', order: 3 }],
    customStickers: [
      { id: 'b', mediaId: 'media-b', name: 'B', folderId: 'missing', order: 8 },
      { id: 'a', mediaId: 'media-a', name: 'A', folderId: 'animals', order: 2 }
    ]
  });
  assert.deepEqual(result.customStickerFolders.map(folder => folder.id), ['animals']);
  assert.deepEqual(result.customStickers.map(sticker => [sticker.id, sticker.folderId, sticker.order]), [
    ['a', 'animals', 0],
    ['b', MY_STICKER_UNFILED_ID, 1]
  ]);
});

test('重複IDや画像のない項目を保存しない', () => {
  const result = normalizeCustomStickerLibrary({
    customStickers: [
      { id: 'one', mediaId: 'media-one', name: ' ひとつ ' },
      { id: 'one', mediaId: 'media-two', name: '重複' },
      { id: 'empty', name: '画像なし' }
    ]
  });
  assert.deepEqual(result.customStickers.map(sticker => sticker.name), ['ひとつ']);
});
