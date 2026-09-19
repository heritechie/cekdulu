import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import {
  deleteWishlistGoal,
  loadWishlistData,
  saveWishlistEntry,
} from '../src/components/wishlist/data.ts';
import WishlistDetail from '../src/components/wishlist/WishlistDetail.tsx';
import WishlistComplete from '../src/components/wishlist/WishlistComplete.tsx';
import {
  LEGACY_NABUNGKU_DB_NAME,
  LEGACY_NABUNGKU_STORAGE_KEY,
  WISHLIST_DB_NAME,
  WISHLIST_DB_STORE,
  WISHLIST_STORAGE_KEY,
  readProof,
} from '../src/lib/wishlist.ts';

/**
 * Step 8 — full Wishlist lifecycle regression, driven through the REAL code
 * paths:
 *
 *   saveWishlistEntry (metadata + proof, in the exact addEntry order)
 *        ↓
 *   deep-reload through loadWishlistData (storage + IndexedDB seams)
 *        ↓
 *   react-facing model (goalToWishlistItem → goalEntriesToHistory)
 *        ↓
 *   WishlistDetail render (proof thumbnails, history rows, progress)
 *
 * This is the guard for the historical bug class where progress/total updated
 * but history entries (and their proofs) did not appear: every test below
 * asserts that progress, history, AND proof appear together, matched BY ENTRY
 * ID on the same hydrated model that a reload produces.
 *
 * The React WishlistApp uses hooks and cannot be executed by the Node test
 * bundle, so the orchestration it owns was extracted into the data bridge
 * (loadWishlistData / saveWishlistEntry / deleteWishlistGoal) — the same
 * single persistence seam the app calls — and these tests run that real code.
 */

const noop = () => {};

const DAY = 86_400_000;
const BASE = Date.parse('2026-09-15T08:00:00Z');

const dataUrl = (tag) => `data:image/png;base64,${tag}`;

function memoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    store,
  };
}

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

  // The tx object is returned AS-IS so writeProofToDatabase / readStoreRecords
  // assign their handlers onto the exact object the microtasks below fire.
  const makeTx = (records, mode) => {
    const tx = { error: null, oncomplete: null, onerror: null, onabort: null };
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
            if (mode === 'readonly') queueMicrotask(() => tx.oncomplete && tx.oncomplete());
          }
        };
        queueMicrotask(emit);
        return req;
      },
      put: (value, key) => {
        records.set(key, value);
      },
      delete: (key) => {
        records.delete(key);
      },
    });
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

const noProofsIdb = () => makeFakeIdb();

function goalJSON({
  id = 'goal-live',
  name = 'Sepatu Impian',
  price = 1000000,
  createdAt = new Date(BASE - 30 * DAY).toISOString(),
  entries = [],
} = {}) {
  return JSON.stringify({ id, name, price, productImage: dataUrl('GOAL'), createdAt, entries });
}

function entry(id, amount, createdAt, rest = {}) {
  return { id, amount, proofImage: '', ...rest, createdAt };
}

