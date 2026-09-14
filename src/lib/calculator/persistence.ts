/**
 * CekDulu — Calculator input persistence (browser localStorage).
 *
 * Persists the wizard's numeric inputs so a returning user sees their last
 * values instead of a blank calculator. No backend, no cookies, no IndexedDB.
 *
 * SSR-safe: `window`/`localStorage` are only touched inside guarded functions,
 * never at module scope, so this module can be imported by Node tests and
 * during an Astro build without breaking anything.
 *
 * PRIVACY: only numeric calculator inputs are stored. No identity data is
 * ever collected, sent to analytics, or put into URLs. Storage is keyed per
 * financing context so different calculators never collide.
 */

export const CALCULATOR_STORAGE_VERSION = 1;
export const CALCULATOR_STATE_EXPIRATION_DAYS = 30;

/** Money fields, formatted as rupiah dots ("1.500.000") in the UI. */
export const CALCULATOR_MONEY_FIELDS = [
  'monthlyIncome',
  'kpr',
  'mobil',
  'motor',
  'kartuKredit',
  'pinjamanLain',
  'newInstallment',
  'financingPrice',
  'downPayment',
  'foodHousing',
  'rent',
  'electricity',
  'transport',
  'education',
  'health',
  'entertainment',
  'otherExpenses',
] as const;

/** Native number inputs (no rupiah formatting dots). */
export const CALCULATOR_NUMBER_FIELDS = ['interestRate', 'tenureMonths'] as const;

export const CALCULATOR_FIELDS = [
  ...CALCULATOR_MONEY_FIELDS,
  ...CALCULATOR_NUMBER_FIELDS,
] as const;

export type CalculatorFieldId = (typeof CALCULATOR_FIELDS)[number];

export type CalculatorStepPath = 'manual' | 'sim';

export interface CalculatorInputData {
  /** Numeric snapshot of every wizard input, keyed by field id. */
  values: Record<CalculatorFieldId, number>;
  /** Step 3 input path: manual installment vs price/DP/bunga/tenor simulator. */
  stepPath: CalculatorStepPath;
}

export interface CalculatorPersistedState {
  version: number;
  updatedAt: string;
  data: CalculatorInputData;
}

/**
 * Storage key, scoped per financing context so KPR / Mobil / Motor / Pinjaman
 * never collide ("cekdulu:calculator:mobil:state:v1").
 */
export function calculatorStorageKey(slug: string): string {
  return `cekdulu:calculator:${slug}:state:v1`;
}

/**
 * Coerce arbitrary parsed JSON into a usable snapshot. Unknown/extra fields
 * are dropped, invalid numbers become 0, an unknown step path falls back to
 * "manual". Returns null when the payload is structurally unusable or when
 * nothing meaningful is left to restore (all zeros).
 */
export function sanitizeCalculatorData(raw: unknown): CalculatorInputData | null {
  if (!raw || typeof raw !== 'object') return null;
  const values = (raw as Partial<CalculatorInputData>).values;
  if (!values || typeof values !== 'object') return null;

  const out = {} as Record<CalculatorFieldId, number>;
  for (const field of CALCULATOR_FIELDS) {
    const candidate = (values as Record<string, unknown>)[field];
    const num = typeof candidate === 'number' ? candidate : Number(candidate);
    out[field] = Number.isFinite(num) && num >= 0 ? num : 0;
  }

  const stepPath: CalculatorStepPath =
    (raw as Partial<CalculatorInputData>).stepPath === 'sim' ? 'sim' : 'manual';

  const data: CalculatorInputData = { values: out, stepPath };
  const hasMeaningfulValue = CALCULATOR_FIELDS.some((field) => data.values[field] > 0);
  if (!hasMeaningfulValue) return null;
  return data;
}

/** True when the stored timestamp is older than the expiration window. */
export function isCalculatorStateExpired(updatedAt: string, now: number = Date.now()): boolean {
  const time = new Date(updatedAt).getTime();
  if (!Number.isFinite(time)) return true; // unparseable = treat as stale
  return now - time > CALCULATOR_STATE_EXPIRATION_DAYS * 86_400_000;
}

/**
 * Validate a parsed storage envelope (version + updatedAt + data). Pure and
 * SSR-safe so the rules can be tested without a browser.
 */
export function parseCalculatorState(
  raw: unknown,
  now: number = Date.now()
): CalculatorPersistedState | null {
  if (!raw || typeof raw !== 'object') return null;
  const envelope = raw as Partial<CalculatorPersistedState>;
  if (typeof envelope.version !== 'number' || envelope.version > CALCULATOR_STORAGE_VERSION) {
    return null;
  }
  if (typeof envelope.updatedAt !== 'string' || isCalculatorStateExpired(envelope.updatedAt, now)) {
    return null;
  }
  const data = sanitizeCalculatorData(envelope.data);
  if (!data) return null;
  return { version: CALCULATOR_STORAGE_VERSION, updatedAt: envelope.updatedAt, data };
}

/** Read the saved snapshot, or null when absent/invalid/expired. */
export function readCalculatorState(slug: string, now: number = Date.now()): CalculatorPersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(calculatorStorageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    // Expired states are cleaned up rather than just ignored.
    if (parsed && typeof parsed === 'object') {
      const updatedAt = (parsed as Partial<CalculatorPersistedState>).updatedAt;
      if (typeof updatedAt !== 'string' || isCalculatorStateExpired(updatedAt, now)) {
        clearCalculatorState(slug);
        return null;
      }
    }
    return parseCalculatorState(parsed, now);
  } catch {
    return null;
  }
}

/**
 * Persist a snapshot. Returns false (and clears any stale entry) when the
 * snapshot has nothing meaningful to store — e.g. the user wiped all inputs.
 */
export function writeCalculatorState(slug: string, data: CalculatorInputData): boolean {
  if (typeof window === 'undefined') return false;
  const sanitized = sanitizeCalculatorData(data);
  if (!sanitized) {
    clearCalculatorState(slug);
    return false;
  }
  const state: CalculatorPersistedState = {
    version: CALCULATOR_STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    data: sanitized,
  };
  try {
    window.localStorage.setItem(calculatorStorageKey(slug), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearCalculatorState(slug: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(calculatorStorageKey(slug));
  } catch {
    // Storage unavailable — nothing meaningful to clean up.
  }
}