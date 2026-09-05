/**
 * CekDulu — 30 Hari Tanpa PayLater
 *
 * Pure, SSR-safe logic for the challenge: no browser-only APIs. Persistence
 * is handled separately by the page via localStorage (browser-only).
 *
 * PRIVACY: raw financial amounts are never meant to reach analytics. The
 * bucketing helpers in this module produce coarse ranges only.
 */

export const CHALLENGE_DAYS = 30;
export const CHALLENGE_STORAGE_KEY = 'cekdulu_paylater_challenge';
export const SCHEMA_VERSION = 1;

/** Milestones shown on the progress row (30 is completion, not a banner). */
export const MILESTONES = [7, 14, 21, 30] as const;

export type Milestone = (typeof MILESTONES)[number];

/** Milestones that trigger a lightweight celebration banner. */
export const CELEBRATION_MILESTONES = [7, 14, 21] as const;

/** Rocket illustration stages for the active hero, keyed by milestone day. */
export type ChallengeRocketStage = 1 | 7 | 14 | 21 | 30;

const ROCKET_STAGES: readonly ChallengeRocketStage[] = [30, 21, 14, 7, 1];

/**
 * Pick the rocket illustration stage that best matches a challenge day:
 * 1–6 → 1, 7–13 → 7, 14–20 → 14, 21–29 → 21, 30 → 30.
 * Pure and SSR-safe so it can be tested without a browser.
 */
export function rocketStageForDay(day: number): ChallengeRocketStage {
  const n = Math.round(day);
  if (!Number.isFinite(n)) return 1;
  const clamped = Math.min(CHALLENGE_DAYS, Math.max(1, n));
  const stage = ROCKET_STAGES.find((s) => clamped >= s);
  return (stage ?? 1) as ChallengeRocketStage;
}

/** What happened for a logged moment. */
export type LogKind = 'not_bought' | 'paid_other';

export interface ChallengeLog {
  id: string;
  kind: LogKind;
  amount: number;
  /** Day (1..30) at the time it was logged, best-effort. */
  day: number;
  category: string;
  createdAt: string;
}

export interface ChallengeState {
  /** Schema version so the stored shape can evolve later. */
  version: number;
  /** ISO date (yyyy-mm-dd) of the challenge start, local time. */
  startDate: string;
  /** Optional baseline (Rp) of typical monthly PayLater usage, 0 when skipped. */
  baseline: number;
  /** Logged moments. */
  logs: ChallengeLog[];
  /** Celebration milestones already acknowledged (7/14/21). */
  celebratedMilestones: number[];
  /** True once day 30 arrived and the result screen was shown. */
  completed: boolean;
}

const LOG_PREFIX = 'paylater-log-';

export function createEmptyState(startDate: string = todayIso()): ChallengeState {
  return {
    version: SCHEMA_VERSION,
    startDate,
    baseline: 0,
    logs: [],
    celebratedMilestones: [],
    completed: false,
  };
}

/** Today's date in yyyy-mm-dd using local time. */
export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function parseIsoDate(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return NaN;
  // Local-time construction (not UTC) so date math matches the user's clock.
  return new Date(y, m - 1, d).getTime();
}

/**
 * 30-day progress based on the start date. Does NOT require a manual daily
 * check-in: the challenge runs for 30 calendar days from the start date.
 * Always returns a value clamped to 1..30.
 */
export function dayForDate(startDate: string, today: string = todayIso()): number {
  const start = parseIsoDate(startDate);
  const now = parseIsoDate(today);
  if (!Number.isFinite(start) || !Number.isFinite(now)) return 1;
  const diffDays = Math.floor((now - start) / 86_400_000);
  return Math.min(CHALLENGE_DAYS, Math.max(1, diffDays + 1));
}

export function isChallengeComplete(state: ChallengeState, today: string = todayIso()): boolean {
  return dayForDate(state.startDate, today) >= CHALLENGE_DAYS;
}

/** Sum of amounts for logs of a given kind. */
function sumByKind(state: ChallengeState, kind: LogKind): number {
  return state.logs.reduce((sum, log) => (log.kind === kind ? sum + log.amount : sum), 0);
}

/** "pengeluaran yang berhasil dihindari" — only logs where nothing was bought. */
export function totalAvoidedExpense(state: ChallengeState): number {
  return sumByKind(state, 'not_bought');
}

/** "transaksi PayLater yang berhasil dihindari" — logs where paid by another method. */
export function totalPaylaterAvoided(state: ChallengeState): number {
  return sumByKind(state, 'paid_other');
}

export function avoidedExpenseCount(state: ChallengeState): number {
  return state.logs.filter((log) => log.kind === 'not_bought').length;
}

export function paylaterAvoidedCount(state: ChallengeState): number {
  return state.logs.filter((log) => log.kind === 'paid_other').length;
}

/**
 * The highest celebration milestone (7/14/21) reached but not yet
 * acknowledged, or null when nothing should be celebrated.
 */
