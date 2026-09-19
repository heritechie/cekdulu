import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_NABUNGKU_STORAGE_KEY,
  LEGACY_NABUNGKU_DB_NAME,
  WISHLIST_STORAGE_KEY,
  WISHLIST_DB_NAME,
  WISHLIST_DB_STORE,
  clearGoalFromStorage,
  migrateLegacyGoalFromStorage,
  migrateLegacyProofs,
  readGoalFromStorage,
  openProofsDatabase,
  readProof,
  writeGoalToStorage,
  writeProofToDatabase,
} from '../src/lib/wishlist.ts';

/**
 * Persistence namespace + migration tests for /wishlist.
 *
 * The feature renamed its internal namespace from "nabungku" to "wishlist"
 * while keeping legacy user data: the old localStorage key and IndexedDB
 * database are copied (never destroyed) into the new names. These tests pin
 * the new identifiers and prove the migration is correct, idempotent and safe
 * for first-time users.
 */

function memoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    store,
  };
}

/**
 * Minimal in-memory stand-in for the bits of IDB the migration touches:
 * open(name)/databases()/transactions/cursors. The fake mirrors async firing
 * of onupgradeneeded → onsuccess and cursor iteration → tx.oncomplete so the
 * promise flow in migrateLegacyProofs() is exercised faithfully.
 */
