"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/cheque-print/AppHeader";
import ChequeHistoryPanel from "@/components/cheque-print/ChequeHistoryPanel";
import ChequePreview from "@/components/cheque-print/ChequePreview";
import LiveChequeFace from "@/components/cheque-print/LiveChequeFace";
import PrintConfirmationDialog from "@/components/cheque-print/PrintConfirmationDialog";
import { amountToIndianWordsResult } from "@/lib/cheque-print/amountToIndianWords";
import {
  adjustAllFontSizesMm,
  loadAlignmentMm,
  saveAlignmentMm,
} from "@/lib/cheque-print/alignmentStorage";
import {
  clearChequeHistory,
  loadChequeHistory,
  saveChequeHistoryEntry,
} from "@/lib/cheque-print/chequeHistory";
import {
  AMOUNT_WORDS_MAX_SAFE_LENGTH,
  PAYEE_MAX_SAFE_LENGTH,
  ChequeNumberSchema,
  PayeeSchema,
  type ChequeAlignmentMm,
  type ChequeHistoryEntry,
  type ChequePrintData,
} from "@/lib/cheque-print/chequeTypes";
import {
  formatIndianCurrency,
  parseAmountInput,
} from "@/lib/cheque-print/formatIndianCurrency";
import { savePrintData } from "@/lib/cheque-print/printDataStorage";
import {
  todayAsDDMMYYYY,
  validateChequeDate,
} from "@/lib/cheque-print/validateChequeDate";

