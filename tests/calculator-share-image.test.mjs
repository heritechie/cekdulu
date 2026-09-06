import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SOCIAL_SHARE_CARD_HEIGHT,
  calculatorResultTitle,
  ctaSpans,
  fillCalculatorSharePlaceholders,
  formatMoneyRupiah,
  socialResultDescription,
  swapCalculatorImageHref,
} from '../src/lib/calculator-share-image.ts';
import {
  SHARE_CARD_HEIGHT,
  personalReportRows,
} from '../src/lib/share-image.ts';

/**
 * Pure logic tests for the Kalkulator Kemampuan Cicilan SOCIAL share image.
 *
 * PNG rendering depends on `canvas` + `Image`, so it is exercised in the
 * browser (same convention as the challenge share image). Here we lock down:
 * (1) the indicative, first-person insight copy (reusing the existing
 * classification, never recomputing it), (2) the minimal placeholder set, and
 * (3) PRIVACY — the social image shows ONLY the remaining money, never income,
 * total installment, or expenses (the personal card alone shows full detail).
 */

/** The raw template the browser will render. */
const template = readFileSync(
  join(process.cwd(), 'public/share/kalkulator-kemampuan-cicilan-share.svg'),
  'utf8'
);

const SUPPORTED_PLACEHOLDERS = [
  '{{RESULT_TITLE}}',
  '{{REMAINING_AMOUNT}}',
  '{{RESULT_DESCRIPTION}}',
];

const FORBIDDEN_PLACEHOLDERS = [
  '{{INCOME}}',
  '{{TOTAL_INSTALLMENT}}',
  '{{EXPENSE}}',
  '{{REMAINING}}',
  '{{CTA}}',
];

/** Public data shapes the social image never receives. */
const FORBIDDEN_LABELS = ['Penghasilan', 'Total cicilan', 'Pengeluaran'];

describe('calculatorResultTitle', () => {
  test('reuses the existing classification: healthy / warning / critical', () => {
    assert.equal(calculatorResultTitle(1_500_000, 'healthy'), 'Cicilanku terlihat cukup seimbang');
    assert.equal(calculatorResultTitle(1_500_000, 'warning'), 'Porsi cicilanku sudah cukup besar');
    assert.equal(calculatorResultTitle(1_500_000, 'critical'), 'Porsi cicilanku terlalu besar');
  });

  test('negative remaining overrides every status class (same rule as the page)', () => {
    for (const cls of ['healthy', 'warning', 'critical']) {
      assert.equal(
        calculatorResultTitle(-100_000, cls),
        'Beban bulananku melebihi penghasilan'
      );
    }
  });

  test('is first-person ("bulananku"/"cicilanku"), like the shared moment', () => {
    for (const cls of ['healthy', 'warning', 'critical']) {
      const t = calculatorResultTitle(1_500_000, cls);
      assert.match(t, /bulananku|cicilanku/i);
    }
    assert.match(calculatorResultTitle(-1, 'healthy'), /bulananku/);
  });

  test('never makes absolute "you can afford it" claims', () => {
    const banned = [
      'kamu mampu', 'kamu bisa', 'kamu layak', 'berarti kamu',
      'pinjaman ini aman', 'gas ambil', 'dilarang', 'tidak boleh', 'tidak layak',
    ];
    for (const cls of ['healthy', 'warning', 'critical', 'negative']) {
      const remaining = cls === 'negative' ? -1 : 1_500_000;
      const title = calculatorResultTitle(remaining, cls);
      for (const phrase of banned) {
        assert.ok(!title.toLowerCase().includes(phrase), `banned phrase: "${phrase}"`);
      }
    }
  });

  test('wording stays indicative, not prescriptive', () => {
    const titles = [
      calculatorResultTitle(1_500_000, 'healthy'),
      calculatorResultTitle(1_500_000, 'warning'),
      calculatorResultTitle(1_500_000, 'critical'),
      calculatorResultTitle(-1, 'healthy'),
    ];
    for (const t of titles) {
      assert.match(t, /terlihat|cukup|sudah|melebihi|terlalu/);
    }
  });
});

