/**
 * CekDulu — Wishlist
 *
 * Pure, SSR-safe logic for the personal saving journey: no browser-only APIs
 * outside the explicitly guarded storage helpers. Calculation and persistence
 * rules here are testable in Node without a DOM.
 *
 * PRIVACY: proof images (screenshot mobile banking / e-wallet, bukti transfer)
 * are stored ONLY in browser IndexedDB. They are never uploaded, never sent to
 * analytics, and never placed into URLs. Analytics only ever receives coarse
 * bucketed data.
 */

// ---- data model ----

export interface SavingEntry {
  id: string;
  amount: number;
  /** data URL (compressed JPEG), stored in IndexedDB, never sent anywhere. */
  proofImage: string;
  note?: string;
  createdAt: string;
}

export interface SavingGoal {
  id: string;
  name?: string;
  /** Target price (Rp). */
  price: number;
  /** data URL of the desired product image. */
  productImage: string;
  createdAt: string;
  entries: SavingEntry[];
}

export const WISHLIST_STORAGE_KEY = 'cekdulu_wishlist_goal';
export const WISHLIST_DB_NAME = 'cekdulu_wishlist';
export const WISHLIST_DB_STORE = 'proofs';
export const WISHLIST_IMAGE_MAX_MB = 5;
export const WISHLIST_IMAGE_COMPRESS_MB = 2;
export const WISHLIST_IMAGE_MAX_EDGE = 1600;

/**
 * Legacy "nabungku" namespace. Kept read-only as the source for an automatic,
 * one-way migration into the wishlist namespace. Old data is never destroyed:
 * records are copied (not moved), and the legacy database/key are preserved so
 * a failed migration can never lose user data.
 */
export const LEGACY_NABUNGKU_STORAGE_KEY = 'cekdulu_nabungku_goal';
export const LEGACY_NABUNGKU_DB_NAME = 'cekdulu_nabungku';

// ---- progress ----

