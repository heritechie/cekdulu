import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import SavingBottomSheet, {
  SavingBottomSheetView,
  validateSavingForm,
  buildSaveFromForm,
} from '../src/components/wishlist/SavingBottomSheet.tsx';
import WishlistDetail from '../src/components/wishlist/WishlistDetail.tsx';

const noop = () => {};

function walkTree(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  const c = node.props?.children;
  if (Array.isArray(c)) c.forEach((x) => walkTree(x, visit));
  else if (c && typeof c === 'object') walkTree(c, visit);
}

function findByEl(node, predicate) {
  let found = null;
  walkTree(node, (n) => {
    if (!found && predicate(n)) found = n;
  });
  return found;
}

function viewProps(overrides = {}) {
  return {
    amountDisplay: '',
    note: '',
    errors: {},
    saving: false,
    proofPreviewUrl: null,
    onAmountChange: noop,
    onProofSelected: noop,
    onProofClear: noop,
    onNoteChange: noop,
    onSubmit: noop,
    onClose: noop,
    ...overrides,
  };
}

const renderSheetOpen = (props = {}) =>
  renderToStaticMarkup(
    createElement(SavingBottomSheet, { open: true, onClose: noop, onSubmit: noop, ...props }),
  );

describe('SavingBottomSheet — dialog and form presence', () => {
  test('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      createElement(SavingBottomSheet, { open: false, onClose: noop, onSubmit: noop }),
    );
    assert.equal(html.trim(), '', 'a closed sheet must render no markup');
  });

  test('renders a modal dialog when open', () => {
    const html = renderSheetOpen();
    assert.ok(html.includes('role="dialog"'), 'sheet must expose a dialog role');
    assert.ok(html.includes('aria-modal="true"'), 'sheet must be aria-modal');
    assert.ok(html.includes('aria-labelledby="saving-sheet-heading"'), 'sheet must be labelled');
    assert.ok(html.includes('Catat Tabungan'), 'sheet heading must render');
  });

  test('renders Nominal, Bukti Tabungan, and Catatan fields', () => {
    const html = renderSheetOpen();
    assert.ok(html.includes('Nominal'), 'nominal field label must render');
    assert.ok(html.includes('Bukti Tabungan'), 'proof field label must render');
    assert.ok(html.includes('Catatan'), 'note field label must render');
    assert.ok(html.includes('(opsional)'), 'note must be marked optional');
    assert.ok(html.includes('id="saving-amount"'), 'nominal input must be present');
    assert.ok(html.includes('id="saving-proof"'), 'proof input must be present');
    assert.ok(html.includes('id="saving-note"'), 'note input must be present');
  });

  test('nominal input is numeric-only, prefixed with Rp', () => {
    const html = renderSheetOpen();
    assert.match(html, /input[Mm]ode="numeric"/, 'nominal must use a numeric keypad');
    assert.ok(html.includes('>Rp<'), 'nominal input must show an Rp prefix');
  });

  test('proof input accepts only common image types', () => {
    const html = renderSheetOpen();
    assert.ok(
      html.includes('accept="image/jpeg,image/png,image/webp"'),
      'proof picker must be limited to jpeg/png/webp',
    );
  });

  test('renders submit button with busy-safe label', () => {
    const html = renderSheetOpen();
    assert.ok(html.includes('Simpan Catatan'), 'submit button must render');
    const busy = renderToStaticMarkup(
      createElement(SavingBottomSheet, { open: true, onClose: noop, onSubmit: noop }),
    );
    assert.ok(!busy.includes('Menyimpan…'), 'submit label must not start in busy state');
  });

  test('close button has an accessible label', () => {
    const html = renderSheetOpen();
    assert.ok(html.includes('aria-label="Tutup"'), 'close button must be accessible');
  });
});

