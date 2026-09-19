import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  canShareImageFiles,
  canSaveImageDownload,
  SHARE_UNSUPPORTED_NOTE,
} from '../src/lib/browser-capabilities.ts';

/**
 * Unit tests for the shared browser capability detection helpers.
 *
 * globalThis browser globals are patched with mocks in each test and restored
 * after, so the SSR/Node path (globals absent) is covered too.
 */

const originalNavigator = globalThis.navigator;
const originalURL = globalThis.URL;
const originalHTMLAnchorElement = globalThis.HTMLAnchorElement;

function restoreGlobals() {
  if (originalNavigator === undefined) delete globalThis.navigator;
  else globalThis.navigator = originalNavigator;
  if (originalURL === undefined) delete globalThis.URL;
  else globalThis.URL = originalURL;
  if (originalHTMLAnchorElement === undefined) delete globalThis.HTMLAnchorElement;
  else globalThis.HTMLAnchorElement = originalHTMLAnchorElement;
}

afterEach(() => {
  restoreGlobals();
});

describe('canShareImageFiles', () => {
  test('returns false when navigator is undefined (SSR / Node)', () => {
    delete globalThis.navigator;
    assert.equal(canShareImageFiles(), false);
  });

  test('returns false when navigator.share is not a function', () => {
    globalThis.navigator = { canShare() { return true; } };
    assert.equal(canShareImageFiles(), false);
  });

  test('returns false when navigator.canShare is not a function', () => {
    globalThis.navigator = { share() {} };
    assert.equal(canShareImageFiles(), false);
  });

  test('returns false when canShare reports file sharing as unsupported', () => {
    globalThis.navigator = { share() {}, canShare() { return false; } };
    assert.equal(canShareImageFiles(), false);
  });

  test('returns true when share and canShare(file) both succeed', () => {
    globalThis.navigator = {
      share() {},
      canShare({ files }) {
        return Array.isArray(files) && files.length === 1 && files[0] instanceof File;
      },
    };
    assert.equal(canShareImageFiles(), true);
  });

  test('returns false when canShare throws', () => {
    globalThis.navigator = {
      share() {},
      canShare() { throw new Error('not supported'); },
    };
    assert.equal(canShareImageFiles(), false);
  });
});

describe('canSaveImageDownload', () => {
  test('returns false when URL is undefined (SSR / Node)', () => {
    delete globalThis.URL;
    assert.equal(canSaveImageDownload(), false);
  });

  test('returns false when URL.createObjectURL is not a function', () => {
    globalThis.URL = function URL() {};
    assert.equal(canSaveImageDownload(), false);
  });

  test('returns false when HTMLAnchorElement is undefined', () => {
    globalThis.URL = function URL() {};
    globalThis.URL.createObjectURL = function () {};
    delete globalThis.HTMLAnchorElement;
    assert.equal(canSaveImageDownload(), false);
  });

  test('returns false when the anchor download attribute is unsupported', () => {
    globalThis.URL = function URL() {};
    globalThis.URL.createObjectURL = function () {};
    globalThis.HTMLAnchorElement = { prototype: {} };
    assert.equal(canSaveImageDownload(), false);
  });

  test('returns true when object URL and anchor download are supported', () => {
    globalThis.URL = function URL() {};
    globalThis.URL.createObjectURL = function () {};
    globalThis.HTMLAnchorElement = { prototype: { download: '' } };
    assert.equal(canSaveImageDownload(), true);
  });
});

describe('SHARE_UNSUPPORTED_NOTE', () => {
  test('exports the exact shared explanation', () => {
    assert.equal(SHARE_UNSUPPORTED_NOTE, 'Buka di browser untuk pengalaman lebih baik.');
  });
});