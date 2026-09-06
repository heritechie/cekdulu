# Plan: Share sejak awal campaign — 30 Hari Tanpa PayLater

## Audit Summary

**Current state:**
- Share **hanya ada di Complete screen** — tombol `#shareBtn` dan logic hanya di section complete
- `src/lib/paylater-share.ts` sudah punya text builders untuk semua context (landing/progress/milestone/completed) — tapi **dead code, tidak di-import**
- Page punya inline `buildShareText()` yang menduplicate logic hanya untuk context completed
- Share mechanism: Web Share API → clipboard fallback → `legacyCopy()` fallback → `trackEvent('paylater_challenge_share', { share_method })`
- HTML share card di complete screen menampilkan stats

**Existing infrastructure reused:**
- `buildChallengeShareText(context, options)` di `paylater-share.ts` — sudah SSR-safe, sudah Option-A-only
- `CHALLENGE_SHARE_URL` dari `paylater-share.ts` (tidak perlu re-declare di page)
- `ChallengeShareContext` type: `'landing' | 'progress' | 'milestone' | 'completed'`
- Share mechanism: Web Share API + clipboard + legacyCopy — sudah ada
- `trackEvent('paylater_challenge_share', { share_method })` — diperluas dengan `share_context`

## Files Changed

### 1. `src/pages/challenges/30-hari-tanpa-paylater.astro`

**HTML:**
- Landing: tombol `#landingShareBtn` "Bagikan Challenge" (ghost/secondary) setelah CTA utama "Mulai Challenge"
- Active: tombol `#activeShareBtn` dengan `#activeShareBtnLabel` di antara main stats card dan HISTORY
- Complete: tombol `#shareBtn` dipertahankan (label "Bagikan Hasilku" tetap)

**JS:**
- Import `buildChallengeShareText`, `CHALLENGE_SHARE_URL`, `ChallengeShareContext` dari `paylater-share.ts`
- Hapus inline `plainRupiah()` + `buildShareText()` (duplikasi)
- Satu fungsi shared **`shareChallenge(context, labelId)`** dipakai oleh landing/active(progress|milestone)/completed
- `currentMilestone` variable (set di `revealMilestone`/`showMilestoneBanner`, clear di close/continue) menentukan apakah active share pakai context 'milestone'
- Dynamic label active: Day 1 → "Bagikan progresmu", Day N → "Bagikan progres N harimu"
- Analytics: `paylater_challenge_share` tetap, ditambah `share_context` (landing/progress/milestone/completed)

### 2. `tests/paylater-challenge.test.mjs`

Tambah suite `challenge share text`:
- landing: invite only, no stats/no money, URL ada
- progress day 7: headline day, stats Option-A-only, Option B tidak bocor
- progress day 1: headline day 1
- milestone 14: headline + stats + CTA join
- completed: headline + stats + CTA join
- Option-B-only: tidak pernah mengklaim penghematan
- Day 30 completion: tidak salah dianggap milestone 21

## Decision Notes

- **Setup screen**: tidak ditambah share CTA — opsional per requirement, minimal scope
- **Label complete**: "Bagikan Hasilku" dipertahankan (tidak mengubah UI approved)
- **Milestone share**: reuse active share button (banner visible + currentMilestone → context 'milestone'), sesuai requirement "tetap bisa menggunakan CTA share yang sama"
- Option A (not_bought) saja yang masuk stats share — Option B (paid_other) tidak pernah dihitung sebagai penghematan

## Hero Layout (fix lanjutan)

Rocket milestone (`rocket-day-01..30`) sekarang jadi **decorative background layer** di dalam blue hero:
- Hero: `relative overflow-hidden bg-primary ...`
- Content (title/day/progress): dibungkus `relative z-10`
- Image: `absolute -bottom-[18px] -right-[14px] z-0 pointer-events-none select-none`, `w-[170px]` mobile / `sm:w-[230px]`, tidak ikut document flow sehingga tidak menambah tinggi hero (height tetap dikontrol konten ≈ 140-155px)
- Day text diberi `pr-16 sm:pr-36` agar tidak menabrak area ilustrasi
- Yellow streak card tetap `flame-streak.png` (Day 1-29) / `trophy.png` (Day 30) — rocket tidak boleh muncul di sana

