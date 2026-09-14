/**
 * Presentasi foto properti per-slide pada halaman campaign.
 *
 * Aturan presentasi bersifat eksplisit pada dua format marketing yang umum
 * diunggah marketer properti:
 *
 * - portrait 9:16 (poster promosi / denah / banner vertikal)
 *   → ditampilkan penuh sebagai potret, informasi properti menjadi overlay
 *     transparan gelap di bagian bawah foto.
 * - landscape 16:9 (foto properti/eksterior)
 *   → ditampilkan normal, informasi properti berada di bawah foto.
 * - rasio lain → presentasi katalog normal (informasi di bawah foto).
 *
 * Mode ditentukan dari dimensi ASLI foto (naturalWidth / naturalHeight),
 * bukan dari nama file atau konfigurasi manual per gambar. Breakdown rasio
 * dibuat toleran karena foto upload nyata jarang tepat 9/16 atau 16/9.
 */

export const PORTRAIT_916_ASPECT_MIN = 0.5;
export const PORTRAIT_916_ASPECT_MAX = 0.65;
export const LANDSCAPE_169_ASPECT_MIN = 1.55;
export const LANDSCAPE_169_ASPECT_MAX = 2.0;

export type PropertyImageMode = 'portrait-9-16' | 'landscape-16-9' | 'normal';

export function getPropertyImageMode(
  width: number,
  height: number,
): PropertyImageMode {
  if (!width || !height) return 'normal';
  const aspect = width / height;
  if (aspect >= PORTRAIT_916_ASPECT_MIN && aspect <= PORTRAIT_916_ASPECT_MAX) {
    return 'portrait-9-16';
  }
  if (aspect >= LANDSCAPE_169_ASPECT_MIN && aspect <= LANDSCAPE_169_ASPECT_MAX) {
    return 'landscape-16-9';
  }
  return 'normal';
}