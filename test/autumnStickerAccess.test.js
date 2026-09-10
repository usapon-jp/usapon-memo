import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTUMN_ENTITLEMENT_ID,
  AUTUMN_FREE_STICKER_ID,
  AUTUMN_PAID_STICKER_IDS,
  AUTUMN_STICKER_IDS,
  AUTUMN_TRIAL_ENTITLEMENT_STICKER_IDS,
  AUTUMN_TRIAL_PRODUCT_KEY,
  AUTUMN_TRIAL_STICKER_IDS,
  PACKAGE_THEME_PACK_ASSETS_BUCKET,
  getAutumnStickerConfig,
  memoAuthRedirectUrl,
  signInWithGoogle,
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

 test('Googleログインは開いたページにかかわらず登録済みのメモURLへ戻る', () => {
  for (const suffix of ['', '/', '/index.html', '/?materials=received', '/index.html?install=1#memo']) {
    assert.equal(memoAuthRedirectUrl(`https://usapon-jp.github.io/usapon-memo${suffix}`), 'https://usapon-jp.github.io/usapon-memo/');
  }
  assert.equal(memoAuthRedirectUrl('http://127.0.0.1:4191/usapon-memo/index.html'), 'http://127.0.0.1:4191/usapon-memo/');
});

test('ログインし直すとGoogleのアカウント選択を表示しメモへ戻る', async () => {
  const previous = globalThis.window;
  globalThis.window = { location: { href: 'https://usapon-jp.github.io/usapon-memo/?materials=received' } };
  let args;
  try {
    await signInWithGoogle({ auth: { signInWithOAuth: async input => { args = input; return { error: null }; } } });
    assert.equal(args.options.redirectTo, 'https://usapon-jp.github.io/usapon-memo/');
    assert.equal(args.options.queryParams.prompt, 'select_account');
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});

test('有料セットだけの購入者にも無料柄を含めた26点を表示する', async () => {
 const client = {
  auth: {getSession: async () => ({data:{session:{user:{id:'paid-user'}}}})},
  schema: name => ({from:()=>query({data:name==='package'?[{theme_pack_id:'autumn-letter-set'}]:[],error:null})}),
  storage: {from:()=>({download:async()=>({data:new Blob(['test']),error:null})})}
 };
 const result = await loadAutumnStickerAccess(client,getAutumnStickerConfig({}));
 try { assert.equal(result.status,'ready'); assert.equal(result.allPaidAssetsLoaded,true); assert.deepEqual(Object.keys(result.sources).sort(),[...AUTUMN_STICKER_IDS].sort()); }
 finally { revokePaidStickerSources(result.sources); }
});

test('起動時はボードで使用中の有料素材だけを読み込める', async () => {
 const downloaded = [];
 const client = {
  auth: {getSession: async () => ({data:{session:{user:{id:'paid-user'}}}})},
  schema: name => ({from:()=>query({data:name==='package'?[{theme_pack_id:'autumn-letter-set'}]:[],error:null})}),
  storage: {from:()=>({download:async path=>{ downloaded.push(path); return {data:new Blob(['test']),error:null}; }})}
 };
 const target = AUTUMN_PAID_STICKER_IDS[3];
 const result = await loadAutumnStickerAccess(client,getAutumnStickerConfig({}),{assetIds:[target]});
 try {
  assert.equal(result.status,'ready');
  assert.equal(result.allPaidAssetsLoaded,false);
  assert.deepEqual(downloaded,[`${AUTUMN_ENTITLEMENT_ID}/${target}.png`]);
  assert.deepEqual(Object.keys(result.sources).sort(),[AUTUMN_FREE_STICKER_ID,target].sort());
 } finally { revokePaidStickerSources(result.sources); }
});
