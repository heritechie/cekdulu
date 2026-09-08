import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFinancialBalance,
  calculateLoanPrincipal,
  calculateMonthlyInstallment,
} from '../src/lib/calculator/engine.ts';

/**
 * Pure logic tests for the shared financial calculation engine.
 *
 * The engine is framework-independent and product-agnostic: there is no
 * "mobil"/"motor"/"KPR" concept here. The installment estimator takes an
 * explicit interestMethod so no single method is silently assumed for every
 * financing product. Its output (monthlyInstallment) plugs directly into
 * calculateFinancialBalance, keeping a single calculation path.
 */

describe('calculateMonthlyInstallment — valid annuity calculation', () => {
  test('100jt 12%/tahun 12 bulan (anuitas) = 8.884.879', () => {
    assert.equal(
      calculateMonthlyInstallment({
        principal: 100_000_000,
        annualInterestRate: 12,
        tenureMonths: 12,
        interestMethod: 'annuity',
      }),
      8_884_879
    );
  });

  test('50jt 6%/tahun 24 bulan (anuitas) = 2.216.031', () => {
    assert.equal(
      calculateMonthlyInstallment({
        principal: 50_000_000,
        annualInterestRate: 6,
        tenureMonths: 24,
        interestMethod: 'annuity',
      }),
      2_216_031
    );
  });

  test('10jt 13,5%/tahun 36 bulan dibulatkan ke rupiah terdekat', () => {
    assert.equal(
      calculateMonthlyInstallment({
        principal: 10_000_000,
        annualInterestRate: 13.5,
        tenureMonths: 36,
        interestMethod: 'annuity',
      }),
      339_353
    );
  });
});

describe('calculateMonthlyInstallment — invalid / non-positive inputs are safe', () => {
  test('zero principal returns 0', () => {
    assert.equal(
      calculateMonthlyInstallment({ principal: 0, annualInterestRate: 12, tenureMonths: 12, interestMethod: 'annuity' }),
      0
    );
  });

  test('negative principal returns 0', () => {
    assert.equal(
      calculateMonthlyInstallment({ principal: -5_000_000, annualInterestRate: 12, tenureMonths: 12, interestMethod: 'annuity' }),
      0
    );
  });

  test('zero tenure returns 0', () => {
    assert.equal(
      calculateMonthlyInstallment({ principal: 100_000_000, annualInterestRate: 12, tenureMonths: 0, interestMethod: 'annuity' }),
      0
    );
  });

  test('negative tenure returns 0', () => {
    assert.equal(
      calculateMonthlyInstallment({ principal: 100_000_000, annualInterestRate: 12, tenureMonths: -1, interestMethod: 'annuity' }),
      0
    );
  });

  test('NaN / Infinity inputs return 0', () => {
    assert.equal(
      calculateMonthlyInstallment({ principal: NaN, annualInterestRate: 12, tenureMonths: 12, interestMethod: 'annuity' }),
      0
    );
    assert.equal(
      calculateMonthlyInstallment({ principal: 100_000_000, annualInterestRate: Infinity, tenureMonths: 12, interestMethod: 'annuity' }),
      0
    );
  });

  test('unsupported interest method returns 0 (method must stay explicit)', () => {
    assert.equal(
      calculateMonthlyInstallment({
        principal: 100_000_000,
        annualInterestRate: 12,
        tenureMonths: 12,
        interestMethod: 'flat',
      }),
      0
    );
  });
});

describe('calculateMonthlyInstallment — zero interest', () => {
  test('12jt 0% 12 bulan = cicilan proporsional 1jt', () => {
    assert.equal(
      calculateMonthlyInstallment({ principal: 12_000_000, annualInterestRate: 0, tenureMonths: 12, interestMethod: 'annuity' }),
      1_000_000
    );
  });

  test('negative interest is treated as 0% (proporsional, tetap aman)', () => {
    assert.equal(
      calculateMonthlyInstallment({ principal: 12_000_000, annualInterestRate: -5, tenureMonths: 12, interestMethod: 'annuity' }),
      1_000_000
    );
  });
});

