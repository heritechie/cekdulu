import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addLog,
  allLogsNewestFirst,
  avoidedExpenseCount,
  createEmptyState,
  createLog,
  latestLogs,
  logOutcomeLabel,
  paylaterAvoidedCount,
  relativeLogDateLabel,
  rocketStageForDay,
  totalAvoidedExpense,
  totalPaylaterAvoided,
} from '../src/lib/paylater-challenge.ts';
import {
  buildChallengeShareText,
  CHALLENGE_SHARE_URL,
} from '../src/lib/paylater-share.ts';

/**
 * Pure logic tests for the 30 Hari Tanpa PayLater challenge.
 *
 * Option A (not_bought)  -> counts as "pengeluaran yang berhasil dihindari".
 * Option B (paid_other)  -> counts only as "PayLater berhasil dihindari",
 *                           never as savings / avoided expense.
 */

function buildState(...kinds) {
  let state = createEmptyState('2026-09-01');
  kinds.forEach((kind) => {
    const amount = kind === 'not_bought' ? 2_000_000 : 100_000;
    state = addLog(state, createLog(kind, amount, 'Belanja Online', 1));
  });
  return state;
}

describe('challenge aggregation', () => {
  test('Option A only: counts as avoided expense, not as PayLater-avoided', () => {
    const state = buildState('not_bought');

    assert.equal(avoidedExpenseCount(state), 1);
    assert.equal(totalAvoidedExpense(state), 2_000_000);
    assert.equal(paylaterAvoidedCount(state), 0);
    assert.equal(totalPaylaterAvoided(state), 0);
  });

  test('Option B only: NOT savings, main stats stay 0, PayLater info is tracked', () => {
    const state = buildState('paid_other');

    assert.equal(avoidedExpenseCount(state), 0);
    assert.equal(totalAvoidedExpense(state), 0);
    assert.equal(paylaterAvoidedCount(state), 1);
    assert.equal(totalPaylaterAvoided(state), 100_000);
  });

  test('Option A + Option B: values stay fully separated', () => {
    const state = buildState('not_bought', 'paid_other');

    assert.equal(avoidedExpenseCount(state), 1);
    assert.equal(totalAvoidedExpense(state), 2_000_000);
    assert.equal(paylaterAvoidedCount(state), 1);
    assert.equal(totalPaylaterAvoided(state), 100_000);
  });

  test('no transactions: everything is zero', () => {
    const state = createEmptyState('2026-09-01');

    assert.equal(avoidedExpenseCount(state), 0);
    assert.equal(totalAvoidedExpense(state), 0);
    assert.equal(paylaterAvoidedCount(state), 0);
    assert.equal(totalPaylaterAvoided(state), 0);
  });

  test('multiple Option A logs sum correctly without touching Option B', () => {
    let state = createEmptyState('2026-09-01');
    state = addLog(state, createLog('not_bought', 250_000, 'Makanan', 2));
    state = addLog(state, createLog('paid_other', 150_000, 'Transportasi', 3));
    state = addLog(state, createLog('not_bought', 750_000, 'Belanja Online', 4));

    assert.equal(avoidedExpenseCount(state), 2);
    assert.equal(totalAvoidedExpense(state), 1_000_000);
    assert.equal(paylaterAvoidedCount(state), 1);
    assert.equal(totalPaylaterAvoided(state), 150_000);
  });
});

