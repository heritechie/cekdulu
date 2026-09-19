import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  availableTarget,
  createWishlistId,
  estimateLabel,
  estimateSaving,
  formatDayDate,
  goalProgress,
  goalSavedDisplay,
  milestoneMessage,
  milestonePercent,
  pickLabel,
  relativeDayLabel,
  remainingAmount,
  totalSaved,
  validateImageFile,
  WISHLIST_IMAGE_MAX_MB,
} from '../src/lib/wishlist.ts';

/**
 * Pure logic tests for /wishlist (Wishlist).
 *
 * The page handles IndexedDB + canvas; these tests cover the SSR-safe rules:
 * progress clamping, remaining amount, milestones, the automatic estimate and
 * the image validation rules.
 */

const isoDaysAgo = (daysAgo, now = Date.parse('2026-09-15T10:00:00Z')) =>
  new Date(now - daysAgo * 86_400_000).toISOString();

function entry(amount, daysAgo) {
  return { id: 'e', amount, proofImage: 'data:,', createdAt: isoDaysAgo(daysAgo) };
}

function goal(price, entries, name) {
  return {
    id: 'g',
    name,
    price,
    productImage: 'data:,',
    createdAt: isoDaysAgo(30),
    entries,
  };
}

// ---- progress ----

describe('goalProgress / saving totals', () => {
  test('returns 0 when there are no entries', () => {
    const g = goal(1000, []);
    assert.equal(totalSaved(g), 0);
    assert.equal(goalProgress(g), 0);
    assert.equal(goalSavedDisplay(g), 0);
  });

  test('progress is totalSaved / price', () => {
    const g = goal(1000, [entry(250, 1), entry(250, 2)]);
    assert.equal(totalSaved(g), 500);
    assert.equal(goalProgress(g), 0.5);
  });

  test('negative amounts are clamped to zero for the total', () => {
    const g = goal(1000, [entry(-500, 1), entry(300, 2)]);
    assert.equal(totalSaved(g), 300);
  });

  test('progress never exceeds 1 and saved display never exceeds price', () => {
    const g = goal(1000, [entry(900, 1), entry(900, 2)]);
    assert.equal(totalSaved(g), 1800);
    assert.equal(goalProgress(g), 1);
    assert.equal(goalSavedDisplay(g), 1000);
  });

  test('price of 0 never divides (no NaN progress)', () => {
    const g = goal(0, [entry(100, 1)]);
    assert.equal(goalProgress(g), 0);
    assert.equal(goalProgress({ ...g, entries: [] }), 0);
  });

  test('invalid goal shape falls back to 0', () => {
    assert.equal(goalProgress({ entries: [] }), 0);
  });
});

describe('remainingAmount', () => {
  test('stays at 0 when savings exceed the target', () => {
    const g = goal(500, [entry(500, 1), entry(100, 2)]);
    assert.equal(remainingAmount(g), 0);
  });
  test('is price minus total savings otherwise', () => {
    const g = goal(1000, [entry(400, 1)]);
    assert.equal(remainingAmount(g), 600);
  });
});

describe('availableTarget', () => {
  test('clamps negative price to 0', () => {
    assert.equal(availableTarget(goal(-500, [])), 0);
  });
});

// ---- milestones ----

describe('milestones', () => {
  test('milestonePercent snaps to 25% steps', () => {
    assert.equal(milestonePercent(0), 0);
    assert.equal(milestonePercent(0.1), 0);
    assert.equal(milestonePercent(0.24), 0);
    assert.equal(milestonePercent(0.25), 25);
    assert.equal(milestonePercent(0.5), 50);
    assert.equal(milestonePercent(0.74), 50);
    assert.equal(milestonePercent(0.75), 75);
    assert.equal(milestonePercent(0.99), 75);
    assert.equal(milestonePercent(1), 100);
  });

  test('milestoneMessage escalates with progress (silent before first milestone)', () => {
    assert.equal(milestoneMessage(0.1), '');
    assert.match(milestoneMessage(0.3), /Mulai terlihat/);
    assert.match(milestoneMessage(0.6), /Setengah jalan/);
    assert.match(milestoneMessage(0.9), /Hampir sampai/);
    assert.match(milestoneMessage(1), /tercapai/);
  });
});