describe('validateSavingForm — validation rules', () => {
  test('empty nominal → "Masukkan nominal tabungan"', () => {
    assert.equal(validateSavingForm('', null).amount, 'Masukkan nominal tabungan');
    assert.equal(validateSavingForm('   ', null).amount, 'Masukkan nominal tabungan');
  });

  test('non-numeric nominal → the empty-value message', () => {
    assert.equal(validateSavingForm('abc', null).amount, 'Masukkan nominal tabungan');
  });

  test('zero nominal → "Nominal harus lebih dari Rp0"', () => {
    assert.equal(validateSavingForm('0', null).amount, 'Nominal harus lebih dari Rp0');
    assert.equal(validateSavingForm('00.000', null).amount, 'Nominal harus lebih dari Rp0');
  });

  test('missing proof → "Tambahkan bukti tabungan"', () => {
    const errors = validateSavingForm('100000', null);
    assert.equal(errors.amount, undefined);
    assert.equal(errors.proof, 'Tambahkan bukti tabungan');
  });

  test('multiple errors appear together', () => {
    const errors = validateSavingForm('', null);
    assert.equal(errors.amount, 'Masukkan nominal tabungan');
    assert.equal(errors.proof, 'Tambahkan bukti tabungan');
  });

  test('valid nominal + proof → no errors', () => {
    const file = { name: 'proof.png' };
    const errors = validateSavingForm('100.000', file);
    assert.deepEqual(errors, {});
  });
});

describe('buildSaveFromForm — submit contract (does not persist)', () => {
  test('invalid form short-circuits with errors and never compresses', async () => {
    let compressed = false;
    const result = await buildSaveFromForm('', null, '', async () => {
      compressed = true;
      return 'data:image/jpeg;base64,x';
    });
    assert.equal(result.ok, false);
    assert.equal(compressed, false, 'compression must not run for an invalid form');
    assert.equal(result.errors.amount, 'Masukkan nominal tabungan');
    assert.equal(result.errors.proof, 'Tambahkan bukti tabungan');
  });

  test('valid form resolves the parsed amount, proof data URL, and trimmed note', async () => {
    const file = { name: 'proof.png' };
    const result = await buildSaveFromForm(
      '100.000',
      file,
      '  Gajian Januari  ',
      async () => 'data:image/jpeg;base64,NEVERPERSISTED',
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.data, {
      amount: 100000,
      proofImage: 'data:image/jpeg;base64,NEVERPERSISTED',
      note: 'Gajian Januari',
    });
  });

  test('blank note is omitted from the payload', async () => {
    const file = { name: 'proof.png' };
    const result = await buildSaveFromForm('50.000', file, '   ', async () => 'data:image/png;base64,y');
    assert.equal(result.ok, true);
    assert.equal(result.data.note, undefined);
  });

  test('empty compression result → "Gagal memproses bukti. Coba gambar lain."', async () => {
    const file = { name: 'proof.png' };
    const result = await buildSaveFromForm('50.000', file, '', async () => '');
    assert.equal(result.ok, false);
    assert.equal(result.errors.proof, 'Gagal memproses bukti. Coba gambar lain.');
  });

  test('compression failure never throws — maps to the same proof error', async () => {
    const file = { name: 'proof.png' };
    const result = await buildSaveFromForm('50.000', file, '', async () => {
      throw new Error('decode failed');
    });
    assert.equal(result.ok, false);
    assert.equal(result.errors.proof, 'Gagal memproses bukti. Coba gambar lain.');
  });

  test('the sheet module never persists on its own (WishlistApp owns it)', () => {
    const src = readFileSync('src/components/wishlist/SavingBottomSheet.tsx', 'utf8');
    assert.ok(!src.includes('writeGoalToStorage'), 'sheet must not write the goal itself');
    assert.ok(!src.includes('writeProofToDatabase'), 'sheet must not write proofs itself');
    assert.ok(!src.includes('LocalStorage'), 'sheet must not touch storage directly');
  });
});

