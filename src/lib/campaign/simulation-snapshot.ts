/**
 * CekDulu — Campaign simulation snapshots (browser localStorage).
 *
 * "Simpan simulasi" on a campaign page: stores a read-only snapshot of the
 * scenario the user calculated so it can be reopened later from the same
 * device. No login, no email, no OTP, no backend.
 *
 * What is stored:
 *   campaign / property context, harga, bunga, DP, tenor, penghasilan,
 *   cicilan berjalan, pengeluaran, calculated result, and timestamp.
 *
 * PRIVACY: data never leaves the browser. Snapshots are keyed per
 * campaign (marketer + campaign slug) so different campaigns never collide.
 *
 * SSR-safe: `window`/`localStorage` are only touched inside guarded
 * functions, never at module scope, so this module can be imported by Node
 * tests and during an Astro build without breaking anything.
 */

export const SIMULATION_SNAPSHOT_VERSION = 1;
/** Keep a small list per campaign so storage stays lightweight. */
export const SIMULATION_SNAPSHOT_MAX = 5;

export interface SimulationSnapshotCampaign {
  marketerSlug: string;
  marketerName: string;
  campaignSlug: string;
  campaignName: string;
  developerName?: string;
  template: string;
}

export interface SimulationSnapshotParams {
  /** Harga properti (read-only, dari katalog campaign). */
  price: number;
  /** Label harga untuk ditampilkan kembali. */
  priceLabel: string;
  /** Bunga simulasi per tahun dalam persen (read-only). */
  annualInterestRate: number;
}

export interface SimulationSnapshotInputs {
  downPayment: number;
  tenorMonths: number;
  monthlyIncome: number;
  existingInstallments: number;
  monthlyExpenses: number;
  /** Suku bunga simulasi aktual yang dipakai saat snapshot disimpan (bisa override). */
  simulationInterestRate: number;
}

export interface SimulationSnapshotResult {
  monthlyInstallment: number;
  totalMonthlyDebt: number;
  debtRatio: number;
  remainingAfterDebtAndExpenses: number;
}

export interface CampaignSimulationSnapshot {
  /** Identifier unik per snapshot (unik dalam satu campaign). */
  id: string;
  /** Kapan snapshot disimpan, ISO string. */
  savedAt: string;
  campaign: SimulationSnapshotCampaign;
  params: SimulationSnapshotParams;
  inputs: SimulationSnapshotInputs;
  result: SimulationSnapshotResult;
}

export interface BuildSimulationSnapshotInput {
  campaign: SimulationSnapshotCampaign;
  params: SimulationSnapshotParams;
  inputs: SimulationSnapshotInputs;
  result: SimulationSnapshotResult;
}

/**
 * Storage key, scoped per campaign ("cekdulu:campaign:simulations:<marketer>:<campaign>:v1").
 * Both slugs are included so a shared campaign slug between marketers never collides.
 */
export function simulationsStorageKey(marketerSlug: string, campaignSlug: string): string {
  return `cekdulu:campaign:simulations:${marketerSlug}:${campaignSlug}:v1`;
}

function clampNumber(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function clampTenorMonths(value: unknown, fallback: number): number {
  const num = clampNumber(value, fallback);
  return num >= 1 ? num : fallback;
}

/** Validate/coerce an arbitrary parsed snapshot into a usable one. */
export function sanitizeSimulationSnapshot(raw: unknown): CampaignSimulationSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;

  const snapshot = raw as Partial<CampaignSimulationSnapshot>;
  const campaign = snapshot.campaign;
  if (!campaign || typeof campaign !== 'object') return null;
  if (!isNonEmptyString(campaign.marketerSlug) || !isNonEmptyString(campaign.campaignSlug)) {
    return null;
  }

  const params = snapshot.params;
  if (!params || typeof params !== 'object') return null;

  const inputs = snapshot.inputs;
  if (!inputs || typeof inputs !== 'object') return null;

  const result = snapshot.result;
  if (!result || typeof result !== 'object') return null;

  return {
    id: isNonEmptyString(snapshot.id) ? snapshot.id : '',
    savedAt: isNonEmptyString(snapshot.savedAt) ? snapshot.savedAt : new Date(0).toISOString(),
    campaign: {
      marketerSlug: campaign.marketerSlug,
      marketerName: isNonEmptyString(campaign.marketerName) ? campaign.marketerName : campaign.marketerSlug,
      campaignSlug: campaign.campaignSlug,
      campaignName: isNonEmptyString(campaign.campaignName) ? campaign.campaignName : campaign.campaignSlug,
      developerName: isNonEmptyString(campaign.developerName) ? campaign.developerName : undefined,
      template: typeof campaign.template === 'string' ? campaign.template : 'kpr',
    },
    params: {
      price: clampNumber(params.price),
      priceLabel: isNonEmptyString(params.priceLabel) ? params.priceLabel : '',
      annualInterestRate: clampNumber(params.annualInterestRate),
    },
    inputs: {
      downPayment: clampNumber(inputs.downPayment),
      tenorMonths: clampTenorMonths(inputs.tenorMonths, 240),
      monthlyIncome: clampNumber(inputs.monthlyIncome),
      existingInstallments: clampNumber(inputs.existingInstallments),
      monthlyExpenses: clampNumber(inputs.monthlyExpenses),
      simulationInterestRate: clampNumber(inputs.simulationInterestRate),
    },
    result: {
      monthlyInstallment: clampNumber(result.monthlyInstallment),
      totalMonthlyDebt: clampNumber(result.totalMonthlyDebt),
      debtRatio: clampNumber(result.debtRatio),
      remainingAfterDebtAndExpenses: clampNumber(result.remainingAfterDebtAndExpenses),
    },
  };
}

