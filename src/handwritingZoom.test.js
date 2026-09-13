import test from 'node:test';
import assert from 'node:assert/strict';
import { zoomedStageLayout } from '../public/handwriting/core/zoom.mjs';

test('縮小したキャンバスは表示領域の中央に置く', () => {
  assert.deepEqual(zoomedStageLayout(1000, 1000, 0.5, 800, 600), {
    width: 800,
    height: 600,
    offsetX: 150,
    offsetY: 50
  });
});

test('拡大したキャンバスはスクロールできる大きさを確保する', () => {
  assert.deepEqual(zoomedStageLayout(1000, 1000, 2, 800, 600), {
    width: 2000,
    height: 2000,
    offsetX: 0,
    offsetY: 0
  });
});