export function clamp(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function goalProgress(goal: SavingGoal): number {
  const total = totalSaved(goal);
  if (total <= 0 || goal.price <= 0) return 0;
  return clamp(total / goal.price);
}

export function totalSaved(goal: SavingGoal): number {
  return goal.entries.reduce((acc, e) => acc + Math.max(0, e.amount || 0), 0);
}

export function availableTarget(goal: SavingGoal): number {
  return Math.max(0, goal.price);
}

/** Remaining amount, floored at 0. Never shows negative or >100% progress. */
export function remainingAmount(goal: SavingGoal): number {
  return Math.max(0, goal.price - totalSaved(goal));
}

export function goalSavedDisplay(goal: SavingGoal): number {
  return Math.min(totalSaved(goal), goal.price);
}

// ---- milestones ----

export const MILESTONES = [0.25, 0.5, 0.75, 1] as const;

export const MILESTONE_LABELS: Record<number, string> = {
  0.25: 'Mulai terlihat',
  0.5: 'Setengah jalan',
  0.75: 'Hampir sampai',
  1: 'Impian tercapai',
};

export function milestoneMessage(progress: number): string {
  if (progress >= 1) return 'Impian tercapai! Barang impianmu sudah jadi nyata.';
  if (progress >= 0.75) return 'Hampir sampai. Sedikit lagi barang impianmu jadi nyata.';
  if (progress >= 0.5) return 'Setengah jalan. Pertahankan ritme menabungmu.';
  if (progress >= 0.25) return 'Mulai terlihat. Kumpulkan terus tabunganmu.';
  // No message before the first milestone; the dashboard omits the box entirely.
  return '';
}

export function milestonePercent(progress: number): number {
  const p = clamp(progress);
  return p === 1 ? 100 : Math.floor(p * 100 / 25) * 25;
}

// ---- automatic estimate ----

export function averagePerDay(entries: SavingEntry[]): number {
  const sorted = [...entries]
    .filter((e) => Number.isFinite(e.amount) && e.amount > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return Math.max(0, sorted[0].amount);

  const first = new Date(sorted[0].createdAt).getTime();
  const last = new Date(sorted[sorted.length - 1].createdAt).getTime();
  const days = (last - first) / 86_400_000;
  if (!Number.isFinite(days) || days <= 0) return 0;

  const total = sorted.reduce((acc, e) => acc + Math.max(0, e.amount), 0);
  return total / days;
}

export interface SavingEstimate {
  kind: 'insufficient' | 'consistent' | 'inconsistent';
  /** Average saving per day in rupiah. */
  rate: number;
  /** True when the average is computed strictly from a rate (not from a mean). */
  rateBased: boolean;
  days: number;
  weeks: number;
  months: number;
}

/**
 * Estimate how long until the goal is reached. The system NEVER asks the user
 * for a target date; everything below is derived from actual saving history.
 *
 * - <3 entries            → insufficient (do not fake precision)
 * - 3+ entries but flat or
 *   wildly irregular rate → inconsistent (do not blame the user)
 * - otherwise             → consistent, rate-based projection
 */
export function estimateSaving(goal: SavingGoal): SavingEstimate {
  const entries = goal.entries;
  const remaining = remainingAmount(goal);

  const empty: SavingEstimate = { kind: 'insufficient', rate: 0, rateBased: false, days: 0, weeks: 0, months: 0 };
  if (remaining <= 0) return { kind: 'consistent', rate: 0, rateBased: false, days: 0, weeks: 0, months: 0 };

  if (entries.length < 3) return empty;

  const sorted = [...entries]
    .filter((e) => Number.isFinite(e.amount) && e.amount > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (sorted.length < 3) return empty;

  const first = new Date(sorted[0].createdAt).getTime();
  const last = new Date(sorted[sorted.length - 1].createdAt).getTime();
  const spanDays = (last - first) / 86_400_000;
  if (!Number.isFinite(spanDays) || spanDays <= 0) {
    // All records on the same day — not enough rhythm to project.
    const single = avgOf(sorted.map((e) => e.amount));
    if (!(single > 0)) return empty;
    const fallback = remaining / single;
    return buildEstimate(single, fallback);
  }

  const total = sorted.reduce((acc, e) => acc + Math.max(0, e.amount), 0);
  const rate = total / spanDays;
  if (!(rate > 0)) return empty;

  const mean = avgOf(sorted.map((e) => e.amount));
  const deviation = mean > 0 ? stdDev(sorted.map((e) => e.amount)) / mean : Infinity;
  if (spanDays >= 2 && deviation >= 1.5) {
    return { kind: 'inconsistent', rate, rateBased: true, days: 0, weeks: 0, months: 0 };
  }

  return buildEstimate(rate, remaining / rate);
}

function avgOf(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = avgOf(values);
  const variance = avgOf(values.map((v) => (v - mean) * (v - mean)));
  return Math.sqrt(variance);
}

function buildEstimate(rate: number, days: number): SavingEstimate {
  const d = Math.max(0, Math.ceil(days));
  return {
    kind: 'consistent',
    rate,
    rateBased: true,
    days: d,
    weeks: Math.floor(d / 7),
    months: Math.max(1, Math.floor(d / 30)),
  };
}

// ---- date formatting ----

export function onboardingDateLabel(createdAt: string): string {
  return formatDayDate(createdAt);
}

/** "5 Sep 2026" using the local clock. */
export function formatDayDate(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.getMonth()] ?? '';
  return `${day} ${month} ${d.getFullYear()}`;
}

/** Human-friendly Indonesian label: "Hari ini", "Kemarin", "5 hari lalu". */
export function relativeDayLabel(createdAt: string, today: number = Date.now()): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  const startOf = (ts: number) => Math.floor(ts / 86_400_000);
  const diff = startOf(today) - startOf(d.getTime());
  if (diff <= 0) return 'Hari ini';
  if (diff === 1) return 'Kemarin';
  return `${diff} hari lalu`;
}

/** "Perkiraan X hari lagi"-ready label derived from a consistent estimate. */
export function estimateLabel(estimate: SavingEstimate): string {
  if (estimate.kind !== 'consistent') return '';
  if (estimate.days <= 0) return 'Hampir tercapai';
  if (estimate.days <= 3) return 'Beberapa hari lagi';
  if (estimate.days < 90) return `${estimate.days} hari lagi`;
  const months = Math.round(estimate.days / 30);
  return `± ${Math.max(1, months)} bulan lagi`;
}

// ---- money formatting (used by React + vanilla for the same input UX) ----

/** Formats a raw string into thousands-separated ID display, e.g. "1.500.000". */
export function formatMoney(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('id-ID') : '';
}

/** Parses a display string (with separators) back into a plain number. */
export function parseMoney(raw: string | undefined): number {
  const n = Number(String(raw || '').replace(/\D/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// ---- image handling (plain browser APIs: canvas + data URLs) ----

export type ImageValidation = { ok: true } | { ok: false; message: string };

export function validateImageFile(file: { type?: string; size?: number }): ImageValidation {
  if (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return { ok: false, message: 'Format gambar didukung: JPG, PNG, atau WebP.' };
  }
  if (typeof file.size === 'number' && file.size > WISHLIST_IMAGE_MAX_MB * 1024 * 1024) {
    return { ok: false, message: 'Ukuran gambar terlalu besar. Coba gunakan gambar yang lebih kecil.' };
  }
  return { ok: true };
}

export function pickLabel(value?: string | null, fallback = 'Barang impian'): string {
  const name = (value ?? '').trim();
  return name ? name : fallback;
}

/**
 * Downscales an image to a compact JPEG data URL for local storage.
 * Small files are read as-is (fast path); larger ones are drawn onto a
 * canvas capped at WISHLIST_IMAGE_MAX_EDGE and re-encoded as JPEG 0.82.
 *
 * Never rejects: any processing failure resolves to `''` so callers can run
 * the same `if (!proofImage)` guard (this is the shared contract used by
 * both the vanilla page and the React saving sheet).
 */
export function compressImage(
  file: File,
  maxBytes: number = WISHLIST_IMAGE_COMPRESS_MB * 1024 * 1024
): Promise<string> {
  return new Promise((resolve) => {
    if (file.size <= maxBytes) {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let tw = img.naturalWidth;
        let th = img.naturalHeight;
        const longest = Math.max(tw, th);
        if (longest > WISHLIST_IMAGE_MAX_EDGE) {
          const k = WISHLIST_IMAGE_MAX_EDGE / longest;
          tw = Math.round(tw * k);
          th = Math.round(th * k);
        }
        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve('');
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0, tw, th);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      } catch {
        URL.revokeObjectURL(url);
        resolve('');
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };
    img.src = url;
  });
}

// ---- proof hydration (IndexedDB → entries) ----

export type ProofGetter = (entryId: string) => Promise<unknown>;

export interface HydrateOptions {
  /**
   * Called with every object URL created from a stored Blob so the caller can
   * revoke them when they are no longer displayed. Data-URL strings never
   * produce object URLs.
   */
  onBlobUrl?: (url: string) => void;
}

/**
 * The single IndexedDB connection abstraction for wishlist proofs. Both the
 * vanilla page and the React data bridge share this — never re-implement
 * `indexedDB.open` per module.
 */
export function openProofsDatabase(idbOverride?: IDBFactory): Promise<IDBDatabase> {
  const idb = idbOverride ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!idb) return Promise.reject(new Error('IndexedDB unavailable'));
  return new Promise((resolve, reject) => {
    const req = idb.open(WISHLIST_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(WISHLIST_DB_STORE)) {
        req.result.createObjectStore(WISHLIST_DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Store one proof record keyed BY ENTRY ID. Values are data-URL strings
 * (compressed on-device), matching what the vanilla page writes today and what
 * hydrateEntries accepts. Mirrors the vanilla in-page transaction, kept here so
 * the React layer writes through the same connection abstraction.
 */
export async function writeProofToDatabase(
  entryId: string,
  value: string,
  idbOverride?: IDBFactory
): Promise<void> {
  const db = await openProofsDatabase(idbOverride);
  return await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(WISHLIST_DB_STORE, 'readwrite');
    tx.objectStore(WISHLIST_DB_STORE).put(value, entryId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error('proof write aborted'));
    };
  });
}

/**
 * Delete one proof record from IndexedDB keyed BY ENTRY ID. Mirrors
 * writeProofToDatabase's connection/open-close contract so the delete path of
 * the React bridge reuses the same single connection abstraction. Cleanup
 * failures are the caller's concern (deletion should never block).
 */
export async function deleteProofFromDatabase(
  entryId: string,
  idbOverride?: IDBFactory
): Promise<void> {
  const db = await openProofsDatabase(idbOverride);
  return await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(WISHLIST_DB_STORE, 'readwrite');
    tx.objectStore(WISHLIST_DB_STORE).delete(entryId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error('proof delete aborted'));
    };
  });
}

/**
 * Read one proof record from IndexedDB keyed BY ENTRY ID. The database is
 * opened and closed per read, exactly like the vanilla implementation. A
 * missing record resolves to `undefined`; callers (hydrateEntries) treat that
 * as "no proof".
 */
export async function readProof(entryId: string, idbOverride?: IDBFactory): Promise<unknown> {
  const db = await openProofsDatabase(idbOverride);
  return await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(WISHLIST_DB_STORE, 'readonly');
    const req = tx.objectStore(WISHLIST_DB_STORE).get(entryId);
    req.onsuccess = () => {
      db.close();
      resolve(req.result);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

/**
 * Resolve each entry's proof from a store keyed BY ENTRY ID (never array
 * index). Proofs are stored as data-URL strings (current writer) or as Blobs
 * (defensive read): both end up as an <img>-usable "proofUrl" on the entry.
 *
 * Missing/unreadable proofs are skipped so the entry is still rendered; only
 * the thumbnail is absent. This is the single source of truth used both at
 * initial load and by tests, so mapping by entry.id is guaranteed.
 */
export async function hydrateEntries(
  entries: SavingEntry[],
  getProof: ProofGetter,
  options: HydrateOptions = {}
): Promise<void> {
  await Promise.all(
    entries.map(async (e) => {
      let data: unknown;
      try {
        data = await getProof(e.id);
      } catch {
        return;
      }
      if (typeof data === 'string' && data) {
        e.proofImage = data;
        return;
      }
      if (typeof Blob !== 'undefined' && data instanceof Blob) {
        const url = URL.createObjectURL(data);
        e.proofImage = url;
        options.onBlobUrl?.(url);
      }
    })
  );
}

export function createWishlistId(prefix: string, now: number = Date.now()): string {
  return `${prefix}${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---- persistence (browser-only, guarded so the module stays SSR-safe) ----

export function readGoalFromStorage(storage?: StorageLike | null): SavingGoal | null {
  const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!s) return null;
  try {
    const raw = s.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavingGoal>;
    if (!parsed || typeof parsed.price !== 'number' || typeof parsed.productImage !== 'string') {
      return null;
    }
    const entries = Array.isArray(parsed.entries) ? (parsed.entries as SavingEntry[]) : [];
    return {
      id: typeof parsed.id === 'string' ? parsed.id : createWishlistId('goal-'),
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      price: parsed.price,
      productImage: parsed.productImage,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
      entries,
    };
  } catch {
    return null;
  }
}

export function writeGoalToStorage(goal: SavingGoal, storage?: StorageLike | null): void {
  const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!s) return;
  try {
    s.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(goal));
  } catch {
    // Storage unavailable (private mode / quota) — the session still works in-memory.
  }
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Copy legacy "nabungku" goal data into the wishlist key. Idempotent and
 * non-destructive:
 *
 * - only runs when the legacy key holds data,
 * - never runs when the wishlist key already holds data (new data wins),
 * - the legacy key is left in place, so a failed write cannot lose anything.
 */
export function migrateLegacyGoalFromStorage(storage?: StorageLike | null): boolean {
  const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!s) return false;
  try {
    const legacy = s.getItem(LEGACY_NABUNGKU_STORAGE_KEY);
    if (!legacy) return false;
    if (s.getItem(WISHLIST_STORAGE_KEY) !== null) return false;
    s.setItem(WISHLIST_STORAGE_KEY, legacy);
    return true;
  } catch {
    return false;
  }
}

export function clearGoalFromStorage(storage?: StorageLike | null): void {
  const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!s) return;
  try {
    s.removeItem(WISHLIST_STORAGE_KEY);
    // Also clear the legacy key so a stale "nabungku" goal can never be
    // re-migrated and resurrected after the user deletes their wishlist.
    s.removeItem(LEGACY_NABUNGKU_STORAGE_KEY);
  } catch {
    // Ignore — nothing to clean up.
  }
}

// ---- legacy IndexedDB proof migration ----

function openIdbToMigrate(
  idb: IDBFactory,
  name: string,
  storeName: string
): Promise<{ db: IDBDatabase | null; created: boolean }> {
  return new Promise((resolve, reject) => {
    const req = idb.open(name, 1);
    let created = false;
    req.onupgradeneeded = () => {
      created = true;
      if (!req.result.objectStoreNames.contains(storeName)) {
        req.result.createObjectStore(storeName);
      }
    };
    req.onsuccess = () => resolve({ db: req.result, created });
    req.onerror = () => reject(req.error);
  });
}

function readStoreRecords(db: IDBDatabase, storeName: string): Promise<{ key: IDBValidKey; value: unknown }[]> {
  return new Promise((resolve, reject) => {
    const records: { key: IDBValidKey; value: unknown }[] = [];
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        records.push({ key: cursor.key, value: cursor.value });
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve(records);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('indexeddb transaction aborted'));
  });
}

/**
 * Copy legacy "nabungku" proof records (keyed by entry id) into the wishlist
 * IndexedDB database. Safe to run repeatedly:
 *
 * - returns false when there is no legacy database or it holds no records,
 * - an existing record at the same key in the wishlist store is never
 *   overwritten (last write to the legacy store loses),
 * - the legacy database is left untouched.
 */
export async function migrateLegacyProofs(idbOverride?: IDBFactory): Promise<boolean> {
  const idb = idbOverride ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!idb) return false;

  if (typeof idb.databases === 'function') {
    try {
      const dbs = await idb.databases();
      if (!dbs.some((d) => d.name === LEGACY_NABUNGKU_DB_NAME)) return false;
    } catch {
      // Existence will be inferred from the upgrade event below instead.
    }
  }

  let legacy: IDBDatabase | null = null;
  let next: IDBDatabase | null = null;
  try {
    const legacyHandle = await openIdbToMigrate(idb, LEGACY_NABUNGKU_DB_NAME, WISHLIST_DB_STORE);
    legacy = legacyHandle.db;
    if (!legacy || legacyHandle.created) {
      legacy?.close();
      return false;
    }
    const records = await readStoreRecords(legacy, WISHLIST_DB_STORE);
    if (records.length === 0) return false;

    const nextHandle = await openIdbToMigrate(idb, WISHLIST_DB_NAME, WISHLIST_DB_STORE);
    next = nextHandle.db;
    if (!next) return false;

    const existing = await readStoreRecords(next, WISHLIST_DB_STORE);
    const existingKeys = new Set(existing.map((r) => r.key));
    const missing = records.filter((r) => !existingKeys.has(r.key));
    if (missing.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = next!.transaction(WISHLIST_DB_STORE, 'readwrite');
        const store = tx.objectStore(WISHLIST_DB_STORE);
        for (const r of missing) store.put(r.value, r.key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('indexeddb transaction aborted'));
      });
    }
    return missing.length > 0;
  } catch {
    return false;
  } finally {
    legacy?.close();
    next?.close();
  }
}