## Milestone Banner Visual (fix lanjutan)

Milestone 7/14/21 banner tidak lagi pakai flame-streak:
- Flame-streak diganti **badge checkmark bulat biru** (Lucide `Check` di dalam `span` `bg-primary text-primary-foreground`, ukuran h-10) — tidak ada dependency baru
- Title milestone diubah dari `🔥 ${ms} Hari!` → `${ms} Hari!` (static HTML + kedua `setText` di `revealMilestone`/`showMilestoneBanner`)
- Stats + CTA "Lanjutkan Challenge" dipertahankan
- Day 30 tidak menampilkan milestone banner (CELEBRATION_MILESTONES = [7,14,21])
- Role visual: hero=🚀 journey, yellow card=🔥 streak, milestone banner=✓ checkpoint, day 30 streak card=🏆 trophy

## Hero Illustration Composition (fix lanjutan)

Rocket per-stage dikomposisi sebagai **positional journey**, bukan sekadar ganti file:
- `#activeRocketImg` tetap absolute/decorative (pointer-events-none, z-0, tidak ikut flow)
- Ukuran/posisi dikendalikan CSS custom props `--rw`/`--rr`/`--rb` (di-set JS per stage di `renderActive` via `ROCKET_LAYOUT`)
- CSS rule static (nilai default = Day 1, untuk SSR no-JS) + media query `width>=640px` skala ×1.28
- Kunci fix: crop sisi kanan dikurangi drastis (right tidak lagi `-14/-20px` agresif) supaya hidung/badan rocket tidak terpotong; crop dipertahankan di bawah (trail/clouds)
- Per-stage (mobile / ×1.28 di sm):
  - Day 1 → w 172, right -8, bottom -16 (starting launch, dekat pojok kanan bawah)
  - Day 7 → w 176, right 0, bottom -20 (lebih tinggi, trail lebih panjang)
  - Day 14 → w 180, right 4, bottom -24 (semakin ke kanan/atas, trail dominan)
  - Day 21 → w 184, right 8, bottom -26 (mendekati destination, moon lebih terlihat)
  - Day 30 → w 188, right 10, bottom -22 (achievement, moon cukup terlihat, rocket utuh)
- Text tetap z-10 di kiri (hapus kelas ukuran dari img, hanya `right-0 bottom-0 absolute h-auto`)
- Layout hero container (`relative overflow-hidden px-5 pt-6 pb-6`), progress bar, day text `pr-16 sm:pr-36`, typography — TIDAK diubah
- Catatan: angka px adalah komposisi default yang harus divalidasi visual (model tidak bisa lihat gambar); `testDay=1/7/14/21/30` untuk review + penyesuaian nilai di `ROCKET_LAYOUT`

## Yellow Streak Card + Action Row (fix lanjutan)

Yellow streak card:
- Background: **asset `public/challenges/30-days-no-paylater-assets/yellow-aksen-banner.png`** (1774×887) sebagai background penuh — `inline style background-image`, `bg-cover bg-center`, `overflow-hidden rounded-2xl` dipertahankan. `decorative-flame.svg` dihapus (tidak dipakai)
- Day 1–29 icon `flame-streak.png`; Day 30 `trophy.png` (JS `renderActive`, TIDAK diubah)
- Icon diperbesar `h-9` → `h-11` (+22%); angka hari tetap HTML `text-5xl` focal
- Explanatory text: `mt-2.5 max-w-[32ch] text-[13px] leading-snug text-[#15345F]/75 sm:max-w-[34ch] sm:text-sm` (lebih besar & lebih lebar, target 2–3 baris mobile, tetap centered, copy TIDAK diubah)
- `py-6` → `py-5` agar card tidak terlalu tinggi (offset ikon lebih besar)

