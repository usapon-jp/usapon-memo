import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeData } from '../src/memoModel.js';
import { newDocument, validateDocument } from '../public/handwriting/core/document.mjs';
import { StrokeBuilder } from '../public/handwriting/core/stroke.mjs';

test('全ての文房具の線をボード別に保存し、バックアップから復元できる', () => {
  const drawing = newDocument({ width: 390, height: 700 });
  for (const tool of ['pen', 'pencil', 'marker', 'crayon', 'watercolor', 'eraser']) {
    const builder = new StrokeBuilder({ tool, input: 'touch', color: '#594536', size: 8, time: 0 });
    builder.sample({ x: 20, y: 30, time: 0, pressure: 0.5 });
    builder.sample({ x: 60, y: 80, time: 16, pressure: 0.5 });
    drawing.strokes.push(builder.stroke);
  }
  const data = normalizeData({ boards: [{ id: 'one', label: 'One', drawing }, { id: 'two', label: 'Two' }] });
  const restored = normalizeData(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(restored.boards[0].drawing, validateDocument(drawing));
  assert.equal(restored.boards[1].drawing, null);
  assert.notEqual(restored.boards[0].drawing.strokes, drawing.strokes);
});

test('古いデータや不正な手書きがあってもボードを保持する', () => {
  const data = normalizeData({ boards: [{ id: 'one', label: '残す', drawing: { broken: true } }] });
  assert.equal(data.boards[0].label, '残す');
  assert.equal(data.boards[0].drawing, null);
  assert.ok(normalizeData({}).boards.length);
});

test('ボード背景は設定値を復元し、不正値はコルクに戻す', () => {
  assert.equal(normalizeData({ boardBackground: 'notebook' }).boardBackground, 'notebook');
  assert.equal(normalizeData({ boardBackground: 'paper' }).boardBackground, 'paper');
  assert.equal(normalizeData({ boardBackground: 'unknown' }).boardBackground, 'cork');
});
