import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTUMN_FREE_STICKER_ID,
  AUTUMN_PAID_STICKER_IDS,
  AUTUMN_STICKER_IDS,
  AUTUMN_TRIAL_ENTITLEMENT_STICKER_IDS,
  AUTUMN_TRIAL_PRODUCT_KEY,
  AUTUMN_TRIAL_STICKER_IDS,
  PACKAGE_THEME_PACK_ASSETS_BUCKET,
  getAutumnStickerConfig,
  isSupabaseConfigured,
  loadAutumnStickerAccess,
  revokePaidStickerSources
} from '../src/autumnStickerAccess.js';
import { STICKER_PACKS, normalizeData } from '../src/memoModel.js';

const visibleStickerIdsForAccess = (ids, availableAutumnIds) => ids.filter((id) => (
  !AUTUMN_STICKER_IDS.includes(id) || availableAutumnIds.includes(id)
));

test('秋セットは26点で、無料素材はIMG9803だけ', () => {
  assert.equal(AUTUMN_FREE_STICKER_ID, 'autumn-stamp-9803');
  assert.equal(AUTUMN_PAID_STICKER_IDS.length, 25);
  assert.equal(AUTUMN_STICKER_IDS.length, 26);
  assert.equal(AUTUMN_PAID_STICKER_IDS.includes(AUTUMN_FREE_STICKER_ID), false);
});

test('既存の合言葉レシートはIMG9803だけを端末に保存し、有料秋セットに合言葉はない', () => {
  assert.equal(STICKER_PACKS.autumn.code, undefined);
  assert.equal(STICKER_PACKS.autumnTrial.code, 'どんぐり');
  assert.deepEqual(STICKER_PACKS.autumnTrial.stickerIds, AUTUMN_TRIAL_STICKER_IDS);
  assert.deepEqual(STICKER_PACKS.autumnTrial.codeStickerIds, ['autumn-stamp-9803']);
  const data = normalizeData({
    unlockedStickerIds: ['autumn-stamp-9803'],
    visibleStickerIds: ['autumn-stamp-9803']
  });
  assert.deepEqual(data.unlockedStickerIds, ['usa', 'piyo', 'pon', 'lemon', 'autumn-stamp-9803']);
  assert.deepEqual(data.visibleStickerIds, ['autumn-stamp-9803']);
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

const query = (result) => {
  const builder = {
    eq: () => builder,
    is: () => builder,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  };
  return { select: () => builder };
};

test('権利がなければprivate Storageを読まない', async () => {
  let storageTouched = false;
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } }, error: null }) },
    schema: () => ({ from: () => query({ data: [], error: null }) }),
    storage: { from: () => { storageTouched = true; } }
  };
  const result = await loadAutumnStickerAccess(client, getAutumnStickerConfig({}));
  assert.equal(result.status, 'not-entitled');
  assert.equal(storageTouched, false);
  assert.equal(PACKAGE_THEME_PACK_ASSETS_BUCKET, 'package-theme-pack-assets');
});

test('無料お試しは同じUIDの有効な共有権利で5点を読み込む', async () => {
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } }, error: null }) },
    schema: (name) => ({ from: () => query(name === 'digital_shop'
      ? { data: [{ product_key: AUTUMN_TRIAL_PRODUCT_KEY, purchaser_user_id: 'user-1', revoked_at: null }], error: null }
      : { data: [], error: null }) }),
    storage: { from: () => { throw new Error('無料お試しではprivate Storageを読まない'); } }
  };
  const result = await loadAutumnStickerAccess(client, getAutumnStickerConfig({ BASE_URL: '/usapon-memo/' }));
  assert.equal(result.status, 'trial-ready');
  assert.deepEqual(Object.keys(result.sources).sort(), [...AUTUMN_TRIAL_STICKER_IDS].sort());
  assert.equal(AUTUMN_TRIAL_ENTITLEMENT_STICKER_IDS.includes(AUTUMN_FREE_STICKER_ID), false);
});

test('取り消された無料お試し権利では素材を解放しない', async () => {
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } }, error: null }) },
    schema: () => ({ from: () => query({ data: [{ product_key: AUTUMN_TRIAL_PRODUCT_KEY, purchaser_user_id: 'user-1', revoked_at: '2026-09-08T00:00:00Z' }], error: null }) }),
    storage: { from: () => { throw new Error('private Storageを読まない'); } }
  };
  const result = await loadAutumnStickerAccess(client, getAutumnStickerConfig({}));
  assert.equal(result.status, 'not-entitled');
  assert.deepEqual(result.sources, {});
});
