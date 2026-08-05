import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  A4PagePlacementSchema,
  DEFAULT_A4_PAGE_PLACEMENT,
  PAGE_PLACEMENT_STORAGE_KEY,
  PRINT_BLOCK_HEIGHT_MM,
  PRINT_BLOCK_WIDTH_MM,
  type A4PagePlacement,
} from "./chequeTypes";

export function getDefaultPagePlacement(): A4PagePlacement {
  return structuredClone(DEFAULT_A4_PAGE_PLACEMENT);
}

export function loadPagePlacement(): A4PagePlacement {
  if (typeof window === "undefined") {
    return getDefaultPagePlacement();
  }

  try {
    const raw = window.localStorage.getItem(PAGE_PLACEMENT_STORAGE_KEY);
    if (!raw) return getDefaultPagePlacement();
    const parsed = JSON.parse(raw) as unknown;
    const result = A4PagePlacementSchema.safeParse(parsed);
    if (!result.success) return getDefaultPagePlacement();
    return result.data;
  } catch {
    return getDefaultPagePlacement();
  }
}

export function savePagePlacement(placement: A4PagePlacement): void {
  if (typeof window === "undefined") return;
  const result = A4PagePlacementSchema.safeParse(placement);
  if (!result.success) {
    throw new Error("Invalid A4 page placement");
  }
  window.localStorage.setItem(
    PAGE_PLACEMENT_STORAGE_KEY,
    JSON.stringify(result.data),
  );
}

export function resetPagePlacement(): A4PagePlacement {
  const defaults = getDefaultPagePlacement();
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(PAGE_PLACEMENT_STORAGE_KEY);
  }
  return defaults;
}

export function nudgePagePlacement(
  placement: A4PagePlacement,
  dLeftMm: number,
  dTopMm: number,
): A4PagePlacement {
  return {
    leftMm: clamp(
      placement.leftMm + dLeftMm,
      -20,
      A4_WIDTH_MM - PRINT_BLOCK_WIDTH_MM + 20,
    ),
    topMm: clamp(
      placement.topMm + dTopMm,
      -20,
      A4_HEIGHT_MM - PRINT_BLOCK_HEIGHT_MM + 20,
    ),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}