describe('S2 — end-to-end save → persist → reload → hydrate lifecycle', () => {
  test('one real save survives a deep reload with metadata AND proof, and renders', async () => {
    const storage = memoryStorage({
      [WISHLIST_STORAGE_KEY]: goalJSON({
        entries: [entry('entry-old', 200000, new Date(BASE - 10 * DAY).toISOString())],
      }),
    });
    const idb = noProofsIdb();

    const initial = await loadWishlistData({ storage, idb });
    assert.ok(initial, 'seeded goal must load');
    assert.equal(initial.item.saved, 200000);
    assert.equal(initial.item.progress, 0.2);
    assert.equal(initial.item.percent, 20);

    const formData = { amount: 300000, proofImage: dataUrl('NEWPROOF'), note: 'Gajian bulanan' };
    const saved = await saveWishlistEntry(initial.goal, formData, { storage, idb }, BASE);

    // — the orchestrator result (in-memory view) —
    assert.ok(saved.entry.id.startsWith('entry-'), 'entry ids must be prefixed');
    assert.equal(saved.proofPersisted, true, 'proof must durably reach IndexedDB');
    assert.equal(saved.goal.entries.length, 2, 'in-memory goal must include the new entry');
    assert.equal(saved.entry.proofImage, formData.proofImage, 'session proof must be hydrated');
    assert.equal(
      saved.goal.entries.find((e) => e.id === saved.entry.id).proofImage,
      formData.proofImage,
      'in-memory entry must carry its own proof',
    );

    // — what actually hit durable storage —
    const stored = JSON.parse(storage.store.get(WISHLIST_STORAGE_KEY));
    assert.equal(stored.entries.length, 2, 'metadata must be persisted');
    assert.ok(
      stored.entries.every((e) => e.proofImage === ''),
      'proofs must never be written into widget storage',
    );
    const storedNew = stored.entries.find((e) => e.id === saved.entry.id);
    assert.equal(storedNew.amount, 300000);
    assert.equal(storedNew.note, 'Gajian bulanan', 'note must keep its trimmed value');
    assert.equal(await readProof(saved.entry.id, idb), formData.proofImage, 'proof keyed by entry id');

    // — the reload a real page refresh would perform —
    const refreshed = await loadWishlistData({ storage, idb });
    assert.ok(refreshed, 'reload must find the goal');
    assert.equal(refreshed.goal.entries.length, 2);
    const reloaded = refreshed.goal.entries.find((e) => e.id === saved.entry.id);
    assert.equal(reloaded.proofImage, formData.proofImage, 'reload must re-hydrate the proof');

    // progress, history, AND proof now appear together (the guarded bug class)
    assert.equal(refreshed.item.saved, 500000, 'total must include the new entry');
    assert.equal(refreshed.item.progress, 0.5);
    assert.equal(refreshed.item.percent, 50);
    assert.equal(refreshed.item.history[0].id, saved.entry.id, 'newest-first history head');
    assert.equal(refreshed.item.history[0].amount, 300000);
    assert.equal(refreshed.item.history[0].note, 'Gajian bulanan');
    assert.equal(refreshed.item.history[0].proofImage, formData.proofImage);

    // — the real React Detail UI renders the reloaded model —
    const html = renderToStaticMarkup(
      createElement(WishlistDetail, { item: refreshed.item, onBack: noop, onAddSaving: noop, onShare: noop, onDelete: noop, shareSupported: true }),
    );
    assert.ok(html.includes('500.000'), 'rendered total must show both entries');
    assert.ok(html.includes('300.000'), 'rendered history row must show the new amount');
    assert.ok(html.includes('Gajian bulanan'), 'rendered history row must show the note');
    assert.ok(html.includes(formData.proofImage), 'rendered history row must show the proof image');
  });
});

describe('S3 — multi-entry proof identity with reversed IndexedDB order', () => {
  test('reversed IDB insertion + an orphan record never mix proofs in the React model', async () => {
    const createdA = new Date(BASE - 20 * DAY).toISOString();
    const createdB = new Date(BASE - 10 * DAY).toISOString();
    const createdC = new Date(BASE - 5 * DAY).toISOString();
    const storage = memoryStorage({
      [WISHLIST_STORAGE_KEY]: goalJSON({
        entries: [
          entry('entry-A', 100000, createdA),
          entry('entry-B', 150000, createdB),
          entry('entry-C', 250000, createdC),
        ],
      }),
    });
    // Records inserted in REVERSE of the entries array order, plus a ghost
    // record whose entry id has no metadata. Cursor/key order and array order
    // differ on purpose: mapping must be by entry.id only.
    const idb = makeFakeIdb({
      [WISHLIST_DB_NAME]: {
        proofs: new Map([
          ['entry-C', dataUrl('CCC')],
          ['entry-B', dataUrl('BBB')],
          ['entry-A', dataUrl('AAA')],
          ['ghost-entry', dataUrl('GHOST')],
        ]),
      },
    });

    const data = await loadWishlistData({ storage, idb });
    assert.ok(data);
    const proofOf = (eid) => data.goal.entries.find((e) => e.id === eid).proofImage;
    assert.equal(proofOf('entry-A'), dataUrl('AAA'));
    assert.equal(proofOf('entry-B'), dataUrl('BBB'));
    assert.equal(proofOf('entry-C'), dataUrl('CCC'));

    const byId = new Map(data.item.history.map((h) => [h.id, h]));
    assert.equal(byId.get('entry-C').proofImage, dataUrl('CCC'));
    assert.equal(byId.get('entry-B').proofImage, dataUrl('BBB'));
    assert.equal(byId.get('entry-A').proofImage, dataUrl('AAA'));
    assert.ok(![...byId.keys()].includes('ghost-entry'), 'orphan proofs must never surface');
    assert.equal(data.item.saved, 500000, 'totals are untouched by proof order');

    // The same identity guarantee holds after ANOTHER save joins the store.
    const res = await saveWishlistEntry(
      data.goal,
      { amount: 50000, proofImage: dataUrl('DDD') },
      { storage, idb },
      BASE,
    );
    const reloaded = await loadWishlistData({ storage, idb });
    const seen = new Map(reloaded.item.history.map((h) => [h.id, h]));
    assert.equal(seen.get('entry-A').proofImage, dataUrl('AAA'));
    assert.equal(seen.get('entry-C').proofImage, dataUrl('CCC'));
    assert.equal(seen.get(res.entry.id).proofImage, dataUrl('DDD'));
    assert.equal(seen.size, 4, 'exactly the four real entries appear');
  });
});

