import { formatNumber, type WishlistItem } from './item';

interface WishlistListProps {
  items: WishlistItem[];
  onSelect: (id: string) => void;
}

export function WishlistListItem({
  item,
  onSelect,
}: {
  item: WishlistItem;
  onSelect: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        data-wishlist-item-id={item.id}
        onClick={() => onSelect(item.id)}
        className="flex w-full items-center gap-4 rounded-3xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <img
          src={item.productImage}
          alt=""
          className="h-24 w-24 shrink-0 rounded-2xl bg-muted object-cover aspect-square"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate text-base font-bold text-foreground">{item.name}</p>
          <p className="text-sm text-muted-foreground">
            Target{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {formatNumber(item.targetPrice)}
            </span>
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold tabular-nums text-foreground">{item.percent}%</span>
              <span className="text-muted-foreground">
                {formatNumber(item.saved)} terkumpul
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={item.percent}
              aria-label="Progres menabung"
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${item.percent}%` }}
              />
            </div>
          </div>
        </div>
        <span className="shrink-0 text-lg text-muted-foreground" aria-hidden="true">›</span>
      </button>
    </li>
  );
}

export default function WishlistList({ items, onSelect }: WishlistListProps) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <WishlistListItem key={item.id} item={item} onSelect={onSelect} />
      ))}
    </ul>
  );
}