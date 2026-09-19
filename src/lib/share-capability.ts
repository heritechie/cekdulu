/**
 * Client-side capability check for image/file sharing via the Web Share API.
 *
 * Some WebViews (Instagram, TikTok, etc.) expose `navigator.share` but cannot
 * attach files, so both `navigator.share` and `navigator.canShare({ files })`
 * must verify before a share-with-image button is enabled.
 *
 * SSR-safe: returns false when the APIs are missing, never throws.
 */
export function canShareImageFiles(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    // Probe with a real file so WebViews that only support text sharing are
    // detected as unsupported.
    const probe = new File(['cekdulu'], 'cekdulu-share.png', { type: 'image/png' });
    return navigator.canShare({ files: [probe] }) === true;
  } catch {
    return false;
  }
}