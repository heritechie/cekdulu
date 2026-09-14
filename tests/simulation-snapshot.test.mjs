import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIMULATION_SNAPSHOT_MAX,
  buildSimulationSnapshot,
  readSimulationSnapshots,
  removeSimulationSnapshot,
  sanitizeSimulationList,
  sanitizeSimulationSnapshot,
  saveSimulationSnapshot,
  simulationsStorageKey,
} from '../src/lib/campaign/simulation-snapshot.ts';

/**
 * Pure logic tests for campaign simulation snapshots.
 *
 * The browser-facing read/save/remove helpers are SSR-safe: in Node (no
 * `window`) they must be graceful no-ops, while the key, build, and
 * sanitization logic is pure and fully tested here.
 */

function validInput(overrides = {}) {
  return {
    campaign: {
      marketerSlug: 'master-property',
      marketerName: 'Master Property',
      campaignSlug: 'keandra-park-cluster-aranda',
      campaignName: 'Cluster Aranda',
      developerName: 'Keandra Park',
      template: 'kpr',
    },
    params: {
      price: 700_000_000,
      priceLabel: 'Rp 700.000.000',
      annualInterestRate: 8.5,
    },
    inputs: {
      downPayment: 140_000_000,
      tenorMonths: 240,
      monthlyIncome: 15_000_000,
      existingInstallments: 1_500_000,
      monthlyExpenses: 4_000_000,
      simulationInterestRate: 7.5,
    },
    result: {
      monthlyInstallment: 5_123_456,
      totalMonthlyDebt: 6_623_456,
      debtRatio: 44.2,
      remainingAfterDebtAndExpenses: 4_376_544,
    },
    ...overrides,
  };
}

describe('simulationsStorageKey', () => {
  test('is scoped per marketer + campaign and versioned', () => {
    assert.equal(
      simulationsStorageKey('master-property', 'keandra-park-cluster-aranda'),
      'cekdulu:campaign:simulations:master-property:keandra-park-cluster-aranda:v1',
    );
    assert.notEqual(
      simulationsStorageKey('master-property', 'a'),
      simulationsStorageKey('master-property', 'b'),
    );
    assert.notEqual(
      simulationsStorageKey('masher-a', 'c'),
      simulationsStorageKey('masher-b', 'c'),
    );
  });
});

describe('buildSimulationSnapshot', () => {
  test('produces a complete snapshot with id and timestamp', () => {
    const snapshot = buildSimulationSnapshot(validInput());
    assert.ok(snapshot.id.length >= 8);
    assert.ok(Number.isFinite(new Date(snapshot.savedAt).getTime()));
    assert.equal(snapshot.campaign.campaignSlug, 'keandra-park-cluster-aranda');
    assert.equal(snapshot.params.price, 700_000_000);
    assert.equal(snapshot.params.annualInterestRate, 8.5);
    assert.equal(snapshot.inputs.simulationInterestRate, 7.5);
    assert.equal(snapshot.inputs.tenorMonths, 240);
    assert.equal(snapshot.result.monthlyInstallment, 5_123_456);
    assert.equal(snapshot.campaign.developerName, 'Keandra Park');
  });

  test('produces unique ids across calls', () => {
    const a = buildSimulationSnapshot(validInput());
    const b = buildSimulationSnapshot(validInput());
    assert.notEqual(a.id, b.id);
  });
});

