export type ParsedAmount = {
  /** Whole rupees as a non-negative integer (string to avoid precision loss). */
  rupees: string;
  /** Paise 0-99 as integer. */
  paise: number;
  /** Original cleaned numeric string without commas. */
  normalized: string;
};

export type AmountParseResult =
  | { ok: true; value: ParsedAmount }
  | { ok: false; error: string };

/**
 * Parse an amount string without floating-point arithmetic.
 * Accepts Indian/Western commas; max two decimal places; must be > 0.
 * Also accepts optional ₹ / Rs / INR prefixes.
 */
export function parseAmountInput(input: string): AmountParseResult {
  if (input === undefined || input === null) {
    return { ok: false, error: "Amount is required" };
  }

  let trimmed = String(input).trim();
  if (!trimmed) {
    return { ok: false, error: "Amount is required" };
  }

  // Strip common currency prefixes so "₹1250" / "Rs 1,250" still work
  trimmed = trimmed
    .replace(/^(rs\.?|inr|₹)\s*/i, "")
    .replace(/\s+/g, "")
    .trim();

  if (!trimmed) {
    return { ok: false, error: "Amount is required" };
  }

  if (/[a-zA-Z]/.test(trimmed)) {
    return { ok: false, error: "Amount must not contain letters" };
  }

  if (!/^[0-9,]+(\.[0-9]+)?$/.test(trimmed)) {
    return { ok: false, error: "Amount contains invalid characters" };
  }

  const withoutCommas = trimmed.replace(/,/g, "");

  if (!/^\d+(\.\d+)?$/.test(withoutCommas)) {
    return { ok: false, error: "Invalid amount format" };
  }

  const [rupeesPart, decimalPart = ""] = withoutCommas.split(".");

  if (decimalPart.length > 2) {
    return { ok: false, error: "Maximum of two decimal places allowed" };
  }

  if (!rupeesPart || !/^\d+$/.test(rupeesPart)) {
    return { ok: false, error: "Invalid amount format" };
  }

  const rupeesNormalized = rupeesPart.replace(/^0+(?=\d)/, "") || "0";
  const paise =
    decimalPart.length === 0
      ? 0
      : decimalPart.length === 1
        ? Number.parseInt(decimalPart, 10) * 10
        : Number.parseInt(decimalPart, 10);

  if (Number.isNaN(paise) || paise < 0 || paise > 99) {
    return { ok: false, error: "Invalid paise value" };
  }

  if (rupeesNormalized === "0" && paise === 0) {
    return { ok: false, error: "Amount must be greater than zero" };
  }

  const normalized =
    paise === 0
      ? rupeesNormalized
      : `${rupeesNormalized}.${paise.toString().padStart(2, "0")}`;

  return {
    ok: true,
    value: {
      rupees: rupeesNormalized,
      paise,
      normalized,
    },
  };
}

/** Format an integer rupee string using the Indian numbering system. */
export function formatIndianInteger(rupees: string): string {
  const digits = rupees.replace(/^0+(?=\d)/, "") || "0";
  if (digits.length <= 3) {
    return digits;
  }

  const lastThree = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];

  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) {
    groups.unshift(rest);
  }

  return `${groups.join(",")},${lastThree}`;
}

/**
 * Format a parsed amount as Indian currency for the cheque amount box.
 * Examples: ₹ 1,250/-  |  ₹ 1,25,000.50/-
 */
export function formatIndianCurrency(parsed: ParsedAmount): string {
  const integerPart = formatIndianInteger(parsed.rupees);
  if (parsed.paise === 0) {
    return `₹ ${integerPart}/-`;
  }
  return `₹ ${integerPart}.${parsed.paise.toString().padStart(2, "0")}/-`;
}

/** Parse and format in one step. Returns null on invalid input. */
export function formatIndianCurrencyFromInput(input: string): string | null {
  const parsed = parseAmountInput(input);
  if (!parsed.ok) return null;
  return formatIndianCurrency(parsed.value);
}
