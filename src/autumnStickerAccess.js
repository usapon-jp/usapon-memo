import { createClient } from '@supabase/supabase-js';

export const AUTUMN_ENTITLEMENT_ID = 'autumn-letter-set';
export const AUTUMN_FREE_STICKER_ID = 'autumn-stamp-9803';
export const AUTUMN_TRIAL_PRODUCT_KEY = 'goodnotes-autumn-trial-set';
export const PACKAGE_THEME_PACK_ASSETS_BUCKET = 'package-theme-pack-assets';
export const AUTUMN_PAID_STAMP_IDS = [
  'autumn-stamp-9798', 'autumn-stamp-9799', 'autumn-stamp-9800', 'autumn-stamp-9801',
  'autumn-stamp-9802', 'autumn-stamp-9804', 'autumn-stamp-9805', 'autumn-stamp-9806',
  'autumn-stamp-9807', 'autumn-stamp-9809', 'autumn-stamp-9810', 'autumn-stamp-9811',
  'autumn-stamp-9812', 'autumn-stamp-9813', 'autumn-stamp-9814', 'autumn-stamp-9815',
  'autumn-stamp-9816', 'autumn-stamp-9817', 'autumn-stamp-9818', 'autumn-stamp-9819',
  'autumn-stamp-9820', 'autumn-stamp-9821', 'autumn-stamp-9822', 'autumn-stamp-9823',
  'autumn-stamp-extra'
];
export const AUTUMN_PAID_STATIONERY_IDS = [
  'autumn-sticky-01', 'autumn-sticky-02', 'autumn-sticky-03', 'autumn-sticky-04', 'autumn-sticky-05',
  'autumn-heading-01', 'autumn-heading-02', 'autumn-heading-03', 'autumn-heading-04', 'autumn-heading-05',
  'autumn-tape-01', 'autumn-tape-02'
];
export const AUTUMN_PAID_STICKER_IDS = [...AUTUMN_PAID_STAMP_IDS, ...AUTUMN_PAID_STATIONERY_IDS];
export const AUTUMN_STICKER_IDS = [
  ...AUTUMN_PAID_STICKER_IDS.slice(0, 5),
  AUTUMN_FREE_STICKER_ID,
  ...AUTUMN_PAID_STICKER_IDS.slice(5)
];
export const AUTUMN_TRIAL_STICKER_IDS = [
  'autumn-trial-cover',
  'autumn-trial-sticky',
  'autumn-trial-heading',
  'autumn-trial-tape',
  AUTUMN_FREE_STICKER_ID
];
export const AUTUMN_TRIAL_ENTITLEMENT_STICKER_IDS = AUTUMN_TRIAL_STICKER_IDS
  .filter((id) => id !== AUTUMN_FREE_STICKER_ID);

const supplied = (value = '') => typeof value === 'string' && value.trim() && !value.includes('your_');

export const getAutumnStickerConfig = (env = {}) => ({
  url: env.VITE_SUPABASE_URL?.trim() || '',
  publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '',
  bucket: PACKAGE_THEME_PACK_ASSETS_BUCKET,
  freeStickerUrl: `${env.BASE_URL || '/usapon-memo/'}assets/stickers/autumn-stamp-9803.png`
});

export const getAutumnTrialStickerSources = (env = {}) => {
  const baseUrl = env.BASE_URL || '/usapon-memo/';
  return {
    'autumn-trial-cover': `${baseUrl}assets/stickers/autumn-trial/autumn-trial-cover.png`,
    'autumn-trial-sticky': `${baseUrl}assets/stickers/autumn-trial/autumn-trial-sticky.png`,
    'autumn-trial-heading': `${baseUrl}assets/stickers/autumn-trial/autumn-trial-heading.png`,
    'autumn-trial-tape': `${baseUrl}assets/stickers/autumn-trial/autumn-trial-tape.png`,
    [AUTUMN_FREE_STICKER_ID]: `${baseUrl}assets/stickers/autumn-stamp-9803.png`
  };
};

export const isSupabaseConfigured = (config) => (
  config.url.startsWith('https://') && supplied(config.publishableKey)
);

const config = getAutumnStickerConfig(import.meta.env);
export const memoSupabase = isSupabaseConfigured(config)
  ? createClient(config.url, config.publishableKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  })
  : null;

export const getAutumnPaidAssetFileName = (id) => `${id}.png`;