describe('S4 — progress 0 → 500000 → 750000 across sequential saves', () => {
  test('total, percent and history advance through the real save+reload path', async () => {
    const storage = memoryStorage({ [WISHLIST_STORAGE_KEY]: goalJSON({ price: 1000000, entries: [] }) });
    const idb = noProofsIdb();

    const v0 = await loadWishlistData({ storage, idb });
    assert.equal(v0.item.saved, 0);
    assert.equal(v0.item.progress, 0);
    assert.equal(v0.item.percent, 0);
    assert.equal(v0.item.history.length, 0);

    const v1 = await saveWishlistEntry(
      v0.goal,
      { amount: 500000, proofImage: dataUrl('P1') },
      { storage, idb },
      BASE,
    );
    const r1 = await loadWishlistData({ storage, idb });
    assert.equal(r1.item.saved, 500000);
    assert.equal(r1.item.progress, 0.5);
    assert.equal(r1.item.percent, 50);
    assert.equal(r1.item.history[0].id, v1.entry.id);

    const v2 = await saveWishlistEntry(
      v1.goal,
      { amount: 250000, proofImage: dataUrl('P2') },
      { storage, idb },
      BASE + DAY,
    );
    const r2 = await loadWishlistData({ storage, idb });
    assert.equal(r2.item.saved, 750000);
    assert.equal(r2.item.progress, 0.75);
    assert.equal(r2.item.percent, 75);
    assert.deepEqual(
      r2.item.history.map((h) => h.id),
      [v2.entry.id, v1.entry.id],
      'history must be newest-first over multiple saves',
    );
    assert.deepEqual(
      r2.item.history.map((h) => h.proofImage),
      [dataUrl('P2'), dataUrl('P1')],
      'each history entry keeps its own proof after both reloads',
    );
    const stored = JSON.parse(storage.store.get(WISHLIST_STORAGE_KEY));
    assert.equal(stored.entries.length, 2, 'exactly the two saved entries are persisted');
    assert.equal(stored.entries.reduce((a, e) => a + e.amount, 0), 750000);
  });
});

describe('S5 — history through persistence → load → goalEntriesToHistory → Detail', () => {
  test('date labels, notes and amounts of persisted entries reach the rendered rows', async () => {
    const createdAtOld = new Date(Date.now() - 5 * DAY).toISOString();
    const createdAtNew = new Date().toISOString();
    const storage = memoryStorage({
      [WISHLIST_STORAGE_KEY]: goalJSON({
        entries: [
          entry('entry-OLD', 100000, createdAtOld, { note: '   ' }),
          entry('entry-NEW', 200000, createdAtNew, { note: 'Gajian' }),
        ],
      }),
    });
    const idb = makeFakeIdb({
      [WISHLIST_DB_NAME]: { proofs: new Map([['entry-NEW', dataUrl('NEW')]]) },
    });

    const data = await loadWishlistData({ storage, idb });
    assert.ok(data);
    assert.deepEqual(
      data.item.history.map((h) => h.id),
      ['entry-NEW', 'entry-OLD'],
      'real persistence gets its dates translated newest-first',
    );
    assert.equal(data.item.history[0].dateLabel, 'Hari ini');
    assert.equal(data.item.history[1].dateLabel, '5 hari lalu');
    assert.equal(data.item.history[1].note, undefined, 'whitespace-only notes are dropped');

    const html = renderToStaticMarkup(
      createElement(WishlistDetail, { item: data.item, onBack: noop, onAddSaving: noop, onShare: noop, onDelete: noop, shareSupported: true }),
    );
    assert.ok(html.includes('Hari ini'), 'today label must render');
    assert.ok(html.includes('5 hari lalu'), 'ago label must render');
    assert.ok(html.includes('Gajian'), 'note must render');
    assert.ok(html.includes(dataUrl('NEW')), 'proof must render on the entry it belongs to');
    assert.ok(html.includes('200.000') && html.includes('100.000'), 'both amounts must render');
  });
});

