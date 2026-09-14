import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsappUrl,
  calculateCampaignScenario,
} from '../src/lib/campaign/campaign-scenario.ts';
import {
  calculateFinancialBalance,
  calculateMonthlyInstallment,
} from '../src/lib/calculator/engine.ts';

describe('calculateCampaignScenario', () => {
  test('menghitung skenario KPR dasar (pokok, cicilan, tenor)', () => {
    const scenario = calculateCampaignScenario({
      price: 700_000_000,
      annualInterestRate: 8.5,
      downPayment: 140_000_000,
      tenorMonths: 240,
      monthlyIncome: 15_000_000,
      existingInstallments: 1_500_000,
      monthlyExpenses: 4_000_000,
    });

    assert.equal(scenario.principal, 560_000_000);
    assert.equal(scenario.tenorYears, 20);
    assert.equal(
      scenario.monthlyInstallment,
      calculateMonthlyInstallment({
        principal: 560_000_000,
        annualInterestRate: 8.5,
        tenureMonths: 240,
        interestMethod: 'annuity',
      }),
    );

    const expectedBalance = calculateFinancialBalance(
      15_000_000,
      1_500_000,
      scenario.monthlyInstallment,
      4_000_000,
    );
    assert.equal(scenario.totalMonthlyDebt, expectedBalance.totalMonthlyDebt);
    assert.equal(scenario.debtRatio, expectedBalance.debtRatio);
    assert.equal(
      scenario.remainingAfterDebtAndExpenses,
      expectedBalance.remainingAfterDebtAndExpenses,
    );
    assert.equal(scenario.financialStatusClass, expectedBalance.financialStatusClass);
  });

  test('DP >= harga menghentikan pokok dan cicilan menjadi 0', () => {
    const scenario = calculateCampaignScenario({
      price: 700_000_000,
      annualInterestRate: 8.5,
      downPayment: 800_000_000,
      tenorMonths: 240,
      monthlyIncome: 10_000_000,
      existingInstallments: 0,
      monthlyExpenses: 3_000_000,
    });
    assert.equal(scenario.principal, 0);
    assert.equal(scenario.monthlyInstallment, 0);
    assert.equal(scenario.totalMonthlyDebt, 0);
  });

  test('input non-positif diklem tanpa error', () => {
    const scenario = calculateCampaignScenario({
      price: 700_000_000,
      annualInterestRate: 8.5,
      downPayment: 0,
      tenorMonths: 0,
      monthlyIncome: 0,
      existingInstallments: -5,
      monthlyExpenses: -2,
    });
    assert.equal(scenario.principal, 700_000_000);
    assert.equal(scenario.tenorYears, 1 / 12);
    assert.equal(scenario.debtRatio, 0);
    assert.equal(scenario.monthlyInstallment, calculateMonthlyInstallment({
      principal: 700_000_000,
      annualInterestRate: 8.5,
      tenureMonths: 1,
      interestMethod: 'annuity',
    }));
  });

  test('bunga 0% dihitung proporsional', () => {
    const scenario = calculateCampaignScenario({
      price: 120_000_000,
      annualInterestRate: 0,
      downPayment: 0,
      tenorMonths: 12,
      monthlyIncome: 10_000_000,
      existingInstallments: 0,
      monthlyExpenses: 3_000_000,
    });
    assert.equal(scenario.monthlyInstallment, 10_000_000);
  });
});

describe('buildWhatsappUrl', () => {
  test('menyertakan pesan awal + URL campaign, tanpa data finansial', () => {
    const url = buildWhatsappUrl({
      number: '6285224416325',
      baseMessage: 'Halo Master Property, saya tertarik dengan Cluster Aranda.',
      url: 'https://cekdulu.co.id/c/master-property/keandra-park-cluster-aranda',
    });

    assert.ok(url.startsWith('https://wa.me/6285224416325?text='));
    const text = decodeURIComponent(url.split('?text=')[1]);
    assert.match(text, /Halo Master Property/);
    assert.match(text, /Cluster Aranda/);
    assert.match(text, /Saya mau tanya lebih lanjut:/);
    assert.match(text, /https:\/\/cekdulu\.co\.id\/c\/master-property\/keandra-park-cluster-aranda/);
    assert.doesNotMatch(text, /penghasilan|income|DP Rp|Tenor|Estimasi cicilan|DBR|sisa|beban/i);
  });

  test('tanpa url: hanya pesan awal', () => {
    const url = buildWhatsappUrl({
      number: '6285224416325',
      baseMessage: 'Halo, info dong.',
      url: '',
    });
    const text = decodeURIComponent(url.split('?text=')[1]);
    assert.equal(text, 'Halo, info dong.');
  });

  test('tanpa pesan maupun url: link telanjang tanpa text param', () => {
    const url = buildWhatsappUrl({
      number: '6285224416325',
      baseMessage: '',
      url: '',
    });
    assert.equal(url, 'https://wa.me/6285224416325');
  });
});