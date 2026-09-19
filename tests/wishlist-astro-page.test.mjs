import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Step 11 migration — the /wishlist page is now a thin Astro shell around the
 * React Wishlist app (the sole production implementation). These tests keep
 * the shell honest:
 *
 *   - the island is mounted UNCONDITIONALLY (prod + dev), so production ships
 *     the React implementation — the vanilla implementation is fully removed;
 *   - no vanilla screens, ids, before-paint flash script, or data-fs machinery
 *     may exist anywhere in the page.
 */
const src = readFileSync('src/pages/wishlist.astro', 'utf8');

describe('wishlist.astro React production shell', () => {
  test('imports and mounts the React Wishlist app as the whole page', () => {
    assert.match(
      src,
      /import WishlistApp from '..\/components\/wishlist\/WishlistApp'/,
      'page must import WishlistApp',
    );
    assert.match(src, /<WishlistApp client:load \/>/, 'the island must be mounted client:load');
    assert.ok(!src.includes('astro-island') || src.includes('client:load'), 'explicit island marker');
  });

  test('the island is NOT dev-gated (React is the production implementation)', () => {
    assert.ok(
      !/import\.meta\.env\.DEV/.test(src),
      'no dev-gating of the island or any page logic may remain',
    );
    assert.ok(
      !src.includes('dev-only'),
      'no dev-only style/rule blocks may remain in the page',
    );
  });

  test('no vanilla screens or ids remain (all vanilla markup removed)', () => {
    for (const marker of [
      'data-screen',
      'screen-landing',
      'screen-active',
      'screen-complete',
      'savingSheet',
      'dashPixel',
      'completePixelCanvas',
      'goalImageInput',
      'startGoalBtn',
      'newGoalBtn',
      'addSavingBtn',
      'appMenuBtn',
      'appShareBtn',
      'appDeleteBtn',
      'shareBtn',
      'saveEntryBtn',
      'history-list',
      'entry-error',
    ]) {
      assert.ok(!src.includes(marker), `vanilla marker must be gone: ${marker}`);
    }
  });

  test('no before-paint flash-prevention script or data-fs machinery remains', () => {
    assert.ok(
      !/<script is:inline slot="head">/.test(src),
      'the inline flash-prevention script must be gone',
    );
    for (const marker of ['data-fs', 'cekdulu_wishlist_goal', 'cekdulu_nabungku_goal']) {
      assert.ok(!src.includes(marker), `no-flash/storage marker must be gone: ${marker}`);
    }
  });

  test('no vanilla module script remains (screen switching / persistence removed)', () => {
    assert.ok(
      !/showScreen/.test(src),
      'vanilla showScreen must not survive anywhere in the page',
    );
    assert.ok(
      !src.includes('<script>'),
      'the vanilla module script must be fully removed',
    );
    assert.ok(
      !src.includes('from \'@/lib/wishlist\''),
      'the page must no longer do its own persistence wiring',
    );
  });

  test('the page keeps its SEO contract (title, description, canonical, OG)', () => {
    assert.match(src, /title="Wishlist/, 'page title must remain for search');
    assert.match(src, /description=/, 'meta description must remain');
    assert.match(src, /canonical=\{canonical\}/, 'canonical must remain');
    assert.match(src, /ogTitle=/, 'Open Graph title must remain');
    assert.match(src, /ogDescription=/, 'Open Graph description must remain');
    assert.match(src, /hideGlobalHeader/, 'the shell keeps its focused layout');
    assert.match(src, /hideGlobalFooter/, 'the shell keeps its focused layout');
  });
});