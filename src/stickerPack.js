import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  MY_STICKER_PACK_FORMAT,
  MY_STICKER_PACK_VERSION,
  MY_STICKER_LIMIT,
  normalizeCustomStickerFolders,
  normalizeCustomStickers,
  safeStickerFileName
} from './customStickers.js';

const MAX_PACK_BYTES = 60 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const dataUrlBytes = (dataUrl = '') => {
  const encoded = dataUrl.split(',')[1] || '';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const bytesDataUrl = (bytes, mimeType = 'image/png') => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
};

export async function sha256DataUrl(dataUrl) {
  const bytes = dataUrlBytes(dataUrl);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}
export function createStickerPackBlob({ folders = [], stickers = [], mediaRecords = [] }) {
  const normalizedFolders = normalizeCustomStickerFolders(folders);
  const normalizedStickers = normalizeCustomStickers(stickers, normalizedFolders);
  const mediaById = new Map(mediaRecords.map(record => [record.id, record]));
  const files = {};
  const manifestStickers = [];
  const usedPaths = new Set();

  for (const sticker of normalizedStickers) {
    const media = mediaById.get(sticker.mediaId);
    if (!media?.dataUrl?.startsWith('data:image/png;base64,')) continue;
    const bytes = dataUrlBytes(media.dataUrl);
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) continue;
    let file = `stickers/${safeStickerFileName(sticker.name, sticker.id)}`;
    if (usedPaths.has(file)) file = `stickers/${sticker.id}.png`;
    usedPaths.add(file);
    files[file] = bytes;
    manifestStickers.push({
      id: sticker.id,
      name: sticker.name,
      folderId: sticker.folderId,
      order: sticker.order,
      file,
      contentHash: sticker.contentHash,
      width: sticker.width,
      height: sticker.height,
      finish: sticker.finish
    });
  }

  if (!manifestStickers.length) throw new Error('書き出せるマイステッカーがありません。');
  files['manifest.json'] = strToU8(JSON.stringify({
    format: MY_STICKER_PACK_FORMAT,
    version: MY_STICKER_PACK_VERSION,
    exportedAt: new Date().toISOString(),
    folders: normalizedFolders,
    stickers: manifestStickers
  }, null, 2));
  return new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' });
}

export async function readStickerPack(file) {
  if (!file || file.size > MAX_PACK_BYTES) throw new Error('ステッカーパックが大きすぎます。');
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const manifestBytes = files['manifest.json'];
  if (!manifestBytes) throw new Error('ステッカーパックの情報が見つかりません。');
  let manifest;
  try { manifest = JSON.parse(strFromU8(manifestBytes)); }
  catch { throw new Error('ステッカーパックの情報を読み取れません。'); }
  if (manifest?.format !== MY_STICKER_PACK_FORMAT || manifest?.version !== MY_STICKER_PACK_VERSION || !Array.isArray(manifest.stickers)) {
    throw new Error('対応していないステッカーパックです。');
  }
  if (manifest.stickers.length > MY_STICKER_LIMIT) throw new Error('一度に読み込めるステッカーは100点までです。');
  const folders = normalizeCustomStickerFolders(manifest.folders);
  const folderIds = new Set(folders.map(folder => folder.id));
  const stickers = [];
  for (const [index, item] of manifest.stickers.entries()) {
    const bytes = typeof item?.file === 'string' ? files[item.file] : null;
    if (!bytes || !bytes.length || bytes.length > MAX_IMAGE_BYTES) continue;
    stickers.push({
      id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
      name: typeof item.name === 'string' ? item.name : `マイステッカー${index + 1}`,
      folderId: folderIds.has(item.folderId) ? item.folderId : 'unfiled',
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
      contentHash: typeof item.contentHash === 'string' ? item.contentHash : '',
      width: Number(item.width) || 1,
      height: Number(item.height) || 1,
      finish: item.finish === 'white-outline' ? 'white-outline' : 'transparent',
      dataUrl: bytesDataUrl(bytes)
    });
  }
  if (!stickers.length) throw new Error('読み込めるPNGがありません。');
  return { folders, stickers };
}
