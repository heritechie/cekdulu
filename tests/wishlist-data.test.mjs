import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { loadWishlistData, createWishlistGoal, deleteWishlistGoal } from '../src/components/wishlist/data.ts';
import { LEGACY_NABUNGKU_STORAGE_KEY, WISHLIST_STORAGE_KEY, WISHLIST_DB_NAME, WISHLIST_DB_STORE } from '../src/lib/wishlist.ts';
import WishlistDetail from '../src/components/wishlist/WishlistDetail.tsx';

/**
 * Data-bridge tests (Step 5): loadWishlistData() is the ONLY persistence
 * reader the React wishlist UI talks to. It must merge localStorage goal
 * metadata + IndexedDB proofs into one model where every entry's proof is
 * matched BY ENTRY ID.
 */

const noop = () => {};

function makeFakeIdb(seed = {}) {
  const dbs = new Map();
  for (const [name, stores] of Object.entries(seed)) {
    const storeMaps = new Map();
    for (const [storeName, records] of Object.entries(stores)) {
      storeMaps.set(storeName, new Map(records));
    }
    dbs.set(name, storeMaps);
  }

  const makeTx = (records, mode) => {
    const tx = { error: null, oncomplete: null, onerror: null, onabort: null };
    tx.objectStore = () => ({
      get: (key) => {
        const req = { result: records.get(key), error: null, onsuccess: null, onerror: null };
        queueMicrotask(() => req.onsuccess && req.onsuccess());
        return req;
      },
      put: (value, key) => {
        records.set(key, value);
        queueMicrotask(() => tx.oncomplete && tx.oncomplete());
        return {};
      },
      delete: (key) => {
        records.delete(key);
        queueMicrotask(() => tx.oncomplete && tx.oncomplete());
        return {};
      },
    });
    return tx;
  };

  const makeDb = (storeMaps) => ({
    objectStoreNames: { contains: (n) => storeMaps.has(n) },
    createObjectStore: (n) => storeMaps.set(n, new Map()),
    transaction: (storeName, mode) => makeTx(storeMaps.get(storeName) ?? new Map(), mode),
    close: () => {},
  });

  return {
    open: (name, _version) => {
      if (!dbs.has(name)) dbs.set(name, new Map());
      const req = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        req.result = makeDb(dbs.get(name));
        if (req.onupgradeneeded && !req.result.objectStoreNames.contains(WISHLIST_DB_STORE)) {
          req.onupgradeneeded();
        }
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
    _dbs: dbs,
  };
}

function memoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    store,
  };
}

const goalJSON = JSON.stringify({
  id: 'goal-abc',
  name: 'Sepatu Impian',
  price: 2000000,
  productImage: 'data:image/jpeg;base64,GOAL',
  createdAt: '2026-01-01T08:00:00.000Z',
  entries: [
    { id: 'entry-A', amount: 600000, proofImage: '', note: 'Gajian', createdAt: '2026-01-10T08:00:00.000Z' },
    { id: 'entry-B', amount: 400000, proofImage: '', note: undefined, createdAt: '2026-01-25T08:00:00.000Z' },
    { id: 'entry-C', amount: 200000, proofImage: '', note: 'Bonus', createdAt: '2026-02-05T08:00:00.000Z' },
  ],
});

function goalStorage(extra = {}) {
  return memoryStorage({ [WISHLIST_STORAGE_KEY]: goalJSON, ...extra });
}

function proofGetter(map) {
  const proofs = new Map(map);
  return async (id) => (proofs.has(id) ? proofs.get(id) : undefined);
}

const dataUrl = (tag) => `data:image/png;base64,${tag}`;

describe('loadWishlistData — no goal', () => {
  test('returns null safely when there is no wishlist data', async () => {
    const result = await loadWishlistData({ storage: memoryStorage() });
    assert.equal(result, null);
  });

  test('returns null and never writes when storage is empty', async () => {
    const s = memoryStorage();
    await loadWishlistData({ storage: s });
    assert.equal(s.store.size, 0);
  });

  test('a corrupt goal record is treated as "no goal", not a crash', async () => {
    const s = memoryStorage({ [WISHLIST_STORAGE_KEY]: '{not-json' });
    assert.equal(await loadWishlistData({ storage: s }), null);
  });
});

