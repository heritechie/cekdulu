import { useEffect, useRef, useState } from 'react';

interface WishlistMenuProps {
  onShare: () => void;
  onDelete: () => void;
  shareSupported: boolean;
}

/**
 * Top bar shared by the detail and completion screens: back button, "Wishlist"
 * title, and the ⋮ menu. Mirrors the vanilla page's fixed top bar.
 */
export function WishlistAppHeader({
  onBack,
  onShare,
  onDelete,
  shareSupported,
}: {
  onBack: () => void;
  onShare: () => void;
  onDelete: () => void;
  shareSupported: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        aria-label="Kembali ke daftar"
        onClick={onBack}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="text-lg leading-none" aria-hidden="true">
          ‹
        </span>
      </button>
      <span className="text-base font-semibold tracking-tight text-foreground">Wishlist</span>
      <WishlistMenu onShare={onShare} onDelete={onDelete} shareSupported={shareSupported} />
    </div>
  );
}

/**
 * App menu (⋮ → Bagikan / Hapus), the direct replacement of the vanilla
 * `appMenu`/`appMenuBtn`. The dropdown stays in the DOM and is toggled by
 * class so SSR (and tests) can assert the actions exist; opening/closing is
 * pure UI state. Clicking outside closes it, exactly like the vanilla page.
 */
export default function WishlistMenu({ onShare, onDelete, shareSupported }: WishlistMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative" role="menu">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>

      <div
        className={`absolute right-0 top-2 w-44 overflow-hidden rounded-2xl border border-border bg-card shadow-lg ${
          open ? '' : 'hidden'
        }`}
      >
        <button
          type="button"
          disabled={!shareSupported}
          onClick={() => {
            setOpen(false);
            onShare();
          }}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Bagikan
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onDelete();
          }}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          Hapus
        </button>
      </div>
    </div>
  );
}