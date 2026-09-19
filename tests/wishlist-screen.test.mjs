import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WishlistScreen } from '../src/components/wishlist/WishlistScreen.tsx';
import WishlistDetail from '../src/components/wishlist/WishlistDetail.tsx';
import WishlistCreate from '../src/components/wishlist/WishlistCreate.tsx';
import WishlistComplete from '../src/components/wishlist/WishlistComplete.tsx';
import { createWishlistNavigation, showDetail } from '../src/components/wishlist/navigation.ts';
import { goalToWishlistItem } from '../src/components/wishlist/item.ts';

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

const baseProps = {
  onSelectItem: noop,
  onBackToList: noop,
  onAddSaving: noop,
  onCreate: noop,
  onShare: noop,
  onDelete: noop,
  onNewGoal: noop,
  shareSupported: true,
};

describe('WishlistScreen view routing', () => {
  test('in the initial list state it renders the Wishlist List', () => {
    const item = goalToWishlistItem(mockGoal);
    const html = renderToStaticMarkup(
      createElement(WishlistScreen, {
        nav: createWishlistNavigation(),
        items: [item],
        ...baseProps,
      }),
    );
    assert.ok(html.includes('Sepatu Impian'), 'initial list state must render the list item');
    assert.ok(
      html.includes('wishlist/test-product.png'),
      'initial list state must render the product image',
    );
    assert.ok(!html.includes('Kembali ke daftar'), 'list state must not render the detail back button');
  });

  test('initial list state with no data renders the create form', () => {
    const html = renderToStaticMarkup(
      createElement(WishlistScreen, {
        nav: createWishlistNavigation(),
        items: [],
        ...baseProps,
      }),
    );
    assert.ok(html.includes('Punya barang impian?'), 'no goal must render the create form');
    assert.ok(html.includes('Mulai Nabung'), 'create CTA must render');
  });

  test('detail state renders WishlistDetail with the selected item', () => {
    const item = goalToWishlistItem(mockGoal);
    const nav = showDetail(createWishlistNavigation(), item.id);
    const html = renderToStaticMarkup(
      createElement(WishlistScreen, {
        nav,
        items: [item],
        ...baseProps,
      }),
    );
    assert.ok(html.includes('Sepatu Impian'), 'detail state must render the selected item');
    assert.ok(html.includes('Kembali ke daftar'), 'detail state must render the back button');
    assert.ok(html.includes('Catatan Tabungan'), 'detail state must render the history section');
  });

  test('detail state with a fully saved item renders the completion screen', () => {
    const item = goalToWishlistItem({ ...mockGoal, price: 750000 });
    assert.equal(item.remaining, 0, 'fixture must be completed');
    const nav = showDetail(createWishlistNavigation(), item.id);
    const html = renderToStaticMarkup(
      createElement(WishlistScreen, {
        nav,
        items: [item],
        ...baseProps,
      }),
    );
    assert.ok(html.includes('Berhasil!'), 'completed detail must render the completion screen');
    assert.ok(html.includes('Buat Target Baru'), 'completion must offer a new goal');
    assert.ok(!html.includes('Catatan Tabungan'), 'completed detail must not render history');
  });

  test('unresolvable selectedWishlistId fails safely back to the List', () => {
    const item = goalToWishlistItem(mockGoal);
    const nav = showDetail(createWishlistNavigation(), 'goal-missing');
    const html = renderToStaticMarkup(
      createElement(WishlistScreen, {
        nav,
        items: [item],
        ...baseProps,
      }),
    );
    assert.ok(html.includes('Sepatu Impian'), 'must still render content for the user');
    assert.ok(
      !html.includes('Kembali ke daftar'),
      'must not show a detail back button for an unknown id',
    );
    assert.ok(!html.includes('Catatan Tabungan'), 'must not render detail for a missing id');
  });
});

