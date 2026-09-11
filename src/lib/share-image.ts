/**
 * CekDulu Share Image
 *
 * Generate a 1080x1350 portrait PNG share card entirely client-side using the
 * native Canvas 2D API. Zero dependencies, no external fonts, no backend.
 *
 * The brand logo (`/images/logo-cekdulu.webp`) is loaded as a same-origin static
 * asset and drawn as-is — we never recreate the logo with emoji or text.
 *
 * PRIVACY: The card only renders aggregate figures the user already entered.
 * It never includes names, emails, locations, or other personal identifiers.
 */

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 880;

/** Same-origin brand logo used by the website header (source of truth). */
export const LOGO_PATH = '/images/logo-cekdulu.webp';

/** Brand & status colors following the CekDulu visual identity. */
const COLORS = {
  bg: '#ffffff',
  ink: '#1f2430',
  muted: '#5c6570',
  faint: '#8a919c',
  line: '#e6ebf2',
  soft: '#f4f8fd',
  yellow: '#ffd51f',
  healthy: '#0f9d6c',
  warning: '#d97706',
  risk: '#dc2626',
};

/** Same-origin balance illustration (the signature visual). */
export const BALANCE_PATH = '/images/illustrations/hero-balance-v1.png';

export interface PersonalReportRow {
  label: string;
  value: number;
  emphasize: boolean;
}

type Status = 'healthy' | 'warning' | 'critical' | 'negative';

export interface ShareCardOptions {
  /** Plain-language result headline, e.g. "Kondisi keuanganmu masih sehat". */
  headline: string;
  /** Status label shown on the badge, e.g. "Sehat". */
  statusLabel: string;
  /** Status key used to pick accent color. */
  status: Status;
  /** Remaining money after all burdens (primary figure). */
  remaining: number;
  income: number;
  totalDebt: number;
  totalExpenses: number;
}

/**
 * The four figures shown on the personal result card, in display order. Kept
 * as a pure helper so tests can lock down that EVERY financial detail the user
 * entered still appears on the "Simpan Hasil" image.
 */
export function personalReportRows(
  remaining: number,
  income: number,
  totalDebt: number,
  totalExpenses: number
): PersonalReportRow[] {
  return [
    { label: 'Penghasilan', value: income, emphasize: false },
    { label: 'Total cicilan', value: totalDebt, emphasize: false },
    { label: 'Pengeluaran', value: totalExpenses, emphasize: false },
    { label: 'Sisa uang', value: remaining, emphasize: true },
  ];
}

/** Indonesian rupiah compact integer format, e.g. "1.500.000". */
export function formatRupiahInt(amount: number): string {
  return Math.round(amount).toLocaleString('id-ID');
}

