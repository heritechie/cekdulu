import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHALLENGE_VIEW_SESSION_KEY,
  challengeEntrySource,
  completeParamsFromState,
  fireChallengeComplete,
  fireChallengeDayActive,
  fireChallengeLog,
  fireChallengeMilestone,
  fireChallengeResume,
  fireChallengeShare,
  fireChallengeStart,
  fireChallengeView,
} from '../src/lib/paylater-analytics.ts';
import {
  addLog,
  createEmptyState,
  createLog,
  dayForDate,
  isChallengeComplete,
  markMilestoneCelebrated,
  nextUncelebratedMilestone,
} from '../src/lib/paylater-challenge.ts';
import { trackEvent } from '../src/lib/analytics.ts';

/**
 * Analytics instrumentation tests for the 30 Hari Tanpa PayLater challenge.
 *
 * Mirrors the exact page logic: emitter calls are the source of truth, and
 * dedup is enforced through the same persistence helpers the page uses
 * (celebratedMilestones + the completed flag). Privacy-sensitive values
 * (amounts) are numeric only.
 */

function spyEmitter() {
  const events = [];
  const emit = (name, params) => events.push({ name, params });
  return { events, emit };
}

/** Same branch the challenge page runs on load (see page init/revealMilestone). */
function revealNextMilestone(state, emit, today = '2026-09-15') {
  const day = dayForDate(state.startDate, today);
  const milestone = nextUncelebratedMilestone(state, day);
  if (milestone) {
    const next = markMilestoneCelebrated(state, milestone);
    fireChallengeMilestone(emit, milestone);
    return next;
  }
  return state;
}

/** Same completion branch the challenge page runs on load (see page init). */
function maybeComplete(state, emit, today = '2026-09-15') {
  if (!state.completed && isChallengeComplete(state, today)) {
    const completed = { ...state, completed: true };
    fireChallengeComplete(emit, completeParamsFromState(completed));
    return completed;
  }
  return state;
}

describe('paylater_challenge_start', () => {
  test('with setup skipped: emits setup_skipped=true', () => {
    const { events, emit } = spyEmitter();
    fireChallengeStart(emit, { setupSkipped: false });
    assert.deepEqual(events, [
      { name: 'paylater_challenge_start', params: { setup_skipped: false } },
    ]);
  });

  test('skipped setup: emits setup_skipped=true', () => {
    const { events, emit } = spyEmitter();
    fireChallengeStart(emit, { setupSkipped: true });
    assert.deepEqual(events, [
      { name: 'paylater_challenge_start', params: { setup_skipped: true } },
    ]);
  });
});

describe('paylater_challenge_log', () => {
  test('Option A: outcome=not_bought with amount and day', () => {
    const { events, emit } = spyEmitter();
    fireChallengeLog(emit, { outcome: 'not_bought', amount: 250_000, day: 3 });
    assert.deepEqual(events, [
      { name: 'paylater_challenge_log', params: { outcome: 'not_bought', amount: 250_000, day: 3 } },
    ]);
  });

  test('Option B: outcome=paid_other with amount and day', () => {
    const { events, emit } = spyEmitter();
    fireChallengeLog(emit, { outcome: 'paid_other', amount: 1_750_000, day: 8 });
    assert.deepEqual(events, [
      { name: 'paylater_challenge_log', params: { outcome: 'paid_other', amount: 1_750_000, day: 8 } },
    ]);
  });
});

describe('paylater_challenge_milestone', () => {
  for (const ms of [7, 14, 21, 30]) {
    test(`day ${ms}: emits { day }`, () => {
      const { events, emit } = spyEmitter();
      fireChallengeMilestone(emit, ms);
      assert.deepEqual(events, [{ name: 'paylater_challenge_milestone', params: { day: ms } }]);
    });
  }
});

describe('milestone dedup', () => {
  test('day 14 first visit reveals it once; refresh and reopen add no more', () => {
    const { events, emit } = spyEmitter();
    const fresh = createEmptyState('2026-09-02'); // today 2026-09-15 => day 14

    let stored = revealNextMilestone(fresh, emit); // -> first visit
    const afterFirst = events.length;
    assert.equal(afterFirst, 1);
    assert.deepEqual(events[0], { name: 'paylater_challenge_milestone', params: { day: 14 } });

    stored = revealNextMilestone(stored, emit); // -> refresh, reads persisted celebrated []
    assert.equal(events.length, afterFirst);

    stored = revealNextMilestone(stored, emit); // -> reopen later
    assert.equal(events.length, afterFirst);
  });

  test('day 21 fresh: it reveals day 21 (highest uncelebrated) and dedups after ack', () => {
    const { events, emit } = spyEmitter();
    const fresh = createEmptyState('2026-08-26'); // today 2026-09-15 => day 21
    const day = dayForDate(fresh.startDate, '2026-09-15');
    assert.equal(day, 21);
    assert.equal(nextUncelebratedMilestone(fresh, day), 21);

    let stored = revealNextMilestone(fresh, emit);
    const afterFirst = events.length;
    assert.equal(afterFirst, 1);
    assert.deepEqual(events[0], { name: 'paylater_challenge_milestone', params: { day: 21 } });
    assert.equal(nextUncelebratedMilestone(stored, day), null);

    stored = revealNextMilestone(stored, emit);
    assert.equal(events.length, afterFirst);
  });
});