describe('loadWishlistData — goal metadata', () => {
  test('returns goal metadata and all entries', async () => {
    const data = await loadWishlistData({
      storage: goalStorage(),
      getProof: proofGetter([]),
    });
    assert.ok(data, 'a goal must produce data');
    assert.equal(data.goal.id, 'goal-abc');
    assert.equal(data.goal.name, 'Sepatu Impian');
    assert.equal(data.goal.price, 2000000);
    assert.equal(data.goal.productImage, 'data:image/jpeg;base64,GOAL');
    assert.equal(data.goal.createdAt, '2026-01-01T08:00:00.000Z');
    assert.equal(data.item.targetPrice, 2000000, 'view model target must match the goal');
    assert.deepEqual(
      data.goal.entries.map((e) => e.id),
      ['entry-A', 'entry-B', 'entry-C'],
      'all stored entries must be returned',
    );
    assert.deepEqual(
      data.goal.entries.map((e) => e.amount),
      [600000, 400000, 200000],
      'entry amounts must survive the round-trip',
    );
  });

  test('migrates legacy localStorage before reading the goal', async () => {
    const s = memoryStorage({ [LEGACY_NABUNGKU_STORAGE_KEY]: goalJSON });
    const data = await loadWishlistData({ storage: s, getProof: proofGetter([]) });
    assert.ok(s.store.has(WISHLIST_STORAGE_KEY), 'legacy data must be copied to the wishlist key');
    assert.ok(data, 'legacy goal must become readable');
    assert.equal(data.goal.id, 'goal-abc');
    assert.equal(data.goal.entries.length, 3);
  });

  test('load is read-only: no new writes besides the allowed legacy migration', async () => {
    const s = goalStorage();
    const keysBefore = [...s.store.keys()].sort();
    const data = await loadWishlistData({ storage: s, getProof: proofGetter([]) });
    assert.ok(data, 'goal must load');
    assert.deepEqual([...s.store.keys()].sort(), keysBefore, 'no keys may be added or removed');
    assert.equal(s.store.get(WISHLIST_STORAGE_KEY), goalJSON, 'goal record must be untouched');
  });
});

describe('loadWishlistData — proof hydration (by entry.id)', () => {
  test('each entry gets its own proof matched by entry id', async () => {
    const data = await loadWishlistData({
      storage: goalStorage(),
      getProof: proofGetter([
        ['entry-A', dataUrl('AAA')],
        ['entry-B', dataUrl('BBB')],
      ]),
    });
    const proofOf = (id) => data.goal.entries.find((e) => e.id === id).proofImage;
    assert.equal(proofOf('entry-A'), dataUrl('AAA'));
    assert.equal(proofOf('entry-B'), dataUrl('BBB'));
    assert.notEqual(proofOf('entry-A'), proofOf('entry-B'), 'proofs must never be shared');
  });

  test('an entry with no stored proof stays valid with an empty thumbnail', async () => {
    const data = await loadWishlistData({
      storage: goalStorage(),
      getProof: proofGetter([['entry-A', dataUrl('AAA')]]),
    });
    const entryC = data.goal.entries.find((e) => e.id === 'entry-C');
    assert.ok(entryC, 'entry without proof must still exist');
    assert.equal(entryC.amount, 200000);
    assert.equal(entryC.proofImage, '', 'missing proof must not be fabricated');
  });

  test('proofs map to the correct entry even when array order differs', async () => {
    // Proof store inserted in reverse: order must never matter, id must.
    const data = await loadWishlistData({
      storage: goalStorage(),
      getProof: proofGetter([
        ['entry-C', dataUrl('CCC')],
        ['entry-B', dataUrl('BBB')],
        ['entry-A', dataUrl('AAA')],
      ]),
    });
    const proofOf = (id) => data.goal.entries.find((e) => e.id === id).proofImage;
    assert.equal(proofOf('entry-A'), dataUrl('AAA'));
    assert.equal(proofOf('entry-B'), dataUrl('BBB'));
    assert.equal(proofOf('entry-C'), dataUrl('CCC'));
  });

  test('history ordering stays newest-first in the React-facing model', async () => {
    const data = await loadWishlistData({
      storage: goalStorage(),
      getProof: proofGetter([]),
    });
    assert.deepEqual(
      data.item.history.map((h) => h.id),
      ['entry-C', 'entry-B', 'entry-A'],
      'history must be newest-first like the vanilla view',
    );
  });

  test('hydrated proofs reach the list/detail model (regression: history+proof)', async () => {
    const data = await loadWishlistData({
      storage: goalStorage(),
      getProof: proofGetter([
        ['entry-A', dataUrl('AAA')],
        ['entry-B', dataUrl('BBB')],
      ]),
    });
    const byId = new Map(data.item.history.map((h) => [h.id, h]));
    assert.equal(byId.get('entry-A').proofImage, dataUrl('AAA'));
    assert.equal(byId.get('entry-B').proofImage, dataUrl('BBB'));
    assert.equal(byId.get('entry-C').proofImage, '', 'missing proof must stay empty in the model');
  });

  test('legacy Blob proofs surface as object URLs via the same path', async () => {
    const singleGoal = memoryStorage({
      [WISHLIST_STORAGE_KEY]: JSON.stringify({
        id: 'goal-blob',
        name: 'Sepatu',
        price: 1000000,
        productImage: 'data:image/jpeg;base64,GOAL',
        createdAt: '2026-01-01T08:00:00.000Z',
        entries: [
          { id: 'entry-A', amount: 500000, proofImage: '', note: 'Gajian', createdAt: '2026-01-10T08:00:00.000Z' },
        ],
      }),
    });
    const blob = new Blob(['png-bytes'], { type: 'image/png' });
    const urls = [];
    const data = await loadWishlistData({
      storage: singleGoal,
      getProof: async () => blob,
      onBlobUrl: (url) => urls.push(url),
    });
    assert.equal(urls.length, 1, 'the blob object URL must be reported for revocation');
    assert.equal(data.goal.entries.length, 1, 'entries stay valid with blob proofs');
    assert.match(data.goal.entries[0].proofImage, /^blob:/, 'blob proof must be image-usable');
    URL.revokeObjectURL(data.goal.entries[0].proofImage);
  });

  test('bridged model drives the React Detail UI with hydrated proofs', async () => {
    const data = await loadWishlistData({
      storage: goalStorage(),
      getProof: proofGetter([
        ['entry-A', 'data:image/jpeg;base64,AAA'],
        ['entry-B', 'data:image/png;base64,BBB'],
      ]),
    });
    const html = renderToStaticMarkup(
      createElement(WishlistDetail, { item: data.item, onBack: noop, onAddSaving: noop, onShare: noop, onDelete: noop, shareSupported: true }),
    );
    assert.ok(html.includes('data:image/jpeg;base64,AAA'), 'proof A must render for entry A');
    assert.ok(html.includes('data:image/png;base64,BBB'), 'proof B must render for entry B');
    assert.ok(html.includes('Sepatu Impian'), 'goal metadata must render');
  });
});

