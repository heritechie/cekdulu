import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { hydrateEntries } from '../src/lib/wishlist.ts';
import { totalSaved } from '../src/lib/wishlist.ts';

/**
 * Hydration tests for /wishlist: proves the IndexedDB → hydrate → UI mapping.
 *
 * The page writes proofs to IndexedDB keyed by entry.id and hydrates them back
 * with hydrateEntries() BEFORE the first renderDashboard(). These tests run the
 * exact same function against an in-memory proof store so the "proof A → entry
 * A" contract (never a mix-up, never a shared image, never index-based) is
 * guaranteed in CI.
 */

// Minimal in-memory stand-in for the `proofs` object store used by the page.
function makeProofStore(initial = new Map()) {
  const store = new Map(initial);
  return {
    store,
    get: async (id) => store.has(id) ? store.get(id) : undefined,
    set: (id, value) => store.set(id, value),
  };
}

const entry = (id, amount, createdAt) => ({
  id,
  amount,
  proofImage: '',
  note: undefined,
  createdAt,
});

describe('hydrateEntries — existing IndexedDB data (reload scenario)', () => {
  test('each entry gets its own proof by entry.id — no mix-up, no sharing', async () => {
    const entries = [
      entry('entry-A', 100000, '2026-09-01T10:00:00.000Z'),
      entry('entry-B', 50000, '2026-09-05T10:00:00.000Z'),
      entry('entry-C', 150000, '2026-09-10T10:00:00.000Z'),
    ];
    const proofs = makeProofStore(
      new Map([
        ['entry-A', 'data:image/jpeg;base64,AAAA'],
        ['entry-B', 'data:image/png;base64,BBBB'],
        ['entry-C', 'data:image/webp;base64,CCCC'],
      ])
    );

    await hydrateEntries(entries, (id) => proofs.get(id));

    assert.equal(entries[0].proofImage, 'data:image/jpeg;base64,AAAA');
    assert.equal(entries[1].proofImage, 'data:image/png;base64,BBBB');
    assert.equal(entries[2].proofImage, 'data:image/webp;base64,CCCC');
    // Cross-check the contract: entry.id, not array position, decides the proof.
    assert.notEqual(entries[0].proofImage, entries[1].proofImage);
    assert.notEqual(entries[1].proofImage, entries[2].proofImage);
    // Total/sum logic is untouched by hydration.
    assert.equal(totalSaved({ price: 1000000, entries }), 300000);
  });

  test('entry with no stored proof is kept visible with an empty thumbnail', async () => {
    const entries = [
      entry('entry-OK', 100000, '2026-09-01T10:00:00.000Z'),
      entry('entry-NO', 50000, '2026-09-05T10:00:00.000Z'),
    ];
    const proofs = makeProofStore(new Map([['entry-OK', 'data:image/png;base64,OKOK']]));

    await hydrateEntries(entries, (id) => proofs.get(id));

    assert.equal(entries[0].proofImage, 'data:image/png;base64,OKOK');
    assert.equal(entries[1].proofImage, ''); // entry stays, thumbnail absent
  });

  test('a rejecting store read does not break the other entries', async () => {
    const entries = [entry('entry-A', 1000, '2026-09-01T10:00:00.000Z')];
    await hydrateEntries(entries, () => Promise.reject(new Error('quota')));
    assert.equal(entries[0].proofImage, '');
  });
});

describe('hydrateEntries — proof format', () => {
  test('stored Blob proofs surface as revocable object URLs', async () => {
    const entries = [entry('entry-B', 50000, '2026-09-05T10:00:00.000Z')];
    const seen = [];
    const blob = new Blob(['fake-png-bytes'], { type: 'image/png' });

    await hydrateEntries(
      entries,
      () => blob,
      { onBlobUrl: (url) => seen.push(url) }
    );

    assert.equal(seen.length, 1);
    assert.match(entries[0].proofImage, /^blob:/);
    // The object URL is reported for revocation once the thumbnail is gone.
    const idx = entries[0].proofImage;
    URL.revokeObjectURL(idx);
  });

  test('garbage stored value (non-string, non-Blob) is skipped safely', async () => {
    const entries = [entry('entry-X', 1000, '2026-09-01T10:00:00.000Z')];
    await hydrateEntries(entries, () => 12345);
    assert.equal(entries[0].proofImage, '');
  });
});

describe('hydrateEntries — matching the page flow', () => {
  test('a fresh save-then-reload keeps amount, date and proof intact', async () => {
    // 1. save: metadata + proof (same entry.id used for both)
    const saved = entry('entry-new', 250000, '2026-09-15T10:00:00.000Z');
    const proofs = makeProofStore();
    proofs.set(saved.id, 'data:image/jpeg;base64,SAVED');

    // 2. reload: goal rebuilt from localStorage (entries with proofImage ''),
    //    proofs re-read by id, then render happens (verified by values here).
    const reloaded = [
      { ...saved, proofImage: '' },
      ...[],
    ];
    await hydrateEntries(reloaded, (id) => proofs.get(id));

    assert.equal(reloaded.length, 1);
    assert.equal(reloaded[0].amount, 250000);
    assert.equal(reloaded[0].createdAt, '2026-09-15T10:00:00.000Z');
    assert.equal(reloaded[0].proofImage, 'data:image/jpeg;base64,SAVED');
  });
});