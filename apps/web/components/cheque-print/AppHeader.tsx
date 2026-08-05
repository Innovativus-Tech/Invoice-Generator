"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AppHeaderProps = {
  compact?: boolean;
};

export default function AppHeader({ compact = false }: AppHeaderProps) {
  const pathname = usePathname();

  return (
    <header className={`relative z-10 ${compact ? "mb-5" : "mb-7"}`}>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-brass">
            Precision print atelier
          </p>
          <h1
            className={`font-display tracking-[-0.03em] text-ink ${
              compact
                ? "mt-2 text-[2.35rem] leading-none md:text-[2.8rem]"
                : "mt-2 text-[3.2rem] leading-[0.92] md:text-[4.4rem]"
            }`}
          >
            Fill Cheque
          </h1>
          <div className="brand-rule mt-4" />
          {!compact && (
            <p className="mt-5 max-w-lg text-[0.98rem] leading-relaxed text-ink-soft">
              A private desk for blank bank leaves. Compose once. Print only the
              empty fields - payee, amount, and date - with millimetre control.
            </p>
          )}
        </div>

        <nav className="nav-pill mt-1" aria-label="Primary">
          <Link
            href="/cheque-print"
            className={pathname === "/cheque-print" ? "is-active" : ""}
          >
            Compose
          </Link>
          <Link
            href="/cheque-print/alignment"
            className={pathname?.startsWith("/cheque-print/alignment") ? "is-active" : ""}
          >
            Calibrate
          </Link>
        </nav>
      </div>
    </header>
  );
}
