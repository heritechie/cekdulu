/**
 * CalculatorWizard context definitions.
 *
 * A context describes how one financing product (rumah, kendaraan, elektronik,
 * lainnya, ...) adapts the shared wizard UI: the labels the user sees, whether
 * the price simulator shows a DP field, and which tenors are offered.
 *
 * Future products (mobil, motor, pinjaman pribadi, ...) can be added as new
 * entries here without touching the wizard component. Unknown slugs resolve to
 * "lainnya" so the utility always renders something sensible.
 */
export interface TenureOption {
  months: number;
  label: string;
}

export interface ContextConfig {
  /** Internal slug used for analytics and URL resolution (e.g. 'rumah'). */
  slug: string;
  /** Short label shown in the wizard header ("Rumah / KPR"). */
  label: string;
  /** Lowercase noun for result copy ("rumah", "cicilan" for lainnya). */
  noun: string;
  /** Capitalized noun for result copy ("Rumah"). */
  nounCapitalized: string;
  /** Noun used when phrasing that a burden feels heavy ("rumah", "ini"). */
  burdenNoun: string;
  /** Label for the simulator price field ("Harga rumah"). */
  priceLabel: string;
  /** Whether the simulator shows the uang muka (DP) field. */
  showDp: boolean;
  /** Tenor presets shown in the select; empty array = free numeric input. */
  tenureOptions: TenureOption[];
  /** Placeholder text for the annual interest rate field. */
  interestPlaceholder: string;
}

export const INSTALLMENT_CONTEXTS: Record<string, ContextConfig> = {
  rumah: {
    slug: 'rumah',
    label: 'Rumah / KPR',
    noun: 'rumah',
    nounCapitalized: 'Rumah',
    burdenNoun: 'rumah',
    priceLabel: 'Harga rumah',
    showDp: true,
    tenureOptions: [
      { months: 60, label: '5 tahun (60 bulan)' },
      { months: 120, label: '10 tahun (120 bulan)' },
      { months: 180, label: '15 tahun (180 bulan)' },
      { months: 240, label: '20 tahun (240 bulan)' },
      { months: 300, label: '25 tahun (300 bulan)' },
      { months: 360, label: '30 tahun (360 bulan)' },
    ],
    interestPlaceholder: 'Contoh: 9,5',
  },
  kendaraan: {
    slug: 'kendaraan',
    label: 'Kendaraan',
    noun: 'kendaraan',
    nounCapitalized: 'Kendaraan',
    burdenNoun: 'kendaraan',
    priceLabel: 'Harga kendaraan',
    showDp: true,
    tenureOptions: [
      { months: 12, label: '1 tahun (12 bulan)' },
      { months: 24, label: '2 tahun (24 bulan)' },
      { months: 36, label: '3 tahun (36 bulan)' },
      { months: 48, label: '4 tahun (48 bulan)' },
      { months: 60, label: '5 tahun (60 bulan)' },
    ],
    interestPlaceholder: 'Contoh: 9,5',
  },
  elektronik: {
    slug: 'elektronik',
    label: 'Elektronik',
    noun: 'elektronik',
    nounCapitalized: 'Elektronik',
    burdenNoun: 'elektronik',
    priceLabel: 'Harga barang',
    showDp: true,
    tenureOptions: [
      { months: 3, label: '3 bulan' },
      { months: 6, label: '6 bulan' },
      { months: 9, label: '9 bulan' },
      { months: 12, label: '12 bulan' },
      { months: 18, label: '18 bulan' },
      { months: 24, label: '24 bulan' },
    ],
    interestPlaceholder: 'Contoh: 9,5',
  },
  lainnya: {
    slug: 'lainnya',
    label: 'Lainnya',
    noun: 'cicilan',
    nounCapitalized: 'Cicilan',
    burdenNoun: 'ini',
    priceLabel: 'Harga barang / pokok pinjaman',
    showDp: true,
    tenureOptions: [],
    interestPlaceholder: 'Contoh: 9,5',
  },
};

/**
 * Resolve a context slug to a full context configuration.
 * Unknown or empty slugs always fall back to "lainnya".
 */
export function resolveContext(slug: string | null | undefined): ContextConfig {
  return INSTALLMENT_CONTEXTS[slug ?? 'lainnya'] ?? INSTALLMENT_CONTEXTS['lainnya'];
}