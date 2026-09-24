export const AUTUMN_TRIAL_PACK_ID = 'autumnTrial';

// Remove the marker after it opens the editor so a reload cannot replace an
// in-progress memo with another fresh draft.
export function consumeAutumnTrialEntry(href) {
  const url = new URL(href);
  if (url.searchParams.get('trial') !== 'autumn') return null;

  url.searchParams.delete('trial');
  return {
    initialStickerPack: AUTUMN_TRIAL_PACK_ID,
    cleanPath: `${url.pathname}${url.search}${url.hash}`
  };
}
