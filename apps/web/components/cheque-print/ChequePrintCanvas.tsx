"use client";

import AmountWordsDisplay from "@/components/cheque-print/AmountWordsDisplay";
import DateDigitDisplay from "@/components/cheque-print/DateDigitDisplay";
import {
  CHEQUE_ASPECT_RATIO,
  CHEQUE_HEIGHT_MM,
  CHEQUE_PRINT_FONT,
  CHEQUE_WIDTH_MM,
  datePitchMm,
  type ChequeAlignmentMm,
  type ChequePrintData,
} from "@/lib/cheque-print/chequeTypes";
import {
  formatPrintAmountDigits,
  formatPrintAmountWords,
  formatPrintPayee,
} from "@/lib/cheque-print/printTextFormat";

type ChequePrintCanvasProps = {
  data: ChequePrintData;
  alignmentMm: ChequeAlignmentMm;
  showBackground?: boolean;
  zoom?: number;
  className?: string;
  printMode?: boolean;
};

/**
 * Positions fields like https://chequeprint.cloud/
 * Origin: bottom-left. Print uses mm; preview uses %.
 * Text format: **PAYEE**, **AMOUNT WORDS**, **1,25,000/** and A/C PAYEE between rules.
 */
export default function ChequePrintCanvas({
  data,
  alignmentMm,
  showBackground = false,
  zoom = 1,
  className = "",
  printMode = false,
}: ChequePrintCanvasProps) {
  const scale = zoom;
  const showAcPayee =
    (data.printAcPayee ?? alignmentMm.acPayee.enabled) &&
    alignmentMm.acPayee.enabled;

  const payeeText = formatPrintPayee(data.payee);
  const wordsText = formatPrintAmountWords(data.amountWords);
  const amountText = formatPrintAmountDigits(data.amountFormatted);

  const pos = (leftMm: number, bottomMm: number, widthMm?: number) => {
    if (printMode) {
      return {
        left: `${leftMm}mm`,
        bottom: `${bottomMm}mm`,
        ...(widthMm != null ? { width: `${widthMm}mm` } : {}),
      } as const;
    }
    return {
      left: `${(leftMm / CHEQUE_WIDTH_MM) * 100}%`,
      bottom: `${(bottomMm / CHEQUE_HEIGHT_MM) * 100}%`,
      ...(widthMm != null
        ? { width: `${(widthMm / CHEQUE_WIDTH_MM) * 100}%` }
        : {}),
    } as const;
  };

  return (
    <div
      className={`cheque-canvas relative overflow-hidden ${printMode ? "cheque-print-surface print-cheque-page" : "bg-white shadow-sm"} ${className}`}
      style={
        printMode
          ? {
              width: `${CHEQUE_WIDTH_MM}mm`,
              height: `${CHEQUE_HEIGHT_MM}mm`,
              maxWidth: `${CHEQUE_WIDTH_MM}mm`,
              maxHeight: `${CHEQUE_HEIGHT_MM}mm`,
              // Rotation is applied by .print-cheque-page / .print-preview-portrait CSS
            }
          : {
              width: "100%",
              aspectRatio: CHEQUE_ASPECT_RATIO,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }
      }
    >
      {showBackground && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/reference-cheque.jpg"
          alt="Cheque reference preview"
          className="cheque-preview-bg absolute inset-0 h-full w-full object-contain object-center"
          draggable={false}
        />
      )}

      {!showBackground && !printMode && (
        <div className="absolute inset-0 bg-[#f7f4ec]" />
      )}

      {showAcPayee && (
        <div
          className="pointer-events-none absolute uppercase"
          style={{
            ...pos(alignmentMm.acPayee.leftMm, alignmentMm.acPayee.bottomMm),
            fontSize: printMode
              ? `${alignmentMm.acPayee.fontSize}pt`
              : `${alignmentMm.acPayee.fontSize * scale}px`,
            fontFamily: CHEQUE_PRINT_FONT,
            fontWeight: 700,
            color: "#000",
            lineHeight: 1,
            letterSpacing: "0.08em",
            borderTop: printMode ? "0.35mm solid #000" : "1px solid #000",
            borderBottom: printMode ? "0.35mm solid #000" : "1px solid #000",
            paddingTop: printMode ? "0.6mm" : "2px",
            paddingBottom: printMode ? "0.6mm" : "2px",
            paddingLeft: printMode ? "1.5mm" : "4px",
            paddingRight: printMode ? "1.5mm" : "4px",
            whiteSpace: "nowrap",
          }}
        >
          A/C PAYEE
        </div>
      )}

      <div
        className="pointer-events-none absolute truncate uppercase"
        style={{
          ...pos(
            alignmentMm.payee.leftMm,
            alignmentMm.payee.bottomMm,
            alignmentMm.payee.widthMm,
          ),
          fontSize: printMode
            ? `${alignmentMm.payee.fontSize}pt`
            : `${alignmentMm.payee.fontSize * scale}px`,
          fontFamily: CHEQUE_PRINT_FONT,
          fontWeight: 700,
          color: "#000",
          lineHeight: 1.05,
        }}
      >
        {payeeText}
      </div>

      <AmountWordsDisplay
        words={wordsText}
        field={alignmentMm.amountWords}
        showWarning={false}
        scale={scale}
        printMode={printMode}
      />

      <div
        className="pointer-events-none absolute overflow-hidden whitespace-nowrap"
        style={{
          ...pos(
            alignmentMm.amountNumbers.leftMm,
            alignmentMm.amountNumbers.bottomMm,
            alignmentMm.amountNumbers.widthMm,
          ),
          fontSize: printMode
            ? `${alignmentMm.amountNumbers.fontSize}pt`
            : `${alignmentMm.amountNumbers.fontSize * scale}px`,
          fontFamily: CHEQUE_PRINT_FONT,
          fontWeight: 700,
          color: "#000",
          lineHeight: 1.05,
        }}
      >
        {amountText}
      </div>

      <DateDigitDisplay
        digits={data.dateRaw}
        field={alignmentMm.date}
        scale={scale}
        printMode={printMode}
      />
    </div>
  );
}

export function dateOverlayWidthMm(alignmentMm: ChequeAlignmentMm): number {
  return datePitchMm(alignmentMm.date) * 8;
}