describe('calculateLoanPrincipal — down payment vs price', () => {
  test('principal = price - down payment', () => {
    assert.equal(calculateLoanPrincipal(200_000_000, 50_000_000), 150_000_000);
  });

  test('no down payment keeps the full price as principal', () => {
    assert.equal(calculateLoanPrincipal(20_000_000, 0), 20_000_000);
  });

  test('down payment larger than price yields 0 (not a negative loan)', () => {
    assert.equal(calculateLoanPrincipal(20_000_000, 25_000_000), 0);
    assert.equal(calculateLoanPrincipal(20_000_000, 20_000_000), 0);
  });

  test('negative inputs are clamped to 0', () => {
    assert.equal(calculateLoanPrincipal(-1_000_000, 500_000), 0);
    assert.equal(calculateLoanPrincipal(10_000_000, -2_000_000), 10_000_000);
  });
});

describe('calculateMonthlyInstallment → calculateFinancialBalance flows', () => {
  test('installment from the engine flows into the affordability check', () => {
    const installment = calculateMonthlyInstallment({
      principal: calculateLoanPrincipal(200_000_000, 40_000_000),
      annualInterestRate: 9,
      tenureMonths: 60,
      interestMethod: 'annuity',
    });
    assert.equal(installment, 3_321_337);

    const result = calculateFinancialBalance(15_000_000, 1_000_000, installment, 5_000_000);
    assert.equal(result.totalMonthlyDebt, 1_000_000 + installment);
    assert.equal(result.remainingAfterDebt, 15_000_000 - 1_000_000 - installment);
    assert.equal(
      result.remainingAfterDebtAndExpenses,
      15_000_000 - 1_000_000 - installment - 5_000_000
    );
    assert.equal(result.debtRatio, ((1_000_000 + installment) / 15_000_000) * 100);
  });

  test('DP > price means no loan: installment 0, affordability fallback stays valid', () => {
    const principal = calculateLoanPrincipal(20_000_000, 25_000_000);
    assert.equal(principal, 0);
    const installment = calculateMonthlyInstallment({
      principal,
      annualInterestRate: 10,
      tenureMonths: 12,
      interestMethod: 'annuity',
    });
    assert.equal(installment, 0);

    const result = calculateFinancialBalance(10_000_000, 0, installment, 4_000_000);
    assert.equal(result.totalMonthlyDebt, 0);
    assert.equal(result.remainingAfterDebtAndExpenses, 6_000_000);
  });
});

describe('calculateFinancialBalance — regression', () => {
  test('healthy: DBR <= 30 and positive remaining', () => {
    const r = calculateFinancialBalance(10_000_000, 1_000_000, 2_000_000, 3_000_000);
    assert.equal(r.totalMonthlyDebt, 3_000_000);
    assert.equal(r.debtRatio, 30);
    assert.equal(r.remainingAfterDebtAndExpenses, 4_000_000);
    assert.equal(r.financialStatusClass, 'healthy');
    assert.equal(r.financialStatus, 'Kondisi keuangan sehat');
  });

  test('warning: DBR <= 45 but above 30', () => {
    const r = calculateFinancialBalance(10_000_000, 1_000_000, 3_000_000, 3_000_000);
    assert.equal(r.debtRatio, 40);
    assert.equal(r.remainingAfterDebtAndExpenses, 3_000_000);
    assert.equal(r.financialStatusClass, 'warning');
  });

  test('critical: DBR > 45 or negative remaining', () => {
    const r = calculateFinancialBalance(10_000_000, 2_000_000, 3_500_000, 2_000_000);
    assert.ok(r.debtRatio > 45);
    assert.equal(r.financialStatusClass, 'critical');
    const negative = calculateFinancialBalance(10_000_000, 2_000_000, 3_000_000, 6_000_000);
    assert.equal(negative.remainingAfterDebtAndExpenses, -1_000_000);
    assert.equal(negative.financialStatusClass, 'critical');
  });

  test('zero income: debt ratio 0, no division blow-up', () => {
    const r = calculateFinancialBalance(0, 500_000, 1_000_000, 300_000);
    assert.equal(r.debtRatio, 0);
    assert.equal(r.remainingAfterDebtAndExpenses, -1_800_000);
    assert.equal(r.financialStatusClass, 'critical');
  });

  test('negative inputs are clamped to zero', () => {
    const r = calculateFinancialBalance(-1_000_000, -500_000, -200_000, -100_000);
    assert.equal(r.totalMonthlyDebt, 0);
    assert.equal(r.debtRatio, 0);
  });

  test('existing + new + expenses sum as total burden', () => {
    const r = calculateFinancialBalance(12_000_000, 2_500_000, 1_500_000, 4_000_000);
    assert.equal(r.totalMonthlyExpenses, 4_000_000);
    assert.equal(r.totalMonthlyDebt, 4_000_000);
    assert.equal(r.remainingAfterDebtAndExpenses, 4_000_000);
  });
});