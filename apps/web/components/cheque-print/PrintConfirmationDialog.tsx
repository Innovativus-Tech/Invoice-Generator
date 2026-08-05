"use client";

import type { ChequePrintData } from "@/lib/cheque-print/chequeTypes";

type PrintConfirmationDialogProps = {
  open: boolean;
  data: ChequePrintData;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
};

export default function PrintConfirmationDialog({
  open,
  data,
  onCancel,
  onConfirm,
  confirming,
}: PrintConfirmationDialogProps) {
  if (!open) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[rgb(7_26_20_/_0.62)] p-4 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-confirm-title"
    >
      <div className="modal-panel ui-panel max-h-[90vh] w-full max-w-xl overflow-y-auto p-6 md:p-8">
        <p className="ui-label">Final review</p>
        <h2
          id="print-confirm-title"
          className="mt-2 font-display text-[2rem] leading-none text-ink md:text-[2.35rem]"
        >
          Confirm the leaf
        </h2>
        <p className="mt-3 text-sm text-ink-soft">
          One copy. Actual Size. No Fit to Page.
        </p>

        <dl className="mt-6 space-y-3 border-y border-line py-5">
          {data.chequeNumber && (
            <Row label="Cheque no." value={data.chequeNumber} mono note="not printed" />
          )}
          <Row label="Payee" value={data.payee} />
          <Row label="Amount" value={data.amountFormatted} />
          <Row label="Words" value={data.amountWords} upper />
          <Row
            label="Date"
            value={data.dateRaw.split("").join(" ")}
            mono
          />
        </dl>

        <div className="mt-5 rounded-[12px] border border-[color-mix(in_srgb,var(--brass)_40%,var(--line))] bg-[rgb(168_137_85_/_0.08)] px-4 py-3.5 text-sm leading-relaxed text-ink-soft">
          <p className="font-semibold text-ink">Press checklist</p>
          <p className="mt-1.5">20 cm x 9 cm leaf · scale 100% · one copy</p>
          <p>Correct face and feed direction</p>
          <p>MICR, account and signature remain untouched</p>
        </div>

        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="ui-btn ui-btn-ghost"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="ui-btn ui-btn-primary min-w-[11rem]"
          >
            {confirming ? "Opening print..." : "Confirm and print"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  upper,
  note,
}: {
  label: string;
  value: string;
  mono?: boolean;
  upper?: boolean;
  note?: string;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <dt className="w-24 shrink-0 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-brass/80">
        {label}
      </dt>
      <dd
        className={`min-w-0 flex-1 font-medium text-ink ${mono ? "font-mono tracking-wider" : ""} ${upper ? "uppercase" : ""}`}
      >
        {value}
        {note && (
          <span className="ml-2 text-xs font-normal normal-case tracking-normal text-ink-soft/60">
            {note}
          </span>
        )}
      </dd>
    </div>
  );
}
