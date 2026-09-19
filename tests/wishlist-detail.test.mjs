import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import WishlistDetail from '../src/components/wishlist/WishlistDetail.tsx';
import { WishlistAppHeader } from '../src/components/wishlist/WishlistMenu.tsx';
import { goalToWishlistItem } from '../src/components/wishlist/item.ts';

const noop = () => {};

function makeItem(overrides = {}) {
  return {
    id: 'goal-abc123',
    name: 'Sepatu Impian',
    productImage: '/wishlist/test-product.png',
    targetPrice: 2000000,
    saved: 1000000,
    remaining: 1000000,
    progress: 0.5,
    percent: 50,
    history: [
      { id: 'entry-1', amount: 500000, note: 'Gajian', dateLabel: 'Kemarin', proofImage: '' },
      { id: 'entry-2', amount: 250000, note: undefined, dateLabel: '5 hari lalu', proofImage: '' },
    ],
    estimateLabel: 'Perkiraan 4 bulan lagi',
    ...overrides,
  };
}

const renderComponent = (item = makeItem(), props = {}) =>
  renderToStaticMarkup(
    createElement(WishlistDetail, { item, onBack: noop, onAddSaving: noop, ...props }),
  );

function findButtons(el) {
  const found = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.props) {
      if (node.props.onClick) {
        found.push(node);
      }
      const c = node.props.children;
      if (Array.isArray(c)) c.forEach(walk);
      else if (c && typeof c === 'object') walk(c);
    }
  };
  walk(el);
  return found;
}

describe('WishlistDetail rendering', () => {
  test('renders the product name and percentage', () => {
    const html = renderComponent();
    assert.ok(html.includes('Sepatu Impian'), 'product name must render');
    assert.ok(html.includes('50%'), 'progress percent must render');
  });

  test('renders the target price', () => {
    const html = renderComponent();
    assert.ok(html.includes('2.000.000'), 'target price must render');
  });

  test('renders the saved amount', () => {
    const html = renderComponent();
    assert.ok(html.includes('1.000.000'), 'saved amount must render');
  });

  test('renders the remaining amount separately', () => {
    const html = renderComponent(
      makeItem({ saved: 1000000, remaining: 750000 }),
    );
    assert.ok(html.includes('750.000'), 'remaining amount must render');
    assert.ok(html.includes('lagi terkumpul'), 'remaining amount must be phrased as left to save');
  });

  test('progress bar exposes percent via aria and fill width', () => {
    const html = renderComponent(makeItem({ percent: 50 }));
    assert.ok(html.includes('role="progressbar"'), 'progress bar must be a progressbar role');
    assert.ok(html.includes('aria-valuenow="50"'), 'aria-valuenow must match percent');
    assert.ok(html.includes('style="width:50%"'), 'fill width must match percent');
  });

  test('renders a pixel-reveal canvas, not a plain product image', () => {
    const html = renderComponent();
    assert.ok(html.includes('<canvas'), 'detail must render the reveal canvas');
    assert.ok(!/<img[^>]*test-product\.png/.test(html), 'product must not be a plain <img>');
  });

  test('renders the estimate only when an estimate label is available', () => {
    assert.ok(
      renderComponent().includes('Perkiraan 4 bulan lagi'),
      'estimate label must render when present',
    );
    const html = renderComponent(makeItem({ estimateLabel: null }));
    assert.ok(!html.includes('Perkiraan'), 'estimate must be hidden when unavailable');
  });

  test('is wired to the shared pixel-reveal module', () => {
    const src = readFileSync('src/components/wishlist/WishlistDetail.tsx', 'utf8');
    assert.match(src, /renderPixelReveal/, 'detail must use the shared reveal');
  });
});

