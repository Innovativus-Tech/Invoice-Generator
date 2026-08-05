import { z } from "zod";

export const PAYEE_MAX_SAFE_LENGTH = 48;
export const AMOUNT_WORDS_MAX_SAFE_LENGTH = 85;

/** Physical cheque leaf - exact user size. */
export const CHEQUE_WIDTH_MM = 200;
export const CHEQUE_HEIGHT_MM = 90;
export const CHEQUE_WIDTH_CM = 20;
export const CHEQUE_HEIGHT_CM = 9;
export const CHEQUE_ASPECT_RATIO = `${CHEQUE_WIDTH_MM} / ${CHEQUE_HEIGHT_MM}`;

/** Print face uses Arial to match calibrated Global Cheque Printer settings. */
export const CHEQUE_PRINT_FONT =
  'Arial, "Helvetica Neue", Helvetica, sans-serif';

/**
 * Perfect calibrated coordinates (mm), matching:
 * DIST. FROM LEFT / DIST. FROM BOTTOM on a 200x90 mm leaf.
 */
export type FieldMm = {
  leftMm: number;
  bottomMm: number;
  widthMm: number;
  fontSize: number;
};

export type DateFieldMm = {
  leftMm: number;
  bottomMm: number;
  /** Extra gap between date digits (mm). Calibrated value: 0. */
  dateGapMm: number;
  /** Base centre-to-centre pitch before gap (mm). ~one date box + default spacing. */
  basePitchMm: number;
  fontSize: number;
};

export type AcPayeeFieldMm = {
  leftMm: number;
  bottomMm: number;
  fontSize: number;
  enabled: boolean;
};

export type ChequeAlignmentMm = {
  payee: FieldMm;
  amountWords: FieldMm;
  amountNumbers: FieldMm;
  date: DateFieldMm;
  acPayee: AcPayeeFieldMm;
};

export const FieldMmSchema = z.object({
  leftMm: z.number().min(0).max(CHEQUE_WIDTH_MM),
  bottomMm: z.number().min(0).max(CHEQUE_HEIGHT_MM),
  widthMm: z.number().min(1).max(CHEQUE_WIDTH_MM),
  fontSize: z.number().min(6).max(48),
});

export const DateFieldMmSchema = z.object({
  leftMm: z.number().min(0).max(CHEQUE_WIDTH_MM),
  bottomMm: z.number().min(0).max(CHEQUE_HEIGHT_MM),
  dateGapMm: z.number().min(0).max(10),
  basePitchMm: z.number().min(2).max(12),
  fontSize: z.number().min(6).max(48),
});

export const AcPayeeFieldMmSchema = z.object({
  leftMm: z.number().min(0).max(CHEQUE_WIDTH_MM),
  bottomMm: z.number().min(0).max(CHEQUE_HEIGHT_MM),
  fontSize: z.number().min(6).max(48),
  enabled: z.boolean(),
});

export const ChequeAlignmentMmSchema = z.object({
  payee: FieldMmSchema,
  amountWords: FieldMmSchema,
  amountNumbers: FieldMmSchema,
  date: DateFieldMmSchema,
  acPayee: AcPayeeFieldMmSchema,
});

/**
 * Exact margins from your ChequePrint calibration (Dist. Left / Dist. Bottom).
 * Relative gaps between fields are intentional - only the page block was moved to TOP.
 * Fonts stay at the reduced (~70%) sizes.
 */
export const DEFAULT_ALIGNMENT_MM: ChequeAlignmentMm = {
  payee: {
    leftMm: 20,
    bottomMm: 68,
    widthMm: 130,
    fontSize: 9,
  },
  amountWords: {
    leftMm: 30,
    bottomMm: 60,
    widthMm: 120,
    fontSize: 8,
  },
  amountNumbers: {
    leftMm: 160,
    bottomMm: 51,
    widthMm: 32,
    fontSize: 9,
  },
  date: {
    leftMm: 153,
    bottomMm: 79.3,
    dateGapMm: 0,
    basePitchMm: 5.4,
    fontSize: 8,
  },
  acPayee: {
    leftMm: 100,
    bottomMm: 79,
    fontSize: 8,
    enabled: true,
  },
};

/** CSS % helpers - convert bottom-left mm → top-left percentages for rendering. */
export function leftMmToPercent(leftMm: number): number {
  return Number(((leftMm / CHEQUE_WIDTH_MM) * 100).toFixed(4));
}

export function bottomMmToTopPercent(bottomMm: number): number {
  return Number(
    (((CHEQUE_HEIGHT_MM - bottomMm) / CHEQUE_HEIGHT_MM) * 100).toFixed(4),
  );
}

export function widthMmToPercent(widthMm: number): number {
  return Number(((widthMm / CHEQUE_WIDTH_MM) * 100).toFixed(4));
}

export function datePitchMm(date: DateFieldMm): number {
  return date.basePitchMm + date.dateGapMm;
}

export function datePitchPercent(date: DateFieldMm): number {
  return widthMmToPercent(datePitchMm(date));
}

/** Legacy percent view used by some display helpers. */
export type FieldAlignment = {
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  fontSize: number;
};

export type DateAlignment = {
  leftPercent: number;
  topPercent: number;
  digitSpacing: number;
  fontSize: number;
};

