/**
 * CekDulu — Pixel/mosaic reveal (client-side Canvas — never CSS blur).
 *
 * Shared, framework-agnostic canvas engine used by BOTH the vanilla /wishlist
 * implementation and the React Wishlist Detail view. The algorithm here is the
 * original pixel-reveal implementation — do not change the progression logic;
 * new callers only adapt how they invoke it.
 */

export const PIXEL_MAP: [number, number][] = [
  [0, 32],
  [10, 28],
  [25, 22],
  [50, 14],
  [75, 7],
  [90, 3],
];

export function pixelSizeFor(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p >= 1) return 1;
  let size = PIXEL_MAP[PIXEL_MAP.length - 1][1];
  for (let i = 0; i < PIXEL_MAP.length; i++) {
    const [pt, px] = PIXEL_MAP[i];
    const [nextPt, nextPx] = PIXEL_MAP[i + 1] ?? [1, 1];
    if (p * 100 >= pt && p * 100 <= nextPt) {
      size =
        nextPt > pt
          ? Math.max(1, Math.round(px + ((nextPx - px) * (p * 100 - pt)) / (nextPt - pt)))
          : px;
      break;
    }
  }
  return Math.max(1, size);
}

export function drawPixelatedImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  progress: number
): void {
  canvas.width = Math.max(1, Math.round(canvas.clientWidth));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = pixelSizeFor(progress);
  const iW = image.naturalWidth || image.width;
  const iH = image.naturalHeight || image.height;
  const cw = canvas.width;
  const ch = canvas.height;
  const scale = Math.max(cw / iW, ch / iH);
  const drawW = iW * scale;
  const drawH = iH * scale;
  const dx = (cw - drawW) / 2;
  const dy = (ch - drawH) / 2;
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, 0, cw, ch);
  if (size <= 1) {
    ctx.drawImage(image, 0, 0, iW, iH, dx, dy, drawW, drawH);
    return;
  }
  const scaledW = Math.max(1, Math.round(drawW / size));
  const scaledH = Math.max(1, Math.round(drawH / size));
  const tmp = document.createElement('canvas');
  tmp.width = scaledW;
  tmp.height = scaledH;
  const tctx = tmp.getContext('2d');
  if (!tctx) return;
  tctx.drawImage(image, 0, 0, iW, iH, 0, 0, scaledW, scaledH);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, dx, dy, drawW, drawH);
}

export interface PixelRevealOptions {
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Load an image and draw it onto the canvas with the current-level pixel
 * reveal. Callers own the canvas/placeholder visibility (e.g. React state or
 * the vanilla `hidden` toggling); this only guarantees the reveal drawing.
 */
export function renderPixelReveal(
  canvas: HTMLCanvasElement,
  imageSrc: string,
  progress: number,
  options: PixelRevealOptions = {}
): void {
  const img = new Image();
  img.onload = () => {
    drawPixelatedImage(canvas, img, progress);
    options.onLoad?.();
  };
  img.onerror = () => {
    options.onError?.();
  };
  img.src = imageSrc;
}