import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveContext } from '../src/lib/calculator/contexts.ts';

/**
 * Tests for the shared wizard context configuration.
 *
 * Contexts keep product-specific labels (price field, tenure presets, DP
 * visibility) outside the CalculatorWizard component so a new financing product
 * can be added without touching the wizard UI.
 */

describe('INSTALLMENT_CONTEXTS — supported slugs', () => {
  test('all six current contexts resolve to themselves with complete config', () => {
    for (const slug of ['rumah', 'mobil', 'motor', 'kendaraan', 'elektronik', 'lainnya']) {
      const ctx = resolveContext(slug);
      assert.equal(ctx.slug, slug);
      assert.ok(ctx.label.length > 0, `${slug} needs a label`);
      assert.ok(ctx.noun.length > 0, `${slug} needs a noun`);
      assert.ok(ctx.nounCapitalized.length > 0, `${slug} needs nounCapitalized`);
      assert.ok(ctx.burdenNoun.length > 0, `${slug} needs burdenNoun`);
      assert.ok(ctx.priceLabel.length > 0, `${slug} needs a priceLabel`);
      assert.equal(typeof ctx.showDp, 'boolean');
      assert.ok(Array.isArray(ctx.tenureOptions), `${slug} tenureOptions must be an array`);
      assert.ok(ctx.interestPlaceholder.length > 0, `${slug} needs interestPlaceholder`);
    }
  });

  test('rumah offers the 20-tahun (240 bulan) KPR tenor', () => {
    assert.ok(resolveContext('rumah').tenureOptions.some((o) => o.months === 240));
  });

  test('kendaraan offers the 5-tahun (60 bulan) tenor', () => {
    assert.ok(resolveContext('kendaraan').tenureOptions.some((o) => o.months === 60));
  });

  test('mobil offers the 1-tahun (12) s.d. 5-tahun (60) auto tenors', () => {
    const months = resolveContext('mobil').tenureOptions.map((o) => o.months);
    assert.deepEqual(months, [12, 24, 36, 48, 60]);
  });

  test('mobil labels the price field "Harga mobil" and shows DP', () => {
    const ctx = resolveContext('mobil');
    assert.equal(ctx.priceLabel, 'Harga mobil');
    assert.equal(ctx.showDp, true);
  });

  test('motor offers the 1-tahun (12) s.d. 5-tahun (60) auto tenors', () => {
    const months = resolveContext('motor').tenureOptions.map((o) => o.months);
    assert.deepEqual(months, [12, 24, 36, 48, 60]);
  });

  test('motor labels the price field "Harga motor" and shows DP', () => {
    const ctx = resolveContext('motor');
    assert.equal(ctx.priceLabel, 'Harga motor');
    assert.equal(ctx.showDp, true);
  });

  test('elektronik offers short tenors down to 3 bulan', () => {
    assert.ok(resolveContext('elektronik').tenureOptions.some((o) => o.months === 3));
  });

  test('lainnya has no preset tenors (wizard falls back to free numeric input)', () => {
    assert.deepEqual(resolveContext('lainnya').tenureOptions, []);
  });
});

describe('resolveContext — fallback safety', () => {
  test('unknown slug falls back to lainnya', () => {
    assert.equal(resolveContext('pinjaman-pribadi').slug, 'lainnya');
    assert.equal(resolveContext('sepeda').slug, 'lainnya');
    assert.equal(resolveContext('kamera').slug, 'lainnya');
  });

  test('empty / missing slug falls back to lainnya', () => {
    assert.equal(resolveContext(undefined).slug, 'lainnya');
    assert.equal(resolveContext(null).slug, 'lainnya');
    assert.equal(resolveContext('').slug, 'lainnya');
  });
});