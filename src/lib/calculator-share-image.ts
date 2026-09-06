/**
 * CekDulu — Kalkulator Kemampuan Cicilan social share image.
 *
 * Renders the static SVG template
 * (`public/share/kalkulator-kemampuan-cicilan-share.svg`) into a 1080x1920 PNG
 * File for Web Share / download. Runs entirely in the browser — no backend.
 *
 * This is intentionally a SEPARATE visual from the personal result card
 * (`share-image.ts`): the social template leads with a friendly question, shows
 * ONLY the user's remaining money (no income / total installment / expense
 * figures), and closes with an invitation to check one's own finances.
 * Classification is reused from the page (via `financialStatusClass` + the
 * negative-remaining check) — nothing is recomputed with different logic.
 *
 * PRIVACY: the social image intentionally avoids income, total installment and
 * monthly expenses. Only the single "remaining" figure appears.
 */

import { formatRupiahInt } from './share-image';

export const SOCIAL_SHARE_CARD_WIDTH = 1080;
export const SOCIAL_SHARE_CARD_HEIGHT = 1920;

export const SOCIAL_SHARE_TEMPLATE_PATH = '/share/kalkulator-kemampuan-cicilan-share.svg';

const BALANCE_IMAGE_PATH = '/images/illustrations/hero-balance-v1.png';

export interface CalculatorShareImageData {
  /** remainingAfterDebtAndExpenses from the existing engine result. */
  remaining: number;
  /** financialStatusClass from the existing engine result. */
  financialStatusClass: 'healthy' | 'warning' | 'critical';
}

/**
 * Indicative, first-person insight copy derived ONLY from the existing result
 * classification: the engine's `financialStatusClass` plus the standard
 * negative-remaining check. No absolute claims ("mampu", "aman", "gas") —
 * wording stays soft and informational.
 */
export function calculatorResultTitle(
  remaining: number,
  financialStatusClass: 'healthy' | 'warning' | 'critical'
): string {
  if (remaining < 0) return 'Beban bulananku melebihi penghasilan';
  if (financialStatusClass === 'healthy') return 'Cicilanku terlihat cukup seimbang';
  if (financialStatusClass === 'warning') return 'Porsi cicilanku sudah cukup besar';
  return 'Porsi cicilanku terlalu besar';
}

/**
 * Two caption lines above the amount: "Setelah dicek," + "sisa penghasilanku".
 */
export function socialResultDescription(): string {
  return 'Setelah dicek,\nsisa penghasilanku';
}

/**
 * "Rp1.234.567" / "-Rp1.234.567" — same money style as the personal card.
 */
export function formatMoneyRupiah(amount: number): string {
  if (amount < 0) return `-Rp${formatRupiahInt(-amount)}`;
  return `Rp${formatRupiahInt(amount)}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Turn a multi-line CTA into centered `<tspan>` lines so the template stays a
 * single `<text>` element. `lineSpacing` is the baseline jump for line 2+.
 */
export function ctaSpans(x: number, lineSpacing: number, text: string): string {
  const lines = text.split('\n');
  return lines
    .map(
      (line, i) =>
        `<tspan x="${x}" dy="${i === 0 ? 0 : lineSpacing}">${escapeXml(line)}</tspan>`
    )
    .join('');
}

/**
 * Replace every template placeholder with the share image data. Placeholders
 * are minimal on purpose: the social image shows ONLY the remaining figure.
 */
export function fillCalculatorSharePlaceholders(
  template: string,
  data: CalculatorShareImageData
): string {
  let svg = template.replaceAll(
    '{{RESULT_TITLE}}',
    escapeXml(calculatorResultTitle(data.remaining, data.financialStatusClass))
  );
  svg = svg.replaceAll('{{REMAINING_AMOUNT}}', formatMoneyRupiah(data.remaining));
  svg = svg.replaceAll(
    '{{RESULT_DESCRIPTION}}',
    ctaSpans(540, 44, socialResultDescription())
  );
  return svg;
}

let templateCache: string | null = null;
let templatePromise: Promise<string> | null = null;

/** Fetch (and cache) the static SVG template as a plain string. */
export async function loadCalculatorShareTemplate(): Promise<string> {
  if (templateCache) return templateCache;
  if (!templatePromise) {
    templatePromise = fetch(SOCIAL_SHARE_TEMPLATE_PATH, { cache: 'no-store' })
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
  if (!res.ok) throw new Error(`Asset fetch failed (${res.status})`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Asset read failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Swap an SVG image href to an inlined asset.
 *
 * Must keep the `<image>` element self-closed (`/>`): the SVG is decoded by
 * the browser as strict XML (SVG-as-image), so an unclosed element fails to
 * parse and `img.onerror` fires.
 */
export function swapCalculatorImageHref(
  svg: string,
  imageId: string,
  imageDataUri: string
): string {
  const imageTag = new RegExp('<image[^>]*id="' + imageId + '"[^>]*>', 'i');
  return svg.replace(imageTag, (openTag) => {
    const tagWithoutHref = openTag.replace(/\s+href="[^"]*"/i, '').replace(/\/?>$/, '');
    return tagWithoutHref + ' href="' + imageDataUri + '"/>';
  });
}

/** Remove the brand images in the safe fallback path (no logo, still shares). */
function stripIllustrations(svg: string): string {
  return svg.replace(
    /<image[^>]*id="(brandLogoHero|brandLogoFooter|balanceIllustration)"[^>]*>/g,
    ''
  );
}

/**
 * Render the template into a 1080x1920 PNG File.
 *
 * If the logo / illustration cannot be loaded, the SVG is rendered without
 * them — sharing still proceeds rather than crashing the page.
 */
export async function renderCalculatorShareImagePng(
  data: CalculatorShareImageData
): Promise<File> {
  const template = await loadCalculatorShareTemplate();

  let svg: string;
  try {
    const [logoDataUri, balanceDataUri] = await Promise.all([
      toDataUri('/images/logo-cekdulu.png'),
      toDataUri(BALANCE_IMAGE_PATH),
    ]);
    let inlined = fillCalculatorSharePlaceholders(template, data);
    inlined = swapCalculatorImageHref(inlined, 'brandLogoHero', logoDataUri);
    inlined = swapCalculatorImageHref(inlined, 'brandLogoFooter', logoDataUri);
    svg = swapCalculatorImageHref(inlined, 'balanceIllustration', balanceDataUri);
  } catch {
    svg = stripIllustrations(fillCalculatorSharePlaceholders(template, data));
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
    canvas.width = SOCIAL_SHARE_CARD_WIDTH;
    canvas.height = SOCIAL_SHARE_CARD_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D not available');
    }
    ctx.drawImage(img, 0, 0, SOCIAL_SHARE_CARD_WIDTH, SOCIAL_SHARE_CARD_HEIGHT);
    const pngBlob = await canvasToBlob(canvas, 'image/png');
    if (!pngBlob || pngBlob.size === 0) {
      throw new Error('Canvas toBlob produced empty PNG');
    }
    return new File([pngBlob], 'cekdulu-hasil-kemampuan-cicilan.png', {
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