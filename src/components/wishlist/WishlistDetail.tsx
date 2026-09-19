import { useEffect, useRef, useState } from 'react';
import { formatNumber, type WishlistItem } from './item';
import { renderPixelReveal } from '../../lib/wishlist-pixel';
import SavingBottomSheet, { type SaveEntryFormData } from './SavingBottomSheet';
import { WishlistAppHeader } from './WishlistMenu';

interface WishlistDetailProps {
  item: WishlistItem;
  onBack: () => void;
  onAddSaving: () => void;
  onShare: () => void;
  onDelete: () => void;
  shareSupported: boolean;
  isSavingOpen?: boolean;
  onCloseSaving?: () => void;
  onSaveSaving?: (data: SaveEntryFormData) => void;
}

type RevealState = 'loaded' | 'failed';

export function PixelRevealCanvas({ imageSrc, progress }: { imageSrc: string; progress: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [reveal, setReveal] = useState<RevealState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setReveal(null);
    renderPixelReveal(canvas, imageSrc, progress, {
      onLoad: () => setReveal('loaded'),
      onError: () => setReveal('failed'),
    });
  }, [imageSrc, progress]);

  const showCanvas = reveal === 'loaded';
  const showPlaceholder = reveal !== 'loaded';

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-label="Visual barang impian"
        className="absolute inset-0 h-full w-full"
      />
      {showPlaceholder ? (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-6xl">
          ⚖️
        </span>
      ) : null}
    </>
  );
}

export default function WishlistDetail({
  item,
  onBack,
  onAddSaving,
  onShare,
  onDelete,
  shareSupported,
  isSavingOpen = false,
  onCloseSaving = () => {},
  onSaveSaving = () => {},
}: WishlistDetailProps) {
  return (
    <div className="flex flex-col gap-5 pt-2 pb-12">
      <WishlistAppHeader
        onBack={onBack}
        onShare={shareSupported ? onShare : () => {}}
        onDelete={onDelete}
      />

      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl border border-border bg-muted shadow-sm">
        <PixelRevealCanvas imageSrc={item.productImage} progress={item.progress} />
        <span className="absolute left-3 top-3 rounded-full border border-border bg-background/90 px-3 py-1 text-xs font-bold text-foreground shadow-sm backdrop-blur">
          <span className="tabular-nums">{item.percent}%</span>
        </span>
      </div>

      <div className="space-y-5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{item.name}</h2>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-2xl font-extrabold tracking-tight text-foreground">
              Rp<span className="tabular-nums">{formatNumber(item.saved)}</span>
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              dari Rp<span className="tabular-nums">{formatNumber(item.targetPrice)}</span>
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="font-semibold tabular-nums text-foreground">{item.percent}%</span>
            <span className="text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">
                {formatNumber(item.remaining)}
              </span>{' '}
              lagi terkumpul
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={item.percent}
            aria-label="Progres menabung"
            className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${item.percent}%` }}
            />
          </div>
        </div>

        {item.estimateLabel ? (
          <p className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground">
            {item.estimateLabel}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onAddSaving}
          className="w-full rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          + Catat Tabungan
        </button>

        <section aria-labelledby="history-heading">
          <h3
            id="history-heading"
            className="text-lg font-bold tracking-tight text-foreground"
          >
            Catatan Tabungan
          </h3>
          {item.history.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Belum ada catatan. Catat tabungan pertamamu!
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {item.history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  {entry.proofImage ? (
                    <img
                      src={entry.proofImage}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg bg-muted object-cover ring-1 ring-border aspect-square"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold leading-tight text-foreground">
                      Rp<span className="tabular-nums">{formatNumber(entry.amount)}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.note ?? 'Catatan tabungan'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {entry.dateLabel}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    <SavingBottomSheet
        open={isSavingOpen}
        onClose={onCloseSaving}
        onSubmit={onSaveSaving}
      />
    </div>
  );
}