// ---- automatic estimate ----

describe('estimateSaving', () => {
  test('empty goal → insufficient (no fake precision)', () => {
    const g = goal(1000, []);
    const e = estimateSaving(g);
    assert.equal(e.kind, 'insufficient');
    assert.equal(e.days, 0);
    assert.equal(e.rate, 0);
  });

  test('fewer than 3 entries → insufficient', () => {
    const g = goal(1000, [entry(100, 1), entry(100, 2)]);
    assert.equal(estimateSaving(g).kind, 'insufficient');
  });

  test('single entry → insufficient', () => {
    const g = goal(1000, [entry(100, 1)]);
    assert.equal(estimateSaving(g).kind, 'insufficient');
  });

  test('consistent daily rate → rate-based projection', () => {
    const now = 1000;
    const g = goal(2000, [
      { id: 'a', amount: 100, proofImage: 'data:,', createdAt: new Date(now).toISOString() },
      { id: 'b', amount: 100, proofImage: 'data:,', createdAt: new Date(now + 2 * 86_400_000).toISOString() },
      { id: 'c', amount: 100, proofImage: 'data:,', createdAt: new Date(now + 4 * 86_400_000).toISOString() },
    ]);
    const e = estimateSaving(g);
    assert.equal(e.kind, 'consistent');
    assert.equal(e.rate, 75); // 300 total / 4 days = 75/day
    assert.equal(e.days, 23); // remaining 1700 / 75
    assert.ok(e.rateBased);
  });

  test('user example: 3 entries over 6 days → "Perkiraan 26 hari lagi"', () => {
    // Total tabungan 225k over a 6-day span → Rp37.500/hari.
    // Sisa target Rp950.000 / 37.500 ≈ 25.33 → 26 hari.
    const base = Date.parse('2026-09-01T08:00:00Z');
    const g = goal(1_175_000, [
      { id: 'a', amount: 50_000, proofImage: 'data:,', createdAt: new Date(base).toISOString() },
      { id: 'b', amount: 100_000, proofImage: 'data:,', createdAt: new Date(base + 3 * 86_400_000).toISOString() },
      { id: 'c', amount: 75_000, proofImage: 'data:,', createdAt: new Date(base + 6 * 86_400_000).toISOString() },
    ]);
    assert.equal(remainingAmount(g), 950_000);
    const e = estimateSaving(g);
    assert.equal(e.kind, 'consistent');
    assert.equal(e.rate, 37_500);
    assert.equal(e.days, 26);
    assert.equal(estimateLabel(e), '26 hari lagi');
  });

  test('already complete goal → consistent with 0 days', () => {
    const g = goal(300, [entry(100, 1), entry(100, 2), entry(100, 3)]);
    const e = estimateSaving(g);
    assert.equal(e.kind, 'consistent');
    assert.equal(e.days, 0);
  });

  test('wildly irregular entries → inconsistent, never blamed', () => {
    // A big one-off spike (5000) next to bare 100s pushes relative deviation high.
    const g = goal(50_000, [entry(5000, 10), entry(100, 9), entry(100, 8), entry(100, 7)]);
    assert.equal(estimateSaving(g).kind, 'inconsistent');
  });

  test('all entries on the same day → single-entry fallback projection', () => {
    const same = '2026-09-15T08:00:00Z';
    const g = goal(900, [
      { id: 'a', amount: 200, proofImage: 'data:,', createdAt: same },
      { id: 'b', amount: 200, proofImage: 'data:,', createdAt: same },
      { id: 'c', amount: 200, proofImage: 'data:,', createdAt: same },
    ]);
    const e = estimateSaving(g);
    assert.equal(e.kind, 'consistent');
    assert.equal(e.rate, 200);
    assert.equal(e.days, 2); // remaining 300 / 200
  });

  test('zero-rate history → insufficient', () => {
    const g = goal(1000, [entry(0, 3), entry(0, 2), entry(0, 1)]);
    assert.equal(estimateSaving(g).kind, 'insufficient');
  });
});

