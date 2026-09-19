import {
  clearGoalFromStorage,
  createWishlistId,
  deleteProofFromDatabase,
  migrateLegacyGoalFromStorage,
  readGoalFromStorage,
  migrateLegacyProofs,
  hydrateEntries,
  readProof,
  writeGoalToStorage,
  writeProofToDatabase,
  type ProofGetter,
  type SavingEntry,
  type SavingGoal,
  type StorageLike,
} from '../../lib/wishlist';
import { goalToWishlistItem, type WishlistItem } from './item';
import type { SaveEntryFormData } from './SavingBottomSheet';

/**
 * React-facing wishlist data model.
 *
 * `goal` is the persisted SavingGoal (reused from the persistence layer, no
 * duplicate schema) with entries ALREADY hydrated with their proofImages.
 * `item` is the Step 4 view-model for the List/Detail UI, derived from that
 * same hydrated goal so proofs reach the UI through one consistent path.
 *
 * This module is the ONLY persistence interface the React UI talks to:
 * reads flow through loadWishlistData() and writes through
 * saveWishlistEntry(), so the component layer never touches localStorage or
 * IndexedDB directly.
 */
export interface WishlistData {
  goal: SavingGoal;
  item: WishlistItem;
  /** Internal debug flag: true when proof hydration (or its migration) failed. */
  proofHydrationFailed: boolean;
}

export interface LoadWishlistDataOptions {
  /** Test seam for localStorage. Defaults to `window.localStorage`. */
  storage?: StorageLike | null;
  /** Test seam for IndexedDB. Defaults to the browser `indexedDB`. */
  idb?: IDBFactory | null;
  /**
   * Test seam for the proof source. Defaults to the shared `readProof`
   * helper (IndexedDB keyed by entry.id). Pass a map-backed getter in tests
   * to exercise the bridge without a real database engine.
   */
  getProof?: ProofGetter | null;
  /** Forwarded to hydrateEntries to revoke object URLs created from Blobs. */
  onBlobUrl?: (url: string) => void;
}

/**
 * Read-only data bridge for the React wishlist view:
 *
 *   migrate legacy localStorage (if needed)
 *        ↓
 *   read goal from localStorage
 *        ↓
 *   migrate + load proof records from IndexedDB
 *        ↓
 *   hydrate each entry's proofImage BY ENTRY ID
 *        ↓
 *   return one complete React-facing model (or null when there is no goal)
 *
 * This is the ONLY persistence reader the React UI talks to. It never writes
 * to localStorage or IndexedDB, and it never alters the vanilla
 * implementation's runtime behavior.
 *
 * Errors never throw: a goal in localStorage survives even when IndexedDB is
 * unavailable — entries stay valid, only their proofImages remain unset.
 */
export async function loadWishlistData(
  options: LoadWishlistDataOptions = {},
): Promise<WishlistData | null> {
  migrateLegacyGoalFromStorage(options.storage ?? null);
  const goal = readGoalFromStorage(options.storage ?? null);
  if (!goal) return null;

  let proofHydrationFailed = false;
  try {
    await migrateLegacyProofs(options.idb ?? undefined);
  } catch {
    proofHydrationFailed = true;
  }

  const getProof: ProofGetter =
    options.getProof ??
    ((entryId: string) => readProof(entryId, options.idb ?? undefined));

  try {
    await hydrateEntries(goal.entries, getProof, { onBlobUrl: options.onBlobUrl });
  } catch {
    proofHydrationFailed = true;
  }

  return {
    goal,
    item: goalToWishlistItem(goal),
    proofHydrationFailed,
  };
}

export interface SaveWishlistEntryOptions
  extends Pick<LoadWishlistDataOptions, 'storage' | 'idb'> {}

export interface SaveWishlistEntryResult {
  /** The next in-memory goal (always includes the new entry). */
  goal: SavingGoal;
  /** The freshly created entry, proof hydrated in-memory. */
  entry: SavingEntry;
  /** True when the proof was durably written to IndexedDB. */
  proofPersisted: boolean;
}

