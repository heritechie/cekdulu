# CekDulu.co.id — Agent Instructions

## Project

CekDulu.co.id adalah public consumer web utility untuk membantu orang Indonesia mengecek kemampuan finansial sebelum mengambil cicilan atau utang jangka panjang.

Core message:

> Sebelum nyicil, cek dulu.

Target utama:

- KPR / rumah
- Mobil
- Motor
- Pinjaman pribadi
- Pengeluaran dan kemampuan cicilan

CekDulu bukan bank, fintech lender, broker pinjaman, atau financial advisor.

Tujuan produk adalah membantu user memahami konsekuensi finansial sebelum mengambil keputusan, bukan mendorong user berutang.

---

## Product Philosophy

User datang bukan karena ingin menghitung DTI/DBR.

User ingin tahu:

> "Kalau saya mengambil cicilan ini, apakah kondisi keuangan saya masih cukup sehat?"

Karena itu jangan menjadikan DTI/DBR sebagai primary UX.

Prioritaskan:

1. Penghasilan
2. Cicilan yang sudah ada
3. Cicilan baru
4. Pengeluaran bulanan
5. Total beban
6. Sisa uang setelah seluruh beban
7. Debt ratio sebagai supporting metric
8. Penjelasan sederhana

Hasil harus mudah dipahami orang awam.

Jangan menggunakan threshold finansial sebagai kebenaran universal. Jika menggunakan threshold, jelaskan bahwa threshold tersebut merupakan indikator/ilustrasi dan dapat berbeda berdasarkan lender atau kebijakan underwriting.

---

## Core UX

CekDulu adalah mobile-first web utility.

Prioritas UX:

- cepat
- sederhana
- minim input
- nyaman digunakan dengan satu tangan
- tanpa login
- tanpa registrasi
- tidak membutuhkan backend untuk kalkulasi sederhana
- hasil mudah dipahami
- hasil mudah dibagikan

User harus dapat mulai menghitung tanpa membuat akun.

Jangan menambahkan authentication, database, user profile, atau backend tanpa kebutuhan nyata.

---

## Signature Visual

Signature visual CekDulu adalah:

> Timbangan keuangan ⚖️

Metafora utama:

Income vs Financial Burden

Timbangan bukan dekorasi.

Posisi atau kondisi visual harus membantu user memahami perubahan beban finansial.

Gunakan ilustrasi yang:

- friendly
- simple
- modern
- lightweight
- approachable
- mudah dikenali
- cocok untuk mobile

Hindari:

- dashboard bank
- enterprise fintech aesthetic
- loan marketplace aesthetic
- crypto aesthetic
- neon/glow berlebihan
- chart kompleks

Visual harus terasa seperti consumer utility, bukan aplikasi bank.

---

## Calculator V1

Core calculation:

Income

- Existing monthly debt
- New installment
- Monthly expenses
  ↓
  Financial balance

Output minimal:

- total monthly debt
- debt ratio / DBR
- total monthly expenses
- remaining money
- visual financial balance
- simple explanation

Jangan berhenti pada angka rasio.

Contoh hasil:

> Penghasilan Rp10.000.000  
> Total cicilan Rp3.000.000  
> Pengeluaran Rp5.500.000  
> Sisa Rp1.500.000

Kemudian jelaskan kondisi secara sederhana.

---

## Sharing

Share result merupakan bagian dari core acquisition strategy.

User tidak perlu login untuk share.

Hasil harus dapat dibagikan melalui:

- Web Share API jika tersedia
- WhatsApp
- social sharing
- copy link
- atau shareable result image jika relevan

Jangan mengekspos data finansial sensitif user secara sembarangan dalam URL.

Privacy harus menjadi pertimbangan utama dalam desain shareable result.

---

## Acquisition

CekDulu adalah traffic-driven product.

Prioritas:

1. SEO
2. TikTok
3. Social sharing
4. Organic referral

Setiap calculator harus memiliki potensi menjadi search landing page.

Search intent yang relevan:

- gaji 5 juta bisa cicilan berapa
- gaji 10 juta bisa KPR berapa
- cicilan mobil sesuai gaji
- cicilan motor sesuai gaji
- berapa persen gaji untuk cicilan
- kalkulator DBR
- kalkulator kemampuan cicilan
- kalkulator KPR
- kalkulator cicilan mobil
- kalkulator cicilan motor

Jangan membuat halaman SEO tipis hanya untuk mengejar keyword.

SEO page harus memberikan utility nyata.

---

## Advertising

Primary monetization:

> Display advertising

Urutan prioritas:

> User value > Calculator > Content > Ads

Ads tidak boleh merusak UX.

Jangan:

- menaruh ads agresif sebelum primary calculator
- membuat iklan terlihat seperti tombol
- menggunakan misleading CTA
- memenuhi halaman dengan banner
- mengganggu input
- mengganggu hasil calculator
- mengorbankan Core Web Vitals demi ad placement

Sediakan natural ad placement:

- setelah hero/intro
- antara calculator dan explanation
- setelah result
- di dalam long-form content jika relevan

Ads harus diperlakukan sebagai secondary experience.

---

## SEO

Setiap tool/page harus mempertimbangkan:

- search intent yang jelas
- unique useful content
- semantic HTML
- title
- meta description
- canonical URL
- Open Graph metadata
- internal linking
- structured data jika relevan
- mobile usability
- fast loading

Jangan melakukan programmatic SEO jika halaman tidak memiliki value yang cukup.

