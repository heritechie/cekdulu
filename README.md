# CekDulu.co.id

> Sebelum nyicil, cek dulu.

CekDulu adalah utility web untuk membantu orang Indonesia mengecek kemampuan finansial sebelum mengambil cicilan atau utang jangka panjang (KPR/rumah, mobil, motor, pinjaman pribadi, elektronik, dan lainnya).

Bukan bank, bukan fintech lender, bukan broker pinjaman, dan bukan financial advisor.

## Fitur

- **Homepage** berorientasi ilustrasi timbangan keuangan ⚖️ (Penghasilan vs Cicilan + Pengeluaran)
- **Wizard 5 langkah** (mobile-first):
  1. Penghasilan bersih
  2. Cicilan yang sudah ada
  3. Rencana cicilan baru
  4. Pengeluaran bulanan
  5. Hasil perhitungan
- Input Rupiah terformat (contoh: `10000000` → `10.000.000`)
- Bagikan hasil tanpa login (Web Share API + fallback salin)
- Tanpa akun, tanpa backend — semua kalkulasi terjadi di browser
- SEO-friendly (semantic HTML, metadata, canonical, Open Graph)

## Stack

- [Astro](https://astro.build) — framework utama (halaman, layout, konten statis)
- [Tailwind CSS v4](https://tailwindcss.com) — styling utilitas
- [shadcn/ui](https://ui.shadcn.com) + [Base UI](https://base-ui.com) — primitives UI (`button`, `input`, `label`, `progress`, `card`, `separator`)
- [lucide-astro](https://lucide.dev) — ikon
- React 19 — hanya untuk komponen interaktif yang membutuhkan state client (via `@astrojs/react`)
- TypeScript

## Requirements

- Node.js 20+ (disarankan)

## Menjalankan

```bash
npm install
npm run dev        # development server
npm run build      # build produksi ke ./dist
npm run preview    # pratinjau build produksi
npm run check      # type-check (astro check)
```

## Scripts

| Script   | Deskripsi                              |
| -------- | -------------------------------------- |
| `dev`    | `astro dev` — development server       |
| `build`  | `astro build` — static build           |
| `preview`| `astro preview` — pratinjau build      |
| `check`  | `astro check` — type-check             |

## Struktur Proyek

```
src/
├── components/
│   ├── ui/            # komponen shadcn/ui (Base UI)
│   ├── balance-scale.astro   # ilustrasi timbangan (SVG self-contained)
│   ├── number-field.astro    # input angka + label
│   ├── money-row.astro       # baris input rupiah + ikon (kategori)
│   └── ad-slot-*.astro       # placeholder iklan (belum terintegrasi)
├── layouts/
│   └── Layout.astro          # layout bersama + metadata SEO
├── lib/
│   ├── calculator/engine.ts  # calculation engine murni
│   └── utils.ts              # helper cn()
├── pages/
│   ├── index.astro           # homepage
│   └── calculator.astro      # wizard 5 langkah
└── styles/
    └── global.css            # tema Tailwind v4 + design tokens
public/images/illustrations/   # aset ilustrasi hero
```

## Calculation Engine

`src/lib/calculator/engine.ts` berisi fungsi murni yang dapat digunakan ulang:

- `calculateFinancialBalance(income, existingInstallments, newInstallment, monthlyExpenses)` — metrik utama (total cicilan, DBR, sisa uang, status finansial)
- `formatRupiah`, `formatPercentage`
- `calculateMaxInstallment`, `calculateRequiredIncome`

Wizard menjumlahkan input per kategori, lalu memanggil engine saat menampilkan hasil.

## Theming

Design tokens didefinisikan di `src/styles/global.css`:

- Latar putih / sangat terang
- Tipografi navy gelap
- **Biru** sebagai warna aksi utama
- Kartu membulat dengan border & shadow halus

Gunakan semantic tokens (`bg-primary`, `text-foreground`, `border-border`, dll.) — jangan hardcode warna secara langsung kecuali diperlukan.

## Panduan

- Baca [AGENTS.md](./AGENTS.md) sebelum berkontribusi.
- Ikuti skill frontend proyek di `.opencode/skills/frontend/SKILL.md` (Astro-first, re-use shadcn/ui, minimal JS client).
- Prioritas implementasi UI: komponen proyek → komponen shadcn/ui → komposisi → komponen baru → CSS custom.

## Lisensi

ISC
