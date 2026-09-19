import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { goalToWishlistItem, estimateSummary } from '../src/components/wishlist/item.ts';
import WishlistList, { WishlistListItem } from '../src/components/wishlist/WishlistList.tsx';

const noop = () => {};
const now = '2026-01-15T08:00:00.000Z';

const mockGoal = {
  id: 'goal-abc123',
  name: 'Sepatu Impian',
  price: 1500000,
  productImage: '/wishlist/test-product.png',
  createdAt: now,
  entries: [
    { id: 'entry-1', amount: 500000, proofImage: '', createdAt: now },
    { id: 'entry-2', amount: 250000, proofImage: '', createdAt: now },
  ],
};

describe('goalToWishlistItem adapter', () => {
  test('maps an existing goal into a flat list item', () => {
    const item = goalToWishlistItem(mockGoal);
    assert.equal(item.id, 'goal-abc123');
    assert.equal(item.name, 'Sepatu Impian');
    assert.equal(item.productImage, '/wishlist/test-product.png');
    assert.equal(item.targetPrice, 1500000);
    assert.equal(item.saved, 750000);
    assert.equal(item.progress, 0.5);
    assert.equal(item.percent, 50);
  });

  test('saved amount is capped at the target price (never negative)', () => {
    const overSaved = {
      ...mockGoal,
      entries: [
        { id: 'entry-1', amount: 900000, proofImage: '', createdAt: now },
        { id: 'entry-2', amount: 800000, proofImage: '', createdAt: now },
      ],
    };
    const item = goalToWishlistItem(overSaved);
    assert.equal(item.saved, 1500000);
    assert.equal(item.percent, 100);
  });

  test('falls back to the default label when the goal has no name', () => {
    const item = goalToWishlistItem({ ...mockGoal, name: undefined });
    assert.equal(item.name, 'Barang impian');
  });

  test('exposes remaining amount and the raw history for the detail view', () => {
    const item = goalToWishlistItem(mockGoal);
    assert.equal(item.remaining, 750000, 'remaining must be target minus saved');
    assert.equal(item.history.length, 2, 'history must expose every entry');
    assert.equal(item.history[0].id, 'entry-1');
    assert.equal(item.history[0].amount, 500000);
    assert.equal(item.history[0].note, undefined, 'blank-note entries stay neutral');
    assert.equal(item.estimateLabel, null, 'mock goal is insufficient for an estimate');
  });

  test('history entries are exposed newest-first with trimmed notes', () => {
    const goal = {
      ...mockGoal,
      entries: [
        {
          id: 'entry-old',
          amount: 100000,
          proofImage: '',
          note: '   ',
          createdAt: '2026-01-01T08:00:00.000Z',
        },
        {
          id: 'entry-new',
          amount: 200000,
          proofImage: '',
          note: 'Gajian',
          createdAt: '2026-01-14T08:00:00.000Z',
        },
      ],
    };
    const item = goalToWishlistItem(goal);
    assert.deepEqual(
      item.history.map((h) => h.id),
      ['entry-new', 'entry-old'],
      'history must be sorted newest-first like the vanilla view',
    );
    assert.equal(item.history[0].note, 'Gajian');
    assert.equal(item.history[1].note, undefined, 'whitespace-only notes must be dropped');
  });

  test('goal with enough saving rhythm produces an estimate label', () => {
    const goal = {
      id: 'goal-est',
      name: 'Kamera',
      price: 2000000,
      productImage: '/img.png',
      createdAt: '2026-01-01T08:00:00.000Z',
      entries: [
        { id: 'e1', amount: 100000, proofImage: '', createdAt: '2026-01-01T08:00:00.000Z' },
        { id: 'e2', amount: 100000, proofImage: '', createdAt: '2026-01-11T08:00:00.000Z' },
        { id: 'e3', amount: 100000, proofImage: '', createdAt: '2026-01-21T08:00:00.000Z' },
        { id: 'e4', amount: 100000, proofImage: '', createdAt: '2026-01-31T08:00:00.000Z' },
      ],
    };
    const item = goalToWishlistItem(goal);
    assert.ok(item.estimateLabel, 'consistent rate-based goal must yield an estimate');
    assert.match(item.estimateLabel, /^Perkiraan /, 'estimate must be phrased "Perkiraan …"');
  });

  test('target-reached goal has no estimate label', () => {
    const goal = {
      ...mockGoal,
      price: 750000,
    };
    const item = goalToWishlistItem(goal);
    assert.equal(item.remaining, 0);
    assert.equal(item.estimateLabel, null, 'reached targets keep the estimate hidden');
  });
});