function makeFakeIdb(seed = {}) {
  const dbs = new Map();
  for (const [name, stores] of Object.entries(seed)) {
    const storeMaps = new Map();
    for (const [storeName, records] of Object.entries(stores)) {
      storeMaps.set(storeName, new Map(records));
    }
    dbs.set(name, storeMaps);
  }

  const makeDb = (storeMaps) => ({
    objectStoreNames: { contains: (n) => storeMaps.has(n) },
    createObjectStore: (n) => storeMaps.set(n, new Map()),
    transaction: (storeName, mode) => makeTx(storeMaps.get(storeName) ?? new Map(), mode),
    close: () => {},
  });

const makeTx = (records, mode) => {
  const tx = { error: null, oncomplete: null, onerror: null, onabort: null };
  let cursorDone = false;
  tx.objectStore = () => ({
    get: (key) => {
      const req = { result: records.get(key), error: null, onsuccess: null, onerror: null };
      queueMicrotask(() => req.onsuccess && req.onsuccess());
      return req;
    },
    openCursor: () => {
      const entries = [...records.entries()];
      let i = 0;
      const req = { result: null, error: null, onsuccess: null, onerror: null };
      const emit = () => {
        if (i < entries.length) {
          const [key, value] = entries[i++];
          req.result = { key, value, continue: () => queueMicrotask(emit) };
          if (req.onsuccess) req.onsuccess();
        } else {
          req.result = null;
          if (req.onsuccess) req.onsuccess();
          if (!cursorDone) {
            cursorDone = true;
            queueMicrotask(() => tx.oncomplete && tx.oncomplete());
          }
        }
      };
      queueMicrotask(emit);
      return req;
    },
    put: (value, key) => {
      records.set(key, value);
    },
  });
  // Write transactions never open a cursor, so complete them independently.
  if (mode === 'readwrite') queueMicrotask(() => tx.oncomplete && tx.oncomplete());
  return tx;
};

  return {
    databases: async () => [...dbs.keys()].map((name) => ({ name, version: 1 })),
    open: (name) => {
      const existed = dbs.has(name);
      if (!existed) dbs.set(name, new Map());
      const storeMaps = dbs.get(name);
      const req = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        req.result = makeDb(storeMaps);
        if (!existed && req.onupgradeneeded) req.onupgradeneeded();
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
    _dbs: dbs,
  };
}

const legacyGoal = JSON.stringify({
  id: 'goal-legacy',
  price: 500000,
  productImage: 'data:image/jpeg;base64,GOAL',
  createdAt: '2026-09-01T00:00:00Z',
  entries: [
    {
      id: 'entry-a',
      amount: 100000,
      proofImage: '',
      note: 'nabung',
      createdAt: '2026-09-02T00:00:00Z',
    },
  ],
});

const legacyProofs = new Map([
  ['entry-a', 'data:image/jpeg;base64,AAA'],
  ['entry-b', 'data:image/png;base64,BBB'],
]);

describe('wishlist persistence namespace', () => {
  test('constants target the new wishlist namespace', () => {
    assert.equal(WISHLIST_STORAGE_KEY, 'cekdulu_wishlist_goal');
    assert.equal(WISHLIST_DB_NAME, 'cekdulu_wishlist');
    assert.equal(WISHLIST_DB_STORE, 'proofs');
  });

  test('legacy nabungku constants are preserved for migration', () => {
    assert.equal(LEGACY_NABUNGKU_STORAGE_KEY, 'cekdulu_nabungku_goal');
    assert.equal(LEGACY_NABUNGKU_DB_NAME, 'cekdulu_nabungku');
  });
});

describe('migrateLegacyGoalFromStorage (localStorage)', () => {
  test('first-time user (no legacy data) → no-op, nothing written', () => {
    const s = memoryStorage();
    assert.equal(migrateLegacyGoalFromStorage(s), false);
    assert.equal(s.store.has(WISHLIST_STORAGE_KEY), false);
  });

  test('legacy present + new absent → copies data verbatim to the wishlist key', () => {
    const s = memoryStorage({ [LEGACY_NABUNGKU_STORAGE_KEY]: legacyGoal });
    assert.equal(migrateLegacyGoalFromStorage(s), true);
    assert.equal(s.store.get(WISHLIST_STORAGE_KEY), legacyGoal);
    assert.equal(s.store.get(LEGACY_NABUNGKU_STORAGE_KEY), legacyGoal);
  });

  test('goal and entry ids are preserved through the copy', () => {
    const s = memoryStorage({ [LEGACY_NABUNGKU_STORAGE_KEY]: legacyGoal });
    migrateLegacyGoalFromStorage(s);
    const copied = s.store.get(WISHLIST_STORAGE_KEY);
    assert.ok(copied.includes('"id":"goal-legacy"'), 'goal id must be preserved');
    assert.ok(copied.includes('"id":"entry-a"'), 'entry id must be preserved');
    assert.ok(copied.includes('"amount":100000'), 'entry amount must be preserved');
  });

  test('both keys present → new wins, both untouched', () => {
    const newer = JSON.stringify({ id: 'goal-new', price: 999, productImage: 'x', createdAt: '2026-09-10T00:00:00Z', entries: [] });
    const s = memoryStorage({ [LEGACY_NABUNGKU_STORAGE_KEY]: legacyGoal, [WISHLIST_STORAGE_KEY]: newer });
    assert.equal(migrateLegacyGoalFromStorage(s), false);
    assert.equal(s.store.get(WISHLIST_STORAGE_KEY), newer);
    assert.equal(s.store.get(LEGACY_NABUNGKU_STORAGE_KEY), legacyGoal);
  });

  test('idempotent — second run no-ops and keeps identical data', () => {
    const s = memoryStorage({ [LEGACY_NABUNGKU_STORAGE_KEY]: legacyGoal });
    assert.equal(migrateLegacyGoalFromStorage(s), true);
    assert.equal(migrateLegacyGoalFromStorage(s), false);
    assert.equal(s.store.get(WISHLIST_STORAGE_KEY), legacyGoal);
  });
});

describe('goal storage under the new key (window shim)', () => {
  function withWindow(storage, fn) {
    const prev = globalThis.window;
    try {
      globalThis.window = { localStorage: storage };
      fn();
    } finally {
      if (prev === undefined) delete globalThis.window;
      else globalThis.window = prev;
    }
  }

  test('writeGoalToStorage persists under cekdulu_wishlist_goal only', () => {
    const s = memoryStorage();
    withWindow(s, () => {
      writeGoalToStorage({
        id: 'goal-x',
        price: 100,
        productImage: 'data:,',
        createdAt: '2026-09-01T00:00:00Z',
        entries: [],
      });
    });
    assert.ok(s.store.get(WISHLIST_STORAGE_KEY).includes('"id":"goal-x"'));
    assert.equal(s.store.has(LEGACY_NABUNGKU_STORAGE_KEY), false);
  });

  test('clearGoalFromStorage removes both the new and legacy keys (no resurrection)', () => {
    const s = memoryStorage({
      [WISHLIST_STORAGE_KEY]: legacyGoal,
      [LEGACY_NABUNGKU_STORAGE_KEY]: legacyGoal,
    });
    withWindow(s, () => {
      clearGoalFromStorage();
    });
    assert.equal(s.store.has(WISHLIST_STORAGE_KEY), false);
    assert.equal(s.store.has(LEGACY_NABUNGKU_STORAGE_KEY), false);
  });

  test('legacy data becomes readable via the wishlist key after migration', () => {
    const s = memoryStorage({ [LEGACY_NABUNGKU_STORAGE_KEY]: legacyGoal });
    withWindow(s, () => {
      assert.equal(migrateLegacyGoalFromStorage(), true);
      const g = readGoalFromStorage();
      assert.ok(g, 'goal must be readable after migration');
      assert.equal(g.id, 'goal-legacy');
      assert.equal(g.price, 500000);
      assert.equal(g.entries.length, 1);
      assert.equal(g.entries[0].id, 'entry-a');
      assert.equal(g.entries[0].amount, 100000);
    });
  });
});

describe('migrateLegacyProofs (IndexedDB)', () => {
  test('first-time user (no legacy db) → false and no wishlist db created', async () => {
    const idb = makeFakeIdb();
    assert.equal(await migrateLegacyProofs(idb), false);
    assert.equal(idb._dbs.has(WISHLIST_DB_NAME), false);
  });

  test('empty legacy database → false, nothing copied', async () => {
    const idb = makeFakeIdb({ [LEGACY_NABUNGKU_DB_NAME]: { proofs: new Map() } });
    assert.equal(await migrateLegacyProofs(idb), false);
    assert.equal(idb._dbs.has(WISHLIST_DB_NAME), false);
  });

  test('copies legacy proofs into cekdulu_wishlist/proofs preserving entry-id keys', async () => {
    const idb = makeFakeIdb({ [LEGACY_NABUNGKU_DB_NAME]: { proofs: legacyProofs } });
    assert.equal(await migrateLegacyProofs(idb), true);
    const target = idb._dbs.get(WISHLIST_DB_NAME).get(WISHLIST_DB_STORE);
    assert.equal(target.get('entry-a'), 'data:image/jpeg;base64,AAA');
    assert.equal(target.get('entry-b'), 'data:image/png;base64,BBB');
    assert.deepEqual([...target.keys()].sort(), ['entry-a', 'entry-b']);
    const legacy = idb._dbs.get(LEGACY_NABUNGKU_DB_NAME).get(WISHLIST_DB_STORE);
    assert.deepEqual([...legacy.keys()].sort(), ['entry-a', 'entry-b']);
  });

  test('blob proof values migrate intact', async () => {
    const blob = { type: 'image/png', bytes: 'fake-bytes' };
    const idb = makeFakeIdb({ [LEGACY_NABUNGKU_DB_NAME]: { proofs: new Map([['entry-z', blob]]) } });
    assert.equal(await migrateLegacyProofs(idb), true);
    assert.equal(idb._dbs.get(WISHLIST_DB_NAME).get(WISHLIST_DB_STORE).get('entry-z'), blob);
  });

  test('idempotent — repeated runs keep identical records', async () => {
    const idb = makeFakeIdb({ [LEGACY_NABUNGKU_DB_NAME]: { proofs: legacyProofs } });
    assert.equal(await migrateLegacyProofs(idb), true);
    const first = [...idb._dbs.get(WISHLIST_DB_NAME).get(WISHLIST_DB_STORE).entries()];
    assert.equal(await migrateLegacyProofs(idb), false);
    const second = [...idb._dbs.get(WISHLIST_DB_NAME).get(WISHLIST_DB_STORE).entries()];
    assert.deepEqual(second, first);
    assert.equal(second.length, 2);
  });

  test('an existing record at the same key in the wishlist store is never overwritten', async () => {
    const idb = makeFakeIdb({
      [LEGACY_NABUNGKU_DB_NAME]: { proofs: new Map([['entry-a', 'legacy-img']]) },
      [WISHLIST_DB_NAME]: { proofs: new Map([['entry-a', 'newer-img']]) },
    });
    await migrateLegacyProofs(idb);
    assert.equal(idb._dbs.get(WISHLIST_DB_NAME).get(WISHLIST_DB_STORE).get('entry-a'), 'newer-img');
  });
});

describe('readProof (shared IndexedDB proof read)', () => {
  test('returns the stored record for an entry id', async () => {
    const idb = makeFakeIdb({
      [WISHLIST_DB_NAME]: { proofs: new Map([['entry-a', 'data:image/jpeg;base64,AAA']]) },
    });
    assert.equal(await readProof('entry-a', idb), 'data:image/jpeg;base64,AAA');
  });

  test('resolves undefined when no record matches the entry id', async () => {
    const idb = makeFakeIdb({ [WISHLIST_DB_NAME]: { proofs: new Map() } });
    assert.equal(await readProof('entry-missing', idb), undefined);
  });

  test('creates the proofs store on upgrade for an empty database', async () => {
    const idb = makeFakeIdb();
    assert.equal(await readProof('entry-a', idb), undefined);
    assert.ok(
      idb._dbs.get(WISHLIST_DB_NAME).has(WISHLIST_DB_STORE),
      'the proofs store must be created on first open',
    );
  });
});

describe('writeProofToDatabase (save-flow proof write)', () => {
  test('round-trips a data-URL proof keyed by entry id', async () => {
    const idb = makeFakeIdb();
    await writeProofToDatabase('entry-new', 'data:image/jpeg;base64,NEW', idb);
    assert.equal(await readProof('entry-new', idb), 'data:image/jpeg;base64,NEW');
    assert.equal(idb._dbs.get(WISHLIST_DB_NAME).get(WISHLIST_DB_STORE).size, 1, 'exactly one record');
  });

  test('overwrites an existing record for the same entry id', async () => {
    const idb = makeFakeIdb({
      [WISHLIST_DB_NAME]: { proofs: new Map([['entry-a', 'data:image/jpeg;base64,OLD']]) },
    });
    await writeProofToDatabase('entry-a', 'data:image/jpeg;base64,REPLACED', idb);
    assert.equal(await readProof('entry-a', idb), 'data:image/jpeg;base64,REPLACED');
  });

  test('keeps proofs separate per entry id', async () => {
    const idb = makeFakeIdb();
    await writeProofToDatabase('entry-1', 'data:image/jpeg;base64,ONE', idb);
    await writeProofToDatabase('entry-2', 'data:image/jpeg;base64,TWO', idb);
    assert.equal(await readProof('entry-1', idb), 'data:image/jpeg;base64,ONE');
    assert.equal(await readProof('entry-2', idb), 'data:image/jpeg;base64,TWO');
  });
});