describe('loadWishlistData — IndexedDB failure resilience', () => {
  test('goal and entries survive when proof reads reject', async () => {
    const data = await loadWishlistData({
      storage: goalStorage(),
      getProof: async () => {
        throw new Error('indexeddb unavailable');
      },
    });
    assert.ok(data, 'goal data must survive proof hydration failure');
    assert.equal(data.goal.entries.length, 3);
    assert.deepEqual(
      data.goal.entries.map((e) => e.amount),
      [600000, 400000, 200000],
      'entry amounts must remain intact',
    );
    assert.ok(
      data.goal.entries.every((e) => e.proofImage === ''),
      'no proof image may be fabricated on failure',
    );
    assert.ok(data.item.estimateLabel === null || typeof data.item.estimateLabel === 'string');
  });

  test('does not reject when IndexedDB is entirely absent', async () => {
    const data = await loadWishlistData({
      storage: goalStorage(),
      idb: null,
      getProof: null,
    });
    assert.ok(data, 'absent IndexedDB must degrade to goal-only data');
    assert.ok(data.goal.entries.every((e) => e.proofImage === ''));
  });
});

describe('create/delete goal bridge', () => {
  test('createWishlistGoal persists an empty goal with a trimmed optional name', () => {
    const s = memoryStorage();
    const goal = createWishlistGoal(
      {
        name: '  Kamera  ',
        price: 2000000,
        productImage: 'data:image/png;base64,GOAL',
      },
      { storage: s },
      Date.parse('2026-02-01T08:00:00.000Z'),
    );
    assert.match(goal.id, /^goal-/, 'goal ids must be prefixed');
    assert.equal(goal.name, 'Kamera');
    assert.equal(goal.price, 2000000);
    assert.equal(goal.entries.length, 0);
    const stored = JSON.parse(s.store.get(WISHLIST_STORAGE_KEY));
    assert.equal(stored.id, goal.id);
    assert.equal(stored.name, 'Kamera');
    assert.equal(stored.productImage, 'data:image/png;base64,GOAL');
    assert.equal(stored.createdAt, '2026-02-01T08:00:00.000Z');
  });

  test('created goal becomes readable through the same loader', async () => {
    const s = memoryStorage();
    createWishlistGoal(
      { name: 'Kamera', price: 2000000, productImage: 'data:image/png;base64,GOAL' },
      { storage: s },
    );
    const data = await loadWishlistData({ storage: s, getProof: proofGetter([]) });
    assert.ok(data, 'created goal must load back');
    assert.equal(data.goal.name, 'Kamera');
    assert.equal(data.goal.entries.length, 0);
  });

  test('deleteWishlistGoal clears goal, legacy, and all indexed proofs', async () => {
    const storage = goalStorage({ [LEGACY_NABUNGKU_STORAGE_KEY]: 'old' });
    const idb = makeFakeIdb({
      [WISHLIST_DB_NAME]: {
        proofs: new Map([
          ['entry-A', dataUrl('AAA')],
          ['entry-B', dataUrl('BBB')],
          ['entry-C', dataUrl('CCC')],
        ]),
      },
    });
    await deleteWishlistGoal({ storage, idb });
    assert.equal(
      idb._dbs.get(WISHLIST_DB_NAME).get(WISHLIST_DB_STORE).size,
      0,
      'every stored entry proof must be deleted',
    );
    assert.ok(!storage.store.has(WISHLIST_STORAGE_KEY), 'goal must be cleared');
    assert.ok(!storage.store.has(LEGACY_NABUNGKU_STORAGE_KEY), 'legacy key must be cleared');
  });

  test('deleteWishlistGoal is a safe no-op on corrupt or absent goals', async () => {
    const s = memoryStorage({ [WISHLIST_STORAGE_KEY]: '{not-json' });
    await deleteWishlistGoal({ storage: s });
    assert.ok(!s.store.has(WISHLIST_STORAGE_KEY));
  });
});

