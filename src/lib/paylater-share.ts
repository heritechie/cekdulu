/**
 * CekDulu — 30 Hari Tanpa PayLater share copy.
 *
 * SSR-safe, pure text builders for the Web Share payload. Stats in every
 * context come ONLY from Option A (not_bought): avoided transactions and
 * avoided expense are never inflated by Option B (paid_other).
 */
import { avoidedExpenseCount, totalAvoidedExpense, type ChallengeState } from './paylater-challenge';

export const CHALLENGE_SHARE_URL = 'https://cekdulu.my.id/challenges/30-hari-tanpa-paylater';

export type ChallengeShareContext = 'landing' | 'progress' | 'milestone' | 'completed';

export interface ChallengeShareOptions {
  state?: ChallengeState | null;
  /** Day shown by the 'progress' context (1..30). */
  day?: number;
  /** Celebration milestone (7/14/21) shown by the 'milestone' context. */
  milestone?: number;
}

function plainRupiah(n: number): string {
  return `Rp${Math.round(n).toLocaleString('id-ID')}`;
}

/** Only Option A stats — Option B is never counted as savings. */
function optionALines(state: ChallengeState | null): string[] {
  const tx = state ? avoidedExpenseCount(state) : 0;
  const expense = state ? totalAvoidedExpense(state) : 0;
  return [`${tx} transaksi berhasil dihindari`, `${plainRupiah(expense)} pengeluaran berhasil dihindari`];
}

export function buildChallengeShareText(
  context: ChallengeShareContext,
  options: ChallengeShareOptions = {}
): string {
  const { state = null, day = 1, milestone } = options;
  const url = CHALLENGE_SHARE_URL;

  switch (context) {
    case 'landing':
      return ['🔥 Aku ikut Challenge 30 Hari Tanpa PayLater.', 'Mau ikut juga?', '', url].join('\n');
    case 'progress':
      return [
        `🔥 ${day} Hari Tanpa PayLater`,
        '',
        ...optionALines(state),
        '',
        'Aku sedang ikut challenge ini.',
        'Kamu mau ikut?',
        '',
        url,
      ].join('\n');
    case 'milestone': {
      const ms = milestone ?? 7;
      return [
        `🎉 ${ms} Hari Tanpa PayLater!`,
        '',
        ...optionALines(state),
        '',
        'Ikut challenge-nya juga →',
        url,
      ].join('\n');
    }
    case 'completed':
      return [
        '🏆 Aku berhasil menyelesaikan 30 Hari Tanpa PayLater.',
        '',
        ...optionALines(state),
        '',
        'Coba ikut challenge-nya juga →',
        url,
      ].join('\n');
  }
}