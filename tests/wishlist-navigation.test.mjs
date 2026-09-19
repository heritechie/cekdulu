import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWishlistNavigation,
  showList,
  showDetail,
  goBackToList,
} from '../src/components/wishlist/navigation.ts';
import { goalToWishlistItem } from '../src/components/wishlist/item.ts';

/**
 * Navigation model tests for the Wishlist mini app (Step 2).
 *
 * The future Wishlist UI navigates with two pieces of internal React state:
 * `view` ("list" | "detail") and `selectedWishlistId` (string | null). These
 * pure transitions are the state machine the app will move through — no router,
 * no URLs, no global store.
 */

describe('wishlist navigation model', () => {
  test('initial state is the list view with no selection', () => {
    assert.deepEqual(createWishlistNavigation(), {
      view: 'list',
      selectedWishlistId: null,
    });
  });

  test('showDetail(id) switches to detail and selects the wishlist', () => {
    const nav = showDetail(createWishlistNavigation(), 'wl-abc');
    assert.equal(nav.view, 'detail');
    assert.equal(nav.selectedWishlistId, 'wl-abc');
  });

  test('showDetail(id) preserves the given id verbatim', () => {
    const nav = showDetail(createWishlistNavigation(), 'goal-m1abc2-def345');
    assert.equal(nav.selectedWishlistId, 'goal-m1abc2-def345');
  });

  test('showList() returns to list and clears the selection', () => {
    const nav = showList(showDetail(createWishlistNavigation(), 'wl-1'));
    assert.deepEqual(nav, { view: 'list', selectedWishlistId: null });
  });

  test('goBackToList() returns to list and clears the selection', () => {
    const nav = goBackToList(showDetail(createWishlistNavigation(), 'wl-1'));
    assert.deepEqual(nav, { view: 'list', selectedWishlistId: null });
  });

  test('goBackToList() from list stays list with no selection', () => {
    assert.deepEqual(goBackToList(createWishlistNavigation()), {
      view: 'list',
      selectedWishlistId: null,
    });
  });

  test('transitions are pure — the source state object is never mutated', () => {
    const source = createWishlistNavigation();
    showDetail(source, 'wl-1');
    showList(source);
    assert.deepEqual(source, { view: 'list', selectedWishlistId: null });
  });

  test('selecting a real list item routes to detail with that item id', () => {
    const goal = {
      id: 'goal-r1a2b3',
      name: 'Kamera',
      price: 5000000,
      productImage: '/img.png',
      createdAt: '2026-01-15T08:00:00.000Z',
      entries: [],
    };
    const item = goalToWishlistItem(goal);
    const nav = showDetail(createWishlistNavigation(), item.id);
    assert.equal(nav.view, 'detail');
    assert.equal(nav.selectedWishlistId, 'goal-r1a2b3');
  });

  test('going back from a real selected item clears the id and returns to list', () => {
    const goal = {
      id: 'goal-r1a2b3',
      name: 'Kamera',
      price: 5000000,
      productImage: '/img.png',
      createdAt: '2026-01-15T08:00:00.000Z',
      entries: [],
    };
    const item = goalToWishlistItem(goal);
    const nav = goBackToList(showDetail(createWishlistNavigation(), item.id));
    assert.deepEqual(nav, { view: 'list', selectedWishlistId: null });
  });
});