export interface CreateWishlistGoalData {
  /** Display name. Empty/whitespace keeps the goal anonymous ("Barang impian"). */
  name: string;
  /** Target price in rupiah (validated by the form before it reaches here). */
  price: number;
  /** Compressed data URL of the desired product image. */
  productImage: string;
}

export interface CreateWishlistGoalOptions
  extends Pick<LoadWishlistDataOptions, 'storage'> {}

/**
 * Create-goal orchestration for the React wishlist view — the write bridge
 * counterpart of the vanilla landing's startGoal(). Builds a fresh empty goal,
 * persists its metadata to localStorage, and returns it (the app then reloads
 * the hydrated view through loadWishlistData()).
 */
export function createWishlistGoal(
  data: CreateWishlistGoalData,
  options: CreateWishlistGoalOptions = {},
  now: number = Date.now(),
): SavingGoal {
  const goal: SavingGoal = {
    id: createWishlistId('goal-', now),
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : undefined,
    price: data.price,
    productImage: data.productImage,
    createdAt: new Date(now).toISOString(),
    entries: [],
  };
  writeGoalToStorage(goal, options.storage ?? null);
  return goal;
}

export interface DeleteWishlistGoalOptions
  extends Pick<LoadWishlistDataOptions, 'storage' | 'idb'> {}

/**
 * Delete/reset orchestration for the React wishlist view — the write bridge
 * counterpart of the vanilla Hapus / "Buat Target Baru" flows. Removes every
 * entry's proof from IndexedDB (best-effort: cleanup failures never block) and
 * clears the goal from storage (wishlist + legacy key, mirroring
 * clearGoalFromStorage) so a stale legacy record can never resurrect it.
 */
export async function deleteWishlistGoal(
  options: DeleteWishlistGoalOptions = {},
): Promise<void> {
  const goal = readGoalFromStorage(options.storage ?? null);
  const ids = goal ? goal.entries.map((e) => e.id) : [];
  for (const id of ids) {
    try {
      await deleteProofFromDatabase(id, options.idb ?? undefined);
    } catch {
      // Ignore cleanup failures.
    }
  }
  clearGoalFromStorage(options.storage ?? null);
}

/**
 * Save orchestration for the React wishlist view — the write counterpart of
 * loadWishlistData. The ordering mirrors the vanilla page's addEntry() so both
 * implementations share the same durability contract:
 *
 *   1. append the entry to the in-memory goal,
 *   2. persist the metadata WITHOUT proofs (the persist() contract: proofs are
 *      large data URLs, kept in IndexedDB) — the authoritative durable record,
 *      so a later proof-write failure can never lose the entry itself,
 *   3. best-effort IndexedDB proof write keyed BY ENTRY ID — a failure keeps
 *      the proof in-memory for this session and never blocks the save,
 *   4. hydrate the in-memory entry so this session can render its proof even
 *      when the IndexedDB write failed.
 *
 * The app refreshes the visible model through loadWishlistData() after a save,
 * so the screen always shows the same hydrated read a reload produces.
 */
export async function saveWishlistEntry(
  goal: SavingGoal,
  formData: SaveEntryFormData,
  options: SaveWishlistEntryOptions = {},
  now: number = Date.now(),
): Promise<SaveWishlistEntryResult> {
  const entry: SavingEntry = {
    id: createWishlistId('entry-', now),
    amount: formData.amount,
    proofImage: '',
    note: formData.note,
    createdAt: new Date(now).toISOString(),
  };
  const nextGoal = { ...goal, entries: [...goal.entries, entry] };
  writeGoalToStorage(
    {
      ...nextGoal,
      entries: nextGoal.entries.map((e) => ({ ...e, proofImage: '' })),
    },
    options.storage ?? null
  );
  let proofPersisted = true;
  try {
    await writeProofToDatabase(entry.id, formData.proofImage, options.idb ?? undefined);
  } catch {
    proofPersisted = false;
  }
  entry.proofImage = formData.proofImage;
  return { goal: nextGoal, entry, proofPersisted };
}