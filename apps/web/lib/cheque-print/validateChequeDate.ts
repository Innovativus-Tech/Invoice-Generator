export type DateValidationResult =
  | { ok: true; digits: string; formattedDisplay: string }
  | { ok: false; error: string };

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(month: number, year: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

/**
 * Validate a cheque date in DDMMYYYY format.
 * Does not auto-correct the user's entry.
 */
export function validateChequeDate(input: string): DateValidationResult {
  if (input === undefined || input === null) {
    return { ok: false, error: "Date is required" };
  }

  const raw = String(input).trim();

  if (!raw) {
    return { ok: false, error: "Date is required" };
  }

  if (!/^\d+$/.test(raw)) {
    return { ok: false, error: "Date must contain only numeric digits" };
  }

  if (raw.length < 8) {
    return { ok: false, error: "Date must be exactly 8 digits (DDMMYYYY)" };
  }

  if (raw.length > 8) {
    return { ok: false, error: "Date must be exactly 8 digits (DDMMYYYY)" };
  }

  if (raw === "00000000") {
    return { ok: false, error: "Invalid date" };
  }

  const day = Number.parseInt(raw.slice(0, 2), 10);
  const month = Number.parseInt(raw.slice(2, 4), 10);
  const year = Number.parseInt(raw.slice(4, 8), 10);

  if (month < 1 || month > 12) {
    return { ok: false, error: "Invalid month" };
  }

  if (day < 1) {
    return { ok: false, error: "Invalid day" };
  }

  const maxDay = daysInMonth(month, year);
  if (day > maxDay) {
    return { ok: false, error: "Invalid date for the given month and year" };
  }

  const spaced = raw.split("").join(" ");

  return {
    ok: true,
    digits: raw,
    formattedDisplay: spaced,
  };
}

/** Today's date as DDMMYYYY using the local timezone. */
export function todayAsDDMMYYYY(now: Date = new Date()): string {
  const day = now.getDate().toString().padStart(2, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const year = now.getFullYear().toString();
  return `${day}${month}${year}`;
}