Action row (SATU ROW 50/50, `grid-cols-2 gap-2`), tepat sebelum "Catatanmu":
- [ + Catat ] = primary (variant default, `Plus`, label "Catat", `rounded-full py-3 text-sm`)
- [ ↗ Bagikan ] = **white/outline blue** — hand-written class (BUKAN cva untuk hindari konflik urutan utility): `border-2 border-primary/40 bg-white text-primary rounded-full py-3 text-sm font-semibold`, `hover:bg-primary/5`; label statis "Bagikan" + `share.svg`
- Posisi: stats → Option B note (jika ada) → action row (`mt-4`) → "Catatanmu" (`mt-6`) → history → lock note
- Tidak ada CTA setelah history (bukan duplicate)
- Share content/behavior dynamic tetap (context milestone/progress via `shareChallenge`, feedback "Tersalin!"); hanya label button compact statis

Blue hero mapping tetap: Day 1–6 `rocket-day-01`, 7–13 `07`, 14–20 `14`, 21–29 `21`, 30 `30` dari `/challenges/30-days-no-paylater-assets/` (folder asli — path `cekdulu-30-hari-tanpa-paylater-assets/challenges/...` TIDAK ada di filesystem; yang benar `public/challenges/30-days-no-paylater-assets/`). Hero tetap absolute/decorative.

## Share Image (fix lanjutan)

Challenge "Bagikan" (active + complete) sekarang me-render **PNG share image 1080×1920** client-side, bukan lagi text-only:

**Module baru `src/lib/paylater-share-image.ts`** (bukan `share-image.ts` yang sudah ada — file itu milik kalkulator, `generateShareFile`, TIDAK boleh ditimpa):
- Template: `public/share/30-days-no-paylater-share-template.svg` (1080×1920), placeholder `{{DAY}}`, `{{PROGRESS_WIDTH}}`, `{{TRANSACTIONS}}`, `{{SAVED_AMOUNT}}`, `{{MILESTONE_HEADLINE}}`, `{{MILESTONE_TEXT}}`; hero `<image id="heroIllustration">` di-*inline* jadi data URI (hero href default template salah → diganti runtime ke `/challenges/30-days-no-paylater-assets/rocket-day-{01|07|14|21|30}.png`)
- `rocketStageForShareImage(day)` mirror `rocketStageForDay` (1/7/14/21/30)
- `progressWidthForShareImage(day)` = round(650 × min(1, day/30)) untuk track 650px
- Milestone copy **emoji-free** (reliabilitas canvas): day 1/7/14/21/30 → ("Aku baru mulai!","Hari pertama tanpa PayLater.") / ("7 hari!",…) / ("14 hari!",…) / ("21 hari!",…) / ("Aku berhasil!","30 hari tanpa PayLater selesai.")
- `renderChallengeShareImagePng(data)`: fetch template (cache) → inline hero data URI → SVG Blob → `Image()` → canvas 1080×1920 → PNG `File` `cekdulu-30-hari-tanpa-paylater-day-{DAY}.png`; jika asset hero gagal → render tanpa ilustrasi (tidak crash)
- `loadShareTemplate` cache + fallback no-crash; `toDataUri` via FileReader (self-contained SVG → canvas tidak tainted)

**Page `30-hari-tanpa-paylater.astro`:**
- Import `renderChallengeShareImagePng`; landing tetap `shareText()` (text-only, belum ada state)
- `shareWithImage(context, labelId)` untuk active (progress/milestone) + complete (completed): label "Menyiapkan gambar..." → render PNG → `navigator.canShare({files})` → `navigator.share` (track `native`) | gagal/unsupported → download PNG (track `download`) | template gagal → copy teks pendek (track `copy`)
- Stats image Option-A-only persis seperti stats layar: `avoidedExpenseCount(state)`, `totalAvoidedExpense(state)` (via `shareImageData()`); Option B tidak pernah jadi savings
- Teks pendek penyerta share memakai `cekdulu.my.id/stopl` (short URL; bukan `CHALLENGE_SHARE_URL`)
- Analytics tetap event `paylater_challenge_share` + `share_context`, hanya pada share sukses (tiada event baru)
- Label lifecycle eksplisit per-branch agar feedback "Tersalin!" tidak ketimpa `finally`

