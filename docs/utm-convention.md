# Konvensi UTM untuk Meta Ads (Facebook / Instagram)

Dokumen acuan manual untuk membuat URL kampanye berbayar Meta Ads yang mengarah ke
halaman kampanye CekDulu. Konvensi ini tidak diimplementasikan di kode aplikasi —
digunakan saat menyusun iklan di Meta Ads Manager.

## Struktur URL kampanye

Halaman kampanye CekDulu punya bentuk:

```
https://cekdulu.co.id/c/{marketer_slug}/{campaign_slug}
```

`marketer_slug` dan `campaign_slug` berasal dari data model di
`src/data/campaigns.ts` (mis. `master-property` / `keandra-park-cluster-aranda`).
Jangan mengganti nilai dari data model atau membuat varian baru tanpa menambahkannya
ke data tersebut.

## Parameter UTM

| Parameter      | Nilai yang dipakai      | Keterangan                                                 |
| -------------- | ----------------------- | ---------------------------------------------------------- |
| `utm_source`   | `facebook` atau `instagram` | Media sosial tempat iklan tayang.                       |
| `utm_medium`   | `paid_social`           | Tetap satu nilai ini untuk semua Meta Ads.                 |
| `utm_campaign` | nama kampanye iklan     | Identitas kampanye marketing di Meta (bukan slug CekDulu). |
| `utm_content`  | identitas kreatif/ads   | Untuk membedakan variasi iklan/creative.                   |
| `utm_term`     | (tidak dipakai)         | Tidak digunakan kecuali ada kebutuhan konkret.             |
| `fbclid`       | otomatis dari Meta      | Ditambahkan otomatis oleh Meta; jangan diubah atau dihapus. |

Setiap halaman kampanye di-`noindex` dan tidak masuk sitemap. Parameter UTM tidak
memengaruhi konten halaman — aplikasi membiarkan parameter tersebut utuh sehingga
GA4 memprosesnya sebagai traffic source standar.

## Aturan penamaan nilai

- Huruf kecil semua.
- Tanpa spasi; gunakan underscore (`_`) sebagai pemisah.
- URL-safe (alfanumerik dan underscore).
- Stabil, jangan berubah antar periode tanpa perlu.
- Manusia mudah membacanya.

### Contoh `utm_campaign`

- `keandra_launch`
- `keandra_testimonial`
- `griya_taman_suci_launch`

### Contoh `utm_content`

- `video_01`, `video_02`
- `carousel_01`
- `reels_01`

## Identitas CekDulu vs atribusi traffic

Dua hal yang berbeda dan tidak boleh dicampur:

- **Identitas kampanye CekDulu:** `campaign_slug` + `marketer_slug` — dipakai event
  GA4 (`campaign_view`, `calculator_start`, `calculator_complete`, `simulation_saved`,
  `whatsapp_click`) dan berasal dari data model.
- **Atribusi traffic:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`,
  `utm_term`, `gclid`/`fbclid` — diproses otomatis oleh GA4 menjadi source/medium.

Jangan menggunakan `utm_campaign` sebagai pengganti `campaign_slug`. Keduanya adalah
dimensi terpisah: GA4 tetap menghubungkan event kampanye CekDulu ke sesi traffic
melalui atribusi standar.

## Aturan yang diikuti aplikasi (jangan dilanggar saat setup)

- Jangan otomatis menambahkan UTM ke canonical URL atau tautan internal.
- Jangan mengubah URL canonical karena adanya parameter UTM.
- Jangan menghapus parameter UTM dari URL yang masuk — GA4 membacanya langsung dari URL.
- Jangan membuat sistem `tracking_code`/`ref` sendiri.
- Jangan menambahkan logika UTM custom ke halaman kampanye.

## Privasi

Nilai UTM tidak boleh mengandung data finansial atau data sensitif, termasuk:

- penghasilan, cicilan, pengeluaran
- nilai DBR/DTI
- jumlah pinjaman
- informasi pribadi pengguna
- nomor telepon
- data sensitif lain

## Contoh URL jadi

Facebook — kampanye peluncuran, video awal:

```
https://cekdulu.co.id/c/master-property/keandra-park-cluster-aranda?utm_source=facebook&utm_medium=paid_social&utm_campaign=keandra_launch&utm_content=video_01
```

Facebook — kampanye testimonial, carousel:

```
https://cekdulu.co.id/c/master-property/keandra-park-cluster-aranda?utm_source=facebook&utm_medium=paid_social&utm_campaign=keandra_testimonial&utm_content=carousel_01
```

Instagram — peluncuran, Reels:

```
https://cekdulu.co.id/c/master-property/keandra-park-cluster-aranda?utm_source=instagram&utm_medium=paid_social&utm_campaign=keandra_launch&utm_content=reels_01
```