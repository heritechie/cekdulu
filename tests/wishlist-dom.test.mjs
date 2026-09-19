import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WishlistScreen } from '../src/components/wishlist/WishlistScreen.tsx';
import { createWishlistNavigation, showDetail } from '../src/components/wishlist/navigation.ts';
import { goalToWishlistItem } from '../src/components/wishlist/item.ts';
import { SHARE_UNSUPPORTED_NOTE } from '../src/lib/browser-capabilities.ts';

const noop = () => {};

const mockGoal = {
  id: 'goal-abc123',
  name: 'Sepatu Impian',
  price: 1500000,
  productImage: '/wishlist/test-product.png',
  createdAt: '2026-01-15T08:00:00.000Z',
  entries: [
    { id: 'entry-1', amount: 500000, proofImage: '', createdAt: '2026-01-15T08:00:00.000Z' },
  ],
};

const baseScreenProps = {
  onSelectItem: noop,
  onBackToList: noop,
  onAddSaving: noop,
  onCreate: noop,
  onShare: noop,
  onDelete: noop,
  onNewGoal: noop,
  shareSupported: true,
};

/**
 * Step 11 — Wishlist DOM/UX surface regression.
 *
 * Previously these tests pinned the vanilla /wishlist DOM (class-based hidden
 * toggling, screen sections, the vanilla bottom sheet). With the vanilla
 * implementation removed and the React app owning the whole lifecycle, they
 * now pin the React-owned surfaces instead:
 *
 *   - empty → create form  (the old "Belum ada wishlist" disabled CTA is gone)
 *   - completed goal → completion screen with share + new-goal
 *   - Hapus/Bagikan menu is React-owned (detail + completion)
 *   - presentational screens stay persistence-free
 *   - the dev-only React preview is now the sole production implementation
 *   - navigation stays pure state ("list" | "detail")
 */

describe('wishlist empty state is the create form (no stale disabled CTA)', () => {
  test('no goal → WishlistScreen renders the create form', () => {
    const html = renderToStaticMarkup(
      createElement(WishlistScreen, {
        nav: createWishlistNavigation(),
        items: [],
        ...baseScreenProps,
      }),
    );
    assert.ok(html.includes('Punya barang impian?'), 'create headline must render');
    assert.ok(html.includes('Mulai Nabung'), 'create submit CTA must render');
    assert.ok(
      !html.includes('Belum ada wishlist'),
      'the old empty-state placeholder must not render',
    );
    assert.ok(
      !html.includes('+ Buat Wishlist'),
      'the obsolete disabled create CTA must not exist',
    );
  });

  test('the old empty-state block is fully removed from WishlistList', () => {
    const listSrc = readFileSync('src/components/wishlist/WishlistList.tsx', 'utf8');
    assert.ok(!/Belum ada wishlist/.test(listSrc), 'empty-state heading must be gone');
    assert.ok(!/disabled/.test(listSrc), 'no disabled create button may remain');
  });
});

describe('completion screen is computed from remaining amount', () => {
  test('a fully saved detail item renders the completion screen instead of detail', () => {
    const item = goalToWishlistItem({
      ...mockGoal,
      price: 500000,
    });
    assert.equal(item.remaining, 0, 'fixture must be a completed goal');
    const nav = showDetail(createWishlistNavigation(), item.id);
    const html = renderToStaticMarkup(
      createElement(WishlistScreen, {
        nav,
        items: [item],
        ...baseScreenProps,
      }),
    );
    assert.ok(html.includes('Berhasil!'), 'completion headline must render');
    assert.ok(html.includes('Bagikan Pencapaian'), 'share CTA must render');
    assert.ok(html.includes('Buat Target Baru'), 'new-goal CTA must render');
    assert.ok(!html.includes('Catatan Tabungan'), 'detail history must not render on completion');
  });

  test('an in-progress item still renders the detail dashboard', () => {
    const item = goalToWishlistItem(mockGoal);
    const nav = showDetail(createWishlistNavigation(), item.id);
    const html = renderToStaticMarkup(
      createElement(WishlistScreen, {
        nav,
        items: [item],
        ...baseScreenProps,
      }),
    );
    assert.ok(html.includes('Catatan Tabungan'), 'detail history must render');
    assert.ok(!html.includes('Buat Target Baru'), 'new-goal CTA is completion-only');
  });
});

