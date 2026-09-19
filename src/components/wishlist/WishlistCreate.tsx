import { useState } from 'react';
import { compressImage, parseMoney, formatMoney, validateImageFile } from '../../lib/wishlist';
import type { CreateWishlistGoalData } from './data';

interface WishlistCreateProps {
  onChangeGoal: (data: CreateWishlistGoalData) => void;
}

/**
 * "Buat target baru" form — the direct replacement of the vanilla landing
 * screen. Mirrors the vanilla startGoal() validation exactly:
 *
 *   - no (valid, above-zero) price → "Masukkan harga barang dulu ya."
 *   - no product photo          → "Upload foto barang impianmu dulu ya."
 *
 * Persistence is NOT part of this component: the payload goes to onChangeGoal
 * and WishlistApp stores it through the data bridge (createWishlistGoal).
 */
export default function WishlistCreate({ onChangeGoal }: WishlistCreateProps) {
  const [name, setName] = useState('');
  const [priceDisplay, setPriceDisplay] = useState('');
  const [productImage, setProductImage] = useState('');
  const [imageHint, setImageHint] = useState('Upload Foto Barang');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleImageSelected = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    const data = await compressImage(file);
    if (data) {
      setProductImage(data);
      setImageHint('Ganti Foto');
      setError(null);
    }
  };

  const handleSubmit = () => {
    if (busy) return;
    const price = parseMoney(priceDisplay);
    if (!(price > 0)) {
      setError('Masukkan harga barang dulu ya.');
      return;
    }
    if (!productImage) {
      setError('Upload foto barang impianmu dulu ya.');
      return;
    }
    setError(null);
    setBusy(true);
    onChangeGoal({ name, price, productImage });
  };

  return (
    <section aria-labelledby="wishlist-heading" className="pt-4">
      <h1
        id="wishlist-heading"
        tabIndex={-1}
        className="text-balance text-center text-3xl font-bold tracking-tight outline-none sm:text-4xl"
      >
        Punya barang impian? <span className="text-primary">Nabung dulu.</span>
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-base text-muted-foreground">
        Upload barang yang kamu mau. Mulai nabung, dan lihat barang impianmu perlahan jadi
        nyata.
      </p>

      <div className="mt-8 flex justify-center">
        <img
          src="/wishlist/wishlist_illustration.png"
          alt=""
          aria-hidden="true"
          className="h-25 w-25 sm:h-32 sm:w-32"
          width="128"
          height="128"
        />
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <label
          htmlFor="goal-image-input"
          className="relative block cursor-pointer border-b border-border bg-muted/60"
        >
          <input
            id="goal-image-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Upload foto barang"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImageSelected(file);
              e.target.value = '';
            }}
          />
          <div className="relative flex h-52 w-full items-center justify-center sm:h-64">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-background text-primary shadow-sm">
                <ImageIcon />
              </span>
              <span className="text-sm font-medium">{imageHint}</span>
            </div>
            {productImage ? (
              <img
                src={productImage}
                alt="Pratinjau foto barang"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
          </div>
        </label>

        <div className="space-y-4 p-5">
          <div>
            <label
              htmlFor="goal-name"
              className="mb-1.5 block text-sm font-medium text-muted-foreground"
            >
              Nama barang <span className="text-muted-foreground/60">(opsional)</span>
            </label>
            <input
              id="goal-name"
              type="text"
              maxLength={60}
              placeholder="Contoh: Sepatu impian"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/40"
            />
          </div>
          <div>
            <label
              htmlFor="goal-price"
              className="mb-1.5 block text-sm font-medium text-muted-foreground"
            >
              Harga barang
            </label>
            <div className="relative">
              <span
                className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-medium text-muted-foreground"
                aria-hidden="true"
              >
                Rp
              </span>
              <input
                id="goal-price"
                type="text"
                inputMode="numeric"
                placeholder="Contoh: 1.500.000"
                value={priceDisplay}
                onChange={(e) => setPriceDisplay(formatMoney(e.target.value))}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 pl-10 text-lg font-semibold text-foreground outline-none transition-colors tabular-nums placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/40"
              />
            </div>
          </div>
          {error ? (
            <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="w-full rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            Mulai Nabung
            <span className="ml-1" aria-hidden="true">
              →
            </span>
          </button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            Gratis. Tanpa login. Data tersimpan di perangkatmu.
          </p>
        </div>
      </div>
    </section>
  );
}

function ImageIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}