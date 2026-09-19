/**
 * CekDulu — shared client-side browser capability detection for Share and Save
 * actions, plus the tiny gate helper used by Astro pages to disable a
 * capability-gated control and reveal one concise explanation.
 *
 * SSR-safe: every check returns `false` when browser globals are absent, so
 * server rendering and Node tests never throw. Capability is decided by real
 * feature detection (Web Share file support; object-URL + anchor download),
 * never by user-agent sniffing of Instagram/TikTok/… webviews.
 *
 * Two action kinds exist today:
 *   SHARE — image/files via the Web Share API, used by the calculator, the
 *           challenge, and the wishlist share CTAs. Some webviews expose
 *           `navigator.share` yet cannot attach files, so the real-file probe
 *           in `canShareImageFiles` is the gate.
 *   SAVE  — the calculator's "Simpan Hasil" download, which generates a Blob
 *           and triggers an `<a download>`. It needs `URL.createObjectURL`
 *           and the anchor `download` attribute.
 */

/** Concise explanation shown when a Share/Save action cannot run. */
export const SHARE_UNSUPPORTED_NOTE = 'Buka di browser untuk pengalaman lebih baik.';

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

export function canSaveImageDownload(): boolean {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
  if (typeof HTMLAnchorElement === 'undefined') return false;
  return 'download' in HTMLAnchorElement.prototype;
}

export interface CapabilityGateTargets {
  buttons: Array<HTMLElement | string>;
  /** Notes hidden when the capability is supported, revealed otherwise. */
  notes?: Array<HTMLElement | string>;
}

/**
 * Shared UI gate: disables the given buttons and reveals the associated notes
 * when the capability is not supported. Call from client-only code (Astro
 * script blocks or React handlers), never during SSR.
 */
export function applyCapabilityGate(supported: boolean, targets: CapabilityGateTargets): void {
  if (typeof document === 'undefined') return;
  const toEl = (v: HTMLElement | string): HTMLElement | null =>
    typeof v === 'string' ? document.getElementById(v) : v;
  for (const b of targets.buttons) {
    const el = toEl(b);
    if (!el) continue;
    if (el instanceof HTMLButtonElement) {
      el.disabled = !supported;
    } else {
      el.setAttribute('aria-disabled', String(!supported));
    }
  }
  for (const n of targets.notes ?? []) {
    const el = toEl(n);
    if (el) el.hidden = supported;
  }
}