describe('estimateSummary', () => {
  test('phrases a consistent rate-based projection', () => {
    assert.equal(
      estimateSummary({ kind: 'consistent', rate: 10000, rateBased: true, days: 90, weeks: 12, months: 3 }),
      'Perkiraan ± 3 bulan lagi',
    );
  });

  test('suppresses every non-rate-based or zero-days state', () => {
    const insufficient = { kind: 'insufficient', rate: 0, rateBased: false, days: 0, weeks: 0, months: 0 };
    const inconsistent = { kind: 'inconsistent', rate: 5000, rateBased: true, days: 0, weeks: 0, months: 0 };
    const noRate = { kind: 'consistent', rate: 0, rateBased: false, days: 0, weeks: 0, months: 0 };
    const zeroDays = { kind: 'consistent', rate: 10000, rateBased: true, days: 0, weeks: 0, months: 1 };
    for (const est of [insufficient, inconsistent, noRate, zeroDays]) {
      assert.equal(estimateSummary(est), null, 'summary must stay hidden for ' + est.kind);
    }
  });

  test('hides a null estimate', () => {
    assert.equal(estimateSummary(null), null);
  });
});

describe('WishlistList rendering', () => {
  test('renders an existing wishlist item with name, target price, savings, and progress', () => {
    const item = goalToWishlistItem(mockGoal);
    const html = renderToStaticMarkup(
      createElement(WishlistList, { items: [item], onSelect: noop }),
    );
    assert.ok(html.includes('Sepatu Impian'), 'product name must render');
    assert.ok(html.includes('1.500.000'), 'target price must render');
    assert.ok(html.includes('750.000'), 'saved amount must render');
    assert.ok(html.includes('50%'), 'progress percent must render');
  });

  test('renders the product image', () => {
    const item = goalToWishlistItem(mockGoal);
    const html = renderToStaticMarkup(
      createElement(WishlistList, { items: [item], onSelect: noop }),
    );
    assert.ok(
      html.includes('src="/wishlist/test-product.png"'),
      'product image must render prominently',
    );
  });

  test('progress bar exposes percent via aria and fill width', () => {
    const item = goalToWishlistItem(mockGoal);
    const html = renderToStaticMarkup(
      createElement(WishlistList, { items: [item], onSelect: noop }),
    );
    assert.ok(html.includes('role="progressbar"'), 'progress bar must be a progressbar role');
    assert.ok(html.includes('aria-valuenow="50"'), 'aria-valuenow must match percent');
    assert.ok(html.includes('aria-valuemax="100"'), 'aria-valuemax must be 100');
    assert.ok(html.includes('style="width:50%"'), 'fill width must match percent');
  });
});

describe('WishlistListItem selection wiring', () => {
  test('tapping the item forwards the actual item id to onSelect', () => {
    const item = goalToWishlistItem({ ...mockGoal, id: 'goal-real-id' });
    const calls = [];
    const li = WishlistListItem({ item, onSelect: (id) => calls.push(id) });
    const button = li.props.children;
    button.props.onClick();
    assert.deepEqual(calls, ['goal-real-id'], 'onSelect must receive the real item id');
  });

  test('item button carries a data attribute with the actual id', () => {
    const item = goalToWishlistItem({ ...mockGoal, id: 'goal-marker-1' });
    const li = WishlistListItem({ item, onSelect: noop });
    const button = li.props.children;
    assert.equal(button.props['data-wishlist-item-id'], 'goal-marker-1');
  });

  test('selecting the rendered item produces detail state for that id', () => {
    const item = goalToWishlistItem(mockGoal);
    const calls = [];
    const li = WishlistListItem({ item, onSelect: (id) => calls.push(id) });
    const button = li.props.children;
    button.props.onClick();
    assert.deepEqual(calls, ['goal-abc123']);
  });
});