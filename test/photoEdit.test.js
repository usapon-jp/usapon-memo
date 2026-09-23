import test from 'node:test';
import assert from 'node:assert/strict';
import { connectedColorRegion, photoPointFromClient } from '../public/handwriting/core/photo-edit.mjs';

test('tap erases only the connected background colour', () => {
  const pixels = new Uint8ClampedArray([
    220, 220, 220, 255, 218, 220, 220, 255, 30, 30, 30, 255,
    220, 220, 220, 255, 218, 220, 220, 255, 30, 30, 30, 255,
    220, 220, 220, 255, 30, 30, 30, 255, 220, 220, 220, 255
  ]);
  const result = connectedColorRegion(pixels, 3, 3, 0, 0, { maxFraction: 0.8 });
  assert.equal(result.count, 5);
  assert.equal(result.mask[8], 0);
  assert.equal(result.mask[2], 0);
});

test('transparent areas and overly broad selections remain unchanged', () => {
  const pixels = new Uint8ClampedArray(4 * 4 * 4).fill(200);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  pixels[3] = 0;
  assert.equal(connectedColorRegion(pixels, 4, 4, 0, 0).count, 0);
  assert.equal(connectedColorRegion(pixels, 4, 4, 1, 0).tooLarge, true);
});

test('a tap cannot spread into a distant area of the same colour', () => {
  const pixels = new Uint8ClampedArray(9 * 9 * 4).fill(200);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  const result = connectedColorRegion(pixels, 9, 9, 4, 4, { radius: 2, maxFraction: 0.9 });
  assert.equal(result.mask[4 * 9 + 4], 1);
  assert.equal(result.mask[4 * 9 + 8], 0);
  assert.equal(result.mask[0], 0);
});

test('brush coordinates follow a rotated photo', () => {
  const geometry = { centerX: 100, centerY: 100, displayWidth: 80, displayHeight: 120, imageWidth: 800, imageHeight: 1200, rotation: 90 };
  assert.deepEqual(photoPointFromClient(100, 100, geometry), { x: 400, y: 600 });
  assert.deepEqual(photoPointFromClient(100, 120, geometry), { x: 600, y: 600 });
  assert.equal(photoPointFromClient(100, 150, geometry), null);
});
