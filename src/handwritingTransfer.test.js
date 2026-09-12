import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHandwritingTransfer } from './handwritingTransfer.js';

test('手書き受け渡しはPNGと寸法だけを受け取る', () => {
  const transfer = parseHandwritingTransfer(JSON.stringify({
    version: 1,
    dataUrl: 'data:image/png;base64,AAAA',
    width: 320,
    height: 240,
    backgroundIncluded: true,
    ignored: 'host-private-field'
  }));
  assert.deepEqual(transfer, {
    dataUrl: 'data:image/png;base64,AAAA',
    width: 320,
    height: 240,
    backgroundIncluded: true,
    finish: 'paper',
    saveToMyStickers: false,
    stickerName: '',
    stickerFolderId: 'unfiled'
  });
});

test('白ふちのマイステッカー登録情報を受け取る', () => {
  const transfer = parseHandwritingTransfer(JSON.stringify({
    version: 2,
    dataUrl: 'data:image/png;base64,AAAA',
    width: 320,
    height: 240,
    finish: 'white-outline',
    saveToMyStickers: true,
    stickerName: ' うさぎ ',
    stickerFolderId: 'animals'
  }));
  assert.equal(transfer.finish, 'white-outline');
  assert.equal(transfer.saveToMyStickers, true);
  assert.equal(transfer.stickerName, 'うさぎ');
  assert.equal(transfer.stickerFolderId, 'animals');
});

test('不正形式や大きすぎる寸法は受け取らない', () => {
  assert.equal(parseHandwritingTransfer('{broken'), null);
  assert.equal(parseHandwritingTransfer(JSON.stringify({ version: 1, dataUrl: 'data:text/plain;base64,AAAA', width: 20, height: 20 })), null);
  assert.equal(parseHandwritingTransfer(JSON.stringify({ version: 1, dataUrl: 'data:image/png;base64,AAAA', width: 9000, height: 20 })), null);
});