describe('estimateLabel', () => {
  test('rounds consistent days into friendly Indonesian labels', () => {
    assert.equal(estimateLabel({ kind: 'consistent', rate: 10, rateBased: true, days: 0, weeks: 0, months: 0 }), 'Hampir tercapai');
    assert.equal(estimateLabel({ kind: 'consistent', rate: 10, rateBased: true, days: 3, weeks: 0, months: 0 }), 'Beberapa hari lagi');
    assert.equal(estimateLabel({ kind: 'consistent', rate: 10, rateBased: true, days: 9, weeks: 1, months: 0 }), '9 hari lagi');
    assert.equal(estimateLabel({ kind: 'consistent', rate: 10, rateBased: true, days: 26, weeks: 3, months: 0 }), '26 hari lagi');
    assert.equal(estimateLabel({ kind: 'consistent', rate: 10, rateBased: true, days: 60, weeks: 8, months: 2 }), '60 hari lagi');
    assert.equal(estimateLabel({ kind: 'consistent', rate: 10, rateBased: true, days: 200, weeks: 28, months: 6 }), '± 7 bulan lagi');
  });

  test('empty for non-consistent estimates', () => {
    assert.equal(estimateLabel({ kind: 'insufficient', rate: 0, rateBased: false, days: 0, weeks: 0, months: 0 }), '');
    assert.equal(estimateLabel({ kind: 'inconsistent', rate: 0, rateBased: true, days: 0, weeks: 0, months: 0 }), '');
  });
});

// ---- dates ----

describe('date labels', () => {
  test('formatDayDate renders Indonesian day-month-year', () => {
    assert.equal(formatDayDate('2026-09-15T08:00:00Z'), '15 Sep 2026');
    assert.equal(formatDayDate('not-a-date'), '');
  });

  test('relativeDayLabel uses local calendar days', () => {
    const today = Date.parse('2026-09-15T10:00:00Z');
    assert.equal(relativeDayLabel(new Date(today).toISOString(), today), 'Hari ini');
    assert.equal(relativeDayLabel(new Date(today - 86_400_000).toISOString(), today), 'Kemarin');
    assert.equal(relativeDayLabel(new Date(today - 5 * 86_400_000).toISOString(), today), '5 hari lalu');
  });
});

// ---- misc helpers ----

describe('pickLabel / createWishlistId', () => {
  test('pickLabel falls back when blank', () => {
    assert.equal(pickLabel(''), 'Barang impian');
    assert.equal(pickLabel('  '), 'Barang impian');
    assert.equal(pickLabel('Sepatu'), 'Sepatu');
  });

  test('ids are prefixed and unique-ish', () => {
    const a = createWishlistId('goal-', 1000);
    const b = createWishlistId('goal-', 1000);
    assert.ok(a.startsWith('goal-'));
    assert.ok(b.startsWith('goal-'));
    assert.notEqual(a, b);
  });
});

// ---- image validation ----

describe('validateImageFile', () => {
  test('accepts jpeg / png / webp under the size cap', () => {
    assert.deepEqual(validateImageFile({ type: 'image/jpeg', size: 100 }), { ok: true });
    assert.deepEqual(validateImageFile({ type: 'image/png', size: 100 }), { ok: true });
    assert.deepEqual(validateImageFile({ type: 'image/webp', size: 100 }), { ok: true });
  });

  test('rejects unsupported formats', () => {
    const r = validateImageFile({ type: 'image/gif', size: 100 });
    assert.equal(r.ok, false);
  });

  test('rejects oversized files', () => {
    const r = validateImageFile({ type: 'image/jpeg', size: (WISHLIST_IMAGE_MAX_MB + 1) * 1024 * 1024 });
    assert.equal(r.ok, false);
  });
});