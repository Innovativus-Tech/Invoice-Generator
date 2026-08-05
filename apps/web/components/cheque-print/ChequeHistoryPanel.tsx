"use client";

import type { ChequeHistoryEntry } from "@/lib/cheque-print/chequeTypes";

type ChequeHistoryPanelProps = {
  entries: ChequeHistoryEntry[];
  onClear: () => void;
  onReuse?: (entry: ChequeHistoryEntry) => void;
};

export default function ChequeHistoryPanel({
  entries,
  onClear,
  onReuse,
}: ChequeHistoryPanelProps) {
  return (
    <aside className="ui-panel sticky top-5 overflow-hidden p-0">
      <div className="border-b border-line/80 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-[1.65rem] leading-none text-ink">
            Ledger
          </h2>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-soft hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft/75">
          Local only. Numbers stay off the printed leaf.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="font-display text-xl text-ink/45">Quiet ledger</p>
          <p className="mt-2 text-xs text-ink-soft/70">
            Printed cheques will collect here
          </p>
        </div>
      ) : (
        <ul className="max-h-[34rem] space-y-0 overflow-auto">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              className="history-row border-b border-line/70 px-5 py-3.5 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-brass/80">
                    Entry {String(entries.length - index).padStart(2, "0")}
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold tracking-wide text-ink">
                    {entry.chequeNumber}
                  </p>
                  <p className="mt-0.5 max-w-[12rem] truncate text-xs text-ink-soft">
                    {entry.payee}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-leaf">
                  {entry.amountFormatted}
                </p>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <p className="font-mono text-[11px] tracking-[0.12em] text-ink-soft/70">
                  {entry.dateRaw}
                </p>
                {onReuse && (
                  <button
                    type="button"
                    className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-leaf hover:text-leaf-deep"
                    onClick={() => onReuse(entry)}
                  >
                    Reuse
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
