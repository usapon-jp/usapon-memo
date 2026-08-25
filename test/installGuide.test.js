import test from 'node:test';
import assert from 'node:assert/strict';
import { canAutoOfferInstall, detectInstallContext } from '../src/installGuide.js';

test('iPhone Instagramを判定する', () => {
  assert.deepEqual(detectInstallContext('Mozilla/5.0 (iPhone) Mobile Instagram 391.0', false, false), {
    platform: 'ios',
    isInstagramInAppBrowser: true,
    isStandalone: false
  });
});

test('ホーム画面起動中または非表示指定後は自動案内しない', () => {
  assert.equal(canAutoOfferInstall({ platform: 'ios', isInstagramInAppBrowser: false, isStandalone: true }, false), false);
  assert.equal(canAutoOfferInstall({ platform: 'android', isInstagramInAppBrowser: false, isStandalone: false }, true), false);
});