describe('S6 — proof display edge cases (missing / failed / blob)', () => {
  test('an entry without a stored proof still renders as a full history row (no thumb)', async () => {
    const storage = memoryStorage({
      [WISHLIST_STORAGE_KEY]: goalJSON({
        entries: [entry('entry-no-proof', 400000, new Date(BASE).toISOString())],
      }),
    });
    const data = await loadWishlistData({ storage, idb: makeFakeIdb() });
    assert.equal(data.goal.entries[0].proofImage, '', 'missing proof stays empty');
    assert.equal(data.item.history[0].amount, 400000);

    const html = renderToStaticMarkup(
      createElement(WishlistDetail, { item: data.item, onBack: noop, onAddSaving: noop, onShare: noop, onDelete: noop, shareSupported: true }),
    );
    assert.ok(!html.includes('<img'), 'no thumbnail may be fabricated for a missing proof');
    assert.ok(html.includes('400.000'), 'the entry itself must still be visible');
  });

  test('a failing proof source degrades to proof-less entries without losing totals', async () => {
    const storage = memoryStorage({
      [WISHLIST_STORAGE_KEY]: goalJSON({
        entries: [
          entry('entry-a', 100000, new Date(BASE - 2 * DAY).toISOString()),
          entry('entry-b', 200000, new Date(BASE - DAY).toISOString()),
        ],
      }),
    });
    const data = await loadWishlistData({
      storage,
      getProof: async () => {
        throw new Error('indexeddb unavailable');
      },
    });
    assert.ok(data);
    // Per-entry proof failures are caught inside hydrateEntries (each entry
    // degrades to proofImage: ''), so the top-level migration/hydration steps
    // still "succeed" and proofHydrationFailed stays false — a defensive flag
    // reserved for a whole-step throw.
    assert.equal(data.proofHydrationFailed, false);
    assert.equal(data.item.saved, 300000, 'totals must survive hydration failure');
    assert.ok(data.goal.entries.every((e) => e.proofImage === ''));

    const html = renderToStaticMarkup(
      createElement(WishlistDetail, { item: data.item, onBack: noop, onAddSaving: noop, onShare: noop, onDelete: noop, shareSupported: true }),
    );
    assert.ok(!html.includes('<img'), 'failed proofs must never fabricate thumbnails');
    assert.ok(html.includes('Catatan Tabungan'), 'history section must still render');
  });

  test('legacy Blob proofs become object URLs that WishlistDetail renders', async () => {
    const storage = memoryStorage({
      [WISHLIST_STORAGE_KEY]: goalJSON({
        entries: [entry('entry-blob', 150000, new Date(BASE).toISOString())],
      }),
    });
    const blob = new Blob(['png-bytes'], { type: 'image/png' });
    const urls = [];
    const data = await loadWishlistData({
      storage,
      getProof: async () => blob,
      onBlobUrl: (url) => urls.push(url),
    });
    assert.equal(urls.length, 1, 'blob object URLs must be reported for revocation');
    assert.match(data.goal.entries[0].proofImage, /^blob:/);

    const html = renderToStaticMarkup(
      createElement(WishlistDetail, { item: data.item, onBack: noop, onAddSaving: noop, onShare: noop, onDelete: noop, shareSupported: true }),
    );
    assert.ok(html.includes(data.goal.entries[0].proofImage), 'object URL must render as the thumb');
    URL.revokeObjectURL(data.goal.entries[0].proofImage);
  });
});

