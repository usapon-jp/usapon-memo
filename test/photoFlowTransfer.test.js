import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePhotoFlowContext, parsePhotoFlowResult } from '../src/photoFlowTransfer.js';

test('写真編集からは貼り方と未保存の写真カードを復元できる', () => {
  const context = { version: 1, mediaId: 'photo-card-123', placement: 'image', draft: { cardType: 'photo', boardId: 'home', caption: '夕方' } };
  assert.deepEqual(parsePhotoFlowContext(JSON.stringify(context)), context);
  assert.equal(parsePhotoFlowContext(JSON.stringify({ ...context, mediaId: '' })), null);
  assert.equal(parsePhotoFlowContext(JSON.stringify({ ...context, placement: 'other' })), null);
});

test('編集結果は一時的な写真IDだけを受け取り、画像データをURLへ載せない', () => {
  assert.deepEqual(parsePhotoFlowResult('{"version":1,"mediaId":"photo-flow-123"}'), { version: 1, mediaId: 'photo-flow-123' });
  assert.equal(parsePhotoFlowResult('{"version":1,"mediaId":"photo-card-123"}'), null);
});