describe('wishlist React owned surfaces (Hapus / Bagikan / reset)', () => {
  test('detail renders the app header (back + title + menu)', () => {
    const item = goalToWishlistItem(mockGoal);
    const html = renderToStaticMarkup(createElement(WishlistScreen, {
      nav: showDetail(createWishlistNavigation(), item.id),
      items: [item],
      ...baseScreenProps,
    }));
    assert.ok(html.includes('aria-label="Kembali ke daftar"'), 'back control must exist');
    assert.ok(html.includes('>Wishlist</span>'), 'app title must exist');
    assert.ok(html.includes('aria-haspopup="menu"'), 'menu trigger must exist');
  });

  test('the menu is in the DOM with Bagikan and Hapus (not conditionally stripped)', () => {
    const item = goalToWishlistItem(mockGoal);
    const html = renderToStaticMarkup(createElement(WishlistScreen, {
      nav: showDetail(createWishlistNavigation(), item.id),
      items: [item],
      ...baseScreenProps,
    }));
    assert.ok(html.includes('Bagikan'), 'share action must be present in the menu');
    assert.ok(html.includes('Hapus'), 'delete action must be present in the menu');
    assert.ok(html.includes('text-destructive'), 'delete must read as destructive');
  });

  test('completion keeps the Hapus menu and the graceful share gate', () => {
    const item = goalToWishlistItem({ ...mockGoal, price: 500000 });
    const html = renderToStaticMarkup(createElement(WishlistScreen, {
      nav: showDetail(createWishlistNavigation(), item.id),
      items: [item],
      ...baseScreenProps,
      shareSupported: false,
    }));
    assert.ok(html.includes('Hapus'), 'completion must still offer delete');
    assert.ok(html.includes(SHARE_UNSUPPORTED_NOTE), 'unsupported-share note');
    assert.ok(/Bagikan Pencapaian<\/button>/.test(html), 'share CTA must stay but be disabled');
  });
});

describe('wishlist screen persistence boundary', () => {
  const presentational = [
    'WishlistList',
    'WishlistDetail',
    'WishlistScreen',
    'WishlistCreate',
    'WishlistComplete',
    'WishlistMenu',
  ];

  for (const name of presentational) {
    test(`${name} stays free of persistence`, () => {
      const c = readFileSync(`src/components/wishlist/${name}.tsx`, 'utf8');
      assert.ok(!/localStorage/.test(c), `${name} must not read localStorage`);
      assert.ok(!/indexedDB/.test(c), `${name} must not open IndexedDB`);
      assert.ok(
        !/readGoalFromStorage|hydrateEntries|readProof|migrateLegacy|writeGoalToStorage|writeProofToDatabase|clearGoalFromStorage|deleteProofFromDatabase/.test(
          c,
        ),
        `${name} must not call persistence helpers`,
      );
    });
  }
});