describe('history display helpers', () => {
  function makeLog(kind, amount, createdAt, category = 'Belanja Online') {
    return { id: `id-${createdAt}-${kind}-${amount}`, kind, amount, day: 1, category, createdAt };
  }

  test('no transactions → empty state (nothing to show)', () => {
    const state = createEmptyState('2026-09-01');
    assert.deepEqual(latestLogs(state, 3), []);
    assert.deepEqual(allLogsNewestFirst(state), []);
  });

  test('one Option A transaction → shown, labeled "Tidak jadi membeli"', () => {
    let state = createEmptyState('2026-09-01');
    state = addLog(state, makeLog('not_bought', 100_000, '2026-09-05T08:00:00.000Z'));
    const items = latestLogs(state, 3);
    assert.equal(items.length, 1);
    assert.equal(items[0].amount, 100_000);
    assert.equal(logOutcomeLabel(items[0].kind), 'Tidak jadi membeli');
  });

  test('one Option B transaction → shown, labeled "Tetap membeli • tanpa PayLater", never savings', () => {
    let state = createEmptyState('2026-09-01');
    state = addLog(state, makeLog('paid_other', 250_000, '2026-09-05T09:00:00.000Z'));
    const items = latestLogs(state, 3);
    assert.equal(items.length, 1);
    assert.equal(items[0].amount, 250_000);
    assert.equal(logOutcomeLabel(items[0].kind), 'Tetap membeli • tanpa PayLater');
  });

  test('Option A + Option B → both listed with distinct labels', () => {
    let state = createEmptyState('2026-09-01');
    state = addLog(state, makeLog('not_bought', 100_000, '2026-09-05T08:00:00.000Z'));
    state = addLog(state, makeLog('paid_other', 250_000, '2026-09-06T09:00:00.000Z'));
    const items = latestLogs(state, 3);
    assert.equal(items.length, 2);
    assert.deepEqual(
      items.map((l) => logOutcomeLabel(l.kind)),
      ['Tetap membeli • tanpa PayLater', 'Tidak jadi membeli']
    );
  });

  test('more than 3 transactions → only the 3 latest are shown (newest first)', () => {
    let state = createEmptyState('2026-09-01');
    state = addLog(state, makeLog('not_bought', 10_000, '2026-09-01T08:00:00.000Z', 'Awal'));
    state = addLog(state, makeLog('paid_other', 20_000, '2026-09-02T08:00:00.000Z', 'Kedua'));
    state = addLog(state, makeLog('not_bought', 30_000, '2026-09-03T08:00:00.000Z', 'Ketiga'));
    state = addLog(state, makeLog('paid_other', 40_000, '2026-09-04T08:00:00.000Z', 'Terbaru'));
    assert.equal(state.logs.length, 4);

    const items = latestLogs(state, 3);
    assert.equal(items.length, 3);
    assert.deepEqual(
      items.map((l) => l.category),
      ['Terbaru', 'Ketiga', 'Kedua']
    );
  });

  test('expanded history → ALL records displayed, newest first', () => {
    let state = createEmptyState('2026-09-01');
    state = addLog(state, makeLog('not_bought', 10_000, '2026-09-01T08:00:00.000Z', 'Awal'));
    state = addLog(state, makeLog('paid_other', 20_000, '2026-09-02T08:00:00.000Z', 'Kedua'));
    state = addLog(state, makeLog('not_bought', 30_000, '2026-09-03T08:00:00.000Z', 'Ketiga'));
    state = addLog(state, makeLog('paid_other', 40_000, '2026-09-04T08:00:00.000Z', 'Terbaru'));

    const items = allLogsNewestFirst(state);
    assert.equal(items.length, 4);
    assert.deepEqual(
      items.map((l) => l.category),
      ['Terbaru', 'Ketiga', 'Kedua', 'Awal']
    );
  });

  test('Option A terminology is consistent', () => {
    assert.equal(logOutcomeLabel('not_bought'), 'Tidak jadi membeli');
    assert.notEqual(logOutcomeLabel('not_bought'), 'Penghematan');
  });

  test('Option B terminology is consistent and never "hemat"/"penghematan"', () => {
    const label = logOutcomeLabel('paid_other');
    assert.equal(label, 'Tetap membeli • tanpa PayLater');
    assert.ok(!/hemat|penghematan|dihemat/i.test(label));
  });

  test('relative date labels: Hari ini, Kemarin, X hari lalu', () => {
    assert.equal(relativeLogDateLabel('2026-09-05T04:00:00.000Z', '2026-09-05'), 'Hari ini');
    assert.equal(relativeLogDateLabel('2026-09-04T04:00:00.000Z', '2026-09-05'), 'Kemarin');
    assert.equal(relativeLogDateLabel('2026-09-01T08:00:00.000Z', '2026-09-05'), '4 hari lalu');
  });
});

