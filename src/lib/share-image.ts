/**
 * CekDulu Share Image
 *
 * Generate a 1080x1350 portrait PNG share card entirely client-side using the
 * native Canvas 2D API. Zero dependencies, no external fonts, no backend.
 *
 * The brand logo (`/images/logo-cekdulu.png`) is loaded as a same-origin static
 * asset and drawn as-is — we never recreate the logo with emoji or text.
 *
 * PRIVACY: The card only renders aggregate figures the user already entered.
 * It never includes names, emails, locations, or other personal identifiers.
 */

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1350;

/** Same-origin brand logo used by the website header (source of truth). */
export const LOGO_PATH = '/images/logo-cekdulu.png';

/** Brand & status colors following the CekDulu visual identity. */
const COLORS = {
  bg: '#ffffff',
  ink: '#1f2430',
  muted: '#5c6570',
  faint: '#8a919c',
  line: '#c6ccd4',
  healthy: '#0f9d6c',
  warning: '#d97706',
  risk: '#dc2626',
};

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

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function font(weight: number, size: number): string {
  return `${weight} ${size}px ${FONT}`;
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

/** Convert a hex #rrggbb to rgba string with the given alpha (0-1). */
function hexA(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
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

  // ---- Branding: official CekDulu logo (top-left, proportional) ----
  const logoTop = 84;
  const logoH = 92;
  if (logo && logo.naturalWidth > 0) {
    const logoW = logoH * (logo.naturalWidth / logo.naturalHeight);
    ctx.drawImage(logo, padX, logoTop, logoW, logoH);
  }

  // ---- Headline (max 2 lines) ----
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const wrapped = wrapText(ctx, opts.headline, contentW, 2, 58);
  const hlSize = wrapped.fontSize;
  const lineH = hlSize * 1.18;
  let hlY = 340;
  for (const line of wrapped.lines) {
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(700, hlSize);
    ctx.fillText(line.text, padX, hlY);
    hlY += lineH;
  }

  // ---- Status badge ----
  const accent = accentFor(opts.status);
  const badgeH = 64;
  const badgeFont = 32;
  const badgePadX = 32;
  const badgeW = r(measure(ctx, opts.statusLabel, badgeFont) + badgePadX * 2);
  const badgeTop = 460;
  const badgeX = padX;
  ctx.fillStyle = hexA(accent, 0.14);
  roundRect(ctx, badgeX, badgeTop, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.font = font(600, badgeFont);
  ctx.textAlign = 'left';
  ctx.fillText(opts.statusLabel, badgeX + badgePadX, badgeTop + badgeH / 2 + 11);

  // ---- Remaining money (primary figure) ----
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(500, 34);
  ctx.fillText('Sisa uang setelah semua beban', padX, 600);

  const money = formatMoney(opts.remaining);
  const remSize = fitFont(ctx, money, contentW - 60, 88, 46);
  ctx.fillStyle = accent;
  ctx.font = font(800, remSize);
  ctx.fillText(money, padX, 756);

  // ---- Divider ----
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, 828);
  ctx.lineTo(W - padX, 828);
  ctx.stroke();

  // ---- Breakdown rows ----
  const rows: Array<[string, number, boolean]> = [
    ['Penghasilan', opts.income, false],
    ['Total cicilan', opts.totalDebt, false],
    ['Pengeluaran', opts.totalExpenses, false],
    ['Sisa uang', opts.remaining, true],
  ];
  const rowTop = 884;
  const rowGap = 78;
  const valueMax = contentW - 48;
  for (let i = 0; i < rows.length; i++) {
    const [label, value, emphasize] = rows[i];
    const y = rowTop + i * rowGap;
    const labelSize = 38;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.muted;
    ctx.font = font(500, labelSize);
    const labelW = measure(ctx, label, labelSize);

    const valText = formatMoney(value);
    const valueAvailable = valueMax - labelW;
    const valueSize = fitFont(ctx, valText, valueAvailable, emphasize ? 40 : 38, 22);

    // Label: left-aligned at the safe horizontal padding.
    ctx.fillStyle = COLORS.muted;
    ctx.font = font(500, labelSize);
    ctx.textAlign = 'left';
    ctx.fillText(label, padX, y);

    // Value: right-aligned with the same right margin.
    const vColor = emphasize ? accent : COLORS.ink;
    ctx.fillStyle = vColor;
    ctx.font = font(emphasize ? 800 : 650, valueSize);
    ctx.textAlign = 'right';
    ctx.fillText(valText, W - padX, y);
  }

  // ---- Footer: tagline + URL (URL is a separate CTA, not part of the logo) ----
  const slogan = 'Sebelum nyicil, cek dulu.';
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(600, 40);
  ctx.textAlign = 'center';
  ctx.fillText(slogan, W / 2, 1180);
  ctx.fillStyle = '#1e46ad';
  ctx.font = font(700, 46);
  ctx.fillText('cekdulu.my.id', W / 2, 1248);
}

/** Load the official brand logo (same-origin, cached by the browser). */
function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = LOGO_PATH;
  });
}

/**
 * Generate a PNG Blob of the share card. Resolves to null if generation fails
 * (so the page can fall back). Also returns the loaded logo for reuse.
 */
export async function generateShareImageBlob(
  opts: ShareCardOptions
): Promise<Blob | null> {
  try {
    const logo = await loadLogo();
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
