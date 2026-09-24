import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const lifecycle = main.slice(main.indexOf('const APP_BUILD_ID')).replaceAll('import.meta.env.BASE_URL', "'/usapon-memo/'");

function mountLifecycle(controller) {
  const windowEvents = {};
  const workerEvents = {};
  let reloads = 0;
  const serviceWorker = {
    controller,
    addEventListener: (name, callback) => { workerEvents[name] = callback; },
    register: async () => ({ update() {}, addEventListener() {}, waiting: null })
  };
  vm.runInNewContext(lifecycle, {
    navigator: { serviceWorker },
    window: { addEventListener: (name, callback) => { windowEvents[name] = callback; }, location: { reload: () => { reloads += 1; } } },
    console
  });
  windowEvents.load();
  return { takeControl() { serviceWorker.controller = {}; workerEvents.controllerchange(); }, reloadCount: () => reloads };
}

test('first service worker takeover keeps the open trial editor', () => {
  const page = mountLifecycle(null);
  page.takeControl();
  assert.equal(page.reloadCount(), 0);
});

test('an existing service worker update reloads once', () => {
  const page = mountLifecycle({});
  page.takeControl();
  page.takeControl();
  assert.equal(page.reloadCount(), 1);
});
