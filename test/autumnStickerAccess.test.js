import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTUMN_FREE_STICKER_ID,
  AUTUMN_PAID_STICKER_IDS,
  AUTUMN_STICKER_IDS,
  PACKAGE_THEME_PACK_ASSETS_BUCKET,
  getAutumnStickerConfig,
  isSupabaseConfigured,
  loadAutumnStickerAccess,
  revokePaidStickerSources
} from '../src/autumnStickerAccess.js';

const visibleStickerIdsForAccess = (ids, availableAutumnIds) => ids.filter((id) => (
  !AUTUMN_STICKER_IDS.includes(id) || availableAutumnIds.includes(id)
));

test('秋セットは26点で、無料素材はIMG9803だけ', () => {
  assert.equal(AUTUMN_FREE_STICKER_ID, 'autumn-stamp-9803');
  assert.equal(AUTUMN_PAID_STICKER_IDS.length, 25);
  assert.equal(AUTUMN_STICKER_IDS.length, 26);
  assert.equal(AUTUMN_PAID_STICKER_IDS.includes(AUTUMN_FREE_STICKER_ID), false);
});

test('有料素材のblob URLだけを破棄し、無料素材は保持する', () => {
  const revoked = [];
  revokePaidStickerSources({
    'autumn-stamp-9798': 'blob:paid-sticker',
    'autumn-stamp-9803': 'https://example.test/free.png'
  }, { revokeObjectURL: (source) => revoked.push(source) });
  assert.deepEqual(revoked, ['blob:paid-sticker']);
});

test('ログアウト中は保存済みの有料表示設定を隠し、再認証で復元できる', () => {
  const saved = ['usa', 'autumn-stamp-9800'];
  assert.deepEqual(visibleStickerIdsForAccess(saved, []), ['usa']);
  assert.deepEqual(visibleStickerIdsForAccess(saved, ['autumn-stamp-9800']), saved);
});

test('共有Supabaseの設定がなければログイン接続を有効にしない', () => {
  assert.equal(isSupabaseConfigured(getAutumnStickerConfig({})), false);
  assert.equal(isSupabaseConfigured(getAutumnStickerConfig({
    VITE_SUPABASE_URL: 'https://vuxedteujpncjutiympt.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example'
  })), true);
});

test('権利がなければprivate Storageを読まない', async () => {
  let storageTouched = false;
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } }, error: null }) },
    schema: () => ({ from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }) }),
    storage: { from: () => { storageTouched = true; } }
  };
  const result = await loadAutumnStickerAccess(client, getAutumnStickerConfig({}));
  assert.equal(result.status, 'not-entitled');
  assert.equal(storageTouched, false);
  assert.equal(PACKAGE_THEME_PACK_ASSETS_BUCKET, 'package-theme-pack-assets');
});
