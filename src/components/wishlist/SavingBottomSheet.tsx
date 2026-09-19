import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  compressImage,
  formatMoney,
  parseMoney,
  validateImageFile,
} from '../../lib/wishlist';

/**
 * Form payload produced by the saving sheet after successful validation.
 * Persistence is deliberately NOT part of this component: WishlistApp owns it.
 */
export interface SaveEntryFormData {
  amount: number;
  proofImage: string;
  note?: string;
}

export interface SavingErrors {
  amount?: string;
  proof?: string;
}

/**
 * Pure field-level validation, extracted so the exact rules stay testable:
 *
 * - empty / non-numeric nominal → "Masukkan nominal tabungan"
 * - filled but not greater than Rp0 → "Nominal harus lebih dari Rp0"
 * - missing proof → "Tambahkan bukti tabungan"
 * - multiple errors can appear at once (each shown near its own field)
 */
export function validateSavingForm(
  amountDisplay: string,
  proofFile: File | null,
): SavingErrors {
  const errors: SavingErrors = {};
  const raw = String(amountDisplay ?? '').trim();
  if (!raw || !/\d/.test(raw)) {
    errors.amount = 'Masukkan nominal tabungan';
  } else if (!(parseMoney(raw) > 0)) {
    errors.amount = 'Nominal harus lebih dari Rp0';
  }
  if (!proofFile) {
    errors.proof = 'Tambahkan bukti tabungan';
  }
  return errors;
}

export type SaveBuildResult =
  | { ok: true; data: SaveEntryFormData }
  | { ok: false; errors: SavingErrors };

/**
 * Validation + proof compression in one pass. Never throws: compression
 * failures (or an empty data URL from `compress`) map to a proof error.
 * `compress` is injectable so tests can supply a deterministic stub.
 */
export async function buildSaveFromForm(
  amountDisplay: string,
  proofFile: File | null,
  note: string,
  compress: (file: File) => Promise<string> = compressImage,
): Promise<SaveBuildResult> {
  const errors = validateSavingForm(amountDisplay, proofFile);
  if (errors.amount || errors.proof) return { ok: false, errors };
  let proofImage = '';
  try {
    proofImage = await compress(proofFile as File);
  } catch {
    proofImage = '';
  }
  if (!proofImage) {
    return { ok: false, errors: { proof: 'Gagal memproses bukti. Coba gambar lain.' } };
  }
  return {
    ok: true,
    data: {
      amount: parseMoney(amountDisplay),
      proofImage,
      note: typeof note === 'string' && note.trim() ? note.trim() : undefined,
    },
  };
}