describe('socialResultDescription', () => {
  test('is the fixed two-line caption above the amount', () => {
    assert.equal(socialResultDescription(), 'Setelah dicek,\nsisa penghasilanku');
  });

  test('contains no hoarded figures and reads first-person', () => {
    const d = socialResultDescription().toLowerCase();
    assert.match(d, /sisa penghasilanku/);
    for (const label of FORBIDDEN_LABELS) {
      assert.ok(!d.includes(label), `forbidden label: ${label}`);
    }
  });
});

describe('social image differs from the personal result card', () => {
  test('social insight copy is a different title, not the personal headline', () => {
    const personalHealthy = ['Dengan cicilan ini, keuanganmu masih sehat', 'Kondisi keuanganmu masih sehat'];
    const social = calculatorResultTitle(1_500_000, 'healthy');
    assert.ok(!personalHealthy.includes(social));
  });

  test('social canvas is 1080x1920; the personal card is shorter (1080x880)', () => {
    assert.equal(SOCIAL_SHARE_CARD_HEIGHT, 1920);
    assert.equal(SHARE_CARD_HEIGHT, 880);
    assert.notEqual(SOCIAL_SHARE_CARD_HEIGHT, SHARE_CARD_HEIGHT);
  });

  test('social CTA is a static invitation to check one\u2019s own finances', () => {
    assert.match(template, /coba cek dulu kondisi keuanganmu\./);
    assert.match(template, /Kalau kamu juga lagi mau ambil cicilan,/);
    assert.match(template, /cekdulu\.my\.id/);
    assert.ok(!/(beli|ambil kredit|daftar|pinjam) sekarang|tawaran/i.test(template));
  });
});

describe('formatMoneyRupiah', () => {
  test('formats positive and negative amounts like the personal card', () => {
    assert.equal(formatMoneyRupiah(2_200_000), 'Rp2.200.000');
    assert.equal(formatMoneyRupiah(20_000_000), 'Rp20.000.000');
    assert.equal(formatMoneyRupiah(11_950_000), 'Rp11.950.000');
    assert.equal(formatMoneyRupiah(-500_000), '-Rp500.000');
  });
});

describe('ctaSpans', () => {
  test('splits multi-line text into centered tspans', () => {
    const spans = ctaSpans(540, 44, socialResultDescription());
    assert.ok(spans.includes('x="540" dy="0"'));
    assert.ok(spans.includes('x="540" dy="44"'));
    assert.equal((spans.match(/<tspan/g) || []).length, 2);
    assert.ok(spans.includes('sisa penghasilanku'));
  });

  test('escapes XML special characters', () => {
    const spans = ctaSpans(10, 20, 'a < b & c');
    assert.ok(spans.includes('a &lt; b &amp; c'));
  });
});

describe('fillCalculatorSharePlaceholders', () => {
  const data = { remaining: 2_200_000, financialStatusClass: 'healthy' };

  test('replaces the insight title and the single remaining figure', () => {
    const filled = fillCalculatorSharePlaceholders(
      '{{RESULT_TITLE}} {{REMAINING_AMOUNT}} {{RESULT_DESCRIPTION}}',
      data
    );
    assert.ok(filled.includes('Cicilanku terlihat cukup seimbang'));
    assert.ok(filled.includes('Rp2.200.000'));
    assert.ok(filled.includes('Setelah dicek,'));
    assert.ok(filled.includes('sisa penghasilanku'));
  });

  test('leaves no template placeholder behind', () => {
    const filled = fillCalculatorSharePlaceholders(template, data);
    assert.doesNotMatch(filled, /\{\{[A-Z_]+\}\}/);
  });

  test('renders negative remaining as -Rp', () => {
    const filled = fillCalculatorSharePlaceholders('{{REMAINING_AMOUNT}}', {
      ...data,
      remaining: -1_200_000,
    });
    assert.ok(filled.includes('-Rp1.200.000'));
  });

  test('social image contains ONLY the remaining figure (privacy)', () => {
    const filled = fillCalculatorSharePlaceholders(template, data);
    const amounts = filled.match(/\bRp[\d.]+\b/g) || [];
    assert.deepEqual(amounts, ['Rp2.200.000']);
    for (const label of FORBIDDEN_LABELS) {
      assert.ok(!filled.includes(label), `personal-only detail leaked: ${label}`);
    }
  });
});