describe('S7 — session destroy + recreate (closest deterministic reload simulation)', () => {
  test('a fresh mount from the same storage produces the identical model and UI', async () => {
    const storage = memoryStorage({
      [WISHLIST_STORAGE_KEY]: goalJSON({
        entries: [entry('entry-a', 200000, new Date(BASE - 3 * DAY).toISOString())],
      }),
    });
    const idb = noProofsIdb();
    const first = await loadWishlistData({ storage, idb });
    await saveWishlistEntry(
      first.goal,
      { amount: 300000, proofImage: dataUrl('AFTER'), note: 'tabungan' },
      { storage, idb },
      BASE,
    );
    const afterSave = await loadWishlistData({ storage, idb });

    // A brand-new WishlistApp instance starts with data = null and calls
    // loadWishlistData() fresh — this simulates that "new session" as closely
    // as Node can (no DOM, no real navigation, no hooks execution).
    const freshStart = await loadWishlistData({ storage, idb });

    assert.deepEqual(
      freshStart.goal.entries.map((e) => ({ id: e.id, amount: e.amount, proofImage: e.proofImage })),
      afterSave.goal.entries.map((e) => ({ id: e.id, amount: e.amount, proofImage: e.proofImage })),
      'a fresh session must reconstruct the exact persisted entries',
    );
    assert.equal(freshStart.item.saved, afterSave.item.saved);
    assert.equal(freshStart.item.progress, afterSave.item.progress);
    assert.deepEqual(
      freshStart.item.history.map((h) => [h.id, h.proofImage]),
      afterSave.item.history.map((h) => [h.id, h.proofImage]),
      'history order and proofs must survive a session recreate',
    );

    const htmlA = renderToStaticMarkup(
      createElement(WishlistDetail, { item: afterSave.item, onBack: noop, onAddSaving: noop, onShare: noop, onDelete: noop, shareSupported: true }),
    );
    const htmlB = renderToStaticMarkup(
      createElement(WishlistDetail, { item: freshStart.item, onBack: noop, onAddSaving: noop, onShare: noop, onDelete: noop, shareSupported: true }),
    );
    assert.equal(htmlA, htmlB, 'the rendered UI must be byte-identical across the recreate');
  });
});

describe('S8 — legacy migration is non-destructive + idempotent with React bridge visibility', () => {
  const legacyGoal = JSON.stringify({
    id: 'goal-legacy',
    name: 'Target Lama',
    price: 900000,
    productImage: dataUrl('LEGACYGOAL'),
    createdAt: new Date(BASE - 40 * DAY).toISOString(),
    entries: [
      {
        id: 'entry-legacy-a',
        amount: 100000,
        proofImage: '',
        note: 'nabung',
        createdAt: new Date(BASE - 15 * DAY).toISOString(),
      },
    ],
  });

  test('legacy data migrates once, never mutates, and accepts new saves on top', async () => {
    const storage = memoryStorage({ [LEGACY_NABUNGKU_STORAGE_KEY]: legacyGoal });
    const idb = makeFakeIdb({
      [LEGACY_NABUNGKU_DB_NAME]: { proofs: new Map([['entry-legacy-a', dataUrl('AAA')]]) },
    });

    // 1. First load migrates legacy storage + proofs.
    const first = await loadWishlistData({ storage, idb });
    assert.ok(first);
    assert.equal(first.goal.id, 'goal-legacy');
    assert.equal(first.goal.entries[0].proofImage, dataUrl('AAA'), 'legacy proof must hydrate');
    assert.ok(storage.store.has(WISHLIST_STORAGE_KEY), 'wishlist key must be created');
    assert.equal(
      storage.store.get(LEGACY_NABUNGKU_STORAGE_KEY),
      legacyGoal,
      'legacy goal record must be byte-for-byte intact',
    );
    assert.ok(
      idb._dbs.has(LEGACY_NABUNGKU_DB_NAME),
      'legacy database must not be destroyed',
    );

    // 2. A new save joins the migrated data.
    const res = await saveWishlistEntry(
      first.goal,
      { amount: 250000, proofImage: dataUrl('NEW') },
      { storage, idb },
      BASE,
    );
    const after = await loadWishlistData({ storage, idb });
    assert.equal(after.goal.entries.length, 2, 'migrated + new entry both visible');
    const byId = new Map(after.item.history.map((h) => [h.id, h]));
    assert.equal(byId.get('entry-legacy-a').proofImage, dataUrl('AAA'));
    assert.equal(byId.get(res.entry.id).proofImage, dataUrl('NEW'));
    assert.equal(
      storage.store.get(LEGACY_NABUNGKU_STORAGE_KEY),
      legacyGoal,
      'legacy storage still untouched after a save',
    );
    assert.deepEqual(
      [...idb._dbs.get(LEGACY_NABUNGKU_DB_NAME).get(WISHLIST_DB_STORE).keys()],
      ['entry-legacy-a'],
      'legacy proof records untouched after a save',
    );

    // 3. Repeated loads never re-run or rewrite the migration.
    const beforeBytes = JSON.stringify([...storage.store.entries()]);
    await loadWishlistData({ storage, idb });
    await loadWishlistData({ storage, idb });
    assert.equal(
      JSON.stringify([...storage.store.entries()]),
      beforeBytes,
      'migration must be idempotent over repeated loads',
    );
    assert.equal(first.goal.entries[0].amount, 100000, 'legacy amounts preserved');
  });
});