**Tests `tests/paylater-share-image.test.mjs`** (pure helpers, no DOM): mapping stage, width progress, copy milestone, dan no-emoji. Script `npm test` di-update untuk bundle semua `tests/*.test.mjs` → `.astro/cekdulu-tests/*.test.mjs` (`--out-extension:.js=.mjs` karena package type commonjs).

**Catatan / keputusan:**
- `share-image.ts` yang lama adalah milik kalkulator (1080×1350, `generateShareFile` digunakan `kalkulator-kemampuan-cicilan.astro`); module challenge dipisah agar tidak override
- Filename PNG mengandung stage (day-NN) → memudahkan identifikasi
- Short URL dipakai karena template memang sudah memuatnya (privacy: tidak menaruh data mentah di URL)
- Screenshot Day 14 & Day 30 tidak bisa dirender di environment agent (tanpa headless browser) — perlu validasi visual manual user via `testDay=7/14/21/30` lalu klik Bagikan
- `formatRupiah` engine (id-ID) menghasilkan "Rp1.500.000" (space sempit) — konsisten dengan stats layar; amount besar bisa panjang, template static

## Setup Page Polish (fix lanjutan)

Polish vertikal halaman onboarding (`#screen-setup`) — TANPA mengubah logic/behavior:

- **Rocket**: dipotong dari natural 480×420 (distorsi: asset asli 1536×1024 aspect 1.5, markup lama stretch) → `width="1536" height="1024"` + `h-auto w-[150px] sm:w-[170px]` (~100px tinggi, aspect benar, tidak overflow 375px); `loading="eager"` (hindari blank saat screen muncul)
- **Vertical rhythm**: gap rocket→card `mt-6` (24px) → `mt-4` (16px) = −33% whitespace (target 25–35%); Kembali & mt-2 ke rocket dipertahankan
- **Form card**: hierarchy dipertahankan (white `bg-card`, `rounded-2xl`, `border-border`, `shadow-sm`, `p-5`); heading & supporting copy wording TIDAK diubah; copy diberi `mt-1.5 leading-normal`
- **Hint**: `text-xs` → `text-[13px] leading-normal` (tetap muted/secondary, lebih readable)
- **Primary CTA**: "Mulai 30 Hari →" dipertahankan (default variant, full-width, rounded-full, py-3.5); visual TIDAK diubah
- **Lewati**: ghost variant (punya hover bg) → text button murni: `mx-auto block rounded-full px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground` (tanpa border/outline/filled/bg; feedback via warna teks saja)
- Robot: `space-y-2.5` → `space-y-1.5` (CTA & Lewati renggang 6px)
- Tanpa tambahan progress indicator/stepper/badge/dekorasi/animation (spec DO NOT OVERDESIGN)

## Share Image — Debug & Root Cause (fix)

**Gejala**: klik Bagikan di active challenge → langsung text fallback ("14 Hari Tanpa PayLater! / 0 transaksi & Rp 0 berhasil dihindari. / cekdulu.my.id/stopl") walau design harus PNG → Web Share files → download → text hanya jika generasi gagal.

**Root cause** (single bug):
- `swapHeroHref()` di `src/lib/paylater-share-image.ts` mengubah `<image ... preserveAspectRatio="xMidYMid meet"/>` menjadi `<image ... href="data:...">` — menghapus `/` penutup dan TIDAK membuat elemen self-closed, tidak ada `</image>`
- Browser mendecode SVG-as-image (`<img src="blob:…">`, MIME `image/svg+xml`) sebagai **XML ketat** → tag `<image>` tanpa penutup = malformed → `img.onerror` → `loadSvgIntoImage` reject → `renderChallengeShareImagePng` throw → di page `catch` → `file = null` → text fallback
- Terbukti: transform lama → `<image>:1, </image>:0, self-closed:false`; transform baru (self-closed) → parse XML OK (diverifikasi dengan `xml.etree` untuk day 14 & 30)
- Bukan masalah template fetch (200, `dist/share/...svg` ada), bukan asset path (`rocket-day-14/30.png` ada di dist), bukan Web Share, bukan fallback order (page handle `file && canShare → share | file → download | else text` sudah benar)