describe('challenge share text', () => {
  function stateWithLogs(kinds) {
    let state = createEmptyState('2026-09-01');
    kinds.forEach((kind) => {
      const amount = kind === 'not_bought' ? 450_000 : 100_000;
      state = addLog(state, createLog(kind, amount, 'Belanja Online', 1));
    });
    return state;
  }

  test('landing: invite only, no fake stats, canonical URL present', () => {
    const text = buildChallengeShareText('landing');
    assert.match(text, /Aku ikut Challenge 30 Hari Tanpa PayLater/);
    assert.match(text, /Mau ikut juga\?/);
    assert.match(text, /challenge/);
    assert.ok(text.includes(CHALLENGE_SHARE_URL));
    assert.ok(!/transaksi berhasil dihindari/.test(text), 'no stats on landing');
    assert.ok(!/Rp/.test(text), 'no money in landing copy');
  });

  test('progress day 7: day in headline, only Option A stats, invite', () => {
    const state = stateWithLogs(['not_bought', 'not_bought', 'not_bought', 'paid_other']);
    const text = buildChallengeShareText('progress', { state, day: 7 });

    assert.match(text, /🔥 7 Hari Tanpa PayLater/);
    assert.match(text, /3 transaksi berhasil dihindari/);
    assert.match(text, /Rp1\.350\.000 pengeluaran berhasil dihindari/);
    assert.match(text, /Aku sedang ikut challenge ini\./);
    assert.match(text, /Kamu mau ikut\?/);
    assert.ok(text.includes(CHALLENGE_SHARE_URL));
    assert.ok(!/Rp100\.000/.test(text), 'Option B must not appear as savings');
    assert.ok(!/transaksi PayLater/.test(text), 'Option B is not in share copy');
  });

  test('progress day 1: headline uses day 1, invite present', () => {
    const state = stateWithLogs([]);
    const text = buildChallengeShareText('progress', { state, day: 1 });
    assert.match(text, /🔥 1 Hari Tanpa PayLater/);
    assert.match(text, /0 transaksi berhasil dihindari/);
    assert.ok(text.includes(CHALLENGE_SHARE_URL));
  });

  test('milestone 14: milestone headline + stats + join CTA', () => {
    const state = stateWithLogs(['not_bought']);
    const text = buildChallengeShareText('milestone', { state, milestone: 14 });

    assert.match(text, /🎉 14 Hari Tanpa PayLater!/);
    assert.match(text, /1 transaksi berhasil dihindari/);
    assert.match(text, /Rp450\.000 pengeluaran berhasil dihindari/);
    assert.match(text, /Ikut challenge-nya juga →/);
    assert.ok(text.includes(CHALLENGE_SHARE_URL));
  });

  test('completed: completion headline, only Option A stats, CTA to join', () => {
    const state = stateWithLogs(['not_bought', 'not_bought', 'paid_other']);
    const text = buildChallengeShareText('completed', { state });

    assert.match(text, /🏆 Aku berhasil menyelesaikan 30 Hari Tanpa PayLater\./);
    assert.match(text, /2 transaksi berhasil dihindari/);
    assert.match(text, /Rp900\.000 pengeluaran berhasil dihindari/);
    assert.match(text, /Coba ikut challenge-nya juga →/);
    assert.ok(text.includes(CHALLENGE_SHARE_URL));
    assert.ok(!/Rp100\.000/.test(text), 'Option B must not appear as savings');
  });

  test('Option B-only state: share never claims savings', () => {
    const state = stateWithLogs(['paid_other']);
    for (const ctx of ['progress', 'milestone', 'completed']) {
      const text = buildChallengeShareText(ctx, { state, day: 7, milestone: 7 });
      assert.match(text, /0 transaksi berhasil dihindari/);
      assert.match(text, /Rp0 pengeluaran berhasil dihindari/);
      assert.ok(!/100\.000/.test(text), `${ctx}: Option B money must not leak`);
    }
  });

  test('day 30 completion is not mistaken for milestone 21', () => {
    const state = stateWithLogs(['not_bought']);
    const text = buildChallengeShareText('completed', { state, day: 30, milestone: 21 });
    assert.match(text, /menyelesaikan 30 Hari Tanpa PayLater/);
    assert.ok(!/🎉 21 Hari/.test(text), 'completed copy must not use milestone frame');
  });
});

describe('rocketStageForDay', () => {
  test('day 1 → stage 1', () => assert.equal(rocketStageForDay(1), 1));
  test('day 6 → stage 1', () => assert.equal(rocketStageForDay(6), 1));
  test('day 7 → stage 7', () => assert.equal(rocketStageForDay(7), 7));
  test('day 13 → stage 7', () => assert.equal(rocketStageForDay(13), 7));
  test('day 14 → stage 14', () => assert.equal(rocketStageForDay(14), 14));
  test('day 20 → stage 14', () => assert.equal(rocketStageForDay(20), 14));
  test('day 21 → stage 21', () => assert.equal(rocketStageForDay(21), 21));
  test('day 29 → stage 21', () => assert.equal(rocketStageForDay(29), 21));
  test('day 30 → stage 30', () => assert.equal(rocketStageForDay(30), 30));
  test('day 0 (edge) → stage 1', () => assert.equal(rocketStageForDay(0), 1));
  test('NaN → stage 1', () => assert.equal(rocketStageForDay(NaN), 1));
  test('day 100 (beyond range) → stage 30', () => assert.equal(rocketStageForDay(100), 30));
});