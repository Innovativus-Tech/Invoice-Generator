"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/cheque-print/AppHeader";
import ChequePrintCanvas from "@/components/cheque-print/ChequePrintCanvas";
import {
  adjustAllFontSizesMm,
  adjustDateGapMm,
  adjustFontSizeMm,
  getDefaultAlignmentMm,
  loadAlignmentMm,
  nudgeAllFieldsMm,
  nudgeFieldMm,
  resetAlignmentMm,
  saveAlignmentMm,
  setFieldMm,
} from "@/lib/cheque-print/alignmentStorage";
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  CHEQUE_ASPECT_RATIO,
  CHEQUE_HEIGHT_MM,
  CHEQUE_WIDTH_MM,
  DEFAULT_A4_PAGE_PLACEMENT,
  PRINT_BLOCK_HEIGHT_MM,
  PRINT_BLOCK_WIDTH_MM,
  SAMPLE_ALIGNMENT_TEST,
  datePitchMm,
  type A4PagePlacement,
  type ChequeAlignmentMm,
  type OverlayFieldKey,
} from "@/lib/cheque-print/chequeTypes";
import {
  loadPagePlacement,
  nudgePagePlacement,
  resetPagePlacement,
  savePagePlacement,
} from "@/lib/cheque-print/pagePlacementStorage";
import { savePrintData } from "@/lib/cheque-print/printDataStorage";

const FIELD_LABELS: Record<OverlayFieldKey, string> = {
  payee: "Payee",
  amountWords: "Amt Words",
  amountNumbers: "Amt Digits",
  date: "Date",
  acPayee: "A/C Payee",
};

type DragState = {
  field: OverlayFieldKey;
  startX: number;
  startY: number;
  snapshot: ChequeAlignmentMm;
};