**Fix**: `swapHeroHref` output `<image … href="data:…"/>` (self-closed):
```
const tagWithoutHref = openTag.replace(/\s+href="[^"]*"/i, '').replace(/\/?>$/, '');
const replaced = `${tagWithoutHref} href="${heroDataUri}"/>`;
```

**Debug tracing (DIHAPUS — cleaned after verification)**: `[SHARE]` console.log/error telah dihapus seluruhnya dari `paylater-share-image.ts` dan `shareWithImage` di page (verified `rg` bersih, build 8 pages). Guard fungsional dipertahankan: sisa `{{PLACEHOLDER}}` di SVG final → throw `Template placeholders not replaced` (melindungi agar PNG yang dibagikan tidak berisi literal placeholder — fallback ke text, bukan debug noise). Semua console log error yang tersisa dibuang, melempar error asli saja. Flow share tidak berubah.

**Export untuk test**: `fillPlaceholders`, `swapHeroHref` (pure, DOM-free).

**Regression tests** (`tests/paylater-share-image.test.mjs`): `fillPlaceholders` — semua placeholder ke-replace untuk day 14 (303px progress, 3 tx, Rp150.000, copy stage 14) & tidak ada token `{{` tersisa; `swapHeroHref` — elemen self-closed `/>`, href = data URI (href lama hilang), SVG lain dipertahankan.

**Verifikasi**: `npm test` 44 pass • `npm run build` 8 pages • `npm run check` 0 errors • transisi day 14 & 30 valid XML • trace `[SHARE]` bersih dari bundle JS (dihapus).

## Setup Page — Rocket as Background (fix lanjutan) + iterasi 2

Iterasi 1 (ditolak user — "card dalam card", rocket kecil): scene ber-border + rounded + box biru muda → card dalam card.

Iterasi 2 (aktif): scene = full-bleed band, form = satu-satunya card:
- Scene: `relative -mx-4 overflow-hidden rounded-b-[2rem] pb-8 bg-[radial-gradient(90%_70%_at_78%_8%,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0)_55%),linear-gradient(180deg,#F2F7FF_0%,#E7EFFF_42%,#DCE9FF_70%,#EFF4FF_100%)] sm:-mx-6` — TANPA border, TANPA shadow, rounded hanya di bawah
- Rocket: `absolute right-2 top-0 z-0 h-auto w-[180px] select-none sm:right-6 sm:w-[205px]` (~120px tinggi mobile, lebih besar dari 150px sebelumnya); sebagian badan masuk di belakang card
- Form: `relative z-10 mx-auto mt-[4.5rem] w-[calc(100%-32px)] max-w-[430px] rounded-2xl border border-border/70 bg-card p-5 shadow-[0_18px_36px_-20px_rgba(21,52,95,0.4)]` — naik overlap rocket (48px badan rocket di belakang card), card putih satu-satunya prominent card
- Aksen scene (CSS only, aria-hidden): lingkaran putih besar kiri-atas + kanan-atas, cloud blob putih blur-md kiri, bintang kuning `rotate-45` kecil, 2 bintang biru, dot biru, bintang putih dekat rocket, blob biru lunak kanan-bawah
- Kembali tetap di luar scene; mt-3 ke scene
- Layering: background → rocket (z-0) → form (z-10, opaque)
- Compact: scene top ke bottom form ≈ 400px mobile (72px band + form), tanpa gap kosong
- Tidak ada overflow horizontal (overflow-hidden; rocket right-2 dalam scene); CTA full-width; tanpa animasi/section baru/dependency; logic & copy & input & CTA behavior tidak berubah

Komposisi ulang halaman onboarding (`#screen-setup`), hanya CSS/layout — asset & logic TIDAK berubah:

