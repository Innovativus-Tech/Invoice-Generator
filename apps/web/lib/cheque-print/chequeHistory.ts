import {
  CHEQUE_HISTORY_STORAGE_KEY,
  type ChequeHistoryEntry,
  type ChequePrintData,
} from "./chequeTypes";

const MAX_HISTORY = 100;

export function loadChequeHistory(): ChequeHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHEQUE_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChequeHistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveChequeHistoryEntry(
  data: ChequePrintData & { chequeNumber: string },
): ChequeHistoryEntry[] {
  if (typeof window === "undefined") return [];

  const entry: ChequeHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    chequeNumber: data.chequeNumber,
    payee: data.payee,
    amountFormatted: data.amountFormatted,
    amountWords: data.amountWords,
    dateRaw: data.dateRaw,
    savedAt: new Date().toISOString(),
  };

  const existing = loadChequeHistory().filter(
    (item) => item.chequeNumber !== entry.chequeNumber,
  );
  const next = [entry, ...existing].slice(0, MAX_HISTORY);
  window.localStorage.setItem(CHEQUE_HISTORY_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearChequeHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CHEQUE_HISTORY_STORAGE_KEY);
}
