"use client";

import ChequePrintCanvas from "@/components/cheque-print/ChequePrintCanvas";
import type { ChequeAlignmentMm, ChequePrintData } from "@/lib/cheque-print/chequeTypes";

type ChequePreviewProps = {
  open: boolean;
  data: ChequePrintData;
  alignmentMm: ChequeAlignmentMm;
  onClose: () => void;
  onPrint: () => void;
};

export default function ChequePreview({
  open,
  data,
  alignmentMm,
  onClose,
  onPrint,
}: ChequePreviewProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-40 flex flex-col bg-[rgb(7_26_20_/_0.9)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4 text-white md:px-8">
        <div>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-brass-soft">
            Placement preview
          </p>
          <h2 className="mt-1 font-display text-[1.85rem] leading-none">
            Exact millimetres
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <PreviewZoomControls />
          <button
            type="button"
            onClick={onPrint}
            className="ui-btn ui-btn-primary"
          >
            Print on cheque
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ui-btn border border-white/20 bg-transparent text-white hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-8">
        <p className="mb-5 text-center text-sm text-white/55">
          200 x 90 mm leaf · printer scale Default / 100%
        </p>
        <div className="mx-auto max-w-5xl overflow-auto rounded-[18px] border border-white/10 bg-white p-5 md:p-8">
          <div id="preview-zoom-target" className="origin-top-left">
            <ChequePrintCanvas
              data={data}
              alignmentMm={alignmentMm}
              showBackground={false}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewZoomControls() {
  const applyZoom = (factor: number) => {
    const el = document.getElementById("preview-zoom-target");
    if (!el) return;
    const current = Number(el.dataset.zoom || "1");
    const next = Math.min(
      2.5,
      Math.max(0.5, Number((current * factor).toFixed(2))),
    );
    el.dataset.zoom = String(next);
    el.style.transform = `scale(${next})`;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => applyZoom(1.15)}
        className="ui-btn border border-white/20 bg-transparent text-white hover:bg-white/10"
      >
        Zoom in
      </button>
      <button
        type="button"
        onClick={() => applyZoom(1 / 1.15)}
        className="ui-btn border border-white/20 bg-transparent text-white hover:bg-white/10"
      >
        Zoom out
      </button>
    </>
  );
}
