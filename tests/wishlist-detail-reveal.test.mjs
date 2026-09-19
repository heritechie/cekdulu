import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Step 9 regression — pixel reveal must draw at its laid-out size.
 *
 * The real-browser smoke test caught a genuine defect: the React detail canvas
 * was kept `hidden` (display:none) while the reveal drew, so `clientWidth` was 0
 * and every fresh detail view ended up with a 1x1 backing store — seen as a
 * single stretched color at mid/100% progress. The fix keeps the canvas always
 * laid out and renders the ⚖️ placeholder as an overlay on top of it.
 */
const detail = readFileSync('src/components/wishlist/WishlistDetail.tsx', 'utf8');
const pixel = readFileSync('src/lib/wishlist-pixel.ts', 'utf8');

describe('pixel reveal layout fix', () => {
  test('the canvas is always laid out (never display:none at draw time)', () => {
    assert.match(
      detail,
      /className="absolute inset-0 h-full w-full"/,
      'canvas class must keep the canvas in normal layout so clientWidth is real',
    );
    assert.ok(
      !/showCanvas\s*\?/.test(detail),
      'canvas visibility must not depend on reveal state via className swap',
    );
  });

  test('placeholder is an overlay, not a layout sibling', () => {
    assert.match(
      detail,
      /absolute inset-0 flex items-center justify-center text-6xl/,
      '⚖️ placeholder overlays the canvas (keeps the centered look)',
    );
  });

  test('reveal still renders via the shared pixel engine', () => {
    assert.match(pixel, /export function drawPixelatedImage/, 'shared engine untouched');
    assert.match(
      pixel,
      /canvas\.width = Math\.max\(1, Math\.round\(canvas\.clientWidth\)\)/,
      'drawPixelatedImage still sizes from clientWidth',
    );
  });
});