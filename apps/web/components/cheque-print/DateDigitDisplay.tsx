"use client";

import {
  CHEQUE_HEIGHT_MM,
  CHEQUE_PRINT_FONT,
  CHEQUE_WIDTH_MM,
  datePitchMm,
  type DateFieldMm,
} from "@/lib/cheque-print/chequeTypes";

type DateDigitDisplayProps = {
  digits: string;
  field: DateFieldMm;
  className?: string;
  scale?: number;
  printMode?: boolean;
};

export default function DateDigitDisplay({
  digits,
  field,
  className = "",
  scale = 1,
  printMode = false,
}: DateDigitDisplayProps) {
  const chars = digits.padEnd(8, " ").slice(0, 8).split("");
  const pitch = datePitchMm(field);

  return (
    <>
      {chars.map((char, index) => {
        const leftMm = field.leftMm + index * pitch;
        const style = printMode
          ? {
              left: `${leftMm}mm`,
              bottom: `${field.bottomMm}mm`,
              width: `${Math.min(pitch * 0.85, 4.2)}mm`,
              height: `4mm`,
              fontSize: `${field.fontSize}pt`,
            }
          : {
              left: `${(leftMm / CHEQUE_WIDTH_MM) * 100}%`,
              bottom: `${(field.bottomMm / CHEQUE_HEIGHT_MM) * 100}%`,
              width: `${((pitch * 0.85) / CHEQUE_WIDTH_MM) * 100}%`,
              height: `${(4 / CHEQUE_HEIGHT_MM) * 100}%`,
              fontSize: `${field.fontSize * scale}px`,
            };

        return (
          <span
            key={`${index}-${char}`}
            className={`pointer-events-none absolute flex items-center justify-center ${className}`}
            style={{
              ...style,
              fontFamily: CHEQUE_PRINT_FONT,
              fontWeight: 700,
              color: "#000",
              lineHeight: 1,
            }}
            aria-hidden={index > 0}
          >
            {char.trim() ? char : ""}
          </span>
        );
      })}
      <span className="sr-only">Date {digits}</span>
    </>
  );
}