describe('React data-flow wiring (static)', () => {
  const appSrc = readFileSync('src/components/wishlist/WishlistApp.tsx', 'utf8');

  test('WishlistApp consumes the bridge, not persistence directly', () => {
    assert.match(appSrc, /from '\.\/data'/, 'app must import the data bridge');
    assert.match(appSrc, /loadWishlistData/, 'app must call loadWishlistData');
    assert.ok(
      !/readGoalFromStorage|hydrateEntries|readProof|migrateLegacyGoalFromStorage/.test(appSrc),
      'app must not call persistence helpers directly',
    );
    assert.ok(!/localStorage/.test(appSrc), 'app must not touch localStorage');
    assert.ok(!/indexedDB/.test(appSrc), 'app must not touch IndexedDB');
  });

  test('items come from the hydrated bridge model', () => {
    assert.match(appSrc, /data \? \[data\.item\]/, 'list items must come from the hydrated model');
  });

  test('WishlistList, WishlistDetail, WishlistScreen stay presentational', () => {
    for (const name of ['WishlistList', 'WishlistDetail', 'WishlistScreen']) {
      const c = readFileSync(`src/components/wishlist/${name}.tsx`, 'utf8');
      assert.ok(!/localStorage/.test(c), `${name} must not read localStorage`);
      assert.ok(!/indexedDB/.test(c), `${name} must not open IndexedDB`);
      assert.ok(
        !/readGoalFromStorage|hydrateEntries|readProof|migrateLegacy/.test(c),
        `${name} must not call persistence helpers`,
      );
    }
  });

  test('the data bridge owns all persistence writes (save, create, delete) like reads', () => {
    const dataSrc = readFileSync('src/components/wishlist/data.ts', 'utf8');
    assert.match(dataSrc, /saveWishlistEntry/, 'bridge must own the save orchestrator');
    assert.match(dataSrc, /writeGoalToStorage/, 'bridge must reuse the lib goal writer');
    assert.match(dataSrc, /writeProofToDatabase/, 'bridge must reuse the lib proof writer');
    assert.match(dataSrc, /createWishlistId/, 'bridge must create entry ids through the lib');
    assert.match(dataSrc, /createWishlistGoal/, 'bridge must own goal creation');
    assert.match(dataSrc, /deleteWishlistGoal/, 'bridge must own goal deletion');
    assert.match(dataSrc, /deleteProofFromDatabase/, 'bridge must reuse the lib proof deletor');
    assert.match(dataSrc, /clearGoalFromStorage/, 'bridge must clear storage through the lib');
  });
});