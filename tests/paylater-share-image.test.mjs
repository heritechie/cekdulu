import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fillPlaceholders,
  milestoneCopyForShareImage,
  milestoneIllustrationForShareImage,
  progressWidthForShareImage,
  rocketStageForShareImage,
  swapImageHref,
  swapHeroHref,
} from '../src/lib/paylater-share-image.ts';

/**
 * Pure logic tests for the 30 Hari Tanpa PayLater share image.
 *
 * Only the DOM/canvas-free helpers live here: the rocket stage mapping, the
 * 650px progress-track width, and the emoji-free milestone copy. PNG rendering
 * itself depends on `canvas` + `Image`, so it is exercised in the browser.
 */

describe('rocketStageForShareImage', () => {
  test('maps progress days to the five rocket stages like the screen', () => {
    assert.equal(rocketStageForShareImage(1), 1);
    assert.equal(rocketStageForShareImage(6), 1);
    assert.equal(rocketStageForShareImage(7), 7);
    assert.equal(rocketStageForShareImage(13), 7);
    assert.equal(rocketStageForShareImage(14), 14);
    assert.equal(rocketStageForShareImage(20), 14);
    assert.equal(rocketStageForShareImage(21), 21);
    assert.equal(rocketStageForShareImage(29), 21);
    assert.equal(rocketStageForShareImage(30), 30);
  });

  test('clamps values above 30 to 30', () => {
    assert.equal(rocketStageForShareImage(45), 30);
  });
});

describe('progressWidthForShareImage', () => {
  test('fills the 650px track proportionally to day / 30', () => {
    assert.equal(progressWidthForShareImage(0), 0);
    assert.equal(progressWidthForShareImage(1), 22); // round(650 * 1/30)
    assert.equal(progressWidthForShareImage(7), 152); // round(650 * 7/30)
    assert.equal(progressWidthForShareImage(14), 303); // round(650 * 14/30)
    assert.equal(progressWidthForShareImage(21), 455); // round(650 * 21/30)
    assert.equal(progressWidthForShareImage(30), 650);
  });

  test('clamps out-of-range days', () => {
    assert.equal(progressWidthForShareImage(-2), 0);
    assert.equal(progressWidthForShareImage(90), 650);
  });
});

describe('milestoneCopyForShareImage', () => {
  test('returns an emoji-free headline + text keyed by rocket stage', () => {
    assert.deepEqual(milestoneCopyForShareImage(1), {
      headline: 'Aku baru mulai!',
      text: 'Hari pertama tanpa PayLater.',
    });
    assert.deepEqual(milestoneCopyForShareImage(7), {
      headline: '7 hari!',
      text: 'Aku masih lanjut tanpa PayLater.',
    });
    assert.deepEqual(milestoneCopyForShareImage(14), {
      headline: '14 hari!',
      text: 'Aku sudah dua minggu tanpa PayLater.',
    });
    assert.deepEqual(milestoneCopyForShareImage(21), {
      headline: '21 hari!',
      text: 'Tinggal sedikit lagi menuju 30 hari.',
    });
    assert.deepEqual(milestoneCopyForShareImage(30), {
      headline: 'Aku berhasil!',
      text: '30 hari tanpa PayLater selesai.',
    });
  });

  test('contains no emojis (SVG canvas text reliability)', () => {
    for (const sticker of [1, 7, 14, 21, 30]) {
      const { headline, text } = milestoneCopyForShareImage(sticker);
      assert.match(`${headline} ${text}`, /^[^\p{Emoji_Presentation}]+$/u);
    }
  });
});

describe('fillPlaceholders', () => {
  test('replaces every template placeholder for a mid-challenge day', () => {
    const template = [
      '{{DAY}} {{PROGRESS_WIDTH}} {{TRANSACTIONS}} {{SAVED_AMOUNT}} {{MILESTONE_HEADLINE}} {{MILESTONE_TEXT}}',
    ].join('\n');
    const out = fillPlaceholders(template, {
      day: 14,
      transactions: 3,
      savedAmount: 'Rp150.000',
    });
    assert.equal(out, '14 303 3 Rp150.000 14 hari! Aku sudah dua minggu tanpa PayLater.');
  });

  test('does not leave any {{PLACEHOLDER}} tokens behind', () => {
    const template = '<svg>{{DAY}}{{PROGRESS_WIDTH}}{{TRANSACTIONS}}{{SAVED_AMOUNT}}{{MILESTONE_HEADLINE}}{{MILESTONE_TEXT}}</svg>';
    const out = fillPlaceholders(template, { day: 7, transactions: 1, savedAmount: 'Rp10.000' });
    assert.doesNotMatch(out, /\{\{/);
  });
});

describe('milestoneIllustrationForShareImage', () => {
  test('uses flame streak while the challenge is running', () => {
    for (const day of [1, 7, 14, 21]) {
      assert.equal(
        milestoneIllustrationForShareImage(day),
        '/cekdulu-30-hari-tanpa-paylater-assets/illustrations/flame-streak.png',
      );
    }
  });

  test('uses trophy only on day 30', () => {
    assert.equal(
      milestoneIllustrationForShareImage(30),
      '/cekdulu-30-hari-tanpa-paylater-assets/illustrations/trophy.png',
    );
  });

  test('days above 30 also get the trophy (day >= 30 rule)', () => {
    assert.equal(
      milestoneIllustrationForShareImage(31),
      '/cekdulu-30-hari-tanpa-paylater-assets/illustrations/trophy.png',
    );
  });
});

describe('swapHeroHref', () => {
  const template = (
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<image id="heroIllustration" href="/old/path/rocket.png" x="690" y="330" ' +
    'width="330" height="330" preserveAspectRatio="xMidYMid meet"/>' +
    '<rect x="0" y="0" width="10" height="10"/>' +
    '</svg>'
  );

  test('keeps the <image> element self-closed (well-formed XML)', () => {
    const out = swapHeroHref(template, 'data:image/png;base64,AAAA');
    const image = out.match(/<image[^>]*\/>/);
    assert.ok(image, 'expected a self-closing <image /> element');
    // No dangling unclosed <image ...> without a closing tag.
    assert.equal((out.match(/<image/g) || []).length, 1);
    assert.equal((out.match(/<\/image/g) || []).length, 0);
    assert.ok(image[0].endsWith('/>'));
  });

  test('inlines the data URI into href', () => {
    const out = swapHeroHref(template, 'data:image/png;base64,AAAA');
    assert.match(out, /href="data:image\/png;base64,AAAA"/);
    assert.doesNotMatch(out, /href="\/old\/path\/rocket\.png"/);
  });

  test('preserves the rest of the SVG', () => {
    const out = swapHeroHref(template, 'data:image/png;base64,AAAA');
    assert.ok(out.includes('<rect x="0" y="0" width="10" height="10"/>'));
  });
});

describe('swapImageHref', () => {
  test('replaces only the requested supporting illustration', () => {
    const template = (
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<image id="heroIllustration" href="/rocket.png"/>' +
      '<image id="milestoneIllustration" href="/trophy.png"/>' +
      '</svg>'
    );
    const out = swapImageHref(template, 'milestoneIllustration', 'data:image/png;base64,TROPHY');

    assert.match(out, /id="heroIllustration" href="\/rocket\.png"/);
    assert.match(out, /id="milestoneIllustration" href="data:image\/png;base64,TROPHY"/);
    assert.match(out, /<image[^>]*id="milestoneIllustration"[^>]*\/>/);
  });
});