export function revokePaidStickerSources(sources = {}, urlApi = URL) {
  AUTUMN_PAID_STICKER_IDS.forEach((id) => {
    const source = sources[id];
    if (typeof source === 'string' && source.startsWith('blob:')) urlApi.revokeObjectURL(source);
  });
}

export async function loadAutumnStickerAccess(client = memoSupabase, settings = config, options = {}) {
  const sources = {};
  if (!client) return { status: 'unconfigured', sources, allPaidAssetsLoaded: true, error: '' };

  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError) return { status: 'error', sources, allPaidAssetsLoaded: true, error: sessionError.message };
  if (!session?.user) return { status: 'signed-out', sources, allPaidAssetsLoaded: true, error: '' };

  const { data: paidData, error: paidError } = await client.schema('package')
    .from('theme_pack_entitlements')
    .select('theme_pack_id')
    .eq('theme_pack_id', AUTUMN_ENTITLEMENT_ID);
  const { data: trialData, error: trialError } = await client.schema('digital_shop')
    .from('free_product_entitlements')
    .select('product_key, purchaser_user_id, revoked_at')
    .eq('product_key', AUTUMN_TRIAL_PRODUCT_KEY)
    .eq('purchaser_user_id', session.user.id)
    .is('revoked_at', null);
  const paidEntitled = !paidError && paidData?.some((row) => row.theme_pack_id === AUTUMN_ENTITLEMENT_ID);
  const trialEntitled = !trialError && trialData?.some((row) => (
    row.product_key === AUTUMN_TRIAL_PRODUCT_KEY
    && row.purchaser_user_id === session.user.id
    && row.revoked_at == null
  ));
  if (!paidEntitled && !trialEntitled) {
    const accessError = paidError || trialError;
    return { status: accessError ? 'error' : 'not-entitled', sources, allPaidAssetsLoaded: true, error: accessError?.message || '' };
  }
  const requestedPaidStickerIds = paidEntitled
    ? (Array.isArray(options.assetIds)
        ? AUTUMN_PAID_STICKER_IDS.filter(id => options.assetIds.includes(id))
        : AUTUMN_PAID_STICKER_IDS)
    : [];
  const downloaded = await Promise.all(requestedPaidStickerIds.map(async (id) => {
    try {
      const { data: blob, error: downloadError } = await client.storage
        .from(settings.bucket)
        .download(`${AUTUMN_ENTITLEMENT_ID}/${getAutumnPaidAssetFileName(id)}`);
      return downloadError ? null : [id, URL.createObjectURL(blob)];
    } catch {
      return null;
    }
  }));
  for (const entry of downloaded) {
    if (entry) sources[entry[0]] = entry[1];
  }
  if (downloaded.some((entry) => !entry)) {
    revokePaidStickerSources(sources);
    return { status: 'assets-unavailable', sources: {}, error: '購入済み素材をすべて読み込めませんでした。' };
  }
  if (paidEntitled) sources[AUTUMN_FREE_STICKER_ID] = settings.freeStickerUrl;
  if (trialEntitled) Object.assign(sources, getAutumnTrialStickerSources(import.meta.env));
  return {
    userId: session.user.id,
    packs: [...(paidEntitled ? ['autumn-letter-set'] : []), ...(trialEntitled ? ['goodnotes-autumn-trial-set'] : [])],
    status: paidEntitled ? 'ready' : 'trial-ready',
    allPaidAssetsLoaded: !paidEntitled || requestedPaidStickerIds.length === AUTUMN_PAID_STICKER_IDS.length,
    sources,
    error: paidError?.message || trialError?.message || ''
  };
}

export function memoAuthRedirectUrl(href, baseUrl = '/usapon-memo/') {
  const page = new URL(href);
  // Always use the registered application root, never index.html or a nested page.
  const redirect = new URL(baseUrl, page.origin);
  redirect.search = '';
  redirect.hash = '';
  if (!redirect.pathname.endsWith('/')) redirect.pathname += '/';
  return redirect.toString();
}

export async function signInWithGoogle(client = memoSupabase) {
  if (!client) throw new Error('共有ログインはまだ設定されていません。');
  const redirectTo = memoAuthRedirectUrl(window.location.href, import.meta.env?.BASE_URL || '/usapon-memo/');
  const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams: { prompt: 'select_account' } } });
  if (error) throw error;
}

export async function signOutFromMemo(client = memoSupabase) {
  if (!client) return;
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw error;
}
