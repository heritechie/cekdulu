/**
 * CekDulu — Wishlist share card (client-only 1080×1080 snapshot).
 *
 * Vanilla /wishlist owned this canvas painting; the React Wishlist app reuses
 * the exact same rendering so the completed-goal share looks identical.
 * PRIVACY: the product image is drawn client-side and shared only through the
 * native Web Share sheet — the canvas is never uploaded anywhere.
 */
import { formatRupiah } from './calculator/engine';
import { goalSavedDisplay, goalProgress, type SavingGoal } from './wishlist';

/**
 * Paint the branded wishing-well share card for a goal at its current
 * progress. Resolves to null when the goal/product image is unreadable or 2D
 * canvas is unavailable — callers treat null as "do not share".
 */
export function buildWishlistShareCanvas(goal: SavingGoal): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(null);
      return;
    }
    const pad = 60;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0c2a4d';
    ctx.font = '800 40px Geist, sans-serif';
    ctx.fillText('Wishlist', pad, pad + 28);
    ctx.font = '600 34px Geist, sans-serif';
    ctx.fillStyle = '#8b8b97';
    ctx.fillText('Aku menabung untuk barang impianku', pad, pad + 76);

    const drew = (img: HTMLImageElement): void => {
      const area = 720;
      const scale = Math.max(area / (img.width || area), area / (img.height || area));
      const w = (img.width || area) * scale;
      const h = (img.height || area) * scale;
      const x = (canvas.width - w) / 2;
      const y = 190 + (area - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      const pct = Math.round(goalProgress(goal) * 100);
      const saved = goalSavedDisplay(goal);
      ctx.fillStyle = '#0c2a4d';
      ctx.font = '800 58px Geist, sans-serif';
      ctx.fillText(`${formatRupiah(saved)}`, pad, y + h + 80);
      ctx.fillStyle = '#8b8b97';
      ctx.font = '600 38px Geist, sans-serif';
      ctx.fillText(`dari ${formatRupiah(goal.price)}`, pad, y + h + 138);
      ctx.fillStyle = '#2563eb';
      ctx.font = '700 40px Geist, sans-serif';
      ctx.fillText(`${pct}% tercapai`, pad, y + h + 200);
      ctx.font = '500 30px Geist, sans-serif';
      ctx.fillStyle = '#a3a3ad';
      ctx.fillText('Sebelum nyicil, nabung dulu — cekdulu.co.id', pad, canvas.height - 70);
      resolve(canvas);
    };

    const img = new Image();
    img.onload = () => drew(img);
    img.onerror = () => resolve(null);
    img.src = goal.productImage;
  });
}