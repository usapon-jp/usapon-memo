import { createClient } from '@supabase/supabase-js';

export const AUTUMN_ENTITLEMENT_ID = 'autumn-letter-set';
export const AUTUMN_FREE_STICKER_ID = 'autumn-stamp-9803';
export const PACKAGE_THEME_PACK_ASSETS_BUCKET = 'package-theme-pack-assets';
export const AUTUMN_PAID_STICKER_IDS = [
  'autumn-stamp-9798', 'autumn-stamp-9799', 'autumn-stamp-9800', 'autumn-stamp-9801',
  'autumn-stamp-9802', 'autumn-stamp-9804', 'autumn-stamp-9805', 'autumn-stamp-9806',
  'autumn-stamp-9807', 'autumn-stamp-9809', 'autumn-stamp-9810', 'autumn-stamp-9811',
  'autumn-stamp-9812', 'autumn-stamp-9813', 'autumn-stamp-9814', 'autumn-stamp-9815',
  'autumn-stamp-9816', 'autumn-stamp-9817', 'autumn-stamp-9818', 'autumn-stamp-9819',
  'autumn-stamp-9820', 'autumn-stamp-9821', 'autumn-stamp-9822', 'autumn-stamp-9823',
  'autumn-stamp-extra'
];
export const AUTUMN_STICKER_IDS = [
  ...AUTUMN_PAID_STICKER_IDS.slice(0, 5),
  AUTUMN_FREE_STICKER_ID,
  ...AUTUMN_PAID_STICKER_IDS.slice(5)
];

const supplied = (value = '') => typeof value === 'string' && value.trim() && !value.includes('your_');

export const getAutumnStickerConfig = (env = {}) => ({
  url: env.VITE_SUPABASE_URL?.trim() || '',
  publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '',
  bucket: PACKAGE_THEME_PACK_ASSETS_BUCKET,
  freeStickerUrl: `${env.BASE_URL || '/usapon-memo/'}assets/stickers/autumn-stamp-9803.png`
});

export const isSupabaseConfigured = (config) => (
  config.url.startsWith('https://') && supplied(config.publishableKey)
);

const config = getAutumnStickerConfig(import.meta.env);
export const memoSupabase = isSupabaseConfigured(config)
  ? createClient(config.url, config.publishableKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  })
  : null;

const assetFileName = (id) => `${id}.png`;

export function revokePaidStickerSources(sources = {}, urlApi = URL) {
  AUTUMN_PAID_STICKER_IDS.forEach((id) => {
    const source = sources[id];
    if (typeof source === 'string' && source.startsWith('blob:')) urlApi.revokeObjectURL(source);
  });
}

export async function loadAutumnStickerAccess(client = memoSupabase, settings = config) {
  const sources = settings.freeStickerUrl ? { [AUTUMN_FREE_STICKER_ID]: settings.freeStickerUrl } : {};
  if (!client) return { status: 'unconfigured', sources, error: '' };

  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError) return { status: 'error', sources, error: sessionError.message };
  if (!session?.user) return { status: 'signed-out', sources, error: '' };

  const { data, error } = await client.schema('package')
    .from('theme_pack_entitlements')
    .select('theme_pack_id')
    .eq('theme_pack_id', AUTUMN_ENTITLEMENT_ID);
  if (error) return { status: 'error', sources, error: error.message };
  if (!data?.some((row) => row.theme_pack_id === AUTUMN_ENTITLEMENT_ID)) {
    return { status: 'not-entitled', sources, error: '' };
  }
  const downloaded = await Promise.all(AUTUMN_PAID_STICKER_IDS.map(async (id) => {
    try {
      const { data: blob, error: downloadError } = await client.storage
        .from(settings.bucket)
        .download(`${AUTUMN_ENTITLEMENT_ID}/${assetFileName(id)}`);
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
    return { status: 'assets-unavailable', sources: { [AUTUMN_FREE_STICKER_ID]: settings.freeStickerUrl }, error: '購入済み素材をすべて読み込めませんでした。' };
  }
  return { status: 'ready', sources, error: '' };
}

export async function signInWithGoogle(client = memoSupabase) {
  if (!client) throw new Error('共有ログインはまだ設定されていません。');
  const redirectTo = new URL(window.location.href);
  redirectTo.search = '';
  redirectTo.hash = '';
  const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo.toString() } });
  if (error) throw error;
}

export async function signOutFromMemo(client = memoSupabase) {
  if (!client) return;
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw error;
}
