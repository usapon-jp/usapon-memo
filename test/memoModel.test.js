import test from 'node:test';
import assert from 'node:assert/strict';

import { sortMemosForBoard } from '../src/memoModel.js';

test('ボードでは最後に動かした付箋が手前に描画される順になる', () => {
  const older = { id: 'older', updatedAt: '2026-09-09T01:00:00.000Z' };
  const latest = { id: 'latest', updatedAt: '2026-09-09T02:00:00.000Z' };

  assert.deepEqual(sortMemosForBoard([latest, older]).map(memo => memo.id), ['older', 'latest']);
});