---

## Content

Gunakan Bahasa Indonesia yang sederhana.

Hindari jargon finansial sebagai primary communication.

Jelaskan istilah seperti DTI/DBR hanya jika membantu user.

Content dapat membahas:

- kemampuan cicilan
- DBR/DTI
- KPR
- cicilan mobil
- cicilan motor
- pengeluaran bulanan
- tenor
- bunga
- DP
- total pembayaran
- risiko cicilan terlalu besar

Jangan memberikan financial advice yang terlalu pasti atau sensationalist.

---

## Technical Principles

Prioritaskan:

- static-first
- client-side calculation
- minimal infrastructure
- fast page load
- SEO-friendly HTML
- accessible semantic HTML
- responsive design
- progressive enhancement

Gunakan dependency seminimal mungkin.

Setiap dependency harus memiliki alasan yang jelas.

Jangan membuat abstraction berlebihan.

Jangan membuat backend/database/auth jika kebutuhan dapat diselesaikan secara client-side.

---

## Architecture

Mulai dari satu reusable calculation engine.

Calculator yang berbeda harus menggunakan shared calculation logic jika memungkinkan.

Potential tools:

- Kalkulator Kemampuan Cicilan
- Kalkulator DBR
- Kalkulator KPR
- Kalkulator Cicilan Mobil
- Kalkulator Cicilan Motor
- Kalkulator Pengeluaran Bulanan
- Kalkulator Kemampuan Pinjaman
- Kalkulator DP dan Tenor

Jangan mengimplementasikan setiap calculator sebagai sistem terpisah jika logic dapat digunakan kembali.

---

## Design System

Design harus konsisten antar tools.

Gunakan:

- typography yang readable
- spacing yang generous
- rounded components secukupnya
- clear hierarchy
- large touch targets
- accessible contrast
- responsive layout

Signature element:

> ⚖️ Financial Balance

Setiap tool boleh memiliki ilustrasi konteks seperti rumah, mobil, atau motor, tetapi timbangan tetap menjadi visual language utama.

---

## Performance

Performance adalah prioritas karena traffic berasal dari search dan TikTok.

Target:

- fast initial load
- minimal JavaScript
- minimal third-party scripts
- optimized images
- good Core Web Vitals

Ads dan analytics tidak boleh menjadi alasan untuk membuat initial page load berat.

---

## Privacy

Calculator tidak membutuhkan akun.

Sebisa mungkin:

- kalkulasi dilakukan di browser
- jangan mengirim data finansial user ke server tanpa alasan jelas
- jangan menyimpan data finansial user tanpa kebutuhan
- jangan memasukkan data sensitif ke URL secara plaintext
- jelaskan jika suatu fitur membutuhkan data eksternal

Privacy adalah bagian dari trust CekDulu.

---

## Development Rules

Sebelum mengimplementasikan fitur:

1. Apakah fitur memberikan user value?
2. Apakah fitur membantu acquisition?
3. Apakah fitur membantu retention atau sharing?
4. Apa dampaknya terhadap SEO?
5. Apa dampaknya terhadap performance?
6. Apa dampaknya terhadap advertising?
7. Apakah fitur benar-benar membutuhkan backend?
8. Apakah ada solusi yang lebih sederhana?

Jika sebuah fitur tidak memberikan value yang jelas, challenge requirement tersebut sebelum mengimplementasikannya.

Prioritas:

> User Value
>
> > Simplicity
> >
> > Performance
> >
> > SEO
> >
> > Monetization

---

## Solo Developer Constraint

Project harus realistis untuk dikelola oleh solo developer.

Hindari:

- premature abstraction
- unnecessary microservices
- unnecessary backend
- complex state management
- unnecessary infrastructure
- over-engineering
- feature creep

Prefer shipping small, measurable improvements.

---

## Agent Behavior

Saat bekerja pada project:

- Jangan otomatis menyetujui ide.
- Challenge assumptions.
- Identifikasi UX risk.
- Identifikasi SEO risk.
- Identifikasi monetization risk.
- Identifikasi technical risk.
- Identifikasi execution risk.
- Jika pendekatan terlalu kompleks, usulkan alternatif yang lebih sederhana.
- Jika fitur tidak memberikan user value atau acquisition value yang jelas, pertanyakan kebutuhannya.
- Jangan mengubah product positioning tanpa alasan kuat.
- Jangan menambahkan fitur hanya karena secara teknis menarik.

Sebelum implementasi besar:

1. pahami existing code
2. identifikasi perubahan minimum
3. jelaskan trade-off jika diperlukan
4. implementasikan solusi paling sederhana
5. validasi hasil

---

## Definition of Done

Sebuah fitur dianggap selesai jika:

- bekerja di mobile
- accessible
- tidak merusak existing functionality
- tidak menambahkan complexity yang tidak perlu
- memiliki UX yang jelas
- mempertimbangkan SEO jika berupa page
- mempertimbangkan performance
- tidak mengganggu advertising placement
- calculation logic memiliki test yang sesuai
- dapat dipahami oleh user non-teknis

---

## North Star

CekDulu bukan bertujuan menjadi aplikasi finansial kompleks.

Tujuan awal:

> Build a useful financial utility that people want to use and share.

Core loop:

> Search / TikTok
> ↓
> CekDulu
> ↓
> Calculator
> ↓
> Financial Balance ⚖️
> ↓
> Share
> ↓
> More Users
> ↓
> Display Ads
