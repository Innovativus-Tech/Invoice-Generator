type LiveChequeFaceProps = {
  payee?: string;
  amountFormatted?: string;
  amountWords?: string;
  dateDigits?: string;
  chequeNumber?: string;
  ready?: boolean;
};

export default function LiveChequeFace({
  payee,
  amountFormatted,
  amountWords,
  dateDigits,
  chequeNumber,
  ready = false,
}: LiveChequeFaceProps) {
  const dateCells = (dateDigits || "--------").padEnd(8, "-").slice(0, 8).split("");

  return (
    <div
      className={`live-cheque ${ready ? "ring-1 ring-[color-mix(in_srgb,var(--leaf)_45%,transparent)]" : ""}`}
      aria-hidden={!payee && !amountFormatted}
    >
      <div className="live-cheque-grid" />

      <div className="relative z-[1] flex h-full flex-col justify-between p-[7%] md:p-[6%]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.22em] text-brass/80 md:text-[0.62rem]">
              Bearer instrument
            </p>
            <p className="mt-1 font-display text-lg leading-none text-ink/80 md:text-2xl">
              Order cheque
            </p>
          </div>
          <div className="text-right">
            <p className="text-[0.55rem] uppercase tracking-[0.18em] text-ink-soft/55">
              Date
            </p>
            <div className="mt-1 flex gap-0.5 md:gap-1">
              {dateCells.map((digit, index) => (
                <span
                  key={`${index}-${digit}`}
                  className={`grid h-5 w-4 place-items-center border border-ink/15 font-mono text-[0.65rem] md:h-6 md:w-5 md:text-xs ${
                    digit !== "-" ? "live-ink bg-leaf/5 font-semibold text-ink" : "text-ink/25"
                  }`}
                >
                  {digit === "-" ? "" : digit}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2.5 md:mt-2 md:space-y-3">
          <div>
            <p className="text-[0.55rem] uppercase tracking-[0.16em] text-ink-soft/50">
              Pay
            </p>
            <p
              className={`mt-0.5 min-h-[1.2em] border-b border-ink/10 pb-1 font-display text-base tracking-wide text-ink md:text-xl ${
                payee ? "live-ink" : "text-ink/20"
              }`}
            >
              {payee || "Beneficiary name"}
            </p>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div>
              <p className="text-[0.55rem] uppercase tracking-[0.16em] text-ink-soft/50">
                Rupees
              </p>
              <p
                className={`mt-0.5 min-h-[2.4em] text-[0.68rem] font-semibold uppercase leading-snug tracking-wide md:text-[0.78rem] ${
                  amountWords ? "live-ink text-ink" : "text-ink/20"
                }`}
              >
                {amountWords || "Amount in words appears here"}
              </p>
            </div>
            <div className="min-w-[5.5rem] text-right md:min-w-[7rem]">
              <p className="text-[0.55rem] uppercase tracking-[0.16em] text-ink-soft/50">
                Amount
              </p>
              <p
                className={`mt-0.5 border border-ink/15 px-2 py-1 font-mono text-sm font-semibold md:text-base ${
                  amountFormatted ? "live-ink text-leaf" : "text-ink/20"
                }`}
              >
                {amountFormatted || "Rs -"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="font-mono text-[0.58rem] tracking-[0.14em] text-ink-soft/45 md:text-[0.65rem]">
            {chequeNumber ? `REF ${chequeNumber}` : "REF · history only"}
          </p>
          <p className="text-[0.55rem] uppercase tracking-[0.18em] text-brass/70">
            {ready ? "Ready to print" : "Compose to preview"}
          </p>
        </div>
      </div>
    </div>
  );
}
