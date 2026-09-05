/**
 * CekDulu — 30 Hari Tanpa PayLater share image.
 *
 * Renders the static SVG template (`public/share/30-days-no-paylater-share-template.svg`)
 * into a PNG File for Web Share / download. Runs entirely in the browser — no
 * backend required.
 *
 * Stats in the image come ONLY from Option A (not_bought): avoided transactions
 * and avoided expense. Option B (paid_other) is intentionally NOT shown as savings,
 * matching the on-screen challenge stats and the text share builder.
 */

export type DayShown = 1 | 7 | 14 | 21 | 30;

export interface ChallengeShareImageData {
  day: number;
  /** Only Option A (not_bought) log count. */
  transactions: number;
  /** Only Option A (not_bought) total expense, formatted as "Rp1.234.567". */
  savedAmount: string;
}

const TEMPLATE_PATH = '/share/30-days-no-paylater-share-template.svg';

const ROCKET_IMAGES: Record<DayShown, string> = {
  1: '/challenges/30-days-no-paylater-assets/rocket-day-01.png',
  7: '/challenges/30-days-no-paylater-assets/rocket-day-07.png',
  14: '/challenges/30-days-no-paylater-assets/rocket-day-14.png',
  21: '/challenges/30-days-no-paylater-assets/rocket-day-21.png',
  30: '/challenges/30-days-no-paylater-assets/rocket-day-30.png',
};

/**
 * Supporting artwork is raster too. These PNGs are inlined before canvas
 * rendering because an SVG loaded from a Blob cannot reliably resolve relative
 * image URLs.
 */
const SUPPORTING_ILLUSTRATIONS = {
  brandLogo: '/images/logo-cekdulu.png',
  transactionIllustration: '/challenges/30-days-no-paylater-assets/share/avoided-transaction-bag.png',
  expenseIllustration: '/challenges/30-days-no-paylater-assets/share/avoided-expense-coins.png',
  shareLinkIllustration: '/challenges/30-days-no-paylater-assets/share/share-link-icon.png',
} as const;

/**
 * Milestone illustration matching the active page visual:
 * flame streak while the challenge is running, trophy only on completion.
 */
export function milestoneIllustrationForShareImage(day: number): string {
  if (day >= 30) {
    return '/cekdulu-30-hari-tanpa-paylater-assets/illustrations/trophy.png';
  }
  return '/cekdulu-30-hari-tanpa-paylater-assets/illustrations/flame-streak.png';
}

/** Rocket stage to use for a given progress day (matches screen mapping). */
export function rocketStageForShareImage(day: number): DayShown {
  if (day >= 30) return 30;
  if (day >= 21) return 21;
  if (day >= 14) return 14;
  if (day >= 7) return 7;
  return 1;
}

/** Milestone copy keyed by rocket stage. Emoji-free for reliable SVG canvas text. */
const MILESTONE_COPY: Record<DayShown, { headline: string; text: string }> = {
  1: { headline: 'Aku baru mulai!', text: 'Hari pertama tanpa PayLater.' },
  7: { headline: '7 hari!', text: 'Aku masih lanjut tanpa PayLater.' },
  14: { headline: '14 hari!', text: 'Aku sudah dua minggu tanpa PayLater.' },
  21: { headline: '21 hari!', text: 'Tinggal sedikit lagi menuju 30 hari.' },
  30: { headline: 'Aku berhasil!', text: '30 hari tanpa PayLater selesai.' },
};

/** Progress bar width (px) for the template's 650px track, capped at 100%. */
export function progressWidthForShareImage(day: number): number {
  const pct = Math.max(0, Math.min(1, day / 30));
  return Math.round(650 * pct);
}

export function milestoneCopyForShareImage(day: number): { headline: string; text: string } {
  return MILESTONE_COPY[rocketStageForShareImage(day)];
}

let templateCache: string | null = null;
let templatePromise: Promise<string> | null = null;

/** Fetch (and cache) the static SVG template as a plain string. */
export async function loadShareTemplate(): Promise<string> {
  if (templateCache) return templateCache;
  if (!templatePromise) {
    templatePromise = fetch(TEMPLATE_PATH, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`Template fetch failed (${res.status})`);
        return res.text();
      })
      .then((text) => {
        templateCache = text;
        return text;
      })
      .finally(() => {
        templatePromise = null;
      });
  }
  return templatePromise;
}

