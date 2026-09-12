import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getBoardItemMaxXPercent,
  getBoardItemPinchScale,
  getGestureRotation,
  hasBoardItemDragStarted,
  isTrashDropTarget
} from '../src/boardItemGesture.js';

test('直接配置した素材は小さな指移動をドラッグとして扱う', () => {
  const origin = { clientX: 100, clientY: 100 };

  assert.equal(hasBoardItemDragStarted(origin, { clientX: 103, clientY: 102 }), false);
  assert.equal(hasBoardItemDragStarted(origin, { clientX: 104, clientY: 103 }), true);
});

test('追加スタンプのピンチ操作は指の距離より少し大きく反応する', () => {
  assert.ok(getBoardItemPinchScale(1, 100, 120) > 1.2);
  assert.ok(getBoardItemPinchScale(1, 100, 80) < 0.8);
  assert.equal(getBoardItemPinchScale(1.5, 100, 100), 1.5);
});

test('二本指の角度が180度境界をまたいでも最短方向に回転する', () => {
  assert.equal(getGestureRotation(10, 179, -179), 12);
  assert.equal(getGestureRotation(10, -179, 179), 8);
  assert.equal(getGestureRotation(-20, 30, 45), -5);
});

test('拡大した横長素材も見た目の右端だけを基準に移動範囲を決める', () => {
  const board = { left: 104, width: 560 };
  const item = { left: 358.2, right: 495.8 };

  assert.ok(Math.abs(getBoardItemMaxXPercent(board, item, 50) - 80.0357) < 0.001);
  assert.equal(getBoardItemMaxXPercent(null, item, 50), 96);
});

test('ゴミ箱は指だけでなく付箋やマステ本体の重なりでも反応する', () => {
  const trash = { left: 355, right: 413, top: 870, bottom: 928 };

  assert.equal(isTrashDropTarget(
    { clientX: 384, clientY: 900 },
    { left: 250, right: 330, top: 820, bottom: 850 },
    trash
  ), true);
  assert.equal(isTrashDropTarget(
    { clientX: 320, clientY: 850 },
    { left: 315, right: 370, top: 840, bottom: 878 },
    trash
  ), true);
  assert.equal(isTrashDropTarget(
    { clientX: 260, clientY: 780 },
    { left: 220, right: 300, top: 740, bottom: 810 },
    trash
  ), false);
});
