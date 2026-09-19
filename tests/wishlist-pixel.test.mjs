import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pixelSizeFor } from '../src/lib/wishlist-pixel.ts';

/**
 * Pixel/mosaic reveal tests for the shared canvas engine (Step 4).
 *
 * The exact algorithm (PIXEL_MAP progression) used to live inside the vanilla
 * /wishlist page script; it moved to src/lib/wishlist-pixel.ts so the React
 * Wishlist Detail view reuses the same reveal. These tests guard the moved
 * progression logic byte-for-byte.
 */

describe('pixelSizeFor progression', () => {
  test('0% is heavily pixelated', () => {
    assert.equal(pixelSizeFor(0), 32);
  });

  test('matches the base table points', () => {
    assert.equal(pixelSizeFor(0.1), 28);
    assert.equal(pixelSizeFor(0.25), 22);
    assert.equal(pixelSizeFor(0.5), 14);
    assert.equal(pixelSizeFor(0.75), 7);
    assert.equal(pixelSizeFor(0.9), 3);
  });

  test('100% reveals the original image (pixel size 1)', () => {
    assert.equal(pixelSizeFor(1), 1);
  });

  test('interpolates between table points', () => {
    assert.equal(pixelSizeFor(0.05), 30);
    assert.equal(pixelSizeFor(0.375), 18);
  });

  test('clamps out-of-range progress', () => {
    assert.equal(pixelSizeFor(-1), 32);
    assert.equal(pixelSizeFor(2), 1);
  });
});

describe('shared pixel module wiring', () => {
  const lib = readFileSync('src/lib/wishlist-pixel.ts', 'utf8');
  const astro = readFileSync('src/pages/wishlist.astro', 'utf8');

  test('module exports the reveal surface used by both implementations', () => {
    assert.match(lib, /export function pixelSizeFor/, 'pixelSizeFor must be exported');
    assert.match(lib, /export function drawPixelatedImage/, 'drawPixelatedImage must be exported');
    assert.match(lib, /export function renderPixelReveal/, 'renderPixelReveal must be exported');
    assert.match(lib, /export const PIXEL_MAP/, 'PIXEL_MAP must be exported');
  });

  test('the page no longer ships its own reveal wiring (React owns it now)', () => {
    assert.ok(!/wishlist-pixel/.test(astro), 'page must not import the pixel module anymore');
    assert.ok(!/const PIXEL_MAP/.test(astro), 'page must not define its own PIXEL_MAP');
    assert.ok(
      !/function pixelSizeFor|function drawPixelatedImage/.test(astro),
      'page must not re-implement the reveal',
    );
  });

  test('React detail component imports the same shared module', () => {
    const detail = readFileSync('src/components/wishlist/WishlistDetail.tsx', 'utf8');
    assert.match(detail, /from '\.\.\/\.\.\/lib\/wishlist-pixel'/, 'detail must reuse the shared reveal');
    assert.match(detail, /renderPixelReveal\(/, 'detail must call renderPixelReveal');
  });
});