/** Inline a same-origin PNG as a data URI so the SVG stays self-contained. */
async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Illustration fetch failed (${res.status})`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Illustration read failed'));
    reader.readAsDataURL(blob);
  });
}

function fillPlaceholders(template: string, data: ChallengeShareImageData): string {
  const copy = milestoneCopyForShareImage(data.day);
  let svg = template.replaceAll('{{DAY}}', String(data.day));
  svg = svg.replaceAll('{{PROGRESS_WIDTH}}', String(progressWidthForShareImage(data.day)));
  svg = svg.replaceAll('{{TRANSACTIONS}}', String(data.transactions));
  svg = svg.replaceAll('{{SAVED_AMOUNT}}', data.savedAmount);
  svg = svg.replaceAll('{{MILESTONE_HEADLINE}}', copy.headline);
  svg = svg.replaceAll('{{MILESTONE_TEXT}}', copy.text);
  return svg;
}

export { fillPlaceholders };

/**
 * Swap an SVG image href to an inlined asset.
 *
 * Must keep the `<image>` element self-closed (`/>`): the SVG is decoded by the
 * browser as strict XML (SVG-as-image), so an unclosed element fails to parse
 * and `img.onerror` fires. The previous version stripped the closing slash,
 * which broke generation on every share.
 */
export function swapImageHref(svg: string, imageId: string, imageDataUri: string): string {
  const imageTag = new RegExp('<image[^>]*id="' + imageId + '"[^>]*>', 'i');
  return svg.replace(imageTag, (openTag) => {
    const tagWithoutHref = openTag.replace(/\s+href="[^"]*"/i, '').replace(/\/?>$/, '');
    return tagWithoutHref + ' href="' + imageDataUri + '"/>';
  });
}

/** Backward-compatible helper for the dynamic milestone rocket. */
export function swapHeroHref(svg: string, heroDataUri: string): string {
  return swapImageHref(svg, 'heroIllustration', heroDataUri);
}

/** Remove all externally-backed illustrations in the safe fallback path. */
function stripIllustrations(svg: string): string {
  return svg.replace(
    /<image[^>]*id="(heroIllustration|brandLogoHero|brandLogoFooter|transactionIllustration|expenseIllustration|milestoneIllustration|shareLinkIllustration)"[^>]*>/g,
    '',
  );
}

/**
 * Render the template into a 1080x1920 PNG File.
 *
 * If an illustration cannot be loaded, the SVG is rendered without artwork —
 * the share still proceeds rather than crashing the page.
 */
export async function renderChallengeShareImagePng(data: ChallengeShareImageData): Promise<File> {
  const template = await loadShareTemplate();

  let svg: string;
  try {
    const heroUrl = ROCKET_IMAGES[rocketStageForShareImage(data.day)];
    const milestoneUrl = milestoneIllustrationForShareImage(data.day);
    const [heroDataUri, brandLogoDataUri, transactionDataUri, expenseDataUri, milestoneDataUri, shareLinkDataUri] = await Promise.all([
      toDataUri(heroUrl),
      toDataUri(SUPPORTING_ILLUSTRATIONS.brandLogo),
      toDataUri(SUPPORTING_ILLUSTRATIONS.transactionIllustration),
      toDataUri(SUPPORTING_ILLUSTRATIONS.expenseIllustration),
      toDataUri(milestoneUrl),
      toDataUri(SUPPORTING_ILLUSTRATIONS.shareLinkIllustration),
    ]);
    svg = swapHeroHref(fillPlaceholders(template, data), heroDataUri);
    svg = swapImageHref(svg, 'brandLogoHero', brandLogoDataUri);
    svg = swapImageHref(svg, 'brandLogoFooter', brandLogoDataUri);
    svg = swapImageHref(svg, 'transactionIllustration', transactionDataUri);
    svg = swapImageHref(svg, 'expenseIllustration', expenseDataUri);
    svg = swapImageHref(svg, 'milestoneIllustration', milestoneDataUri);
    svg = swapImageHref(svg, 'shareLinkIllustration', shareLinkDataUri);
  } catch {
    svg = stripIllustrations(fillPlaceholders(template, data));
  }

  const leftover = svg.match(/\{\{[A-Z_]+\}\}/);
  if (leftover) {
    throw new Error('Template placeholders not replaced');
  }

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = await loadSvgIntoImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D not available');
    }
    ctx.drawImage(img, 0, 0, 1080, 1920);
    const pngBlob = await canvasToBlob(canvas, 'image/png');
    if (!pngBlob || pngBlob.size === 0) {
      throw new Error('Canvas toBlob produced empty PNG');
    }
    return new File([pngBlob], `cekdulu-30-hari-tanpa-paylater-day-${data.day}.png`, {
      type: 'image/png',
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadSvgIntoImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG image load failed'));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, type);
  });
}