describe('WishlistDetail interactions', () => {
  test('back button calls onBack', () => {
    const calls = [];
    const el = WishlistAppHeader({
      onBack: () => calls.push('back'),
      onShare: noop,
      onDelete: noop,
    });
    const backButton = findButtons(el).find(
      (b) => b.props['aria-label'] === 'Kembali ke daftar',
    );
    assert.ok(backButton, 'back button must exist with a clear label');
    backButton.props.onClick();
    assert.deepEqual(calls, ['back'], 'onBack must be triggered');
  });

  test('detail renders the back button through the shared header', () => {
    const html = renderComponent();
    assert.ok(html.includes('aria-label="Kembali ke daftar"'), 'detail must render the back button');
    assert.ok(/<button[^>]*aria-label="Kembali ke daftar"[^>]*>/g.test(html), 'back button must be a button');
  });

  test('+ Catat Tabungan button calls onAddSaving', () => {
    const calls = [];
    const el = WishlistDetail({
      item: makeItem(),
      onBack: noop,
      onAddSaving: () => calls.push('add'),
    });
    const cta = findButtons(el).find(
      (b) => typeof b.props.children === 'string' && b.props.children.includes('Catat Tabungan'),
    );
    assert.ok(cta, '+ Catat Tabungan button must exist');
    cta.props.onClick();
    assert.deepEqual(calls, ['add'], 'onAddSaving must be triggered');
  });
});

describe('WishlistDetail history presentation', () => {
  test('renders amount, note fallback, and date label for each entry', () => {
    const html = renderComponent();
    assert.ok(html.includes('Catatan Tabungan'), 'history heading must render');
    assert.ok(html.includes('Gajian'), 'entry note must render');
    assert.ok(html.includes('Catatan tabungan'), 'blank note must fall back to a neutral label');
    assert.ok(html.includes('Kemarin'), 'entry date label must render');
    assert.ok(html.includes('<li'), 'history must render as a list');
  });

  test('renders the empty state when there is no history', () => {
    const html = renderComponent(makeItem({ history: [] }));
    assert.ok(
      html.includes('Belum ada catatan. Catat tabungan pertamamu!'),
      'empty history state must encourage a first entry',
    );
    assert.ok(!html.includes('<li'), 'empty history must not render list items');
  });

  test('renders a proof thumbnail only when proofImage data is available', () => {
    const html = renderComponent(
      makeItem({
        history: [
          {
            id: 'entry-proof',
            amount: 500000,
            note: 'Kulakan',
            dateLabel: 'Kemarin',
            proofImage: 'data:image/jpeg;base64,abc123',
          },
          {
            id: 'entry-no-proof',
            amount: 250000,
            note: undefined,
            dateLabel: '5 hari lalu',
            proofImage: '',
          },
        ],
      }),
    );
    const imgCount = (html.match(/<img /g) ?? []).length;
    assert.equal(imgCount, 1, 'exactly one proof thumbnail must render');
    assert.ok(
      html.includes('data:image/jpeg;base64,abc123'),
      'the available proof image must be shown',
    );
  });

  test('integration: a goal mapped through the adapter drives the detail UI', () => {
    const goal = {
      id: 'goal-integration',
      name: 'Kamera',
      price: 2000000,
      productImage: '/wishlist/camera.png',
      createdAt: '2026-01-01T08:00:00.000Z',
      entries: [
        { id: 'entry-1', amount: 100000, proofImage: 'data:image/jpeg;base64,proof1', createdAt: '2026-01-01T08:00:00.000Z' },
        { id: 'entry-2', amount: 100000, proofImage: '', createdAt: '2026-01-11T08:00:00.000Z' },
        { id: 'entry-3', amount: 100000, proofImage: '', createdAt: '2026-01-21T08:00:00.000Z' },
        { id: 'entry-4', amount: 100000, proofImage: '', createdAt: '2026-01-31T08:00:00.000Z' },
      ],
    };
    const item = goalToWishlistItem(goal);
    const html = renderComponent(item);
    assert.ok(item.estimateLabel, 'integration goal must produce an estimate');
    assert.match(item.estimateLabel, /^Perkiraan /, 'estimate must be phrased as an estimate');
    assert.ok(html.includes(item.estimateLabel), 'computed estimate must render');
    assert.ok(html.includes('data:image/jpeg;base64,proof1'), 'existing proof must render');
    assert.ok(!html.includes('Belum cukup data'), 'no insufficient-data copy must appear');
  });
});