describe('social template integrity', () => {
  test('template contains exactly the supported placeholders (and no others)', () => {
    const tokens = Array.from(template.matchAll(/\{\{[A-Z_]+\}\}/g), (m) => m[0]);
    assert.equal(new Set(tokens).size, SUPPORTED_PLACEHOLDERS.length);
    for (const p of SUPPORTED_PLACEHOLDERS) {
      assert.ok(tokens.includes(p), `missing ${p}`);
    }
    for (const p of FORBIDDEN_PLACEHOLDERS) {
      assert.ok(!tokens.includes(p), `old placeholder still present: ${p}`);
    }
  });

  test('template never embeds income / installment / expense labels', () => {
    for (const label of FORBIDDEN_LABELS) {
      assert.ok(!template.includes(label), `personal-only detail in template: ${label}`);
    }
  });

  test('every <image> element is self-closed (SVG-as-image strict XML)', () => {
    const images = template.match(/<image[^>]*>/g) || [];
    assert.ok(images.length >= 3, 'hero + balance + footer images expected');
    assert.ok(/id="balanceIllustration"/.test(template), 'balance illustration missing');
    for (const tag of images) {
      assert.ok(tag.trim().endsWith('/>'), `image not self-closed: ${tag.slice(0, 60)}`);
    }
  });

  test('template is a single valid-looking svg document', () => {
    assert.match(template.trim(), /^<svg[\s\S]*<\/svg>$/);
  });
});

describe('swapCalculatorImageHref', () => {
  test('swaps brand logo, footer logo, and balance illustration', () => {
    const svg = '<image id="brandLogoHero" href="/images/logo-cekdulu.png" filter="url(#whiteLogo)"/><image id="balanceIllustration" href="/images/illustrations/hero-balance-v1.png"/>';
    const out = swapCalculatorImageHref(svg, 'brandLogoHero', 'data:image/png;base64,AAAA');
    const out2 = swapCalculatorImageHref(out, 'balanceIllustration', 'data:image/png;base64,BBBB');
    assert.ok(out2.includes('data:image/png;base64,AAAA'));
    assert.ok(out2.includes('data:image/png;base64,BBBB'));
    assert.ok(!out2.includes('logo-cekdulu.png'));
    assert.ok(!out2.includes('hero-balance-v1.png'));
  });

  test('keeps the element self-closed while swapping the href', () => {
    const svg = '<image id="brandLogoHero" href="/images/logo-cekdulu.png" x="58" y="46" width="330" height="110" preserveAspectRatio="xMinYMid meet" filter="url(#whiteLogo)"/>';
    const out = swapCalculatorImageHref(svg, 'brandLogoHero', 'data:image/png;base64,AAAA');
    assert.ok(out.includes('data:image/png;base64,AAAA'));
    assert.ok(out.trim().endsWith('/>'));
    assert.ok(!out.includes('logo-cekdulu.png'));
  });
});

describe('personalReportRows (Simpan Hasil keeps every financial detail)', () => {
  const rows = personalReportRows(2_200_000, 20_000_000, 11_950_000, 5_850_000);

  test('all four financial details appear on the personal card', () => {
    assert.deepEqual(
      rows.map((r) => r.label),
      ['Penghasilan', 'Total cicilan', 'Pengeluaran', 'Sisa uang']
    );
  });

  test('values map to the user input exactly', () => {
    assert.equal(rows[0].value, 20_000_000);
    assert.equal(rows[1].value, 11_950_000);
    assert.equal(rows[2].value, 5_850_000);
    assert.equal(rows[3].value, 2_200_000);
  });

  test('only the remaining figure is visually emphasized', () => {
    assert.deepEqual(rows.map((r) => r.emphasize), [false, false, false, true]);
  });
});