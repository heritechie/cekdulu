import type { FinancialCalculationResult } from './calculator/engine';

/**
 * CekDulu analytics helpers (GA4).
 *
 * PRIVACY: Never send raw financial values to analytics. Only bucketed
 * ranges are allowed. `trackEvent` only every sends bucketed data.
 */

type AnalyticsParams = Record<string, string | number | boolean | undefined>;

/**
 * Send a GA4 event.
 *
 * Safe no-op when gtag is not available (i.e. GA4 is not configured because
 * PUBLIC_GA_MEASUREMENT_ID is absent and the gtag loader never ran).
 */
export function trackEvent(name: string, params?: AnalyticsParams): void {
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== 'function') return;
  const payload: Record<string, string | number | boolean> = {};
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) payload[key] = value;
    }
  }
  gtag('event', name, payload);
}

// ---- income ----

export type IncomeRange =
  | 'under_3jt'
  | '3_5jt'
  | '5_7_5jt'
  | '7_5_10jt'
  | '10_15jt'
  | '15_20jt'
  | '20_30jt'
  | '30jt_plus';

export function incomeRange(income: number): IncomeRange {
  if (income < 3_000_000) return 'under_3jt';
  if (income < 5_000_000) return '3_5jt';
  if (income < 7_500_000) return '5_7_5jt';
  if (income < 10_000_000) return '7_5_10jt';
  if (income < 15_000_000) return '10_15jt';
  if (income < 20_000_000) return '15_20jt';
  if (income < 30_000_000) return '20_30jt';
  return '30jt_plus';
}

// ---- installment debt (existing debt & new installment share buckets) ----

export type InstallmentRange =
  | 'none'
  | 'under_1jt'
  | '1_2jt'
  | '2_3jt'
  | '3_5jt'
  | '5_10jt'
  | '10jt_plus';

export function installmentRange(value: number): InstallmentRange {
  if (value <= 0) return 'none';
  if (value < 1_000_000) return 'under_1jt';
  if (value < 2_000_000) return '1_2jt';
  if (value < 3_000_000) return '2_3jt';
  if (value < 5_000_000) return '3_5jt';
  if (value < 10_000_000) return '5_10jt';
  return '10jt_plus';
}

// ---- monthly expenses ----

export type ExpenseRange =
  | 'under_2jt'
  | '2_3jt'
  | '3_5jt'
  | '5_7_5jt'
  | '7_5_10jt'
  | '10_15jt'
  | '15jt_plus';

export function expenseRange(value: number): ExpenseRange {
  if (value < 2_000_000) return 'under_2jt';
  if (value < 3_000_000) return '2_3jt';
  if (value < 5_000_000) return '3_5jt';
  if (value < 7_500_000) return '5_7_5jt';
  if (value < 10_000_000) return '7_5_10jt';
  if (value < 15_000_000) return '10_15jt';
  return '15jt_plus';
}

// ---- debt ratio (DBR) ----

export type DebtRatioRange =
  | '0_10'
  | '10_20'
  | '20_30'
  | '30_40'
  | '40_50'
  | '50_60'
  | '60_75'
  | '75_plus';

export function debtRatioRange(ratio: number): DebtRatioRange {
  if (ratio < 10) return '0_10';
  if (ratio < 20) return '10_20';
  if (ratio < 30) return '20_30';
  if (ratio < 40) return '30_40';
  if (ratio < 50) return '40_50';
  if (ratio < 60) return '50_60';
  if (ratio < 75) return '60_75';
  return '75_plus';
}

// ---- remaining income ----

export type RemainingIncomeRange =
  | 'negative'
  | '0_1jt'
  | '1_2jt'
  | '2_3jt'
  | '3_5jt'
  | '5_10jt'
  | '10jt_plus';

export function remainingIncomeRange(value: number): RemainingIncomeRange {
  if (value < 0) return 'negative';
  if (value < 1_000_000) return '0_1jt';
  if (value < 2_000_000) return '1_2jt';
  if (value < 3_000_000) return '2_3jt';
  if (value < 5_000_000) return '3_5jt';
  if (value < 10_000_000) return '5_10jt';
  return '10jt_plus';
}

// ---- result category ----

export type ResultCategory = 'healthy' | 'warning' | 'critical' | 'negative_balance';

/**
 * Map the existing engine result to an aggregated result category.
 * Follows the same logic the UI uses to color the result badge.
 */
export function resultCategory(result: FinancialCalculationResult): ResultCategory {
  if (result.remainingAfterDebtAndExpenses < 0) return 'negative_balance';
  return result.financialStatusClass;
}