export function nextUncelebratedMilestone(state: ChallengeState, day: number): Milestone | null {
  const celebrated = new Set(state.celebratedMilestones);
  const candidates = CELEBRATION_MILESTONES.filter((m) => day >= m && !celebrated.has(m));
  return candidates.length ? (Math.max(...candidates) as Milestone) : null;
}

/** Mark a milestone as acknowledged (persisted by the caller). */
export function markMilestoneCelebrated(state: ChallengeState, milestone: number): ChallengeState {
  if (state.celebratedMilestones.includes(milestone)) return state;
  return { ...state, celebratedMilestones: [...state.celebratedMilestones, milestone] };
}

/** Build a new log entry. */
export function createLog(
  kind: LogKind,
  amount: number,
  category: string,
  day: number
): ChallengeLog {
  return {
    id: `${LOG_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    amount: Math.max(0, Math.round(amount)),
    day: Math.min(CHALLENGE_DAYS, Math.max(1, day)),
    category,
    createdAt: new Date().toISOString(),
  };
}

export function addLog(state: ChallengeState, log: ChallengeLog): ChallengeState {
  return { ...state, logs: [...state.logs, log] };
}

// ---- History display helpers (used by the active-screen journal) ----

/** Newest-first logs, limited to `limit` entries (default: the 3 latest). */
export function latestLogs(state: ChallengeState, limit: number = 3): ChallengeLog[] {
  return [...state.logs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, Math.max(0, limit));
}

/** All logs, newest first (expanded history view). */
export function allLogsNewestFirst(state: ChallengeState): ChallengeLog[] {
  return latestLogs(state, state.logs.length);
}

/** Short, jargon-free outcome label for a logged moment. */
export function logOutcomeLabel(kind: LogKind): string {
  return kind === 'not_bought' ? 'Tidak jadi membeli' : 'Tetap membeli • tanpa PayLater';
}

/** Human-friendly relative date for a log's `createdAt` (Indonesian). */
export function relativeLogDateLabel(createdAt: string, today: string = todayIso()): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  const localIso =
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const createdTime = parseIsoDate(localIso);
  const todayTime = parseIsoDate(today);
  if (!Number.isFinite(createdTime) || !Number.isFinite(todayTime)) return '';
  const diff = Math.round((todayTime - createdTime) / 86_400_000);
  if (diff <= 0) return 'Hari ini';
  if (diff === 1) return 'Kemarin';
  return `${diff} hari lalu`;
}

// ---- Persistence (browser-only, guarded so this module stays SSR-safe) ----

/** Read the stored challenge, or null when absent/invalid. */
export function readChallengeStorage(): ChallengeState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CHALLENGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChallengeState>;
    if (!parsed || typeof parsed.startDate !== 'string' || !Array.isArray(parsed.logs)) {
      return null;
    }
    // A stored schema never older than the current one is safe to read.
    if (typeof parsed.version === 'number' && parsed.version > SCHEMA_VERSION) return null;
    return {
      version: SCHEMA_VERSION,
      startDate: parsed.startDate,
      baseline: Number(parsed.baseline) || 0,
      logs: parsed.logs as ChallengeLog[],
      celebratedMilestones: Array.isArray(parsed.celebratedMilestones)
        ? (parsed.celebratedMilestones as number[])
        : [],
      completed: parsed.completed === true,
    };
  } catch {
    return null;
  }
}

export function writeChallengeStorage(state: ChallengeState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CHALLENGE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode / quota) — the session still works in-memory.
  }
}

export function clearChallengeStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CHALLENGE_STORAGE_KEY);
  } catch {
    // Ignore — nothing meaningful to clean up.
  }
}

// ---- Analytics buckets (safe ranges only; never raw amounts) ----

export type PaylaterAmountBucket =
  | 'none'
  | 'under_100k'
  | '100k_500k'
  | '500k_1jt'
  | '1_2jt'
  | '2jt_plus';

export function paylaterAmountBucket(value: number): PaylaterAmountBucket {
  if (value <= 0) return 'none';
  if (value < 100_000) return 'under_100k';
  if (value < 500_000) return '100k_500k';
  if (value < 1_000_000) return '500k_1jt';
  if (value < 2_000_000) return '1_2jt';
  return '2jt_plus';
}

export interface ChallengeAnalyticsSummary {
  day: number;
  log_count: number;
  avoided_expense_bucket: PaylaterAmountBucket;
  paylater_avoided_bucket: PaylaterAmountBucket;
  baseline_bucket: PaylaterAmountBucket;
  completed: boolean;
}

/** Coarse, privacy-safe snapshot of a challenge for analytics events. */
export function summarizeForAnalytics(state: ChallengeState): ChallengeAnalyticsSummary {
  return {
    day: dayForDate(state.startDate),
    log_count: state.logs.length,
    avoided_expense_bucket: paylaterAmountBucket(totalAvoidedExpense(state)),
    paylater_avoided_bucket: paylaterAmountBucket(totalPaylaterAvoided(state)),
    baseline_bucket: paylaterAmountBucket(state.baseline),
    completed: isChallengeComplete(state),
  };
}