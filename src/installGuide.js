export const INSTALL_GUIDE_HIDDEN_KEY = 'usapon-memo.install-guide.hidden.v1';

export const detectInstallContext = (
  userAgent = globalThis.navigator?.userAgent || '',
  standaloneDisplay = globalThis.matchMedia?.('(display-mode: standalone)').matches || false,
  navigatorStandalone = Boolean(globalThis.navigator?.standalone)
) => ({
  platform: /iPhone|iPad|iPod/i.test(userAgent) ? 'ios' : /Android/i.test(userAgent) ? 'android' : 'other',
  isInstagramInAppBrowser: /Instagram|FBAN\/Instagram/i.test(userAgent),
  isStandalone: Boolean(standaloneDisplay || navigatorStandalone)
});

export const canAutoOfferInstall = (context, hidden) => !context.isStandalone && !hidden;