export type ChequeAlignment = {
  payee: FieldAlignment;
  amountWords: FieldAlignment;
  amountNumbers: FieldAlignment;
  date: DateAlignment;
  acPayee: {
    leftPercent: number;
    topPercent: number;
    fontSize: number;
    enabled: boolean;
  };
};

export function alignmentMmToPercent(
  mm: ChequeAlignmentMm,
): ChequeAlignment {
  return {
    payee: {
      leftPercent: leftMmToPercent(mm.payee.leftMm),
      topPercent: bottomMmToTopPercent(mm.payee.bottomMm),
      widthPercent: widthMmToPercent(mm.payee.widthMm),
      fontSize: mm.payee.fontSize,
    },
    amountWords: {
      leftPercent: leftMmToPercent(mm.amountWords.leftMm),
      topPercent: bottomMmToTopPercent(mm.amountWords.bottomMm),
      widthPercent: widthMmToPercent(mm.amountWords.widthMm),
      fontSize: mm.amountWords.fontSize,
    },
    amountNumbers: {
      leftPercent: leftMmToPercent(mm.amountNumbers.leftMm),
      topPercent: bottomMmToTopPercent(mm.amountNumbers.bottomMm),
      widthPercent: widthMmToPercent(mm.amountNumbers.widthMm),
      fontSize: mm.amountNumbers.fontSize,
    },
    date: {
      leftPercent: leftMmToPercent(mm.date.leftMm),
      topPercent: bottomMmToTopPercent(mm.date.bottomMm),
      digitSpacing: datePitchPercent(mm.date),
      fontSize: mm.date.fontSize,
    },
    acPayee: {
      leftPercent: leftMmToPercent(mm.acPayee.leftMm),
      topPercent: bottomMmToTopPercent(mm.acPayee.bottomMm),
      fontSize: mm.acPayee.fontSize,
      enabled: mm.acPayee.enabled,
    },
  };
}

export const DEFAULT_ALIGNMENT: ChequeAlignment = alignmentMmToPercent(
  DEFAULT_ALIGNMENT_MM,
);

export const ALIGNMENT_STORAGE_KEY = "cheque-print-alignment-v12-date-left-153";
export const PAGE_PLACEMENT_STORAGE_KEY = "cheque-a4-page-placement-v1";
export const PRINT_DATA_SESSION_KEY = "cheque-print-data-v1";
export const CHEQUE_HISTORY_STORAGE_KEY = "cheque-fill-history-v1";

/** Standard A4 portrait sheet the printer actually feeds. */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/**
 * After +90deg rotation the cheque face occupies a 90x200 mm rectangle on the sheet.
 * Field-to-field mm gaps stay fixed; only this block moves on A4.
 */
export const PRINT_BLOCK_WIDTH_MM = CHEQUE_HEIGHT_MM; // 90
export const PRINT_BLOCK_HEIGHT_MM = CHEQUE_WIDTH_MM; // 200

export type A4PagePlacement = {
  /** Distance from top edge of A4 to top of the whole content block (mm). */
  topMm: number;
  /** Distance from left edge of A4 to left of the whole content block (mm). */
  leftMm: number;
};

export const A4PagePlacementSchema = z.object({
  topMm: z.number().min(-20).max(A4_HEIGHT_MM),
  leftMm: z.number().min(-20).max(A4_WIDTH_MM),
});

/** Flush to top; horizontally centred on A4 - calibrate in Alignment. */
export const DEFAULT_A4_PAGE_PLACEMENT: A4PagePlacement = {
  topMm: 0,
  leftMm: (A4_WIDTH_MM - PRINT_BLOCK_WIDTH_MM) / 2, // 60
};

export const PayeeSchema = z
  .string()
  .trim()
  .min(1, "Payee name is required")
  .regex(
    /^[A-Za-z0-9 ., &\-()]+$/,
    "Only letters, numbers, spaces, periods, commas, ampersands, hyphens and parentheses are allowed",
  )
  .transform((value) => value.replace(/\s+/g, " ").trim().toUpperCase());

export const ChequeNumberSchema = z
  .string()
  .trim()
  .min(1, "Cheque number is required")
  .max(20, "Cheque number is too long")
  .regex(/^[0-9A-Za-z\-\/]+$/, "Use only letters, numbers, hyphens or /")
  .transform((value) => value.trim().toUpperCase());

export type ChequePrintData = {
  payee: string;
  amountFormatted: string;
  amountWords: string;
  dateRaw: string;
  chequeNumber?: string;
  printAcPayee?: boolean;
  isAlignmentTest?: boolean;
};

export type ChequeHistoryEntry = {
  id: string;
  chequeNumber: string;
  payee: string;
  amountFormatted: string;
  amountWords: string;
  dateRaw: string;
  savedAt: string;
};

export const SAMPLE_ALIGNMENT_TEST: ChequePrintData = {
  payee: "TEST BENEFICIARY",
  amountWords: "ONE LAKH TWENTY-FIVE THOUSAND ONLY",
  amountFormatted: "₹ 1,25,000/-",
  dateRaw: "04082026",
  chequeNumber: "TEST-000",
  printAcPayee: true,
  isAlignmentTest: true,
};

export type OverlayFieldKey =
  | "payee"
  | "amountWords"
  | "amountNumbers"
  | "date"
  | "acPayee";
