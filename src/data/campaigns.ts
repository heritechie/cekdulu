/**
 * Campaign model: Marketer → Campaign → Template.
 *
 * Kampanye adalah unit katalog yang ditampilkan sebagai halaman statis
 * (mis. /c/master-property/keandra-park-cluster-aranda) dan disasar lewat
 * iklan. Tidak ada entitas partner/product terpisah di pengalaman consumer;
 * marketer memegang daftar campaign-nya sendiri.
 */

export type CampaignTemplateId = 'kpr' | 'mobil' | 'motor' | 'pinjaman';

/**
 * Satu-satunya template yang diimplementasikan saat ini. Template lain
 * (mobil/motor/pinjaman) sengaja belum dibuat.
 */
export const CAMPAIGN_TEMPLATE_LABELS: Partial<Record<CampaignTemplateId, string>> = {
  kpr: 'KPR',
};

export interface CampaignFinancialParams {
  /** Harga properti dalam rupiah (read-only, dari marketer). */
  price: number;
  /** Suku bunga simulasi per tahun dalam persen (read-only). */
  annualInterestRate: number;
  /** Bunga promo per tahun dalam persen (opsional). Default: annualInterestRate. */
  promoInterest?: number;
  /** Lama periode promo dalam tahun (opsional, untuk teks penjelasan). */
  promoPeriodYears?: number;
  /** Asumsi bunga floating per tahun dalam persen (opsional). Default: annualInterestRate. */
  floatingInterest?: number;
  /** Asumsi margin syariah per tahun dalam persen (opsional; tanpa ini mode Syariah menampilkan placeholder). */
  syariahMargin?: number;
}

export interface CampaignSpec {
  label: string;
  value: string;
}

export interface Campaign {
  slug: string;
  name: string;
  developerName?: string;
  tagline?: string;
  image: string;
  imageAlt: string;
  /** Koleksi foto properti untuk carousel. Jika kosong, gunakan `image`. */
  images?: string[];
  /** Tipe unit, mis. "Type 60". */
  unitType?: string;
  /** Lokasi terstruktur: "Kecamatan, Kota/Kabupaten, Provinsi". */
  location?: string;
  priceLabel: string;
  specs: CampaignSpec[];
  /** Kelebihan properti dari marketer, dirender ringkas di bawah harga. Maksimal 5. */
  highlights?: string[];
  /** Promo properti saat ini, dirender dalam section terpisah "Promo yang tersedia". */
  promos?: string[];
  template: CampaignTemplateId;
  params: CampaignFinancialParams;
  tenorPresetsMonths: number[];
  defaultTenorMonths: number;
  /** Nomor WhatsApp marketer dalam format internasional, tanpa + dan spasi. */
  whatsapp: string;
  /** Pesan awal (prefill) sebelum ringkasan hasil simulasi. */
  whatsappMessage: string;
  seoDescription: string;
}

export interface CampaignMarketer {
  slug: string;
  name: string;
  campaigns: Campaign[];
}

export const campaignMarketers: CampaignMarketer[] = [
  {
    slug: 'master-property',
    name: 'Master Property',
    campaigns: [
      {
        slug: 'keandra-park-cluster-aranda',
        name: 'Cluster Aranda',
        developerName: 'Keandra Park',
        tagline: 'Hunian nyaman untuk keluarga modern.',
        image: '/campaigns/master-property/keandra-park-cluster-aranda/main-cover.webp',
        imageAlt: 'Foto Cluster Aranda di Keandra Park',
        images: [
          '/campaigns/master-property/keandra-park-cluster-aranda/main-cover.webp',
          '/campaigns/master-property/keandra-park-cluster-aranda/slide-2.webp',
          '/campaigns/master-property/keandra-park-cluster-aranda/slide-3.webp',
          '/campaigns/master-property/keandra-park-cluster-aranda/slide-4.webp',
          '/campaigns/master-property/keandra-park-cluster-aranda/slide-5.webp',
          '/campaigns/master-property/keandra-park-cluster-aranda/slide-6.webp',
        ],
        unitType: 'Type 45/75',
        location: 'Larangan, Harjamukti, Kota Cirebon',
        priceLabel: 'Rp. 577.000.000',
        specs: [
          { label: 'Tanah', value: '75 m²' },
          { label: 'Bangunan', value: '45 m²' },
          { label: 'Kamar tidur', value: '2' },
          { label: 'Kamar mandi', value: '1' },
        ],
        highlights: [
          'Lokasi strategis di Kota Cirebon',
          '𝙏𝙀𝙍𝙄𝙈𝘼 𝙆𝙐𝙉𝘾𝙄 𝟱 𝙅𝙐𝙏𝘼 𝘼𝙇𝙇-𝙄𝙉 + 𝙁𝙍𝙀𝙀 𝘼𝘾',
        ],
        promos: [
          '𝙏𝙀𝙍𝙄𝙈𝘼 𝙆𝙐𝙉𝘾𝙄 𝟱 𝙅𝙐𝙏𝘼 𝘼𝙇𝙇-𝙄𝙉 + 𝙁𝙍𝙀𝙀 𝘼𝘾',
        ],
        template: 'kpr',
        params: { price: 577_000_000, annualInterestRate: 6, promoInterest: 6, floatingInterest: 11 },
        tenorPresetsMonths: [60, 120, 180, 240, 300, 360],
        defaultTenorMonths: 120,
        whatsapp: '6285224416325',
        whatsappMessage:
          'Halo Master Property, saya baru selesai cek simulasi KPR untuk Keandra Park - Cluster Aranda.',
        seoDescription:
          'Cek kemampuan KPR Cluster Aranda, Keandra Park sebelum mengambil cicilan.',
      },
    ],
  },
];