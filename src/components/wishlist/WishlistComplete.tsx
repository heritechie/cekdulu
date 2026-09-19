import { formatNumber, type WishlistItem } from './item';
import { PixelRevealCanvas } from './WishlistDetail';
import { WishlistAppHeader } from './WishlistMenu';
import { SHARE_UNSUPPORTED_NOTE } from '../../lib/browser-capabilities';

interface WishlistCompleteProps {
  item: WishlistItem;
  shareSupported: boolean;
  onBack: () => void;
  onShare: () => void;
  onDelete: () => void;
  onNewGoal: () => void;
}

/**
 * Goal completion screen — the direct replacement of the vanilla "complete"
 * section. Rendered whenever the selected wishlist item has no remaining
 * amount (full pixel reveal at progress 1). Share is gated on the same
 * capability probe the vanilla page used; when unsupported the CTA is disabled
 * and a note explains why, while the ⋮ menu's Bagikan stays inert.
 */
export default function WishlistComplete({
  item,
  shareSupported,
  onBack,
  onShare,
  onDelete,
  onNewGoal,
}: WishlistCompleteProps) {
  return (
    <div className="flex flex-col gap-5 pt-2 pb-12">
      <WishlistAppHeader
        onBack={onBack}
        onShare={shareSupported ? onShare : () => {}}
        onDelete={onDelete}
        shareSupported={shareSupported}
      />

      <p className="text-center text-5xl" aria-hidden="true">
        🎉
      </p>
      <h2
        id="wishlist-complete-heading"
        tabIndex={-1}
        className="text-balance text-center text-3xl font-bold tracking-tight outline-none"
      >
        Berhasil!
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-center text-base text-muted-foreground">
        Kamu berhasil menabung untuk{' '}
        <span className="font-semibold text-foreground">{item.name}</span>.
      </p>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          <PixelRevealCanvas imageSrc={item.productImage} progress={1} />
          <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground shadow-sm">
            100%
          </span>
        </div>
        <div className="flex flex-wrap items-baseline justify-center gap-x-2 p-5 text-center">
          <p className="text-2xl font-extrabold tracking-tight text-foreground">
            Rp<span className="tabular-nums">{formatNumber(item.saved)}</span>
          </p>
          <p className="text-sm font-medium text-muted-foreground">
            / Rp<span className="tabular-nums">{formatNumber(item.targetPrice)}</span>
          </p>
        </div>
      </div>

      <div className="mt-1 space-y-3">
        <button
          type="button"
          onClick={onShare}
          disabled={!shareSupported}
          className="w-full rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          Bagikan Pencapaian
        </button>
        {!shareSupported ? (
          <p className="text-center text-xs text-muted-foreground">{SHARE_UNSUPPORTED_NOTE}</p>
        ) : null}
        <button
          type="button"
          onClick={onNewGoal}
          className="w-full rounded-full border border-border bg-background px-8 py-3.5 text-base font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Buat Target Baru
        </button>
      </div>
    </div>
  );
}