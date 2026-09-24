import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const lifecycle = main.slice(main.indexOf('const APP_BUILD_ID')).replaceAll('import.meta.env.BASE_URL', "'/usapon-memo/'");

function mountLifecycle(controller, href = 'https://example.test/usapon-memo/') {
  const windowEvents = {};
  const workerEvents = {};
  let reloads = 0;
  const location = { href, reload: () => { reloads += 1; }, replace: (url) => { location.replacedWith = url; } };
  const serviceWorker = {
    controller,
    addEventListener: (name, callback) => { workerEvents[name] = callback; },
    register: async () => ({ update() {}, addEventListener() {}, waiting: null })
  };
  vm.runInNewContext(lifecycle, {
    navigator: { serviceWorker },
    window: { addEventListener: (name, callback) => { windowEvents[name] = callback; }, location },
    URL,
    console
  });
  windowEvents.load();
  return { takeControl() { serviceWorker.controller = {}; workerEvents.controllerchange(); }, reloadCount: () => reloads, location };
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

test('an update during the trial entry restores its consumed URL marker', () => {
  const page = mountLifecycle({}, 'https://example.test/usapon-memo/?trial=autumn&source=booth');
  page.location.href = 'https://example.test/usapon-memo/?source=booth';
  page.takeControl();
  assert.equal(page.location.replacedWith, 'https://example.test/usapon-memo/?source=booth&trial=autumn');
});
