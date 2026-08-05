import {
  PRINT_DATA_SESSION_KEY,
  type ChequePrintData,
} from "./chequeTypes";

export function savePrintData(data: ChequePrintData): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PRINT_DATA_SESSION_KEY, JSON.stringify(data));
}

export function loadPrintData(): ChequePrintData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PRINT_DATA_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ChequePrintData;
  } catch {
    return null;
  }
}

export function clearPrintData(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PRINT_DATA_SESSION_KEY);
}
