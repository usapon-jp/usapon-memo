import test from 'node:test';
import assert from 'node:assert/strict';
import { DrawingHistory, newDocument } from '../public/handwriting/core/document.mjs';
import { InputSession } from '../public/handwriting/core/input.mjs';
import { StrokeBuilder } from '../public/handwriting/core/stroke.mjs';

const touch = (id, time, x = 20, y = 20) => ({ id, type: 'touch', time, x, y, pressure: 0.5 });
const pen = (id, time, x = 20, y = 20) => ({ id, type: 'pen', time, x, y, pressure: 0.5 });

test('Apple Pencilは手のひらによる停止状態より優先される', () => {
  let begins = 0;
  const input = new InputSession({ begin() { begins += 1; }, append() {}, finish() {}, cancel() {}, undo() {} });

  input.down(touch(1, 0));
  input.down(touch(2, 30));
  input.move(touch(1, 80, 42, 20));
  assert.equal(input.blocked, true);

  input.down(pen(3, 100));
  assert.equal(input.active?.type, 'pen');
  assert.equal(input.blocked, false);
  assert.deepEqual([...input.pointers.keys()], [3]);
  assert.equal(begins, 2);

  input.down(touch(4, 120));
  assert.deepEqual([...input.pointers.keys()], [3]);
});

test('Apple Pencilの終了通知が欠けても同じIDの次の一画を開始できる', () => {
  const actions = [];
  const input = new InputSession({
    begin(p) { actions.push(['begin', p.x]); },
    append() {},
    finish() { actions.push(['finish']); },
    cancel() { actions.push(['cancel']); },
    undo() {}
  });

  input.down(pen(3, 100, 20));
  input.down(pen(3, 200, 60));
  assert.deepEqual(actions, [['begin', 20], ['finish'], ['begin', 60]]);
  assert.equal(input.active?.x, 60);
  input.up(pen(3, 230, 70));
  assert.deepEqual(actions.at(-1), ['finish']);
  assert.equal(input.pointers.size, 0);
});

test('Apple Pencilが中断されても受け取った線を残し、次の一画を受け付ける', () => {
  const actions = [];
  const input = new InputSession({
    begin() { actions.push('begin'); }, append() {},
    finish() { actions.push('finish'); }, cancel() { actions.push('cancel'); }, undo() {}
  });

  input.down(pen(7, 100));
  input.up(pen(7, 130), true, 'pointercancel');
  input.down(pen(7, 200));
  input.up(pen(7, 230));
  assert.deepEqual(actions, ['begin', 'finish', 'begin', 'finish']);
});

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
