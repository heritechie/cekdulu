import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { canShareImageFiles } from '../src/lib/share-capability.ts';

/**
 * Unit tests for the Web Share file-sharing capability detection helper.
 *
 * globalThis.navigator is patched with mocks in each test and restored after.
 */

const originalNavigator = globalThis.navigator;

function restoreNavigator() {
  globalThis.navigator = originalNavigator;
}

afterEach(() => {
  restoreNavigator();
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
    globalThis.navigator = {
      share() {},
      canShare({ files }) {
        return files.length > 0 && files[0].name === 'cekdulu-share.png' ? true : false;
      },
    };
    // navigator.canShare check passes (files array non-empty), but we use canShare which returns true.
    // Actually the probe creates a file with name "cekdulu-share.png", so canShare returns true.
    // To test the false case, make canShare always return false.
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
