import test from 'node:test';
import assert from 'node:assert/strict';
import { refineForegroundMask } from '../public/handwriting/core/cutout-mask.mjs';

test('keeps a dark eye opaque inside a cutout subject', () => {
  const width = 32;
  const height = 32;
  const raw = new Float32Array(width * height);
  for (let y = 5; y < 27; y++) {
    for (let x = 5; x < 27; x++) raw[y * width + x] = 1;
  }
  raw[16 * width + 16] = 0.6;
  const alpha = refineForegroundMask(raw, width, height);
  assert.equal(alpha[16 * width + 16], 255);
  assert.equal(alpha[0], 0);
});

test('rejects an empty segmentation result', () => {
  assert.throws(() => refineForegroundMask(new Float32Array(16), 4, 4), /マスク/);
});
