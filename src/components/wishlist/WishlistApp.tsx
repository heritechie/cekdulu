import { useEffect, useState } from 'react';
import { createWishlistNavigation, showDetail, goBackToList, type WishlistNavigation } from './navigation';
import { WishlistScreen } from './WishlistScreen';
import {
  createWishlistGoal,
  deleteWishlistGoal,
  loadWishlistData,
  saveWishlistEntry,
  type CreateWishlistGoalData,
  type WishlistData,
} from './data';
import type { WishlistItem } from './item';
import type { SaveEntryFormData } from './SavingBottomSheet';
import { buildWishlistShareCanvas } from '../../lib/wishlist-share';
import { canShareImageFiles } from '../../lib/browser-capabilities';
import { fireShareClick, fireShareSuccess, trackEvent } from '../../lib/analytics';

/**
 * Wishlist mini app — the sole production implementation of /wishlist.
 *
 * Owns navigation, loading, and every side effect (persistence through the
 * data bridge, native share, coarse analytics). Presentational screens never
 * touch storage; all reads flow through loadWishlistData() and writes through
 * createWishlistGoal / saveWishlistEntry / deleteWishlistGoal.
 *
 * Analytics parity with the retired vanilla page:
 *   saving_goal_started       {price_under_1jt}
 *   saving_entry_started
 *   saving_entry_completed    {amount_under_100k}
 *   saving_goal_completed
 *   saving_goal_reset         (Hapus only — "Buat Target Baru" never fires it)
 *   share_click / share_success (wishlist / image)
 */
export default function WishlistApp() {
  const [nav, setNav] = useState<WishlistNavigation>(() => createWishlistNavigation());
  const [data, setData] = useState<WishlistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSavingOpen, setIsSavingOpen] = useState(false);
  const [completedTracked, setCompletedTracked] = useState(false);
  const [shareSupported] = useState<boolean>(() => canShareImageFiles());

  useEffect(() => {
    let cancelled = false;
    loadWishlistData()
      .then((loaded) => {
        if (!cancelled) setData(loaded);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror the vanilla init-before-complete: a goal that is already complete
  // (or reaches completion) fires saving_goal_completed exactly once.
  const goalCompleted = Boolean(data && data.item.remaining <= 0);
  useEffect(() => {
    if (goalCompleted && !completedTracked) {
      setCompletedTracked(true);
      trackEvent('saving_goal_completed');
    } else if (!goalCompleted && completedTracked) {
      setCompletedTracked(false);
    }
  }, [goalCompleted, completedTracked]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" aria-busy="true">
        <p className="text-sm text-muted-foreground">Memuat wishlist…</p>
      </div>
    );
  }

  const items: WishlistItem[] = data ? [data.item] : [];

  const handleCreate = (goalData: CreateWishlistGoalData) => {
    const goal = createWishlistGoal(goalData);
    trackEvent('saving_goal_started', { price_under_1jt: goal.price < 1_000_000 });
    void loadWishlistData().then((refreshed) => {
      if (refreshed) {
        setData(refreshed);
        setNav((prev) => showDetail(prev, refreshed.item.id));
      }
    });
  };

  const handleAddSaving = () => {
    trackEvent('saving_entry_started');
    setIsSavingOpen(true);
  };

  const handleSaveSaving = async (formData: SaveEntryFormData): Promise<void> => {
    const goal = data?.goal;
    if (!goal) return;
    const result = await saveWishlistEntry(goal, formData);
    setIsSavingOpen(false);
    trackEvent('saving_entry_completed', { amount_under_100k: result.entry.amount < 100_000 });
    const refreshed = await loadWishlistData();
    if (refreshed) setData(refreshed);
  };

  const handleDelete = async (): Promise<void> => {
    if (!data) return;
    const ok = window.confirm('Hapus target dan semua catatan tabungan dari perangkat ini?');
    if (!ok) return;
    await deleteWishlistGoal();
    setData(null);
    setNav(() => createWishlistNavigation());
    trackEvent('saving_goal_reset');
  };

  const handleNewGoal = async (): Promise<void> => {
    const ok = window.confirm('Mulai target baru? Target ini akan diganti dengan target yang baru.');
    if (!ok) return;
    await deleteWishlistGoal();
    setData(null);
    setNav(() => createWishlistNavigation());
  };

  const handleShare = async (): Promise<void> => {
    if (!shareSupported || !data) return;
    fireShareClick(trackEvent, { share_context: 'wishlist', share_target: 'image' });
    const canvas = await buildWishlistShareCanvas(data.goal);
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no blob'))), 'image/png');
      });
      const file = new File([blob], 'wishlist-pencapaian.png', { type: 'image/png' });
      if (!navigator.share || !navigator.canShare?.({ files: [file] })) return;
      try {
        await navigator.share({ files: [file], title: 'Wishlist — Pencapaianku' });
        fireShareSuccess(trackEvent, {
          share_context: 'wishlist',
          share_target: 'image',
          share_method: 'web_share',
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // user cancelled: no event
        return; // share failed: no fallback
      }
    } catch {
      // Sharing failed silently — nothing else to do.
    }
  };

  return (
    <>
      <WishlistScreen
        nav={nav}
        items={items}
        onSelectItem={(id) => setNav((prev) => showDetail(prev, id))}
        onBackToList={() => setNav(goBackToList)}
        onAddSaving={handleAddSaving}
        onCreate={handleCreate}
        onShare={() => void handleShare()}
        onDelete={() => void handleDelete()}
        onNewGoal={() => void handleNewGoal()}
        shareSupported={shareSupported}
        isSavingOpen={isSavingOpen}
        onCloseSaving={() => setIsSavingOpen(false)}
        onSaveSaving={handleSaveSaving}
      />
    </>
  );
}