describe('SavingBottomSheetView — interaction wiring', () => {
  test('close button calls onClose', () => {
    let closed = 0;
    const el = SavingBottomSheetView(viewProps({ onClose: () => closed++ }));
    const btn = findByEl(el, (n) => n.props?.['aria-label'] === 'Tutup');
    assert.ok(btn, 'close button must exist');
    btn.props.onClick();
    assert.equal(closed, 1, 'close button must trigger onClose');
  });

  test('backdrop click calls onClose', () => {
    let closed = 0;
    const el = SavingBottomSheetView(viewProps({ onClose: () => closed++ }));
    const backdrop = findByEl(
      el,
      (n) => typeof n.props?.className === 'string' && n.props.className.includes('backdrop-blur-sm'),
    );
    assert.ok(backdrop, 'backdrop must exist');
    backdrop.props.onClick();
    assert.equal(closed, 1, 'backdrop click must trigger onClose');
  });

  test('clicking inside the sheet does not close it', () => {
    let closed = 0;
    const el = SavingBottomSheetView(viewProps({ onClose: () => closed++ }));
    let sheetOps = 0;
    walkTree(el, (n) => {
      if (typeof n.props?.className === 'string' && n.props.className.includes('rounded-t-3xl')) {
        const overridden = n.props.onClick;
        if (overridden) sheetOps += 1;
      }
    });
    const input = findByEl(el, (n) => n.props?.id === 'saving-amount');
    const inputOnClick = input?.props?.onClick;
    assert.equal(sheetOps, 0, 'sheet panel must not treat clicks as close');
    assert.equal(inputOnClick, undefined, 'form inputs must not close the sheet');
  });

  test('nominal input change calls onAmountChange with the raw value', () => {
    let value = '';
    const el = SavingBottomSheetView(
      viewProps({ onAmountChange: (v) => (value = v) }),
    );
    const input = findByEl(el, (n) => n.props?.id === 'saving-amount');
    input.props.onChange({ target: { value: '1.500.000' } });
    assert.equal(value, '1.500.000');
  });

  test('note input change calls onNoteChange', () => {
    let value = '';
    const el = SavingBottomSheetView(viewProps({ onNoteChange: (v) => (value = v) }));
    const input = findByEl(el, (n) => n.props?.id === 'saving-note');
    input.props.onChange({ target: { value: 'Freelance' } });
    assert.equal(value, 'Freelance');
  });

  test('proof file selection calls onProofSelected with the file', () => {
    let picked = null;
    const el = SavingBottomSheetView(
      viewProps({ onProofSelected: (f) => (picked = f) }),
    );
    const input = findByEl(el, (n) => n.props?.id === 'saving-proof');
    const file = { name: 'bukti.png' };
    input.props.onChange({ target: { files: [file], value: 'old' } });
    assert.equal(picked, file, 'selected file must reach onProofSelected');
  });

  test('submit button calls onSubmit', () => {
    let submitted = 0;
    const el = SavingBottomSheetView(viewProps({ onSubmit: () => submitted++ }));
    const btn = findByEl(el, (n) => typeof n.props?.children === 'string' && n.props.children.includes('Simpan Catatan'));
    assert.ok(btn, 'submit button must exist');
    btn.props.onClick();
    assert.equal(submitted, 1);
  });

  test('empty proof state shows the upload box; a preview swaps it for a thumbnail', () => {
    const empty = renderToStaticMarkup(createElement(SavingBottomSheetView, viewProps()));
    assert.ok(empty.includes('Upload Bukti'), 'empty state must offer upload');
    assert.ok(!empty.includes('<img'), 'empty state must not show a preview image');

    const previewed = renderToStaticMarkup(
      createElement(
        SavingBottomSheetView,
        viewProps({ proofPreviewUrl: 'blob:test-preview' }),
      ),
    );
    assert.ok(previewed.includes('blob:test-preview'), 'preview image must render the object URL');
    assert.ok(!previewed.includes('Upload Bukti'), 'preview state must hide the upload box');
    assert.ok(previewed.includes('aria-label="Ganti bukti"'), 'preview must offer replacing the proof');
  });

  test('clear/replace button calls onProofClear', () => {
    let cleared = 0;
    const el = SavingBottomSheetView(
      viewProps({ proofPreviewUrl: 'blob:test-preview', onProofClear: () => cleared++ }),
    );
    const btn = findByEl(el, (n) => n.props?.['aria-label'] === 'Hapus bukti');
    assert.ok(btn, 'clear button must exist with a clear label');
    btn.props.onClick();
    assert.equal(cleared, 1, 'clear button must trigger onProofClear');
  });
});

