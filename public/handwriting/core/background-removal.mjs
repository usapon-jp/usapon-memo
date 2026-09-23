const INPUT_SIZE = 1024;
let worker = null;
let pending = null;
let nextId = 0;

const aborted = () => new DOMException('中止しました', 'AbortError');

function stopWorker() {
  worker?.terminate();
  worker = null;
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./background-worker.mjs?v=20260923-cutout2', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (!pending || data.id !== pending.id) return;
    if (data.type === 'progress') {
      pending.onProgress({ status: data.status, progress: data.progress });
      return;
    }
    const current = pending;
    pending = null;
    current.signal?.removeEventListener('abort', current.abort);
    if (data.type === 'error') current.reject(new Error(data.message || '背景を消せませんでした。'));
    else current.resolve(new Uint8Array(data.alpha));
  };
  worker.onerror = error => {
    const current = pending;
    pending = null;
    stopWorker();
    current?.signal?.removeEventListener('abort', current.abort);
    current?.reject(new Error(error.message || '背景削除を開始できませんでした。'));
  };
  return worker;
}

function runModel(input, { onProgress, signal }) {
  if (pending) throw new Error('背景削除はすでに進行中です。');
  if (signal?.aborted) throw aborted();
  const activeWorker = getWorker();
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const abort = () => {
      if (pending?.id !== id) return;
      pending = null;
      stopWorker();
      reject(aborted());
    };
    pending = { id, resolve, reject, onProgress, signal, abort };
    signal?.addEventListener('abort', abort, { once: true });
    activeWorker.postMessage({ type: 'run', id, input: input.buffer }, [input.buffer]);
  });
}

function imageFromUrl(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('写真を読み込めませんでした。'));
    image.src = source;
  });
}

function inputFromImage(image) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = INPUT_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const pixels = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
  const area = INPUT_SIZE * INPUT_SIZE;
  const input = new Float32Array(area * 3);
  for (let i = 0, offset = 0; i < area; i++, offset += 4) {
    input[i] = (pixels[offset] - 128) / 256;
    input[area + i] = (pixels[offset + 1] - 128) / 256;
    input[area * 2 + i] = (pixels[offset + 2] - 128) / 256;
  }
  return input;
}

function applyAlpha(image, alpha) {
  const mask = document.createElement('canvas');
  mask.width = mask.height = INPUT_SIZE;
  const maskContext = mask.getContext('2d');
  const pixels = maskContext.createImageData(INPUT_SIZE, INPUT_SIZE);
  for (let i = 0, offset = 0; i < alpha.length; i++, offset += 4) {
    pixels.data[offset + 3] = alpha[i];
  }
  maskContext.putImageData(pixels, 0, 0);

  const output = document.createElement('canvas');
  output.width = image.naturalWidth;
  output.height = image.naturalHeight;
  const context = output.getContext('2d');
  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(mask, 0, 0, output.width, output.height);
  return output.toDataURL('image/png');
}

export async function removeBackgroundOnDevice(dataUrl, { onProgress = () => {}, signal } = {}) {
  if (signal?.aborted) throw aborted();
  onProgress({ status: 'loading', progress: 0 });
  const image = await imageFromUrl(dataUrl);
  if (signal?.aborted) throw aborted();
  const input = inputFromImage(image);
  const alpha = await runModel(input, { onProgress, signal });
  if (signal?.aborted) throw aborted();
  onProgress({ status: 'done', progress: 1 });
  return applyAlpha(image, alpha);
}

export function resetBackgroundRemovalForTests() {
  pending?.signal?.removeEventListener('abort', pending.abort);
  pending?.reject(aborted());
  pending = null;
  stopWorker();
}