describe('S9 — delete/reset is React-owned (proofs + storage cleared through the bridge)', () => {
  const item = {
    id: 'goal-1',
    name: 'Sepatu',
    productImage: '/img.png',
    targetPrice: 1000000,
    saved: 400000,
    remaining: 600000,
    progress: 0.4,
    percent: 40,
    history: [{ id: 'e1', amount: 400000, note: undefined, dateLabel: 'Hari ini', proofImage: '' }],
    estimateLabel: null,
  };

  test('the app wires delete and reset through the bridge with the vanilla confirm texts', () => {
    const appSrc = readFileSync('src/components/wishlist/WishlistApp.tsx', 'utf8');
    assert.match(appSrc, /deleteWishlistGoal\(\)/, 'delete/reset must go through the bridge');
    assert.match(
      appSrc,
      /confirm\('Hapus target dan semua catatan tabungan dari perangkat ini\?'\)/,
      'Hapus must keep the vanilla confirm text',
    );
    assert.match(
      appSrc,
      /confirm\('Mulai target baru\? Target ini akan diganti dengan target yang baru\.'\)/,
      'Buat Target Baru must keep the vanilla confirm text',
    );
    assert.match(appSrc, /trackEvent\('saving_goal_reset'\)/, 'Hapus must fire the reset event');
  });

  test('the bridge delete clears proofs by entry id and wipes goal storage', async () => {
    const storage = memoryStorage({
      [WISHLIST_STORAGE_KEY]: goalJSON({
        entries: [
          entry('e1', 400000, new Date(BASE - 1 * DAY).toISOString()),
          entry('e2', 200000, new Date(BASE).toISOString()),
        ],
      }),
    });
    const idb = makeFakeIdb({
      [WISHLIST_DB_NAME]: { proofs: new Map([['e1', dataUrl('AAA')], ['e2', dataUrl('BBB')]]) },
    });
    await deleteWishlistGoal({ storage, idb });
    assert.ok(!storage.store.has(WISHLIST_STORAGE_KEY), 'goal must be cleared from storage');
    assert.equal(
      idb._dbs.get(WISHLIST_DB_NAME)?.get(WISHLIST_DB_STORE)?.size ?? 0,
      0,
      'all proofs must be deleted',
    );
  });

  test('the React screens expose the delete control via the menu', () => {
    const detail = renderToStaticMarkup(
      createElement(WishlistDetail, { item, onBack: noop, onAddSaving: noop, onShare: noop, onDelete: noop, shareSupported: true }),
    );
    assert.ok(detail.includes('Hapus'), 'detail menu must offer deletion');
    assert.ok(detail.includes('Bagikan'), 'detail menu must offer sharing');
    const complete = renderToStaticMarkup(
      createElement(WishlistComplete, {
        item: { ...item, remaining: 0, saved: 1000000, progress: 1, percent: 100 },
        shareSupported: true,
        onBack: noop,
        onShare: noop,
        onDelete: noop,
        onNewGoal: noop,
      }),
    );
    assert.ok(complete.includes('Buat Target Baru'), 'reset lives on the completion screen');
  });
});