describe('WishlistScreen prop threading', () => {
  test('list state threads items and onSelectItem into WishlistList', () => {
    const item = goalToWishlistItem(mockGoal);
    const selectSpy = () => {};
    const el = WishlistScreen({
      nav: createWishlistNavigation(),
      items: [item],
      onSelectItem: selectSpy,
      onBackToList: noop,
      onAddSaving: noop,
      onCreate: noop,
      onShare: noop,
      onDelete: noop,
      onNewGoal: noop,
      shareSupported: true,
    });
    const listEl = el.props.children;
    assert.deepEqual(listEl.props.items, [item], 'items must be passed to WishlistList');
    assert.equal(listEl.props.onSelect, selectSpy, 'onSelectItem must reach WishlistList as onSelect');
  });

  test('no-goal state threads the create handler into WishlistCreate', () => {
    const createSpy = () => {};
    const el = WishlistScreen({
      nav: createWishlistNavigation(),
      items: [],
      onSelectItem: noop,
      onBackToList: noop,
      onAddSaving: noop,
      onCreate: createSpy,
      onShare: noop,
      onDelete: noop,
      onNewGoal: noop,
      shareSupported: true,
    });
    const createEl = el.props.children;
    assert.equal(createEl.type, WishlistCreate, 'no-goal state must render the create form');
    assert.equal(createEl.props.onChangeGoal, createSpy, 'onCreate must reach the form');
  });

  test('detail state resolves and threads the matching item into WishlistDetail', () => {
    const item = goalToWishlistItem(mockGoal);
    const backSpy = () => {};
    const addSpy = () => {};
    const el = WishlistScreen({
      nav: showDetail(createWishlistNavigation(), item.id),
      items: [item],
      onSelectItem: noop,
      onBackToList: backSpy,
      onAddSaving: addSpy,
      onCreate: noop,
      onShare: noop,
      onDelete: noop,
      onNewGoal: noop,
      shareSupported: true,
    });
    const detailEl = el.props.children;
    assert.equal(detailEl.type, WishlistDetail, 'detail must render WishlistDetail');
    assert.equal(detailEl.props.item, item, 'the exact selected item must be passed through');
    assert.equal(detailEl.props.onBack, backSpy, 'back must thread through to the detail');
    assert.equal(detailEl.props.onAddSaving, addSpy, 'add-saving CTA must thread through');
    assert.equal(detailEl.props.shareSupported, true, 'share gate must reach the detail');
  });

  test('completion state threads share/delete/new-goal through WishlistComplete', () => {
    const item = goalToWishlistItem({ ...mockGoal, price: 750000 });
    const shareSpy = () => {};
    const deleteSpy = () => {};
    const newGoalSpy = () => {};
    const el = WishlistScreen({
      nav: showDetail(createWishlistNavigation(), item.id),
      items: [item],
      onSelectItem: noop,
      onBackToList: noop,
      onAddSaving: noop,
      onCreate: noop,
      onShare: shareSpy,
      onDelete: deleteSpy,
      onNewGoal: newGoalSpy,
      shareSupported: false,
    });
    const completeEl = el.props.children;
    assert.equal(completeEl.type, WishlistComplete, 'completed detail must render the completion');
    assert.equal(completeEl.props.onShare, shareSpy, 'share must thread through');
    assert.equal(completeEl.props.onDelete, deleteSpy, 'menu delete must thread through');
    assert.equal(completeEl.props.onNewGoal, newGoalSpy, 'new-goal must thread through');
    assert.equal(completeEl.props.shareSupported, false, 'the share gate must thread through');
  });

  test('detail state threads the saving sheet open/close/save props', () => {
    const item = goalToWishlistItem(mockGoal);
    const closeSpy = () => {};
    const saveSpy = () => {};
    const el = WishlistScreen({
      nav: showDetail(createWishlistNavigation(), item.id),
      items: [item],
      onSelectItem: noop,
      onBackToList: noop,
      onAddSaving: noop,
      onCreate: noop,
      onShare: noop,
      onDelete: noop,
      onNewGoal: noop,
      shareSupported: true,
      isSavingOpen: true,
      onCloseSaving: closeSpy,
      onSaveSaving: saveSpy,
    });
    const detailEl = el.props.children;
    assert.equal(detailEl.props.isSavingOpen, true, 'open state must reach the detail');
    assert.equal(detailEl.props.onCloseSaving, closeSpy, 'close handler must reach the detail');
    assert.equal(detailEl.props.onSaveSaving, saveSpy, 'save handler must reach the detail');
  });
});