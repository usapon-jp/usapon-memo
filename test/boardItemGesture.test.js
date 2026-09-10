import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getBoardItemPinchScale,
  getGestureRotation,
  hasBoardItemDragStarted
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
