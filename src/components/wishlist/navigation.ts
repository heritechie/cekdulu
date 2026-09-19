/**
 * CekDulu — Wishlist navigation model.
 *
 * Internal navigation for the future Wishlist mini app: plain React state kept
 * inside WishlistApp (no router, no URL routes, no global store, no Context).
 * The pure transitions below mirror React setState updaters so the model is
 * testable in Node without a DOM and directly usable with useState.
 */

export type WishlistView = 'list' | 'detail';

export interface WishlistNavigation {
  view: WishlistView;
  selectedWishlistId: string | null;
}

export function createWishlistNavigation(): WishlistNavigation {
  return { view: 'list', selectedWishlistId: null };
}

export function showList(_nav: WishlistNavigation): WishlistNavigation {
  return { view: 'list', selectedWishlistId: null };
}

export function showDetail(
  nav: WishlistNavigation,
  wishlistId: string
): WishlistNavigation {
  return { view: 'detail', selectedWishlistId: wishlistId };
}

export function goBackToList(_nav: WishlistNavigation): WishlistNavigation {
  return { view: 'list', selectedWishlistId: null };
}