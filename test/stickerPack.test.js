import test from 'node:test';
import assert from 'node:assert/strict';
import { createStickerPackBlob, readStickerPack } from '../src/stickerPack.js';

test('フォルダとPNGを一つのうさぽんステッカーパックで往復できる', async () => {
  const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
  const blob = createStickerPackBlob({
    folders: [{ id: 'animals', name: 'どうぶつ', order: 0 }],
    stickers: [{ id: 'rabbit', name: 'うさぎ', folderId: 'animals', mediaId: 'media-rabbit', order: 0, width: 320, height: 240, finish: 'white-outline' }],
    mediaRecords: [{ id: 'media-rabbit', dataUrl }]
  });
  const restored = await readStickerPack({ size: blob.size, arrayBuffer: () => blob.arrayBuffer() });
  assert.deepEqual(restored.folders.map(folder => [folder.id, folder.name]), [['animals', 'どうぶつ']]);
  assert.equal(restored.stickers[0].name, 'うさぎ');
  assert.equal(restored.stickers[0].folderId, 'animals');
  assert.equal(restored.stickers[0].finish, 'white-outline');
  assert.equal(restored.stickers[0].dataUrl, dataUrl);
});