export default function ChequeForm() {
  const router = useRouter();
  const [chequeNumber, setChequeNumber] = useState("");
  const [payee, setPayee] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [dateRaw, setDateRaw] = useState("");
  const [alignmentMm, setAlignmentMm] = useState<ChequeAlignmentMm | null>(
    null,
  );
  const [history, setHistory] = useState<ChequeHistoryEntry[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [printLocked, setPrintLocked] = useState(false);

  useEffect(() => {
    setAlignmentMm(loadAlignmentMm());
    setHistory(loadChequeHistory());
  }, []);

  const chequeNumberResult = useMemo(() => {
    if (!chequeNumber.trim()) {
      return { ok: false as const, error: "", value: "" };
    }
    const parsed = ChequeNumberSchema.safeParse(chequeNumber);
    if (!parsed.success) {
      return {
        ok: false as const,
        error: parsed.error.issues[0]?.message ?? "Invalid cheque number",
        value: "",
      };
    }
    return { ok: true as const, error: "", value: parsed.data };
  }, [chequeNumber]);

  const payeeResult = useMemo(() => {
    if (!payee.trim()) {
      return { ok: false as const, error: "", value: "" };
    }
    const parsed = PayeeSchema.safeParse(payee);
    if (!parsed.success) {
      return {
        ok: false as const,
        error: parsed.error.issues[0]?.message ?? "Invalid payee",
        value: "",
      };
    }
    return { ok: true as const, error: "", value: parsed.data };
  }, [payee]);

  const amountResult = useMemo(() => {
    if (!amountRaw.trim()) {
      return {
        ok: false as const,
        error: "",
        formatted: "",
        words: "",
      };
    }
    const parsed = parseAmountInput(amountRaw);
    if (!parsed.ok) {
      return {
        ok: false as const,
        error: parsed.error,
        formatted: "",
        words: "",
      };
    }
    const wordsResult = amountToIndianWordsResult(amountRaw);
    return {
      ok: true as const,
      error: "",
      formatted: formatIndianCurrency(parsed.value),
      words: wordsResult.ok ? wordsResult.words : "",
    };
  }, [amountRaw]);

  const dateResult = useMemo(() => {
    if (!dateRaw.trim()) {
      return { ok: false as const, error: "", digits: "" };
    }
    const validated = validateChequeDate(dateRaw);
    if (!validated.ok) {
      return { ok: false as const, error: validated.error, digits: "" };
    }
    return { ok: true as const, error: "", digits: validated.digits };
  }, [dateRaw]);

  const stepsDone = [
    chequeNumberResult.ok,
    payeeResult.ok,
    amountResult.ok,
    dateResult.ok,
  ].filter(Boolean).length;
  const progress = (stepsDone / 4) * 100;

  const isValid =
    chequeNumberResult.ok &&
    payeeResult.ok &&
    amountResult.ok &&
    dateResult.ok &&
    Boolean(alignmentMm);

  const printData: (ChequePrintData & { chequeNumber: string }) | null =
    isValid
      ? {
          chequeNumber: chequeNumberResult.value,
          payee: payeeResult.value,
          amountFormatted: amountResult.formatted,
          amountWords: amountResult.words,
          dateRaw: dateResult.digits,
        }
      : null;

  const payeeTooLong =
    payeeResult.ok && payeeResult.value.length > PAYEE_MAX_SAFE_LENGTH;
  const wordsTooLong =
    amountResult.ok &&
    amountResult.words.length > AMOUNT_WORDS_MAX_SAFE_LENGTH;

  const resetForm = () => {
    setChequeNumber("");
    setPayee("");
    setAmountRaw("");
    setDateRaw("");
    setPreviewOpen(false);
    setConfirmOpen(false);
    setConfirming(false);
    setPrintLocked(false);
  };

  const startPrintFlow = () => {
    if (!printData || printLocked) return;
    setConfirmOpen(true);
  };

  const handleConfirmPrint = () => {
    if (!printData || printLocked || confirming) return;
    setConfirming(true);
    setPrintLocked(true);
    setHistory(saveChequeHistoryEntry(printData));
    savePrintData(printData);
    setConfirmOpen(false);
    router.push("/cheque-print/print?autoprint=1");

    window.setTimeout(() => {
      setConfirming(false);
      setPrintLocked(false);
    }, 15000);
  };

  const reuseHistory = (entry: ChequeHistoryEntry) => {
    setChequeNumber(entry.chequeNumber);
    setPayee(entry.payee);
    const numeric = entry.amountFormatted
      .replace(/^₹\s*/, "")
      .replace(/\/-$/, "")
      .replace(/,/g, "")
      .trim();
    setAmountRaw(numeric);
    setDateRaw(entry.dateRaw);
  };

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <div className="fade-rise">
        <AppHeader />
      </div>

      <section className="fade-rise fade-rise-delay-1 mb-7">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="ui-label">Live leaf</p>
            <p className="mt-1 text-sm text-ink-soft">
              Watch the instrument fill as you compose
            </p>
          </div>
          <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
            <div className="mb-1.5 flex justify-between text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink-soft/70">
              <span>Complete</span>
              <span>
                {stepsDone}/4
              </span>
            </div>
            <div className="progress-rail" aria-hidden>
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
        <LiveChequeFace
          payee={payeeResult.ok ? payeeResult.value : undefined}
          amountFormatted={
            amountResult.ok ? amountResult.formatted : undefined
          }
          amountWords={amountResult.ok ? amountResult.words : undefined}
          dateDigits={dateResult.ok ? dateResult.digits : undefined}
          chequeNumber={
            chequeNumberResult.ok ? chequeNumberResult.value : undefined
          }
          ready={isValid}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_300px]">
        <form
          className="ui-panel fade-rise fade-rise-delay-2 space-y-7 p-5 md:p-8"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["01", chequeNumberResult.ok],
                ["02", payeeResult.ok],
                ["03", amountResult.ok],
                ["04", dateResult.ok],
              ] as const
            ).map(([label, done]) => (
              <span
                key={label}
                className={`step-dot ${done ? "is-done" : ""}`}
                aria-hidden
              >
                {label}
              </span>
            ))}
            <p className="ml-1 text-xs text-ink-soft/75">
              Four fields. One perfect print.
            </p>
          </div>

          {alignmentMm && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line/70 bg-paper/40 px-3.5 py-3">
              <div>
                <p className="ui-label">Type scale</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {alignmentMm.payee.fontSize} / {alignmentMm.amountWords.fontSize}{" "}
                  / {alignmentMm.amountNumbers.fontSize} /{" "}
                  {alignmentMm.date.fontSize} pt
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = adjustAllFontSizesMm(alignmentMm, 1);
                    setAlignmentMm(next);
                    saveAlignmentMm(next);
                  }}
                  className="ui-btn ui-btn-ghost !px-3 !py-2"
                >
                  A+
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = adjustAllFontSizesMm(alignmentMm, -1);
                    setAlignmentMm(next);
                    saveAlignmentMm(next);
                  }}
                  className="ui-btn ui-btn-ghost !px-3 !py-2"
                >
                  A-
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="ui-field">
              <label htmlFor="chequeNumber" className="ui-label">
                <span>01 Cheque no.</span>
                <span className="font-medium normal-case tracking-normal text-ink-soft/55">
                  not printed
                </span>
              </label>
              <input
                id="chequeNumber"
                name="chequeNumber"
                type="text"
                autoComplete="off"
                value={chequeNumber}
                onChange={(event) => setChequeNumber(event.target.value)}
                className="ui-input ui-input-mono"
                placeholder="000014"
              />
              {chequeNumberResult.error && (
                <p className="mt-1.5 text-sm text-[var(--danger)]">
                  {chequeNumberResult.error}
                </p>
              )}
            </div>

            <div className="ui-field">
              <label htmlFor="date" className="ui-label">
                <span>04 Date</span>
                <span className="font-medium normal-case tracking-normal text-ink-soft/55">
                  DDMMYYYY
                </span>
              </label>
              <div className="flex items-end gap-2">
                <input
                  id="date"
                  name="date"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={8}
                  value={dateRaw}
                  onChange={(event) =>
                    setDateRaw(event.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  className="ui-input ui-input-mono"
                  placeholder="04082026"
                />
                <button
                  type="button"
                  onClick={() => setDateRaw(todayAsDDMMYYYY())}
                  className="ui-btn ui-btn-ghost shrink-0 !px-3 !py-2"
                >
                  Today
                </button>
              </div>
              {dateResult.error && (
                <p className="mt-1.5 text-sm text-[var(--danger)]">
                  {dateResult.error}
                </p>
              )}
            </div>
          </div>

          <div className="ui-field">
            <label htmlFor="pay" className="ui-label">
              <span>02 Pay</span>
            </label>
            <input
              id="pay"
              name="pay"
              type="text"
              autoComplete="off"
              value={payee}
              onChange={(event) => setPayee(event.target.value)}
              className="ui-input font-display !text-[1.35rem]"
              placeholder="Beneficiary / payee"
            />
            {payeeResult.error && (
              <p className="mt-1.5 text-sm text-[var(--danger)]">
                {payeeResult.error}
              </p>
            )}
            {payeeTooLong && (
              <p className="mt-1.5 text-sm text-[var(--warn)]">
                Name may overflow the Pay line.
              </p>
            )}
          </div>

          <div className="ui-field">
            <label htmlFor="amount" className="ui-label">
              <span>03 Amount</span>
            </label>
            <input
              id="amount"
              name="amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amountRaw}
              onChange={(event) => setAmountRaw(event.target.value)}
              className="ui-input !text-[1.35rem] font-semibold"
              placeholder="1,25,000.50"
            />
            {amountResult.error && (
              <p className="mt-1.5 text-sm text-[var(--danger)]">
                {amountResult.error}
              </p>
            )}
            {amountResult.ok && (
              <p className="mt-2 text-sm font-semibold tracking-wide text-leaf">
                {amountResult.formatted}
              </p>
            )}
          </div>

          <div>
            <p className="ui-label">
              <span>In words</span>
              <span className="font-medium normal-case tracking-normal text-ink-soft/55">
                auto
              </span>
            </p>
            <div className="words-field mt-2" aria-live="polite">
              {amountResult.ok
                ? amountResult.words
                : amountRaw.trim()
                  ? "Enter a valid amount above"
                  : "Words compose automatically from the amount"}
            </div>
            {wordsTooLong && (
              <p className="mt-1.5 text-sm text-[var(--warn)]">
                Words may not fit the Rupees lines.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line/80 pt-5">
            <button
              type="button"
              disabled={!isValid || printLocked}
              onClick={startPrintFlow}
              className={`ui-btn ui-btn-primary min-w-[11rem] ${isValid ? "is-ready" : ""}`}
            >
              Print on cheque
            </button>
            <button
              type="button"
              disabled={!isValid}
              onClick={() => setPreviewOpen(true)}
              className="ui-btn ui-btn-ink"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="ui-btn ui-btn-ghost"
            >
              Clear
            </button>
          </div>

          <p className="text-xs leading-relaxed text-ink-soft/75">
            New printer?{" "}
            <Link
              href="/cheque-print/alignment"
              className="font-semibold text-leaf underline decoration-leaf/25 underline-offset-4 hover:decoration-leaf"
            >
              Calibrate placement
            </Link>{" "}
            on plain paper at Actual Size / 100%.
          </p>
        </form>

        <div className="fade-rise fade-rise-delay-3">
          <ChequeHistoryPanel
            entries={history}
            onClear={() => {
              clearChequeHistory();
              setHistory([]);
            }}
            onReuse={reuseHistory}
          />
        </div>
      </div>

      {printData && alignmentMm && (
        <>
          <ChequePreview
            open={previewOpen}
            data={printData}
            alignmentMm={alignmentMm}
            onClose={() => setPreviewOpen(false)}
            onPrint={() => {
              setPreviewOpen(false);
              startPrintFlow();
            }}
          />
          <PrintConfirmationDialog
            open={confirmOpen}
            data={printData}
            confirming={confirming}
            onCancel={() => {
              if (!confirming) setConfirmOpen(false);
            }}
            onConfirm={handleConfirmPrint}
          />
        </>
      )}
    </div>
  );
}
