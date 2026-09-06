/**
 * CekDulu — 30 Hari Tanpa PayLater analytics instrumentation.
 *
 * Pure, SSR-safe helpers that describe WHICH events fire and with WHAT params.
 * Browser wiring (gtag, internals filter, sessionStorage) stays in the page:
 * pages pass their real `trackEvent` as the emitter and their own storage.
 *
 * PRIVACY: only coarse, non-personal values are emitted — day numbers, counts,
 * outcome kind, and raw transaction amounts. Free text, merchant names, and any
 * identifier are never part of these events.
 */

import { CHALLENGE_DAYS, avoidedExpenseCount, totalAvoidedExpense } from './paylater-challenge';
import type { ChallengeState, LogKind } from './paylater-challenge';

/** Emits a GA4 event (e.g. the app's existing `trackEvent`). */
export type ChallengeEventEmitter = (
  name: string,
  params?: Record<string, string | number | boolean | undefined>
) => void;

/** Minimal storage contract compatible with sessionStorage. */
export interface SimpleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ChallengeSource = 'homepage' | 'challenges' | 'direct';

export type ChallengeShareMethod = 'web_share' | 'download';

export type ChallengeShareAnalyticsContext = 'progress' | 'milestone' | 'completed';

export const CHALLENGE_VIEW_SESSION_KEY = 'cekdulu_paylater_challenge_view';

/**
 * Where the user came from before opening the challenge page. Never
 * speculative: anything that is not a same-origin homepage or /challenges
 * referral maps to "direct".
 */
export function challengeEntrySource(referrer: string, origin: string): ChallengeSource {
  if (!referrer) return 'direct';
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return 'direct';
  }
  if (url.origin !== origin) return 'direct';
  const path = url.pathname;
  if (path === '' || path === '/') return 'homepage';
  if (path.startsWith('/challenges')) return 'challenges';
  return 'direct';
}

/**
 * Page-entry event, fires at most once per tab session so a refresh does not
 * inflate the funnel. Returns true when the event was actually emitted.
 */
export function fireChallengeView(
  emit: ChallengeEventEmitter,
  source: ChallengeSource,
  session: SimpleStorage
): boolean {
  let fired = false;
  try {
    fired = session.getItem(CHALLENGE_VIEW_SESSION_KEY) === '1';
  } catch {
    // Storage unavailable — still emit so first-time tracking survives.
  }
  if (fired) return false;
  emit('paylater_challenge_view', { source });
  try {
    session.setItem(CHALLENGE_VIEW_SESSION_KEY, '1');
  } catch {
    // Not fatal: next open will just emit again.
  }
  return true;
}

export interface ChallengeStartParams {
  /** True when the user jumped past the setup input. */
  setupSkipped: boolean;
}

export function fireChallengeStart(
  emit: ChallengeEventEmitter,
  params: ChallengeStartParams
): void {
  emit('paylater_challenge_start', {
    setup_skipped: params.setupSkipped,
  });
}

export interface ChallengeLogParams {
  outcome: LogKind;
  /** Raw transaction amount — numeric only, never a label or merchant name. */
  amount: number;
  /** Actual challenge day when the log was recorded. */
  day: number;
}

export function fireChallengeLog(
  emit: ChallengeEventEmitter,
  params: ChallengeLogParams
): void {
  emit('paylater_challenge_log', {
    outcome: params.outcome,
    amount: Math.round(params.amount),
    day: params.day,
  });
}

export function fireChallengeMilestone(emit: ChallengeEventEmitter, day: number): void {
  emit('paylater_challenge_milestone', { day });
}

export interface ChallengeShareParams {
  day: number;
  shareMethod: ChallengeShareMethod;
  context: ChallengeShareAnalyticsContext;
}

export function fireChallengeShare(
  emit: ChallengeEventEmitter,
  params: ChallengeShareParams
): void {
  emit('paylater_challenge_share', {
    day: params.day,
    share_method: params.shareMethod,
    share_context: params.context,
  });
}

export interface ChallengeCompleteParams {
  daysCompleted: number;
  transactionsAvoided: number;
  /** Only Option A (not_bought) totals — Option B is never counted as savings. */
  amountAvoided: number;
}

/**
 * Completion transition (fires once — the page only calls this when the
 * `completed` flag flips). Emits the day-30 milestone, then the completion
 * event, in that order.
 */
export function fireChallengeComplete(
  emit: ChallengeEventEmitter,
  params: ChallengeCompleteParams
): void {
  fireChallengeMilestone(emit, params.daysCompleted);
  emit('paylater_challenge_complete', {
    days_completed: params.daysCompleted,
    transactions_avoided: params.transactionsAvoided,
    amount_avoided: params.amountAvoided,
  });
}

/**
 * Convenience used by the challenge page for the completion event: derives the
 * taxonomy params from a real challenge state (Option A only).
 */
export function completeParamsFromState(state: ChallengeState): ChallengeCompleteParams {
  return {
    daysCompleted: CHALLENGE_DAYS,
    transactionsAvoided: avoidedExpenseCount(state),
    amountAvoided: totalAvoidedExpense(state),
  };
}

export function fireChallengeResume(emit: ChallengeEventEmitter, day: number): void {
  emit('paylater_challenge_resume', { day });
}

export interface ChallengeDayActiveParams {
  /** Current challenge day (1-30) calculated from startDate. */
  day: number;
  /** Total number of logs recorded so far. */
  logs_count: number;
}

/**
 * Fires when user visits the challenge page with an active (non-completed) challenge.
 * Useful for measuring daily active utilization.
 */
export function fireChallengeDayActive(
  emit: ChallengeEventEmitter,
  params: ChallengeDayActiveParams
): void {
  console.debug('[paylater-analytics] fireChallengeDayActive called', params);
  emit('paylater_challenge_day_active', {
    day: params.day,
    logs_count: params.logs_count,
  });
}