interface SavingBottomSheetViewProps {
  amountRef?: RefObject<HTMLInputElement | null>;
  amountDisplay: string;
  note: string;
  errors: SavingErrors;
  saving: boolean;
  proofPreviewUrl: string | null;
  onAmountChange: (display: string) => void;
  onProofSelected: (file: File) => void;
  onProofClear: () => void;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

/**
 * Pure presentational dialog + form. State and effects live in the default
 * export; this stays hook-free so tests can call it directly as a function
 * and walk handlers from the returned element tree.
 */
export function SavingBottomSheetView(props: SavingBottomSheetViewProps) {
  const {
    amountRef,
    amountDisplay,
    note,
    errors,
    saving,
    proofPreviewUrl,
    onAmountChange,
    onProofSelected,
    onProofClear,
    onNoteChange,
    onSubmit,
    onClose,
  } = props;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="saving-sheet-heading"
    >
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-border bg-background shadow-2xl">
        <div className="mx-auto mt-1 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        <div className="mb-3 flex items-center justify-between px-5 pt-3 pb-2">
          <h2 id="saving-sheet-heading" className="text-xl font-bold tracking-tight">
            Catat Tabungan
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Tutup"
          >
            <span className="text-lg leading-none" aria-hidden="true">
              ✕
            </span>
          </button>
        </div>

        <div className="space-y-5 px-5 pb-8">
          <div>
            <label htmlFor="saving-amount" className="mb-1.5 block text-sm font-medium text-foreground">
              Nominal
            </label>
            <div className="relative">
              <span
                className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-medium text-muted-foreground"
                aria-hidden="true"
              >
                Rp
              </span>
              <input
                ref={amountRef}
                id="saving-amount"
                type="text"
                inputMode="numeric"
                value={amountDisplay}
                onChange={(e) => onAmountChange(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 pl-10 text-lg font-semibold text-foreground outline-none transition-colors tabular-nums placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/40"
              />
            </div>
            {errors.amount ? (
              <p className="mt-1.5 text-sm font-medium text-destructive" role="alert">
                {errors.amount}
              </p>
            ) : null}
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="saving-proof" className="block text-sm font-medium text-foreground">
                Bukti Tabungan <span aria-hidden="true">*</span>
              </label>
            </div>

            {proofPreviewUrl ? (
              <div className="relative block">
                <label
                  htmlFor="saving-proof"
                  className="block cursor-pointer"
                  aria-label="Ganti bukti"
                >
                  <img
                    src={proofPreviewUrl}
                    alt="Pratinjau bukti tabungan"
                    className="max-h-44 w-full rounded-xl object-cover"
                  />
                </label>
                <button
                  type="button"
                  onClick={onProofClear}
                  className="absolute top-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/90 text-foreground backdrop-blur transition-colors hover:bg-muted"
                  aria-label="Hapus bukti"
                >
                  <span className="text-sm leading-none" aria-hidden="true">
                    ✕
                  </span>
                </button>
              </div>
            ) : (
              <label
                htmlFor="saving-proof"
                className="relative block cursor-pointer rounded-2xl border-2 border-dashed border-border bg-muted/50 p-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-background text-primary shadow-sm">
                    <CameraIcon />
                  </span>
                  <p className="text-sm font-medium text-foreground">Upload Bukti</p>
                  <p className="text-xs text-muted-foreground">
                    Screenshot m-banking, e-wallet, atau bukti transfer
                  </p>
                </div>
              </label>
            )}
            <input
              id="saving-proof"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Upload bukti tabungan"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onProofSelected(file);
                e.target.value = '';
              }}
            />
            {errors.proof ? (
              <p className="mt-1.5 text-sm font-medium text-destructive" role="alert">
                {errors.proof}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="saving-note" className="mb-1.5 block text-sm font-medium text-foreground">
              Catatan <span className="text-muted-foreground/60">(opsional)</span>
            </label>
            <input
              id="saving-note"
              type="text"
              maxLength={120}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/40"
            />
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="w-full rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {saving ? 'Menyimpan…' : 'Simpan Catatan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

interface SavingBottomSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: SaveEntryFormData) => void;
}

/**
 * Self-contained bottom sheet for recording a saving entry.
 *
 * Owns every piece of form state (nominal, proof, note, errors, busy flag),
 * focuses the nominal input on open, and never persists anything itself — the
 * payload goes to `onSubmit` and WishlistApp decides how to store it.
 */
export default function SavingBottomSheet({ open, onClose, onSubmit }: SavingBottomSheetProps) {
  const amountRef = useRef<HTMLInputElement | null>(null);
  const [amountDisplay, setAmountDisplay] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<SavingErrors>({});
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmountDisplay('');
    setNote('');
    setErrors({});
    setProofFile(null);
    setProofPreviewUrl(null);
    setSaving(false);
    requestAnimationFrame(() => amountRef.current?.focus());
  }, [open]);

  useEffect(() => {
    return () => {
      if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    };
  }, [proofPreviewUrl]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleProofSelected = (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.ok) {
      setErrors((prev) => ({ ...prev, proof: validation.message }));
      return;
    }
    if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    setProofPreviewUrl(URL.createObjectURL(file));
    setProofFile(file);
    setErrors((prev) => ({ ...prev, proof: undefined }));
  };

  const handleProofClear = () => {
    if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    setProofPreviewUrl(null);
    setProofFile(null);
  };

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    const result = await buildSaveFromForm(amountDisplay, proofFile, note);
    setSaving(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onSubmit(result.data);
  };

  return (
    <SavingBottomSheetView
      amountRef={amountRef}
      amountDisplay={amountDisplay}
      note={note}
      errors={errors}
      saving={saving}
      proofPreviewUrl={proofPreviewUrl}
      onAmountChange={(raw) => setAmountDisplay(formatMoney(raw))}
      onProofSelected={handleProofSelected}
      onProofClear={handleProofClear}
      onNoteChange={setNote}
      onSubmit={handleSubmit}
      onClose={onClose}
    />
  );
}