function isUsableSnapshot(snapshot: CampaignSimulationSnapshot | null): snapshot is CampaignSimulationSnapshot {
  return snapshot !== null && snapshot.id !== '';
}

/**
 * Sanitize an arbitrary stored list: drops invalid entries, dedupes by id
 * (keeps the newest), and caps the length to SIMULATION_SNAPSHOT_MAX.
 */
export function sanitizeSimulationList(raw: unknown): CampaignSimulationSnapshot[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CampaignSimulationSnapshot[] = [];
  for (const item of raw) {
    const snapshot = sanitizeSimulationSnapshot(item);
    if (!isUsableSnapshot(snapshot)) continue;
    if (seen.has(snapshot.id)) continue;
    seen.add(snapshot.id);
    out.push(snapshot);
    if (out.length >= SIMULATION_SNAPSHOT_MAX) break;
  }
  return out;
}

/**
 * Build a complete snapshot for a campaign simulation. Pure and SSR-safe:
 * the id/timestamp are generated from clock + random so no `window` needed.
 */
export function buildSimulationSnapshot(input: BuildSimulationSnapshotInput): CampaignSimulationSnapshot {
  const id =
    new Date().getTime().toString(36) +
    Math.random().toString(36).slice(2, 10);
  return sanitizeSimulationSnapshot({
    id,
    savedAt: new Date().toISOString(),
    campaign: input.campaign,
    params: input.params,
    inputs: input.inputs,
    result: input.result,
  }) ?? {
    id,
    savedAt: new Date().toISOString(),
    campaign: input.campaign,
    params: input.params,
    inputs: input.inputs,
    result: input.result,
  };
}

/** Read saved snapshots for a campaign, newest first. Empty when absent. */
export function readSimulationSnapshots(
  marketerSlug: string,
  campaignSlug: string,
): CampaignSimulationSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(simulationsStorageKey(marketerSlug, campaignSlug));
    if (!raw) return [];
    return sanitizeSimulationList(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * Persist a snapshot (prepended, capped). Returns false when storage is
 * unavailable or the snapshot is structurally invalid.
 */
export function saveSimulationSnapshot(
  marketerSlug: string,
  campaignSlug: string,
  snapshot: CampaignSimulationSnapshot,
): boolean {
  if (typeof window === 'undefined') return false;
  const sanitized = sanitizeSimulationSnapshot(snapshot);
  if (!isUsableSnapshot(sanitized)) return false;

  const key = simulationsStorageKey(marketerSlug, campaignSlug);
  try {
    const list = readSimulationSnapshots(marketerSlug, campaignSlug);
    const next = [sanitized, ...list.filter((item) => item.id !== sanitized.id)].slice(
      0,
      SIMULATION_SNAPSHOT_MAX,
    );
    window.localStorage.setItem(key, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

/** Remove a specific saved snapshot. Returns true when it was removed. */
export function removeSimulationSnapshot(
  marketerSlug: string,
  campaignSlug: string,
  id: string,
): boolean {
  if (typeof window === 'undefined') return false;
  if (!id) return false;
  const key = simulationsStorageKey(marketerSlug, campaignSlug);
  try {
    const list = readSimulationSnapshots(marketerSlug, campaignSlug);
    const next = list.filter((item) => item.id !== id);
    if (next.length === list.length) return false;
    if (next.length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(next));
    }
    return true;
  } catch {
    return false;
  }
}