describe('SavingBottomSheet — object URL and focus lifecycle (source contract)', () => {
  const src = readFileSync('src/components/wishlist/SavingBottomSheet.tsx', 'utf8');

  test('creates previews through URL.createObjectURL', () => {
    assert.match(src, /URL\.createObjectURL\(/, 'previews must be object URLs');
  });

  test('revokes every created object URL (close, clear, replace, unmount)', () => {
    assert.match(src, /URL\.revokeObjectURL\(proofPreviewUrl\)/, 'must revoke the preview URL');
    assert.ok(
      (src.match(/URL\.revokeObjectURL\(/g) ?? []).length >= 1,
      'revocation must be reachable in the effect cleanup',
    );
  });

  test('focuses the nominal input when the sheet opens', () => {
    assert.match(src, /amountRef\.current\?\.focus\(\)/, 'must move focus into the sheet on open');
  });

  test('Escape closes the sheet on desktop', () => {
    assert.match(src, /e\.key === 'Escape'/, 'Escape must close the sheet');
    assert.match(src, /document\.addEventListener\('keydown'/, 'Escape must be a document listener');
  });
});

describe('WishlistDetail integration — sheet is wired, not a stub', () => {
  const item = {
    id: 'goal-abc123',
    name: 'Sepatu Impian',
    productImage: '/wishlist/test-product.png',
    targetPrice: 2000000,
    saved: 1000000,
    remaining: 1000000,
    progress: 0.5,
    percent: 50,
    history: [],
    estimateLabel: null,
  };

  test('renders a closed sheet child by default and shows no dialog markup', () => {
    const el = WishlistDetail({ item, onBack: noop, onAddSaving: noop });
    const sheet = findByEl(el, (n) => n.type?.name === 'SavingBottomSheet');
    assert.ok(sheet, 'WishlistDetail must render the saving sheet');
    assert.equal(sheet.props.open, false, 'sheet must start closed');

    const html = renderToStaticMarkup(createElement(WishlistDetail, { item, onBack: noop, onAddSaving: noop }));
    assert.ok(!html.includes('saving-sheet-heading'), 'closed sheet must not leak into the DOM');
  });

  test('threads its sheet props into the SavingBottomSheet child', () => {
    const onCloseSaving = () => {};
    const onSaveSaving = () => {};
    const el = WishlistDetail({
      item,
      onBack: noop,
      onAddSaving: noop,
      isSavingOpen: true,
      onCloseSaving,
      onSaveSaving,
    });
    const sheet = findByEl(el, (n) => n.type?.name === 'SavingBottomSheet');
    assert.equal(sheet.props.open, true, 'open state must reach the sheet');
    assert.equal(sheet.props.onClose, onCloseSaving, 'close handler must reach the sheet');
    assert.equal(sheet.props.onSubmit, onSaveSaving, 'save handler must reach the sheet');
  });

  test('open sheet renders its dialog inside the detail page', () => {
    const html = renderToStaticMarkup(
      createElement(WishlistDetail, {
        item,
        onBack: noop,
        onAddSaving: noop,
        isSavingOpen: true,
      }),
    );
    assert.ok(html.includes('saving-sheet-heading'), 'open sheet must render inside the detail view');
    assert.ok(html.includes('Bukti Tabungan'), 'open sheet must render its fields');
  });
});