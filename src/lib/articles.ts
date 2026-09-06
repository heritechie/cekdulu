export interface ArticleMeta {
  title: string;
  description: string;
  href: string;
  category: string;
}

export const articles: ArticleMeta[] = [
  {
    title: 'Apa Itu DBR?',
    description:
      'Kenali apa itu DBR, cara menghitung rasio cicilan terhadap penghasilan, arti angka 20%, 30%, dan 40%, serta konteks acuan 30%.',
    href: '/apa-itu-dbr',
    category: 'Kemampuan Cicilan',
  },
  {
    title: 'Berapa Persen Gaji yang Ideal untuk Cicilan?',
    description:
      'Cara menilai kemampuan membayar cicilan tanpa hanya mengandalkan persentase — bandingkan sisa uang setelah cicilan dan pengeluaran.',
    href: '/berapa-persen-gaji-ideal-untuk-cicilan',
    category: 'Kemampuan Cicilan',
  },
];