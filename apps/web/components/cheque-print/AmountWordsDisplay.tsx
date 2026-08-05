"use client";

import {
  AMOUNT_WORDS_MAX_SAFE_LENGTH,
  CHEQUE_HEIGHT_MM,
  CHEQUE_PRINT_FONT,
  CHEQUE_WIDTH_MM,
  type FieldMm,
} from "@/lib/cheque-print/chequeTypes";

type AmountWordsDisplayProps = {
  words: string;
  field: FieldMm;
  showWarning?: boolean;
  scale?: number;
  className?: string;
  maxHeightMm?: number;
  printMode?: boolean;
};

export default function AmountWordsDisplay({
  words,
  field,
  showWarning = true,
  scale = 1,
  className = "",
  maxHeightMm = 14,
  printMode = false,
}: AmountWordsDisplayProps) {
  const isLong = words.length > AMOUNT_WORDS_MAX_SAFE_LENGTH;
  const fontSize =
    words.length > 70
      ? field.fontSize * 0.85
      : words.length > 55
        ? field.fontSize * 0.92
        : field.fontSize;

  const boxStyle = printMode
    ? {
        left: `${field.leftMm}mm`,
        bottom: `${field.bottomMm}mm`,
        width: `${field.widthMm}mm`,
        maxHeight: `${maxHeightMm}mm`,
        fontSize: `${fontSize}pt`,
      }
    : {
        left: `${(field.leftMm / CHEQUE_WIDTH_MM) * 100}%`,
        bottom: `${(field.bottomMm / CHEQUE_HEIGHT_MM) * 100}%`,
        width: `${(field.widthMm / CHEQUE_WIDTH_MM) * 100}%`,
        maxHeight: `${(maxHeightMm / CHEQUE_HEIGHT_MM) * 100}%`,
        fontSize: `${fontSize * scale}px`,
      };

  return (
    <div className={className}>
      <div
        className="pointer-events-none absolute uppercase leading-snug"
        style={{
          ...boxStyle,
          fontFamily: CHEQUE_PRINT_FONT,
          fontWeight: 600,
          color: "#000",
          wordBreak: "normal",
          overflowWrap: "break-word",
          hyphens: "none",
          overflow: "hidden",
        }}
      >
        {words}
      </div>
      {showWarning && isLong && (
        <p className="mt-2 text-sm text-amber-700">
          Warning: amount in words is very long and may not fit safely on the
          cheque lines.
        </p>
      )}
    </div>
  );
}
