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

test('前のApple Pencilのcapture終了通知が遅れても次の線を止めない', () => {
  const actions = [];
  const input = new InputSession({
    begin(p) { actions.push(['begin', p.x]); },
    append(p) { actions.push(['append', p.x]); },
    finish() { actions.push(['finish']); },
    cancel() { actions.push(['cancel']); },
    undo() {}
  });
  input.down(pen(7, 100, 20));
  input.up(pen(7, 130, 30));
  input.down(pen(7, 200, 60));
  input.lostCapture(pen(7, 210, 30));
  input.move(pen(7, 220, 70));
  input.up(pen(7, 230, 80));
  assert.deepEqual(actions, [
    ['begin', 20], ['append', 30], ['finish'],
    ['begin', 60], ['append', 70], ['append', 80], ['finish']
  ]);
});

test('指のcapture終了通知では進行中の入力を片付ける', () => {
  const actions = [];
  const input = new InputSession({
    begin() { actions.push('begin'); }, append() {}, finish() {},
    cancel() { actions.push('cancel'); }, undo() {}
  });
  input.down(touch(4, 100));
  input.lostCapture(touch(4, 120));
  assert.deepEqual(actions, ['begin', 'cancel']);
  assert.equal(input.pointers.size, 0);
});

test('Apple Pencilの接触移動が先に届いたら線を開始し、ホバーと指は開始しない', () => {
  const actions = [];
  const input = new InputSession({
    begin(p) { actions.push(['begin', p.x]); },
    append(p) { actions.push(['append', p.x]); },
    finish() { actions.push(['finish']); },
    cancel() {}, undo() {}
  });

  input.move({ ...pen(1, 10, 10), pressure: 0, buttons: 0 });
  input.move({ ...touch(2, 20, 15), buttons: 1 });
  assert.deepEqual(actions, []);

  input.move({ ...pen(1, 30, 20), buttons: 1 });
  input.move({ ...pen(1, 40, 30), buttons: 1 });
  input.up({ ...pen(1, 50, 40), buttons: 0 });
  assert.deepEqual(actions, [['begin', 20], ['append', 20], ['append', 30], ['append', 40], ['finish']]);
  assert.equal(input.pointers.size, 0);

  input.move({ ...pen(3, 60, 50), buttons: 0 });
  input.up({ ...pen(3, 70, 60), buttons: 0 });
  assert.deepEqual(actions.slice(-4), [['begin', 50], ['append', 50], ['append', 60], ['finish']]);
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
