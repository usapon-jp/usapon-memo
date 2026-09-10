import test from 'node:test';
import assert from 'node:assert/strict';
import { DrawingHistory, newDocument } from '../public/handwriting/core/document.mjs';
import { InputSession } from '../public/handwriting/core/input.mjs';
import { StrokeBuilder } from '../public/handwriting/core/stroke.mjs';

const touch = (id, time, x = 20, y = 20) => ({ id, type: 'touch', time, x, y, pressure: 0.5 });

test('二本指の軽いタップは一度だけ取り消し、動かした二本指操作では取り消さない', () => {
  let undoCount = 0;
  const input = new InputSession({ begin() {}, append() {}, finish() {}, cancel() {}, undo() { undoCount += 1; } });

  input.down(touch(1, 0));
  input.down(touch(2, 30));
  input.up(touch(1, 80));
  input.up(touch(2, 100));
  assert.equal(undoCount, 1);

  input.down(touch(3, 300));
  input.down(touch(4, 330));
  input.move(touch(3, 360, 42, 20));
  input.up(touch(3, 380, 42, 20));
  input.up(touch(4, 400));
  assert.equal(undoCount, 1);
});

test('手書き履歴は続けて書いた線を順番に戻し、やり直せる', () => {
  const history = new DrawingHistory(newDocument({ width: 390, height: 700 }));
  const stroke = (x) => {
    const builder = new StrokeBuilder({ tool: 'pen', input: 'touch', color: '#594536', size: 4, time: 0 });
    builder.sample({ x, y: 20, time: 0, pressure: 0.5 });
    builder.sample({ x: x + 20, y: 40, time: 16, pressure: 0.5 });
    return builder.stroke;
  };

  history.commit(stroke(10));
  history.commit(stroke(60));
  assert.equal(history.document.strokes.length, 2);
  history.undo();
  assert.equal(history.document.strokes.length, 1);
  history.undo();
  assert.equal(history.document.strokes.length, 0);
  history.redo();
  assert.equal(history.document.strokes.length, 1);
  history.redo();
  assert.equal(history.document.strokes.length, 2);
});
