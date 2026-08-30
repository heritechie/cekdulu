/**
 * CekDulu Financial Calculation Engine
 * Pure TypeScript calculation functions for financial balance assessment.
 * 
 * All functions are pure (no side effects, no global state) and reusable
 * by any calculator UI or future integrations.
 * 
 * @param monthlyIncome - Penghasilan per bulan (in rupiah)
 * @param existingInstallments - Cicilan yang sudah berjalan per bulan (in rupiah)
 * @param newInstallment - Cicilan baru per bulan (in rupiah)
 * @param monthlyExpenses - Pengeluaran bulanan per bulan (in rupiah)
 * @returns Calculated financial metrics
 */
export interface FinancialCalculationResult {
  /** Total monthly debt including existing and new installment */
  totalMonthlyDebt: number;
  /** Total monthly debt ratio (DBR) - percentage of income going to debt */
  debtRatio: number;
  /** Total monthly expenses */
  totalMonthlyExpenses: number;
  /** Remaining income after paying total debt */
  remainingAfterDebt: number;
  /** Remaining income after debt and expenses */
  remainingAfterDebtAndExpenses: number;
  /** Financial status description */
  financialStatus: string;
  /** Financial status class for UI styling */
  financialStatusClass: 'healthy' | 'warning' | 'critical';
}

/**
 * Calculate financial balance based on income, existing installments,
 * new installment, and monthly expenses.
 */
export function calculateFinancialBalance(
  monthlyIncome: number,
  existingInstallments: number,
  newInstallment: number,
  monthlyExpenses: number
): FinancialCalculationResult {
  // Validate inputs - ensure non-negative
  const income = Math.max(0, monthlyIncome);
  const existing = Math.max(0, existingInstallments);
  const newInst = Math.max(0, newInstallment);
  const expenses = Math.max(0, monthlyExpenses);

  // Calculate total monthly debt (existing + new)
  const totalMonthlyDebt = existing + newInst;

  // Calculate Debt Ratio (DBR) - percentage of income going to debt
  // DBR = (Total Monthly Debt / Monthly Income) * 100
  const debtRatio = income > 0 ? (totalMonthlyDebt / income) * 100 : 0;

  // Calculate total monthly expenses
  const totalMonthlyExpenses = expenses;

  // Remaining income after debt payment
  const remainingAfterDebt = income - totalMonthlyDebt;

  // Remaining income after debt and expenses
  const remainingAfterDebtAndExpenses = income - totalMonthlyDebt - totalMonthlyExpenses;

  // Determine financial status
  let financialStatus: string;
  let financialStatusClass: 'healthy' | 'warning' | 'critical';

  if (debtRatio <= 30 && remainingAfterDebtAndExpenses >= 0) {
    financialStatus = 'Kondisi keuangan sehat';
    financialStatusClass = 'healthy';
  } else if (debtRatio <= 45 && remainingAfterDebtAndExpenses >= 0) {
    financialStatus = 'Penggunaan cicilan perlu diperhatikan';
    financialStatusClass = 'warning';
  } else {
    financialStatus = 'Beban cicilan terlalu besar';
    financialStatusClass = 'critical';
  }

  return {
    totalMonthlyDebt,
    debtRatio,
    totalMonthlyExpenses,
    remainingAfterDebt,
    remainingAfterDebtAndExpenses,
    financialStatus,
    financialStatusClass,
  };
}

/**
 * Helper function to format numbers as Indonesian rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Helper function to format percentage
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Calculate proposed installment based on target DBR and income
 * Useful for KPR, mobil, motor calculators
 * 
 * @param monthlyIncome - Penghasilan per bulan
 * @param targetDbr - Target debt ratio percentage (default: 30)
 * @param existingInstallments - Existing monthly installments
 * @returns Maximum allowed new installment
 */
export function calculateMaxInstallment(
  monthlyIncome: number,
  targetDbr: number = 30,
  existingInstallments: number = 0
): number {
  const income = Math.max(0, monthlyIncome);
  const existing = Math.max(0, existingInstallments);
  const targetAmount = (income * targetDbr) / 100;
  return Math.max(0, targetAmount - existing);
}

/**
 * Calculate required income based on total debt and target DBR
 */
export function calculateRequiredIncome(
  totalDebt: number,
  targetDbr: number = 30
): number {
  if (targetDbr <= 0 || targetDbr > 100) {
    return totalDebt; // fallback
  }
  return (totalDebt * 100) / targetDbr;
}

export type { FinancialCalculationResult };