describe('wishlist React navigation model wiring', () => {
  const appSrc = readFileSync('src/components/wishlist/WishlistApp.tsx', 'utf8');
  const navPath = 'src/components/wishlist/navigation.ts';

  test('navigation model file exists alongside the component', () => {
    assert.ok(existsSync(navPath), 'navigation.ts must exist under src/components/wishlist');
  });

  test('WishlistApp holds internal navigation state via useState', () => {
    assert.match(appSrc, /useState/, 'WishlistApp must use React useState');
    assert.match(appSrc, /useState<WishlistNavigation>/, 'state must hold the navigation model');
    assert.match(appSrc, /createWishlistNavigation/, 'initial nav state must be created');
  });

  test('view model covers list and detail', () => {
    const navSrc = readFileSync(navPath, 'utf8');
    assert.match(navSrc, /'list'/, "view type must include 'list'");
    assert.match(navSrc, /'detail'/, "view type must include 'detail'");
  });

  test('WishlistApp wires navigation from the local model module', () => {
    assert.match(appSrc, /from '\.\/navigation'/, 'navigation must come from the local model');
    assert.match(appSrc, /createWishlistNavigation/, 'initial nav state must be created');
    assert.match(appSrc, /showDetail/, 'showDetail must be wired');
    assert.match(appSrc, /goBackToList/, 'back navigation must be wired');
  });

  test('showList transition also lives in the local model module', () => {
    assert.match(readFileSync(navPath, 'utf8'), /showList/, 'showList must exist in navigation.ts');
  });

  test('WishlistApp owns sheet state and persists only through the data bridge', () => {
    assert.match(appSrc, /isSavingOpen/, 'sheet open state must live in the app');
    assert.match(appSrc, /setIsSavingOpen\(true\)/, 'CTA must open the sheet');
    assert.match(appSrc, /saveWishlistEntry/, 'save must go through the bridge orchestrator');
    assert.match(appSrc, /from '\.\/data'/, 'the save orchestrator must come from the bridge');
    assert.ok(
      !/(?:window\.)?(?:localStorage|indexedDB)/.test(appSrc),
      'WishlistApp must never touch raw storage APIs',
    );
    assert.match(appSrc, /loadWishlistData\(\)/, 'the UI must refresh through the bridge');
  });

  test('WishlistApp wires the whole lifecycle through the data bridge', () => {
    assert.match(appSrc, /createWishlistGoal/, 'create must go through the bridge');
    assert.match(appSrc, /deleteWishlistGoal/, 'delete/reset must go through the bridge');
    assert.ok(!/readGoalFromStorage|hydrateEntries|readProof|migrateLegacyGoalFromStorage/.test(appSrc),
      'app must not call persistence helpers directly');
  });

  test('the app is not DEV-gated (React is the production implementation)', () => {
    assert.ok(!/import\.meta\.env\.DEV/.test(appSrc), 'WishlistApp must render in production');
  });
});

describe('wishlist React List UI wiring', () => {
  const appSrc = readFileSync('src/components/wishlist/WishlistApp.tsx', 'utf8');

  test('WishlistList, WishlistScreen, WishlistDetail, Create, Complete exist', () => {
    for (const name of [
      'WishlistList',
      'WishlistScreen',
      'WishlistDetail',
      'WishlistCreate',
      'WishlistComplete',
    ]) {
      assert.ok(existsSync(`src/components/wishlist/${name}.tsx`), `${name}.tsx must exist`);
    }
  });

  test('detail placeholder component is fully removed', () => {
    assert.ok(
      !existsSync('src/components/wishlist/WishlistDetailPlaceholder.tsx'),
      'WishlistDetailPlaceholder.tsx must be deleted',
    );
  });

  test('WishlistApp loads data through the bridge, not persistence directly', () => {
    assert.match(appSrc, /from '\.\/data'/, 'WishlistApp must import the data bridge');
    assert.match(appSrc, /loadWishlistData/, 'WishlistApp must call loadWishlistData');
    assert.ok(!/localStorage/.test(appSrc), 'WishlistApp must not touch localStorage');
    assert.ok(!/indexedDB/.test(appSrc), 'WishlistApp must not touch IndexedDB');
  });

  test('WishlistApp renders items from the hydrated bridge model', () => {
    assert.match(appSrc, /data \? \[data\.item\]/, 'items must come from the hydrated model');
    assert.ok(
      !/goalToWishlistItem/.test(appSrc),
      'goal→item mapping must live in the bridge, not the app',
    );
  });

  test('WishlistScreen renders the real WishlistDetail and fails safely', () => {
    const screenSrc = readFileSync('src/components/wishlist/WishlistScreen.tsx', 'utf8');
    assert.match(screenSrc, /from '\.\/WishlistDetail'/, 'detail must come from the local component');
    assert.match(screenSrc, /from '\.\/WishlistList'/, 'list must still be rendered');
    assert.match(screenSrc, /items\.find\(/, 'selected item must be resolved from items');
    assert.match(screenSrc, /if \(!selected\)/, 'unknown ids must fail safe');
    assert.ok(
      !/WishlistDetailPlaceholder/.test(screenSrc),
      'placeholder must no longer be referenced',
    );
  });
});