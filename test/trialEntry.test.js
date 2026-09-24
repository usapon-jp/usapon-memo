import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTUMN_TRIAL_PACK_ID, consumeAutumnTrialEntry } from '../src/trialEntry.js';

test('秋のお試し導線だけを消費し、他の検索条件とハッシュを残す', () => {
  assert.deepEqual(
    consumeAutumnTrialEntry('https://example.test/usapon-memo/?materials=received&trial=autumn&install=1#memo'),
    {
      initialStickerPack: AUTUMN_TRIAL_PACK_ID,
      cleanPath: '/usapon-memo/?materials=received&install=1#memo'
    }
  );
});

test('別のtrial値では既存の導線を消費しない', () => {
  assert.equal(consumeAutumnTrialEntry('https://example.test/usapon-memo/?trial=summer#memo'), null);
});
