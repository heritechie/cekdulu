import {
  calculateFinancialBalance,
  calculateLoanPrincipal,
  calculateMonthlyInstallment,
  type FinancialCalculationResult,
} from '../calculator/engine';

/**
 * Pure logic untuk simulasi kampanye campaign (mis. Cek Kemampuan Cicilan
 * pada halaman katalog property). Fisik perhitungan memakai engine kalkulator
 * yang sama agar hasil konsisten dengan kalkulator CekDulu.
 */

export interface CampaignScenarioInput {
  price: number;
  annualInterestRate: number;
  downPayment: number;
  tenorMonths: number;
  monthlyIncome: number;
  existingInstallments: number;
  monthlyExpenses: number;
}

export interface CampaignScenario extends FinancialCalculationResult {
  principal: number;
  monthlyInstallment: number;
  tenorYears: number;
}

export function calculateCampaignScenario(input: CampaignScenarioInput): CampaignScenario {
  const price = Math.max(0, input.price);
  const downPayment = Math.max(0, input.downPayment);
  const tenorMonths = Math.max(1, input.tenorMonths);

  const principal = calculateLoanPrincipal(price, downPayment);
  const monthlyInstallment = calculateMonthlyInstallment({
    principal,
    annualInterestRate: Math.max(0, input.annualInterestRate),
    tenureMonths: tenorMonths,
    interestMethod: 'annuity',
  });
  const balance = calculateFinancialBalance(
    input.monthlyIncome,
    input.existingInstallments,
    monthlyInstallment,
    input.monthlyExpenses,
  );

  return {
    principal,
    monthlyInstallment,
    tenorYears: tenorMonths / 12,
    ...balance,
  };
}

export interface CampaignWhatsappContext {
  number: string;
  baseMessage: string;
  /** URL campaign saat ini (dari browser), agar pesan WhatsApp mengacu pada campaign yang sedang dibuka. */
  url?: string;
}

/**
 * Membuat link wa.me dengan pesan awal + URL campaign saat ini.
 *
 * HANYA mengarah pada identitas property (marketer + nama campaign) dan URL,
 * tanpa ringkasan finansial apa pun. Penghasilan, cicilan berjalan, pengeluaran,
 * DP, tenor, bunga, DBR, sisa uang, dan estimasi cicilan sengaja TIDAK
 * dimasukkan agar data finansial user tidak terkirim ke marketer.
 * URL diambil dari browser saat runtime (window.location.href), bukan hardcode.
 */
export function buildWhatsappUrl(context: CampaignWhatsappContext): string {
  const lines: string[] = [];

  const base = (context.baseMessage || '').trim();
  if (base) lines.push(base);

  if (context.url) {
    if (lines.length > 0) lines.push('');
    lines.push('Saya mau tanya lebih lanjut:');
    lines.push(context.url);
  }

  if (lines.length === 0) return `https://wa.me/${context.number}`;

  return `https://wa.me/${context.number}?text=${encodeURIComponent(lines.join('\n'))}`;
}