export default function AlignmentEditor() {
  const router = useRouter();
  const [alignmentMm, setAlignmentMm] = useState<ChequeAlignmentMm>(() =>
    getDefaultAlignmentMm(),
  );
  const [pagePlacement, setPagePlacement] = useState<A4PagePlacement>(
    DEFAULT_A4_PAGE_PLACEMENT,
  );
  const [selected, setSelected] = useState<OverlayFieldKey>("payee");
  const [fine, setFine] = useState(true);
  const [moveAll, setMoveAll] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    setAlignmentMm(loadAlignmentMm());
    setPagePlacement(loadPagePlacement());
  }, []);

  const stepMm = fine ? 0.25 : 1;

  const onPointerDown = (
    field: OverlayFieldKey,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(field);
    dragRef.current = {
      field,
      startX: event.clientX,
      startY: event.clientY,
      snapshot: structuredClone(alignmentMm),
    };
  };

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dxMm =
        ((event.clientX - dragRef.current.startX) / rect.width) *
        CHEQUE_WIDTH_MM;
      // Screen Y down -> decrease distance-from-bottom
      const dyMmUp =
        -((event.clientY - dragRef.current.startY) / rect.height) *
        CHEQUE_HEIGHT_MM;
      const snapshot = dragRef.current.snapshot;
      const field = dragRef.current.field;

      if (moveAll) {
        setAlignmentMm(nudgeAllFieldsMm(snapshot, dxMm, dyMmUp));
        return;
      }

      setAlignmentMm(
        setFieldMm(
          snapshot,
          field,
          snapshot[field].leftMm + dxMm,
          snapshot[field].bottomMm + dyMmUp,
        ),
      );
    },
    [moveAll],
  );

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleSave = () => {
    saveAlignmentMm(alignmentMm);
    savePagePlacement(pagePlacement);
    setSavedMessage("Field mm + A4 page position saved for all future prints.");
    window.setTimeout(() => setSavedMessage(""), 4000);
  };

  const handleReloadDefaults = () => {
    const defaults = resetAlignmentMm();
    const pageDefaults = resetPagePlacement();
    setAlignmentMm(defaults);
    setPagePlacement(pageDefaults);
    saveAlignmentMm(defaults);
    savePagePlacement(pageDefaults);
    setSavedMessage(
      "Reloaded field mm defaults + A4 top=0 / centred horizontally.",
    );
    window.setTimeout(() => setSavedMessage(""), 4000);
  };

  const handlePrintTest = () => {
    saveAlignmentMm(alignmentMm);
    savePagePlacement(pagePlacement);
    savePrintData(SAMPLE_ALIGNMENT_TEST);
    router.push("/cheque-print/print?autoprint=1&test=1");
  };

  const selectedField = alignmentMm[selected];

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 md:py-10">
      <div className="fade-rise">
        <AppHeader compact />
        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Field spacing on the cheque leaf stays fixed. Use{" "}
          <strong className="font-semibold text-ink">A4 sheet position</strong>{" "}
          to move the whole block. Print scale must stay at{" "}
          <strong className="font-semibold text-ink">100%</strong>.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="fade-rise fade-rise-delay-1">
          <div
            ref={canvasRef}
            className="relative select-none overflow-hidden rounded-[14px] border border-line bg-white"
            style={{ aspectRatio: CHEQUE_ASPECT_RATIO }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/reference-cheque.jpg"
              alt="Reference cheque for alignment"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain object-center"
              draggable={false}
            />

            {(
              [
                "payee",
                "amountWords",
                "amountNumbers",
                "date",
                "acPayee",
              ] as OverlayFieldKey[]
            ).map((field) => {
              const mm = alignmentMm[field];
              const isSelected = selected === field;
              const widthMm =
                field === "date"
                  ? datePitchMm(alignmentMm.date) * 8
                  : field === "acPayee"
                    ? 36
                    : "widthMm" in mm
                      ? mm.widthMm
                      : 40;

              return (
                <div
                  key={field}
                  onPointerDown={(event) => onPointerDown(field, event)}
                  className={`absolute cursor-move border-2 px-1 py-0.5 text-[10px] font-semibold uppercase ${
                    isSelected
                      ? "border-sky-600 bg-sky-400/25 text-sky-950"
                      : "border-rose-500/80 bg-rose-400/20 text-rose-950"
                  }`}
                  style={{
                    left: `${(mm.leftMm / CHEQUE_WIDTH_MM) * 100}%`,
                    bottom: `${(mm.bottomMm / CHEQUE_HEIGHT_MM) * 100}%`,
                    width: `${(widthMm / CHEQUE_WIDTH_MM) * 100}%`,
                    fontSize: `${mm.fontSize}px`,
                    lineHeight: 1.2,
                    touchAction: "none",
                  }}
                >
                  {FIELD_LABELS[field]}
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-sm font-medium text-slate-700">
              Live preview (sample)
            </p>
            <ChequePrintCanvas
              data={SAMPLE_ALIGNMENT_TEST}
              alignmentMm={alignmentMm}
              showBackground={false}
              className="w-full"
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-md border border-slate-200 bg-slate-100 p-3">
            <p className="mb-2 text-sm font-medium text-slate-700">
              A4 blank sheet - whole content block
            </p>
            <p className="mb-3 text-xs text-slate-500">
              Top {pagePlacement.topMm} mm from sheet edge / Left{" "}
              {pagePlacement.leftMm} mm / Block {PRINT_BLOCK_WIDTH_MM}x
              {PRINT_BLOCK_HEIGHT_MM} mm
            </p>
            <div
              className="print-preview-a4-scale"
              style={{ transform: "scale(0.38)", marginBottom: "-180mm" }}
            >
              <div className="print-preview-a4">
                <div
                  className="print-preview-a4-block border border-dashed border-sky-500"
                  style={{
                    top: `${pagePlacement.topMm}mm`,
                    left: `${pagePlacement.leftMm}mm`,
                  }}
                >
                  <ChequePrintCanvas
                    data={SAMPLE_ALIGNMENT_TEST}
                    alignmentMm={alignmentMm}
                    showBackground={false}
                    printMode
                    className="print-cheque-page"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="ui-panel fade-rise fade-rise-delay-2 space-y-4 p-4">
          <div className="rounded-[10px] border border-[color-mix(in_srgb,var(--brass)_35%,var(--line))] bg-[rgb(143_115_72_/_0.08)] p-3">
            <p className="font-display text-lg font-semibold text-ink">
              A4 sheet position
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
              Moves the entire print block on blank A4. Does not change spaces
              between payee / words / amount / date.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-[11px] font-medium text-slate-700">
                Dist. From Top (mm)
                <input
                  type="number"
                  step="0.5"
                  value={pagePlacement.topMm}
                  onChange={(event) =>
                    setPagePlacement((prev) => ({
                      ...prev,
                      topMm: Number(event.target.value) || 0,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-[11px] font-medium text-slate-700">
                Dist. From Left (mm)
                <input
                  type="number"
                  step="0.5"
                  value={pagePlacement.leftMm}
                  onChange={(event) =>
                    setPagePlacement((prev) => ({
                      ...prev,
                      leftMm: Number(event.target.value) || 0,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              A4 = {A4_WIDTH_MM}x{A4_HEIGHT_MM} mm. Default top 0 (flush), left{" "}
              {(A4_WIDTH_MM - PRINT_BLOCK_WIDTH_MM) / 2} (centred).
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 place-items-center">
              <span />
              <ArrowButton
                label="Move block up"
                onClick={() =>
                  setPagePlacement((prev) =>
                    nudgePagePlacement(prev, 0, -stepMm),
                  )
                }
              >
                Up
              </ArrowButton>
              <span />
              <ArrowButton
                label="Move block left"
                onClick={() =>
                  setPagePlacement((prev) =>
                    nudgePagePlacement(prev, -stepMm, 0),
                  )
                }
              >
                Left
              </ArrowButton>
              <ArrowButton
                label="Move block down"
                onClick={() =>
                  setPagePlacement((prev) =>
                    nudgePagePlacement(prev, 0, stepMm),
                  )
                }
              >
                Down
              </ArrowButton>
              <ArrowButton
                label="Move block right"
                onClick={() =>
                  setPagePlacement((prev) =>
                    nudgePagePlacement(prev, stepMm, 0),
                  )
                }
              >
                Right
              </ArrowButton>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                onClick={() =>
                  setPagePlacement({
                    topMm: 0,
                    leftMm: pagePlacement.leftMm,
                  })
                }
              >
                Pin to top
              </button>
              <button
                type="button"
                className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                onClick={() =>
                  setPagePlacement({
                    topMm: pagePlacement.topMm,
                    leftMm: (A4_WIDTH_MM - PRINT_BLOCK_WIDTH_MM) / 2,
                  })
                }
              >
                Centre H
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Print font
            </p>
            <p className="mt-1 text-sm text-slate-800">Arial (Default)</p>
          </div>

          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Field</th>
                  <th className="px-2 py-1.5 font-medium">Dist. left</th>
                  <th className="px-2 py-1.5 font-medium">Dist. bottom</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    "payee",
                    "amountWords",
                    "amountNumbers",
                    "date",
                    "acPayee",
                  ] as OverlayFieldKey[]
                ).map((field) => (
                  <tr
                    key={field}
                    className={`border-t border-slate-100 ${selected === field ? "bg-sky-50" : ""}`}
                  >
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        className="font-medium text-slate-800"
                        onClick={() => setSelected(field)}
                      >
                        {FIELD_LABELS[field]}
                      </button>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.1"
                        value={alignmentMm[field].leftMm}
                        onChange={(event) => {
                          setSelected(field);
                          setAlignmentMm((prev) =>
                            setFieldMm(
                              prev,
                              field,
                              Number(event.target.value),
                              prev[field].bottomMm,
                            ),
                          );
                        }}
                        className="w-16 rounded border border-slate-300 px-1 py-0.5"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.1"
                        value={alignmentMm[field].bottomMm}
                        onChange={(event) => {
                          setSelected(field);
                          setAlignmentMm((prev) =>
                            setFieldMm(
                              prev,
                              field,
                              prev[field].leftMm,
                              Number(event.target.value),
                            ),
                          );
                        }}
                        className="w-16 rounded border border-slate-300 px-1 py-0.5"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">
              Date Gap (mm)
            </label>
            <input
              type="number"
              step="0.1"
              min={0}
              value={alignmentMm.date.dateGapMm}
              onChange={(event) =>
                setAlignmentMm((prev) => ({
                  ...prev,
                  date: {
                    ...prev.date,
                    dateGapMm: Number(event.target.value) || 0,
                  },
                }))
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Calibrated value is 0. Pitch = {alignmentMm.date.basePitchMm} + gap
              mm.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={alignmentMm.acPayee.enabled}
              onChange={(event) =>
                setAlignmentMm((prev) => ({
                  ...prev,
                  acPayee: { ...prev.acPayee, enabled: event.target.checked },
                }))
              }
            />
            Print A/C PAYEE stamp
          </label>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={fine}
                onChange={(event) => setFine(event.target.checked)}
              />
              Fine movement (0.25 mm)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={moveAll}
                onChange={(event) => setMoveAll(event.target.checked)}
              />
              Move all fields together
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">
              Nudge selected ({FIELD_LABELS[selected]})
            </p>
            <div className="grid grid-cols-3 gap-2 place-items-center">
              <span />
              <ArrowButton
                label="Move up"
                onClick={() =>
                  setAlignmentMm((prev) =>
                    moveAll
                      ? nudgeAllFieldsMm(prev, 0, stepMm)
                      : nudgeFieldMm(prev, selected, 0, stepMm),
                  )
                }
              >
                Up
              </ArrowButton>
              <span />
              <ArrowButton
                label="Move left"
                onClick={() =>
                  setAlignmentMm((prev) =>
                    moveAll
                      ? nudgeAllFieldsMm(prev, -stepMm, 0)
                      : nudgeFieldMm(prev, selected, -stepMm, 0),
                  )
                }
              >
                Left
              </ArrowButton>
              <ArrowButton
                label="Move down"
                onClick={() =>
                  setAlignmentMm((prev) =>
                    moveAll
                      ? nudgeAllFieldsMm(prev, 0, -stepMm)
                      : nudgeFieldMm(prev, selected, 0, -stepMm),
                  )
                }
              >
                Down
              </ArrowButton>
              <ArrowButton
                label="Move right"
                onClick={() =>
                  setAlignmentMm((prev) =>
                    moveAll
                      ? nudgeAllFieldsMm(prev, stepMm, 0)
                      : nudgeFieldMm(prev, selected, stepMm, 0),
                  )
                }
              >
                Right
              </ArrowButton>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              Selected: left {selectedField.leftMm} mm, bottom{" "}
              {selectedField.bottomMm} mm
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() =>
                setAlignmentMm((prev) => adjustFontSizeMm(prev, selected, 1))
              }
            >
              Font +
            </button>
            <button
              type="button"
              className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() =>
                setAlignmentMm((prev) => adjustFontSizeMm(prev, selected, -1))
              }
            >
              Font -
            </button>
            <button
              type="button"
              className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() =>
                setAlignmentMm((prev) => adjustDateGapMm(prev, 0.1))
              }
            >
              Gap +
            </button>
            <button
              type="button"
              className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() =>
                setAlignmentMm((prev) => adjustDateGapMm(prev, -0.1))
              }
            >
              Gap -
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-md bg-slate-800 px-2 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
              onClick={() =>
                setAlignmentMm((prev) => adjustAllFontSizesMm(prev, 1))
              }
            >
              All fonts +
            </button>
            <button
              type="button"
              className="flex-1 rounded-md bg-slate-800 px-2 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
              onClick={() =>
                setAlignmentMm((prev) => adjustAllFontSizesMm(prev, -1))
              }
            >
              All fonts -
            </button>
          </div>

          <div className="space-y-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={handleSave}
              className="ui-btn ui-btn-ink w-full"
            >
              Save alignment
            </button>
            <button
              type="button"
              onClick={handleReloadDefaults}
              className="ui-btn ui-btn-ghost w-full"
            >
              Reload defaults
            </button>
            <button
              type="button"
              onClick={handlePrintTest}
              className="ui-btn ui-btn-primary w-full"
            >
              Print cheque (test)
            </button>
            <p className="text-center text-xs font-semibold text-[var(--danger)]">
              Set print scale to Default / 100%
            </p>
          </div>

          {savedMessage && (
            <p className="text-sm font-medium text-leaf">{savedMessage}</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function ArrowButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="ui-btn ui-btn-ghost h-9 w-9 !px-0 text-sm"
    >
      {children}
    </button>
  );
}