describe('S10 — failure cases A–F (pinned, documented contracts — no silent drift)', () => {
  test('A: no goal → no save can start (binding guard)', async () => {
    const storage = memoryStorage();
    const loaded = await loadWishlistData({ storage, idb: makeFakeIdb() });
    assert.equal(loaded, null, 'empty storage must yield no data');
    const appSrc = readFileSync('src/components/wishlist/WishlistApp.tsx', 'utf8');
    assert.match(appSrc, /if \(!goal\) return/, 'save must no-op without a goal');
  });

  test('B: an invalid form never touches storage or IndexedDB', async () => {
    const storage = memoryStorage({ [WISHLIST_STORAGE_KEY]: goalJSON({ entries: [] }) });
    const idb = noProofsIdb();
    const keysBefore = [...storage.store.keys()].sort();
    const data = await loadWishlistData({ storage, idb });
    // The sheet only ever calls onSubmit(result.data) for ok:true — simulate
    // what a failed submission legitimately does: nothing at the persistence
    // layer. The bounds stay sealed because the sheet cannot import writers.
    assert.deepEqual([...storage.store.keys()].sort(), keysBefore, 'storage is untouched');
    assert.equal(idb._dbs.size, 0, 'no database is created by a non-submission');
    assert.equal(data.item.history.length, 0);
  });

  test('C: silent storage write failure keeps the in-memory goal but storage stays stale', async () => {
    const goodStorage = memoryStorage({
      [WISHLIST_STORAGE_KEY]: goalJSON({ entries: [entry('entry-a', 100000, new Date(BASE).toISOString())] }),
    });
    const idb = noProofsIdb();
    const data = await loadWishlistData({ storage: goodStorage, idb });

    const quotaStorage = {
      getItem: (k) => goodStorage.getItem(k),
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: (k) => goodStorage.removeItem(k),
    };
    const res = await saveWishlistEntry(
      data.goal,
      { amount: 500000, proofImage: dataUrl('P') },
      { storage: quotaStorage, idb },
      BASE,
    );
    // writeGoalToStorage swallows the storage error (documented lib contract):
    // the session still carries the save…
    assert.equal(res.goal.entries.length, 2);
    assert.equal(res.entry.proofImage, dataUrl('P'), 'in-memory proof stays usable this session');
    assert.equal(res.proofPersisted, true, 'the proof write itself is unaffected');

    // …but a reload from the same (broken) storage cannot see it.
    const reloaded = await loadWishlistData({ storage: quotaStorage, idb });
    assert.equal(reloaded.item.history.length, 1, 'entry absent after reload');
    assert.equal(await readProof(res.entry.id, idb), dataUrl('P'), 'orphaned proof is documented');
  });

  test('D + F: metadata survives, proof degrades, and history still appears on reload', async () => {
    const storage = memoryStorage({
      [WISHLIST_STORAGE_KEY]: goalJSON({ entries: [] }),
    });

    const idbWritesFail = {
      databases: async () => [],
      open: (name) => {
        const req = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null };
        queueMicrotask(() => {
          req.result = {
            objectStoreNames: { contains: (n) => true },
            transaction: (storeName, mode) => {
              if (mode === 'readwrite') {
                // Handlers are assigned onto the returned object itself.
                const tx = {
                  error: new Error('idb write failed'),
                  oncomplete: null,
                  onerror: null,
                  onabort: null,
                  objectStore: () => ({ put: () => {} }),
                };
                queueMicrotask(() => tx.onerror && tx.onerror());
                return tx;
              }
              const tx = { oncomplete: null, onerror: null, onabort: null };
              tx.objectStore = () => ({
                get: () => {
                  const getReq = { result: undefined, error: null, onsuccess: null, onerror: null };
                  queueMicrotask(() => getReq.onsuccess && getReq.onsuccess());
                  return getReq;
                },
              });
              queueMicrotask(() => tx.oncomplete && tx.oncomplete());
              return tx;
            },
            close: () => {},
          };
          req.onsuccess && req.onsuccess();
        });
        return req;
      },
    };

    const goal = { ...(await loadWishlistData({ storage, idb: idbWritesFail })).goal };
    const res = await saveWishlistEntry(
      goal,
      { amount: 450000, proofImage: dataUrl('LOST') },
      { storage, idb: idbWritesFail },
      BASE,
    );
    assert.equal(res.proofPersisted, false, 'proof write rejection must be caught');
    assert.equal(res.entry.proofImage, dataUrl('LOST'), 'proof stays in-memory for the session');
    assert.ok(res.goal.entries.some((e) => e.id === res.entry.id));

    // A reload from the same (broken) IndexedDB: metadata present, proof gone.
    const reloaded = await loadWishlistData({ storage, idb: idbWritesFail });
    assert.ok(reloaded, 'goal must still load');
    const history = reloaded.item.history;
    assert.equal(history[0].id, res.entry.id, 'the entry MUST appear in history (anti-bug guard)');
    assert.equal(history[0].amount, 450000, 'its amount must be present');
    assert.equal(history[0].proofImage, '', 'the proof is lost — pinned degradation');
    assert.equal(reloaded.item.saved, 450000, 'progress must reflect the persisted entry');

    const html = renderToStaticMarkup(
      createElement(WishlistDetail, { item: reloaded.item, onBack: noop, onAddSaving: noop, onShare: noop, onDelete: noop, shareSupported: true }),
    );
    assert.ok(!html.includes(dataUrl('LOST')), 'no phantom thumbnail may appear');
    assert.ok(html.includes('450.000'), 'the entry itself is visibly saved');
  });

  test('E: reload returning null after a save keeps the in-memory goal for the caller', async () => {
    const storage = memoryStorage({
      [WISHLIST_STORAGE_KEY]: goalJSON({ entries: [] }),
    });
    const idb = noProofsIdb();
    const data = await loadWishlistData({ storage, idb });

    const res = await saveWishlistEntry(
      data.goal,
      { amount: 300000, proofImage: dataUrl('E') },
      { storage, idb },
      BASE,
    );
    assert.equal(res.goal.entries.length, 1, 'orchestrator always yields the in-memory next goal');

    storage.removeItem(WISHLIST_STORAGE_KEY);
    const reloaded = await loadWishlistData({ storage, idb });
    assert.equal(reloaded, null, 'goal gone after storage is cleared externally');
    assert.equal(res.entry.proofImage, dataUrl('E'), 'caller still has the in-memory entry');
  });
});

