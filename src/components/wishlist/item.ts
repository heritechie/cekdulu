import {
  pickLabel,
  goalProgress,
  goalSavedDisplay,
  remainingAmount,
  estimateSaving,
  estimateLabel,
  relativeDayLabel,
  type SavingGoal,
  type SavingEstimate,
  type SavingEntry,
} from '../../lib/wishlist';
import { formatRupiah } from '../../lib/calculator/engine';

export function formatNumber(n: number): string {
  return formatRupiah(n).replace(/^Rp\s*/, '');
}

export interface HistoryEntryView {
  id: string;
  amount: number;
  note?: string;
  dateLabel: string;
  proofImage: string;
}

export interface WishlistItem {
  id: string;
  name: string;
  productImage: string;
  targetPrice: number;
  saved: number;
  remaining: number;
  progress: number;
  percent: number;
  history: HistoryEntryView[];
  estimateLabel: string | null;
}

export function goalEntriesToHistory(
  goal: SavingGoal,
  today: number = Date.now(),
): HistoryEntryView[] {
  return [...goal.entries]
    .filter((e): e is SavingEntry => Boolean(e) && Number.isFinite(e.amount))
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((e) => ({
      id: e.id,
      amount: Math.max(0, e.amount),
      note: typeof e.note === 'string' && e.note.trim() ? e.note.trim() : undefined,
      dateLabel: relativeDayLabel(e.createdAt, today),
      proofImage: typeof e.proofImage === 'string' ? e.proofImage : '',
    }));
}

export function estimateSummary(estimate: SavingEstimate | null): string | null {
  if (!estimate) return null;
  if (estimate.kind !== 'consistent' || !estimate.rateBased || estimate.days <= 0) {
    return null;
  }
  const label = estimateLabel(estimate);
  return label ? `Perkiraan ${label}` : null;
}

export function goalToWishlistItem(goal: SavingGoal): WishlistItem {
  const progress = goalProgress(goal);
  return {
    id: goal.id,
    name: pickLabel(goal.name),
    productImage: goal.productImage,
    targetPrice: goal.price,
    saved: goalSavedDisplay(goal),
    remaining: remainingAmount(goal),
    progress,
    percent: Math.round(progress * 100),
    history: goalEntriesToHistory(goal),
    estimateLabel: estimateSummary(estimateSaving(goal)),
  };
}