import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOARD_UNDO_LIMIT,
  captureBoardUndo,
  emptyBoardUndoHistory,
  redoBoardAction,
  undoBoardAction
} from '../src/boardUndoHistory.js';

test('ボードの操作を続けて戻し、同じ順序でやり直せる', () => {
  const first = { memos: [] };
  const second = { memos: ['a'] };
  const third = { memos: ['a', 'b'] };
  let history = captureBoardUndo(emptyBoardUndoHistory(), '追加 a', first);
  history = captureBoardUndo(history, '追加 b', second);

  const undoSecond = undoBoardAction(history, third);
  assert.equal(undoSecond.data, second);
  const undoFirst = undoBoardAction(undoSecond.history, undoSecond.data);
  assert.equal(undoFirst.data, first);
  assert.equal(undoBoardAction(undoFirst.history, undoFirst.data), null);

  const redoFirst = redoBoardAction(undoFirst.history, undoFirst.data);
  assert.equal(redoFirst.data, second);
  const redoSecond = redoBoardAction(redoFirst.history, redoFirst.data);
  assert.equal(redoSecond.data, third);
  assert.equal(redoBoardAction(redoSecond.history, redoSecond.data), null);
});

test('新しい操作でやり直し履歴を消し、履歴を20件までに保つ', () => {
  let history = emptyBoardUndoHistory();
  for (let index = 0; index < BOARD_UNDO_LIMIT + 2; index += 1) {
    history = captureBoardUndo(history, `操作 ${index}`, { index });
  }
  assert.equal(history.past.length, BOARD_UNDO_LIMIT);
  assert.equal(history.past[0].data.index, 2);
  const undone = undoBoardAction(history, { index: 22 });
  assert.equal(undone.history.future.length, 1);
  assert.equal(captureBoardUndo(undone.history, '新しい操作', undone.data).future.length, 0);
});
