"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ChequePrintCanvas from "@/components/cheque-print/ChequePrintCanvas";
import { loadAlignmentMm } from "@/lib/cheque-print/alignmentStorage";
import {
  type A4PagePlacement,
  type ChequeAlignmentMm,
  type ChequePrintData,
  DEFAULT_A4_PAGE_PLACEMENT,
} from "@/lib/cheque-print/chequeTypes";
import { loadPagePlacement } from "@/lib/cheque-print/pagePlacementStorage";
import { clearPrintData, loadPrintData } from "@/lib/cheque-print/printDataStorage";

function PrintPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("autoprint") === "1";
  const [data, setData] = useState<ChequePrintData | null>(null);
  const [alignmentMm, setAlignmentMm] = useState<ChequeAlignmentMm | null>(
    null,
  );
  const [placement, setPlacement] = useState<A4PagePlacement>(
    DEFAULT_A4_PAGE_PLACEMENT,
  );
  const printedRef = useRef(false);

  useEffect(() => {
    setData(loadPrintData());
    setAlignmentMm(loadAlignmentMm());
    setPlacement(loadPagePlacement());
  }, []);

  useEffect(() => {
    if (!autoPrint || !data || !alignmentMm || printedRef.current) return;
    printedRef.current = true;

    const timer = window.setTimeout(() => {
      window.print();
    }, 400);

    const onAfterPrint = () => {
      clearPrintData();
      router.push("/cheque-print");
    };

    window.addEventListener("afterprint", onAfterPrint);

    const fallback = window.setTimeout(() => {
      clearPrintData();
    }, 20000);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(fallback);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [autoPrint, data, alignmentMm, router]);

  if (!data || !alignmentMm) {
    return (
      <div className="no-print relative z-10 flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-display text-2xl text-ink">Nothing to print</p>
        <p className="text-sm text-ink-soft">No cheque data is ready yet.</p>
        <Link href="/cheque-print" className="ui-btn ui-btn-primary mt-2">
          Return to form
        </Link>
      </div>
    );
  }

  const pageVars = {
    ["--page-top" as string]: `${placement.topMm}mm`,
    ["--page-left" as string]: `${placement.leftMm}mm`,
  };

  return (
    <>
      <div className="no-print relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper-bright/90 px-4 py-4 backdrop-blur-sm md:px-6">
        <div className="text-sm text-ink-soft">
          <p className="font-display text-lg font-semibold text-ink">
            Ready to print
          </p>
          <p className="mt-0.5">
            A4 · top {placement.topMm} mm · left {placement.leftMm} mm · scale{" "}
            <strong className="text-ink">100%</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="ui-btn ui-btn-primary"
          >
            Print
          </button>
          <Link href="/cheque-print" className="ui-btn ui-btn-ghost">
            Cancel
          </Link>
        </div>
      </div>

      <div className="no-print relative z-10 overflow-x-auto bg-[rgb(16_40_32_/_0.06)] p-4 md:p-6">
        <div
          className="print-preview-a4-scale"
          style={{ transform: "scale(0.42)" }}
        >
          <div className="print-preview-a4">
            <div
              className="print-preview-a4-block"
              style={{
                top: `${placement.topMm}mm`,
                left: `${placement.leftMm}mm`,
              }}
            >
              <ChequePrintCanvas
                data={data}
                alignmentMm={alignmentMm}
                showBackground={false}
                printMode
                className="print-cheque-page"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="print-root" style={pageVars}>
        <ChequePrintCanvas
          data={data}
          alignmentMm={alignmentMm}
          showBackground={false}
          printMode
          className="print-cheque-page"
        />
      </div>
    </>
  );
}

export default function PrintPageClient() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-slate-600">Preparing print…</div>
      }
    >
      <PrintPageInner />
    </Suspense>
  );
}
