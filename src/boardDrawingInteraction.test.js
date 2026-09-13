import test from 'node:test';
import assert from 'node:assert/strict';
import { isShortTap } from './boardDrawingInteraction.js';

test('ステッカー上の小さな指移動は短いタップとして扱う', () => {
  assert.equal(isShortTap({ x: 100, y: 100 }, { x: 106, y: 107 }), true);
});

test('描き始める距離まで動いたら短いタップではない', () => {
  assert.equal(isShortTap({ x: 100, y: 100 }, { x: 111, y: 100 }), false);
});