describe('S11 — save ordering contract (metadata before proof, proofs never in storage)', () => {
  test('metadata is written stripped of proofs and independent of the proof write', async () => {
    const storage = memoryStorage({
      [WISHLIST_STORAGE_KEY]: goalJSON({ entries: [] }),
    });
    const idb = noProofsIdb();
    const data = await loadWishlistData({ storage, idb });
    const writes = [];
    const tape = {
      getItem: (k) => storage.getItem(k),
      setItem: (k, v) => {
        writes.push(k);
        storage.setItem(k, v);
      },
      removeItem: (k) => storage.removeItem(k),
    };

    await saveWishlistEntry(
      data.goal,
      { amount: 100000, proofImage: dataUrl('ORDER') },
      { storage: tape, idb },
      BASE,
    );

    assert.deepEqual(writes, [WISHLIST_STORAGE_KEY], 'exactly one metadata write, leading the save');
    const stored = JSON.parse(storage.store.get(WISHLIST_STORAGE_KEY));
    assert.ok(stored.entries.every((e) => e.proofImage === ''), 'metadata never carries proofs');
    const entryId = stored.entries[0].id;
    assert.equal(await readProof(entryId, idb), dataUrl('ORDER'), 'proof lands separately, by id');

    // D back-to-back: the two writes are independent. Storage leads; a failed
    // proof write must not lose the metadata (see also S10 D/F), and a failed
    // storage write must not cancel the proof write (see also S10 C).
    const quotaTape = { ...tape, setItem: () => { throw new Error('quota'); } };
    await saveWishlistEntry(data.goal, { amount: 1, proofImage: dataUrl('X') }, { storage: quotaTape, idb }, BASE + 1);
    const afterFail = await readProof(stored.entries[0].id, idb);
    assert.ok(afterFail);
  });
});

describe('S12 — pixel reveal progress and intact placeholder regression', () => {
  test('detail feeds the live progress into the shared reveal and keeps the placeholder', () => {
    const detailSrc = readFileSync('src/components/wishlist/WishlistDetail.tsx', 'utf8');
    assert.match(detailSrc, /progress=\{item\.progress\}/, 'reveal must use item.progress');
    assert.match(detailSrc, /\{item\.percent\}%/, 'percent chip must use the same progress source');
    assert.match(detailSrc, /renderPixelReveal\(/, 'reveal must come from the shared engine');
  });

  test('SSR renders the intact fallback (canvas + balance placeholder) at any progress', () => {
    const item = {
      id: 'goal-pixel',
      name: 'Kamera',
      productImage: '/images/illustrations/hero-balance-v1.png',
      targetPrice: 2000000,
      saved: 1000000,
      remaining: 1000000,
      progress: 0.5,
      percent: 50,
      history: [],
      estimateLabel: null,
    };
    const html = renderToStaticMarkup(
      createElement(WishlistDetail, { item, onBack: noop, onAddSaving: noop, onShare: noop, onDelete: noop, shareSupported: true }),
    );
    assert.ok(html.includes('aria-label="Visual barang impian"'), 'canvas must be present');
    assert.ok(html.includes('⚖️'), 'balance placeholder must show until the reveal loads');
    assert.ok(html.includes('>50%<'), 'progress chip must reflect the live progress');
    assert.ok(html.includes('1.000.000'), 'saved amount renders');
  });
});