import test from 'node:test';
import assert from 'node:assert/strict';
import { availableStickerPacks } from '../src/stickerPacks.js';
import { DEFAULT_STICKER_IDS, STICKER_PACKS, normalizeData } from '../src/memoModel.js';
test('セット別に15個を超える購入済み素材をすべて選べる', () => {
 const ids = [...DEFAULT_STICKER_IDS, ...STICKER_PACKS.autumn.stickerIds, ...STICKER_PACKS.autumnTrial.stickerIds];
 const packs = availableStickerPacks(ids);
 assert.equal(packs.find(p => p.id === 'autumn').stickerIds.length, 26);
 assert.equal(packs.find(p => p.id === 'autumnTrial').stickerIds.length, 5);
});
test('未受取の素材は一覧に出さず、旧合言葉の受取済み素材は保持する', () => {
 assert.deepEqual(availableStickerPacks(DEFAULT_STICKER_IDS).map(p=>p.id), ['default']);
 const data = normalizeData({ unlockedStickerIds: [...DEFAULT_STICKER_IDS, 'autumn-stamp-9803'] });
 assert.ok(availableStickerPacks(data.unlockedStickerIds).find(p=>p.id==='autumnTrial').stickerIds.includes('autumn-stamp-9803'));
 assert.equal(availableStickerPacks(['unknown']).length,0);
});
test('セット単位の非表示と並び順を保存・復元し、管理には非表示セットも残す', () => {
 const ids = [...DEFAULT_STICKER_IDS, ...STICKER_PACKS.autumn.stickerIds, ...STICKER_PACKS.autumnTrial.stickerIds];
 const saved = normalizeData({stickerSetPreferences:{order:['autumnTrial','autumn','default'],hidden:['autumn']}});
 const restored = normalizeData(JSON.parse(JSON.stringify(saved)));
 assert.deepEqual(availableStickerPacks(ids, restored.stickerSetPreferences).map(p=>p.id),['autumnTrial','default']);
 assert.deepEqual(availableStickerPacks(ids, restored.stickerSetPreferences, true).map(p=>p.id),['autumnTrial','autumn','default']);
 assert.deepEqual(availableStickerPacks(DEFAULT_STICKER_IDS, restored.stickerSetPreferences).map(p=>p.id),['default']);
});
