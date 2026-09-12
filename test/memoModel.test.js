import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_BOARD_ITEM_MAX_SCALE,
  getBoardItemMaxScale,
  getBoardStickerInitialScale,
  normalizeBoardItem,
  sortBoardItemsForBoard,
  sortMemosForBoard,
  STATIONERY_BOARD_ITEM_MAX_SCALE,
  STICKER_CATALOG
} from '../src/memoModel.js';

test('ボードでは最後に動かした付箋が手前に描画される順になる', () => {
  const older = { id: 'older', updatedAt: '2026-09-09T01:00:00.000Z' };
  const latest = { id: 'latest', updatedAt: '2026-09-09T02:00:00.000Z' };

  assert.deepEqual(sortMemosForBoard([latest, older]).map(memo => memo.id), ['older', 'latest']);
});

test('直接配置素材も最後に触ったものが手前に描画される', () => {
  const older = { id: 'older', updatedAt: '2026-09-09T01:00:00.000Z' };
  const latest = { id: 'latest', updatedAt: '2026-09-09T02:00:00.000Z' };

  assert.deepEqual(sortBoardItemsForBoard([latest, older]).map(item => item.id), ['older', 'latest']);
});

test('秋の文房具は種類に合わせた初期サイズと書き込み方法を持つ', () => {
  const byId = Object.fromEntries(STICKER_CATALOG.map(sticker => [sticker.id, sticker]));

  assert.equal(byId['autumn-trial-cover'].boardTextMode, 'multiline');
  assert.equal(byId['autumn-trial-sticky'].boardTextMode, 'multiline');
  assert.equal(byId['autumn-trial-heading'].boardTextMode, 'singleline');
  assert.equal(byId['autumn-trial-tape'].boardTextMode, 'singleline');
  assert.equal(byId['autumn-stamp-9803'].boardTextMode, undefined);
  assert.equal(byId['autumn-sticky-05'].boardTextMode, 'multiline');
  assert.equal(byId['autumn-heading-05'].boardTextMode, 'singleline');
  assert.equal(byId['autumn-tape-02'].boardTextMode, 'singleline');
  assert.ok(getBoardStickerInitialScale('autumn-trial-tape') > 1);
  assert.equal(getBoardStickerInitialScale('autumn-stamp-9803'), 1);
  assert.ok(getBoardStickerInitialScale('autumn-stamp-9800') < 1);
});

test('付箋系だけをiPadで大きく拡大でき、通常スタンプの上限は維持する', () => {
  const sticky = { type: 'sticker', assetId: 'autumn-trial-sticky' };
  const heading = { type: 'sticker', assetId: 'autumn-trial-heading' };
  const stamp = { type: 'sticker', assetId: 'autumn-stamp-9803' };

  assert.equal(getBoardItemMaxScale(sticky), STATIONERY_BOARD_ITEM_MAX_SCALE);
  assert.equal(getBoardItemMaxScale(heading), STATIONERY_BOARD_ITEM_MAX_SCALE);
  assert.equal(getBoardItemMaxScale(stamp), DEFAULT_BOARD_ITEM_MAX_SCALE);
  assert.equal(normalizeBoardItem({ ...sticky, scale: 9 }).scale, STATIONERY_BOARD_ITEM_MAX_SCALE);
  assert.equal(normalizeBoardItem({ ...stamp, scale: 9 }).scale, DEFAULT_BOARD_ITEM_MAX_SCALE);
});