describe('paylater_challenge_complete', () => {
  test('fires milestone day 30 then complete with gathered Option A stats', () => {
    const { events, emit } = spyEmitter();
    let state = createEmptyState('2026-08-17'); // today 2026-09-15 => day 30
    state = addLog(state, createLog('not_bought', 2_000_000, 'Belanja Online', 20));
    state = addLog(state, createLog('paid_other', 100_000, 'Kuliner', 25));

    const completed = maybeComplete(state, emit);
    assert.equal(completed.completed, true);
    assert.deepEqual(events[0], { name: 'paylater_challenge_milestone', params: { day: 30 } });
    assert.deepEqual(events[1], {
      name: 'paylater_challenge_complete',
      params: {
        days_completed: 30,
        transactions_avoided: 1, // paid_other is never counted as avoided
        amount_avoided: 2_000_000,
      },
    });
  });

  test('never refires once the completed flag is persisted', () => {
    const { events, emit } = spyEmitter();
    let state = createEmptyState('2026-08-17');
    state = maybeComplete(state, emit);
    const afterFirst = events.length;
    assert.equal(afterFirst, 2);

    state = maybeComplete(state, emit); // -> reopened with completed:true
    assert.equal(events.length, afterFirst);
  });
});

describe('paylater_challenge_resume', () => {
  test('emits the in-progress day on tap', () => {
    const { events, emit } = spyEmitter();
    fireChallengeResume(emit, 14);
    assert.deepEqual(events, [{ name: 'paylater_challenge_resume', params: { day: 14 } }]);
  });
});

describe('paylater_challenge_day_active', () => {
  test('emits day and logs_count for active challenge', () => {
    const { events, emit } = spyEmitter();
    fireChallengeDayActive(emit, { day: 14, logs_count: 5 });
    assert.deepEqual(events, [
      { name: 'paylater_challenge_day_active', params: { day: 14, logs_count: 5 } },
    ]);
  });

  test('emits day 1 with zero logs for fresh challenge', () => {
    const { events, emit } = spyEmitter();
    fireChallengeDayActive(emit, { day: 1, logs_count: 0 });
    assert.deepEqual(events, [
      { name: 'paylater_challenge_day_active', params: { day: 1, logs_count: 0 } },
    ]);
  });

  test('emits day 30 with logs for completed challenge', () => {
    const { events, emit } = spyEmitter();
    fireChallengeDayActive(emit, { day: 30, logs_count: 12 });
    assert.deepEqual(events, [
      { name: 'paylater_challenge_day_active', params: { day: 30, logs_count: 12 } },
    ]);
  });
});

describe('paylater_challenge_share', () => {
  test('web_share method with day and context', () => {
    const { events, emit } = spyEmitter();
    fireChallengeShare(emit, { day: 14, shareMethod: 'web_share', context: 'progress' });
    assert.deepEqual(events, [
      { name: 'paylater_challenge_share', params: { day: 14, share_method: 'web_share', share_context: 'progress' } },
    ]);
  });

  test('download fallback method with day and completed context', () => {
    const { events, emit } = spyEmitter();
    fireChallengeShare(emit, { day: 30, shareMethod: 'download', context: 'completed' });
    assert.deepEqual(events, [
      { name: 'paylater_challenge_share', params: { day: 30, share_method: 'download', share_context: 'completed' } },
    ]);
  });
});

describe('paylater_challenge_view', () => {
  test('source classification: homepage, challenges hub, others/direct', () => {
    const origin = 'https://cekdulu.co.id';
    assert.equal(challengeEntrySource('https://cekdulu.co.id/', origin), 'homepage');
    assert.equal(challengeEntrySource('https://cekdulu.co.id', origin), 'homepage');
    assert.equal(challengeEntrySource('https://cekdulu.co.id/challenges', origin), 'challenges');
    assert.equal(challengeEntrySource('https://cekdulu.co.id/30SPL', origin), 'direct');
    assert.equal(challengeEntrySource('', origin), 'direct');
    assert.equal(challengeEntrySource('https://play.google.com/', origin), 'direct');
    assert.equal(challengeEntrySource('https://cekdulu.co.id/kalkulator-kemampuan-cicilan', origin), 'direct');
    assert.equal(challengeEntrySource('not-a-url', origin), 'direct');
  });

  test('fires once per tab session; refresh and reopen add no more', () => {
    const { events, emit } = spyEmitter();
    const memory = new Map();
    const session = {
      getItem: (k) => (memory.has(k) ? memory.get(k) : null),
      setItem: (k, v) => memory.set(k, v),
    };

    assert.equal(fireChallengeView(emit, 'homepage', session), true);
    assert.deepEqual(events, [{ name: 'paylater_challenge_view', params: { source: 'homepage' } }]);
    assert.equal(memory.get(CHALLENGE_VIEW_SESSION_KEY), '1');

    assert.equal(fireChallengeView(emit, 'challenges', session), false);
    assert.equal(events.length, 1);
    assert.equal(memory.get(CHALLENGE_VIEW_SESSION_KEY), '1');
  });
});

describe('internal analytics exclusion (existing trackEvent)', () => {
  function withGtagWindow({ internal = false, gtag = true } = {}) {
    const calls = [];
    globalThis.window = {
      localStorage: {
        getItem: (key) => (internal && key === 'cekdulu_internal_analytics' ? '1' : null),
      },
      gtag: gtag ? (...args) => calls.push(args) : undefined,
    };
    return calls;
  }

  test('internal (test) browser never reaches gtag', () => {
    const calls = withGtagWindow({ internal: true });
    trackEvent('paylater_challenge_start', { setup_skipped: false });
    assert.equal(calls.length, 0);
  });

  test('public browser forwards the event and cleans undefined params', () => {
    const calls = withGtagWindow({ internal: false });
    trackEvent('paylater_challenge_start', { setup_skipped: false });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], ['event', 'paylater_challenge_start', { setup_skipped: false }]);
  });

  test('no-op when gtag is unavailable', () => {
    const calls = withGtagWindow({ internal: false, gtag: false });
    trackEvent('paylater_challenge_view', { source: 'homepage' });
    assert.equal(calls.length, 0);
  });
});