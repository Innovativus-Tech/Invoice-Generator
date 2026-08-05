import {
  ALIGNMENT_STORAGE_KEY,
  ChequeAlignmentMmSchema,
  DEFAULT_ALIGNMENT_MM,
  CHEQUE_HEIGHT_MM,
  CHEQUE_WIDTH_MM,
  alignmentMmToPercent,
  type ChequeAlignment,
  type ChequeAlignmentMm,
  type OverlayFieldKey,
} from "./chequeTypes";

export function getDefaultAlignmentMm(): ChequeAlignmentMm {
  return structuredClone(DEFAULT_ALIGNMENT_MM);
}

export function getDefaultAlignment(): ChequeAlignment {
  return alignmentMmToPercent(getDefaultAlignmentMm());
}

export function loadAlignmentMm(): ChequeAlignmentMm {
  if (typeof window === "undefined") {
    return getDefaultAlignmentMm();
  }

  try {
    const raw = window.localStorage.getItem(ALIGNMENT_STORAGE_KEY);
    if (!raw) return getDefaultAlignmentMm();
    const parsed = JSON.parse(raw) as unknown;
    const result = ChequeAlignmentMmSchema.safeParse(parsed);
    if (!result.success) return getDefaultAlignmentMm();
    return result.data;
  } catch {
    return getDefaultAlignmentMm();
  }
}

export function loadAlignment(): ChequeAlignment {
  return alignmentMmToPercent(loadAlignmentMm());
}

export function saveAlignmentMm(alignment: ChequeAlignmentMm): void {
  if (typeof window === "undefined") return;
  const result = ChequeAlignmentMmSchema.safeParse(alignment);
  if (!result.success) {
    throw new Error("Invalid alignment data");
  }
  window.localStorage.setItem(
    ALIGNMENT_STORAGE_KEY,
    JSON.stringify(result.data),
  );
}

export function resetAlignmentMm(): ChequeAlignmentMm {
  const defaults = getDefaultAlignmentMm();
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ALIGNMENT_STORAGE_KEY);
  }
  return defaults;
}

export function resetAlignment(): ChequeAlignment {
  return alignmentMmToPercent(resetAlignmentMm());
}

export function nudgeFieldMm(
  alignment: ChequeAlignmentMm,
  field: OverlayFieldKey,
  dxMm: number,
  /** Positive = move up (increase distance from bottom). */
  dyMmUp: number,
): ChequeAlignmentMm {
  const next = structuredClone(alignment);
  const target = next[field];
  target.leftMm = clamp(target.leftMm + dxMm, 0, CHEQUE_WIDTH_MM - 1);
  target.bottomMm = clamp(target.bottomMm + dyMmUp, 0, CHEQUE_HEIGHT_MM - 1);
  return next;
}

export function nudgeAllFieldsMm(
  alignment: ChequeAlignmentMm,
  dxMm: number,
  dyMmUp: number,
): ChequeAlignmentMm {
  let next = alignment;
  (
    ["payee", "amountWords", "amountNumbers", "date", "acPayee"] as OverlayFieldKey[]
  ).forEach((field) => {
    next = nudgeFieldMm(next, field, dxMm, dyMmUp);
  });
  return next;
}

export function adjustFontSizeMm(
  alignment: ChequeAlignmentMm,
  field: OverlayFieldKey,
  delta: number,
): ChequeAlignmentMm {
  const next = structuredClone(alignment);
  next[field].fontSize = clamp(next[field].fontSize + delta, 6, 48);
  return next;
}

/** Change every print field font by the same pt delta. */
export function adjustAllFontSizesMm(
  alignment: ChequeAlignmentMm,
  delta: number,
): ChequeAlignmentMm {
  let next = alignment;
  (
    ["payee", "amountWords", "amountNumbers", "date", "acPayee"] as OverlayFieldKey[]
  ).forEach((field) => {
    next = adjustFontSizeMm(next, field, delta);
  });
  return next;
}

export function adjustDateGapMm(
  alignment: ChequeAlignmentMm,
  delta: number,
): ChequeAlignmentMm {
  const next = structuredClone(alignment);
  next.date.dateGapMm = clamp(Number((next.date.dateGapMm + delta).toFixed(2)), 0, 10);
  return next;
}

export function setFieldMm(
  alignment: ChequeAlignmentMm,
  field: OverlayFieldKey,
  leftMm: number,
  bottomMm: number,
): ChequeAlignmentMm {
  const next = structuredClone(alignment);
  next[field].leftMm = clamp(leftMm, 0, CHEQUE_WIDTH_MM - 1);
  next[field].bottomMm = clamp(bottomMm, 0, CHEQUE_HEIGHT_MM - 1);
  return next;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}
