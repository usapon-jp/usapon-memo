import * as ort from '../vendor/ort/ort.wasm.bundle.min.mjs';
import { refineForegroundMask } from './cutout-mask.mjs?v=20260923-cutout2';

const INPUT_SIZE = 1024;
const MODEL_URL = new URL('../models/isnet-general-use-q8.onnx', import.meta.url);
ort.env.wasm.wasmPaths = new URL('../vendor/ort/', import.meta.url).href;
ort.env.wasm.numThreads = 1;
let sessionPromise = null;

async function downloadModel(id) {
  const response = await fetch(MODEL_URL);
  if (!response.ok || !response.body) throw new Error('切り抜きモデルを読み込めませんでした。');
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    self.postMessage({ type: 'progress', id, status: 'loading', progress: total ? loaded / total : 0 });
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function getSession(id) {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const model = await downloadModel(id);
      self.postMessage({ type: 'progress', id, status: 'initializing', progress: 1 });
      return ort.InferenceSession.create(model, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      });
    })().catch(error => { sessionPromise = null; throw error; });
  }
  return sessionPromise;
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'run') return;
  const { id } = data;
  try {
    const session = await getSession(id);
    self.postMessage({ type: 'progress', id, status: 'running', progress: 0 });
    const tensor = new ort.Tensor('float32', new Float32Array(data.input), [1, 3, INPUT_SIZE, INPUT_SIZE]);
    const result = await session.run({ input: tensor }, ['output']);
    const alpha = refineForegroundMask(result.output.data, INPUT_SIZE, INPUT_SIZE);
    self.postMessage({ type: 'result', id, alpha: alpha.buffer }, [alpha.buffer]);
  } catch (error) {
    self.postMessage({ type: 'error', id, message: error?.message || String(error) });
  }
};