- Rocket dilepas dari normal-flow `<img>` (tidak lagi mengambil vertical space) → **absolute decorative layer** di scene:
  `<div class="relative mt-3 overflow-hidden rounded-3xl border border-border/60 bg-[linear-gradient(165deg,#EEF6FF_0%,#FBFDFF_45%,#E4EFFF_100%)] px-4 pb-5 pt-6 sm:px-6 sm:pt-7">`
- Rocket: `<img alt="" aria-hidden="true" class="pointer-events-none absolute right-0 top-1 z-0 h-auto w-[150px] select-none sm:right-2 sm:w-[168px]">` (upper/right scene, ~100px tinggi mobile)
- Background scene aksen ringan (tanpa aset baru): 2 lingkaran putih besar, blob biru putus-putus `blur-2xl` (soft cloud), dot putih `blur-md`, 4 spark dots `bg-primary/10-20` — semua `aria-hidden` + `pointer-events-none`, opacity rendah
- Form card sekarang **overlay** di atas scene: `relative z-10 mt-24 sm:mt-28` (rocket z-0, card z-10, card opaque `bg-card`), urutan visual: rocket berada di belakang/sekitar card
- Kembali tetap di luar scene (di atas), spacing `mt-3`
- Vertical rhythm: rocket tidak menambah tinggi; scene menampung rocket di area atas, card langsung menyusul — tanpa whitespace besar
- Tidak ada overflow horizontal (scene `overflow-hidden` + rocket `right-0` dalam scene); CTA tetap full-width; tanpa animasi/section baru/dependency

## Setup Page — Micro Polish (no redesign)

Komposisi dipertahankan (rocket background, form overlay, band full-bleed, white card). Hanya 3 polish:

1. **Rocket**: naik sedikit `-top-3` + geser kiri `right-6 sm:right-10` (ukuran tetap `w-[180px] sm:w-[205px]`). Body terlihat ~70% (dalam rentang 60-75%); titik bawah masih di belakang card; `overflow-hidden` di scene DILEPAS agar nose tidak terpotong — semua aksen kini positif (di dalam bounds), tanpa risiko horizontal overflow (rocket `right-6` masih dalam viewport). Video rocket `-top-3` = 12px, berada dalam gap `mt-5`.
2. **Aksen** dikurangi ke 3 item subtle saja (opacity rendah): bintang kuning kecil `rotate-45`, cloud blob putih `blur-md`, ring biru tipis `border-primary/15`.
3. **Spacing**: `mt-3` → `mt-5` antara Kembali dan scene (breathing room, +8px saja, tidak menambah tinggi signifikan).

## Day 30 Banner Copy (active screen)

Banner kuning di active menyimpan copy statis "Challenge jalan terus...". Untuk Day 30 (hari sudah selesai), copy diganti conditional di `renderActive()`:
- `<30` (default, HTML as-is): heading "hari tanpa PayLater" + note "Challenge jalan terus meski kamu tidak membuka halaman ini tiap hari."
- `day >= CHALLENGE_DAYS` (30): heading "Aku berhasil!" + note "30 hari tanpa PayLater selesai. / Satu kebiasaan baik sudah kamu mulai." (2 `<p>` hidden tambahan, layout/class identik)
- Toggle via `.hidden` di renderActive, mengikuti `previewTestDay` sehingga `?testDay=30` menampilkan copy Day 30. Header/banner/icon (flame→trophy di day>=30 sudah ada) & stats tidak diubah.

## /challenges — State-Aware Card