describe('sanitizeSimulationSnapshot', () => {
  test('round-trips a valid snapshot', () => {
    const snapshot = sanitizeSimulationSnapshot(validInput());
    assert.ok(snapshot);
    assert.equal(snapshot.params.price, 700_000_000);
    assert.equal(snapshot.inputs.monthlyIncome, 15_000_000);
    assert.equal(snapshot.result.debtRatio, 44.2);
  });

  test('rejects non-objects and missing campaign slugs', () => {
    assert.equal(sanitizeSimulationSnapshot(null), null);
    assert.equal(sanitizeSimulationSnapshot('x'), null);
    assert.equal(sanitizeSimulationSnapshot(42), null);
    assert.equal(sanitizeSimulationSnapshot({}), null);
    assert.equal(
      sanitizeSimulationSnapshot({ campaign: { marketerSlug: 'm' } }),
      null,
    );
    assert.equal(
      sanitizeSimulationSnapshot({ campaign: { marketerSlug: 'm', campaignSlug: '' } }),
      null,
    );
  });

  test('coerces invalid numbers and fills missing labels', () => {
    const snapshot = sanitizeSimulationSnapshot({
      id: 'abc',
      savedAt: '2026-01-01T00:00:00.000Z',
      campaign: { marketerSlug: 'm', campaignSlug: 'c', template: 'kpr' },
      params: { price: -5, priceLabel: '', annualInterestRate: 'nan' },
      inputs: { downPayment: 0, tenorMonths: 0, monthlyIncome: 1000, existingInstallments: 3, monthlyExpenses: 2, simulationInterestRate: 'oops' },
      result: { monthlyInstallment: 1, totalMonthlyDebt: NaN, debtRatio: 80, remainingAfterDebtAndExpenses: -9 },
    });
    assert.ok(snapshot);
    assert.equal(snapshot.params.price, 0);
    assert.equal(snapshot.params.priceLabel, '');
    assert.equal(snapshot.params.annualInterestRate, 0);
    assert.equal(snapshot.inputs.tenorMonths, 240); // fallback tenor
    assert.equal(snapshot.inputs.simulationInterestRate, 0); // invalid coerced
    assert.equal(snapshot.result.totalMonthlyDebt, 0);
    assert.equal(snapshot.result.remainingAfterDebtAndExpenses, 0); // clamped to 0
    assert.equal(snapshot.campaign.marketerName, 'm');
    assert.equal(snapshot.campaign.campaignName, 'c');
  });
});

describe('sanitizeSimulationList', () => {
  test('drops invalid entries and caps to SIMULATION_SNAPSHOT_MAX', () => {
    const valid = buildSimulationSnapshot(validInput());
    const raw = [valid, null, 'x', validInput({ campaign: { marketerSlug: 'x' } })];
    const sources = [
      valid,
      ...Array.from({ length: SIMULATION_SNAPSHOT_MAX + 2 }, (_, i) =>
        buildSimulationSnapshot(validInput({ savedAt: `2026-01-0${i + 1}T00:00:00.000Z` })),
      ),
    ];
    const list = sanitizeSimulationList(sources);
    assert.ok(list.length <= SIMULATION_SNAPSHOT_MAX);
    assert.equal(sanitizeSimulationList(raw).length, 1);
  });

  test('returns [] for non-array input', () => {
    assert.deepEqual(sanitizeSimulationList(null), []);
    assert.deepEqual(sanitizeSimulationList({}), []);
  });
});

describe('browser storage helpers (SSR-safe in Node)', () => {
  test('read returns [] without a window', () => {
    assert.deepEqual(
      readSimulationSnapshots('master-property', 'keandra-park-cluster-aranda'),
      [],
    );
  });

  test('save is a graceful no-op without a window', () => {
    const snapshot = buildSimulationSnapshot(validInput());
    assert.equal(
      saveSimulationSnapshot('master-property', 'keandra-park-cluster-aranda', snapshot),
      false,
    );
  });

  test('save rejects an invalid snapshot without throwing', () => {
    const snapshot = buildSimulationSnapshot(validInput());
    const invalid = { ...snapshot, id: '' };
    assert.equal(
      saveSimulationSnapshot('master-property', 'keandra-park-cluster-aranda', invalid),
      false,
    );
  });

  test('remove never throws without a window', () => {
    assert.doesNotThrow(() =>
      removeSimulationSnapshot('master-property', 'keandra-park-cluster-aranda', 'abc'),
    );
  });
});