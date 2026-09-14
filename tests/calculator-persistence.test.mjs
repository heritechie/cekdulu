import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CALCULATOR_FIELDS,
  CALCULATOR_MONEY_FIELDS,
  CALCULATOR_STORAGE_VERSION,
  calculatorStorageKey,
  clearCalculatorState,
  isCalculatorStateExpired,
  parseCalculatorState,
  readCalculatorState,
  sanitizeCalculatorData,
  writeCalculatorState,
} from '../src/lib/calculator/persistence.ts';

/**
 * Pure logic tests for calculator input persistence.
 *
 * The browser-facing read/write/clear helpers are SSR-safe: in Node (no
 * `window`) they must be graceful no-ops, while the validation, key, and
 * expiration logic is pure and fully tested here.
 */

function validData() {
  return {
    values: {
      monthlyIncome: 10000000,
      kpr: 3000000,
      foodHousing: 500000,
      interestRate: 9.5,
      tenureMonths: 24,
    },
    stepPath: 'sim',
  };
}

function validEnvelope(data = validData(), updatedAt = new Date().toISOString()) {
  return { version: CALCULATOR_STORAGE_VERSION, updatedAt, data };
}

describe('calculatorStorageKey', () => {
  test('is scoped per calculator and versioned', () => {
    assert.equal(calculatorStorageKey('mobil'), 'cekdulu:calculator:mobil:state:v1');
    assert.equal(calculatorStorageKey('kpr'), 'cekdulu:calculator:kpr:state:v1');
    assert.notEqual(calculatorStorageKey('mobil'), calculatorStorageKey('motor'));
  });
});

describe('sanitizeCalculatorData', () => {
  test('round-trips valid numeric values', () => {
    const out = sanitizeCalculatorData(validData());
    assert.ok(out);
    assert.equal(out.values.monthlyIncome, 10000000);
    assert.equal(out.values.kpr, 3000000);
    assert.equal(out.values.foodHousing, 500000);
    assert.equal(out.values.interestRate, 9.5);
    assert.equal(out.values.tenureMonths, 24);
    assert.equal(out.stepPath, 'sim');
  });

  test('rejects non-objects and missing values', () => {
    assert.equal(sanitizeCalculatorData(null), null);
    assert.equal(sanitizeCalculatorData('x'), null);
    assert.equal(sanitizeCalculatorData(42), null);
    assert.equal(sanitizeCalculatorData({}), null);
    assert.equal(sanitizeCalculatorData({ values: 'nope' }), null);
  });

  test('coerces invalid numbers to zero and drops unknown fields', () => {
    const out = sanitizeCalculatorData({ values: { monthlyIncome: '10000000', kpr: -5, kartuKredit: NaN, ghost: 999 } });
    assert.ok(out);
    assert.equal(out.values.monthlyIncome, 10000000);
    assert.equal(out.values.kpr, 0);
    assert.equal(out.values.kartuKredit, 0);
    assert.ok(!('ghost' in out.values));
  });

  test('all field ids are numeric after sanitizing', () => {
    const out = sanitizeCalculatorData({
      values: Object.fromEntries(CALCULATOR_FIELDS.map((f) => [f, 123])),
      stepPath: 'manual',
    });
    assert.ok(out);
    for (const field of CALCULATOR_FIELDS) {
      assert.equal(out.values[field], 123, `field ${field} should be preserved`);
    }
    assert.equal(CALCULATOR_MONEY_FIELDS.length + 2, CALCULATOR_FIELDS.length);
  });

  test('returns null when nothing meaningful is stored', () => {
    assert.equal(sanitizeCalculatorData({ values: {}, stepPath: 'manual' }), null);
    assert.equal(
      sanitizeCalculatorData({ values: { monthlyIncome: 0, kpr: 0 }, stepPath: 'manual' }),
      null
    );
  });

  test('falls back to manual when stepPath is unknown', () => {
    const out = sanitizeCalculatorData({ values: { monthlyIncome: 1000 }, stepPath: 'sideways' });
    assert.ok(out);
    assert.equal(out.stepPath, 'manual');
  });
});

describe('isCalculatorStateExpired', () => {
  test('rejects data older than the expiration window', () => {
    const old = Date.now() - 31 * 86_400_000;
    assert.equal(isCalculatorStateExpired(new Date(old).toISOString(), Date.now()), true);
  });

  test('keeps recent data', () => {
    const recent = Date.now() - 1 * 86_400_000;
    assert.equal(isCalculatorStateExpired(new Date(recent).toISOString(), Date.now()), false);
  });

  test('treats unparseable timestamps as stale', () => {
    assert.equal(isCalculatorStateExpired('tidak-valid', Date.now()), true);
  });
});

describe('parseCalculatorState', () => {
  test('accepts a valid envelope of the current version', () => {
    const out = parseCalculatorState(validEnvelope(), Date.now());
    assert.ok(out);
    assert.equal(out.version, CALCULATOR_STORAGE_VERSION);
    assert.equal(out.data.values.monthlyIncome, 10000000);
  });

  test('rejects a newer schema version', () => {
    const envelope = validEnvelope();
    envelope.version = CALCULATOR_STORAGE_VERSION + 1;
    assert.equal(parseCalculatorState(envelope, Date.now()), null);
  });

  test('tolerates an older schema version', () => {
    const envelope = validEnvelope();
    envelope.version = CALCULATOR_STORAGE_VERSION - 1;
    assert.ok(parseCalculatorState(envelope, Date.now()));
  });

  test('rejects corrupt envelopes', () => {
    assert.equal(parseCalculatorState(null, Date.now()), null);
    assert.equal(parseCalculatorState('corrupt', Date.now()), null);
    assert.equal(parseCalculatorState({ version: 1, updatedAt: 'x', data: { values: {} } }, Date.now()), null);
    assert.equal(parseCalculatorState({ version: 1, data: validData() }, Date.now()), null);
  });

  test('rejects expired envelopes', () => {
    const envelope = validEnvelope();
    envelope.updatedAt = new Date(Date.now() - 40 * 86_400_000).toISOString();
    assert.equal(parseCalculatorState(envelope, Date.now()), null);
  });
});

describe('browser storage helpers (SSR-safe in Node)', () => {
  test('read returns null without a window', () => {
    assert.equal(readCalculatorState('mobil'), null);
  });

  test('write is a graceful no-op without a window', () => {
    assert.equal(writeCalculatorState('mobil', validData()), false);
  });

  test('clear never throws without a window', () => {
    assert.doesNotThrow(() => clearCalculatorState('mobil'));
  });
});