Featured card "30 Hari Tanpa PayLater" di `/challenges` kini state-aware dari `readChallengeStorage()` (satu sumber kebenaran yang sama dengan halaman challenge):
- **Belum mulai** (default SSR): ribbon kuning "Challenge pertama" + Flame, CTA "Ikut Challenge".
- **Sedang berjalan** (`state` ada, belum selesai): ribbon biru `bg-primary/10` "Sedang berjalan" + Flame, blok "Hari ke-X dari 30" + progress bar kecil (X = `dayForDate`, width `day/30`), CTA "Lanjutkan Challenge".
- **Selesai** (`state.completed || isChallengeComplete`): ribbon solid primary "Selesai" + Check icon, teks "30 hari selesai!", CTA "Lihat Hasil".
- CTA href tetap `/challenges/${slug}` (auto-route oleh halaman challenge: landing/setup untuk fresh, active, completed) — tanpa route baru, tanpa menyentuh halaman challenge. `?testDay` TIDAK dipakai di /challenges dan tidak menulis localStorage.
- Implementasi: id hook di CardContent + `<script>` bundled yang mengimpor `CHALLENGE_DAYS/dayForDate/isChallengeComplete/readChallengeStorage` dari `../../lib/paylater-challenge` → satu sumber state, tanpa backend/db/auth. Body/perubahan state tidak menyentuh halaman challenge.

## Homepage — Single Challenge Entry Point (in "Pelajari Sebelum Nyicil")

Section `#challenge-shortcut` terpisah sudah **dihapus** (tidak ada card/shortcut tambahan — challenge hanya muncul SATU KALI di homepage). Satu-satunya entry point challenge = item "30 Hari Tanpa PayLater" di section "Pelajari Sebelum Nyicil", kini state-aware via `readChallengeStorage()` (satu sumber state yang sama dengan /challenges & halaman challenge):
- **Fresh**: murni educational link (title + ArrowRight), identik dengan item lain.
- **Aktif**: + icon flame-streak kecil, sub "Hari ke-X dari 30", progress bar kecil `bg-primary` (width day/30), CTA "Lanjutkan Challenge". Klik → `/challenges/30-hari-tanpa-paylater`.
- **Selesai** (`completed || isChallengeComplete`): + icon trophy, sub "Challenge selesai", CTA "Lihat Hasil". Klik → URL sama.
- Tetap compact & konsisten dengan educational card lain (p-5, grid 2 kolom), tidak mengalahkan calculator/hero. Fresh = default SSR (hooks `hidden`); tanpa login/backend/db/state baru; `?testDay` tidak digunakan.

## Share Progress — Image Only

`shareWithImage` (aktif/milestone/completed) kini **image-only**:
- Web Share Files → `navigator.share({ files: [file] })` — tanpa `title`/`text`/`url` (menghilangkan double share di WhatsApp: [image] + [text message]).
- Download fallback tetap (`downloadPng`) tanpa clipboard text otomatis.
- Jika PNG gagal di-render → tidak share apa-apa (restore label).
- `buildShortShareTextSafe` dihapus (hanya dipakai flow image). `shareText` (landing/legacy, tombol sudah dihapus) tidak diubah; `buildChallengeShareText`/`copyText`/`CHALLENGE_SHARE_URL` tetap karena dipakai flow tersebut.
- Event `paylater_challenge_share` tetap — dipanggil sekali per path sukses (native | download). Template/design short URL `cekdulu.my.id/stopl` tidak disentuh.

## Verification

- `npm test` → 39 pass
- `npm run build` → 8 pages built successfully
- `npm run check` → 0 errors
- Built CSS memuat rule `#activeRocketImg` + media query `width>=640px` dengan custom props
- Built CSS bundle memuat: `linear-gradient(135deg,#ffde5c 0%,#ffd33d 55%,#ffb93a 100%)`, `.-scale-x-100`, `.-rotate-6`, `.opacity-10`
- Markup grid: `logBtn` & `activeShareBtn` masing-masing tepat 1× di halaman; tidak ada "Catat yang Berhasil Dihindari"
- (Iterasi ini) `bg-cover`/`bg-center` terkompilasi; `rocket-day-30.png` ada di bundle JS; streak img `h-11`; `yellow-aksen-banner.png` direferensikan di HTML
- (Share image) bundle JS page memuat: "Menyiapkan gambar", `canShare`, `cekdulu-30-hari-tanpa-paylater-day`, `share/30-days-no-paylater-share-template`, `rocket-day-07`, `URL.createObjectURL`