/** "Rp" or "-Rp" prefixed rupiah string; negative → "-Rp 500.000". */
function formatMoney(amount: number): string {
  if (amount < 0) return `-Rp ${formatRupiahInt(-amount)}`;
  return `Rp ${formatRupiahInt(amount)}`;
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function font(weight: number, size: number): string {
  return `${weight} ${size}px ${FONT}`;
}

/** Measure text width for a given font size (weight 700). */
function measure(ctx: CanvasRenderingContext2D, text: string, fontSize: number): number {
  ctx.font = font(700, fontSize);
  return ctx.measureText(text).width;
}

/** Pick the largest font size ≤ start that fits within maxWidth. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  start: number,
  min: number
): number {
  let s = start;
  while (s > min && measure(ctx, text, s) > maxWidth) {
    s -= 2;
  }
  return s < min ? min : s;
}

interface WrappedLine {
  text: string;
  width: number;
}

/**
 * Wrap text into up to maxLines lines that each fit within maxWidth.
 * Falls back to ellipsis on the last line if it cannot fit in maxLines.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  fontSize: number
): { lines: WrappedLine[]; fontSize: number } {
  let size = fontSize;
  let lines = doWrap(ctx, text, maxWidth, maxLines, size);

  // Shrink until it fits within maxLines (or stops at the floor).
  while (lines.length > maxLines && size > 34) {
    size -= 2;
    lines = doWrap(ctx, text, maxWidth, maxLines, size);
  }

  // Last resort: hard clamp to maxLines and add ellipsis.
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    const last = lines[maxLines - 1];
    let t = last.text;
    while (t.length > 1 && measure(ctx, t + '…', size) > maxWidth) {
      t = t.slice(0, -1);
    }
    lines[maxLines - 1] = { text: t + '…', width: measure(ctx, t + '…', size) };
  }

  return { lines, fontSize: size };
}

function doWrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  fontSize: number
): WrappedLine[] {
  const words = text.split(' ');
  const lines: WrappedLine[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(ctx, candidate, fontSize) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push({ text: current, width: measure(ctx, current, fontSize) });
      current = word;
      if (lines.length >= maxLines) {
        lines.push({ text: word, width: measure(ctx, word, fontSize) });
        return lines;
      }
    }
  }
  if (current) {
    lines.push({ text: current, width: measure(ctx, current, fontSize) });
  }
  return lines;
}

/** Round to device pixels for crisp lines. */
function r(n: number): number {
  return Math.round(n);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function accentFor(status: Status): string {
  if (status === 'healthy') return COLORS.healthy;
  if (status === 'warning') return COLORS.warning;
  return COLORS.risk;
}

/**
 * Render the share card to a canvas 1080x1350.
 * `logo` is optional; when absent the brand image is skipped (no fallback logo).
 * Pure aside from the provided canvas: does not touch DOM or page state.
 */
export function renderShareCard(
  canvas: HTMLCanvasElement,
  opts: ShareCardOptions,
  logo: HTMLImageElement | null = null
): void {
  const W = SHARE_CARD_WIDTH;
  const H = SHARE_CARD_HEIGHT;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  const padX = 88;
  const contentW = W - padX * 2;

  // ---- Branding: official CekDulu logo (natural colors, top-left) ----
  const logoTop = 32;
  const logoHt = 64;
  if (logo && logo.naturalWidth > 0) {
    const logoW = logoHt * (logo.naturalWidth / logo.naturalHeight);
    ctx.drawImage(logo, padX, logoTop, logoW, logoHt);
  }

  // ---- Hero band: blue gradient with headline + status badge ----
  const heroTop = 24;
  const heroH = 160;
  const heroBottom = heroTop + heroH;
  const heroGrad = ctx.createLinearGradient(0, heroTop, 0, heroBottom);
  heroGrad.addColorStop(0, '#0b5fe0');
  heroGrad.addColorStop(0.5, '#1189f6');
  heroGrad.addColorStop(1, '#3da9ff');
  roundRect(ctx, padX, heroTop, contentW, heroH, 32);
  ctx.fillStyle = heroGrad;
  ctx.fill();

  // Subtle decorative circle inside hero band.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.beginPath();
  ctx.arc(padX + contentW / 2, heroTop + heroH / 2 + 10, 70, 0, Math.PI * 2);
  ctx.fill();

  // Headline inside hero (white, max 2 lines) — generous top padding
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  const wrapped = wrapText(ctx, opts.headline, contentW - 40, 2, 36);
  const hlSize = wrapped.fontSize;
  const lineH = hlSize * 1.2;
  let hlY = heroTop + 48;
  for (const line of wrapped.lines) {
    ctx.font = font(800, hlSize);
    ctx.fillText(line.text, padX + 52, hlY);
    hlY += lineH;
  }

  // Status badge: solid yellow pill with status text — generous bottom padding
  const badgeFont = 24;
  const badgeHt = 40;
  const badgeW = r(measure(ctx, opts.statusLabel, badgeFont) + 32 * 2);
  const badgeY = heroBottom - badgeHt - 24;
  ctx.fillStyle = COLORS.yellow;
  roundRect(ctx, padX + 48, badgeY, badgeW, badgeHt, badgeHt / 2);
  ctx.fill();
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(600, badgeFont);
  ctx.textAlign = 'left';
  ctx.fillText(opts.statusLabel, padX + 64, badgeY + badgeHt / 2 + 8);

  // ---- Sisa uang (primary figure) ----
  // Clear section gap after hero
  const sectionGap = 32;
  const labelY = heroBottom + sectionGap;
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(500, 30);
  ctx.fillText('Sisa uang setelah semua beban', padX, labelY);

  const accent = accentFor(opts.status);
  const money = formatMoney(opts.remaining);
  const moneyAvail = contentW - 60;
  const moneySize = fitFont(ctx, money, moneyAvail, 80, 48);
  // Breathing room between label and nominal
  const moneyGap = 18;
  const moneyY = labelY + moneyGap + moneySize;
  ctx.fillStyle = accent;
  ctx.font = font(800, moneySize);
  ctx.fillText(money, padX, moneyY);

  // ---- Divider ----
  const dividerGap = 28;
  const dividerY = moneyY + dividerGap;
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, dividerY);
  ctx.lineTo(W - padX, dividerY);
  ctx.stroke();

  // ---- Breakdown card: rounded soft card with all four figures ----
  const cardGap = 24;
  const cardY = dividerY + cardGap;
  const cardH = 380;
  roundRect(ctx, padX, cardY, contentW, cardH, 32);
  ctx.fillStyle = COLORS.soft;
  ctx.fill();

  const rows = personalReportRows(
    opts.remaining,
    opts.income,
    opts.totalDebt,
    opts.totalExpenses
  );
  const rowStart = cardY + 28;
  const rowGap = 82;
  for (let i = 0; i < rows.length; i++) {
    const { label, value, emphasize } = rows[i];
    const y = rowStart + i * rowGap;
    const labelSize = 26;
    const labelW = measure(ctx, label, labelSize);

    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.muted;
    ctx.font = font(500, labelSize);
    ctx.fillText(label, padX + 32, y + 6);

    const valText = formatMoney(value);
    const valAvail = W - padX - 32 - (padX + 32 + labelW) - 12;
    const valSize = fitFont(ctx, valText, valAvail, emphasize ? 36 : 32, 22);
    ctx.fillStyle = emphasize ? accent : COLORS.ink;
    ctx.font = font(emphasize ? 800 : 650, valSize);
    ctx.textAlign = 'right';
    ctx.fillText(valText, W - padX - 32, y + 6);
  }

  // ---- Footer: tagline + URL ----
  const footerTop = cardY + cardH + 16;
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(600, 34);
  ctx.textAlign = 'center';
  ctx.fillText('Sebelum nyicil, cek dulu.', W / 2, footerTop);
  ctx.fillStyle = '#1e46ad';
  ctx.font = font(700, 40);
  ctx.fillText('cekdulu.co.id', W / 2, footerTop + 40);
}

/** Load a same-origin image asset (cached by the browser). Resolves to null on
 * failure so rendering can continue without the image.
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Generate a PNG Blob of the share card. Resolves to null if generation fails
 * (so the page can fall back).
 */
export async function generateShareImageBlob(
  opts: ShareCardOptions
): Promise<Blob | null> {
  try {
    const logo = await loadImage(LOGO_PATH);
    return await new Promise<Blob | null>((resolve) => {
      const canvas = document.createElement('canvas');
      renderShareCard(canvas, opts, logo);
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  } catch {
    return null;
  }
}

export interface GeneratedShareFile {
  file: File | null;
  url: string | null;
}

/**
 * Generate the share PNG and wrap it as a File. Also returns an object URL
 * suitable for preview / download fallback. Caller must revokeObjectURL.
 */
export async function generateShareFile(
  opts: ShareCardOptions
): Promise<GeneratedShareFile> {
  const blob = await generateShareImageBlob(opts);
  if (!blob) {
    return { file: null, url: null };
  }
  const file = new File([blob], 'cekdulu-hasil.png', { type: 'image/png' });
  return { file, url: URL.createObjectURL(blob) };
}