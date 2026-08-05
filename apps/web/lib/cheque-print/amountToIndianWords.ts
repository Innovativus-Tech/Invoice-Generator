import { parseAmountInput, type ParsedAmount } from "./formatIndianCurrency";

const ONES = [
  "",
  "ONE",
  "TWO",
  "THREE",
  "FOUR",
  "FIVE",
  "SIX",
  "SEVEN",
  "EIGHT",
  "NINE",
  "TEN",
  "ELEVEN",
  "TWELVE",
  "THIRTEEN",
  "FOURTEEN",
  "FIFTEEN",
  "SIXTEEN",
  "SEVENTEEN",
  "EIGHTEEN",
  "NINETEEN",
];

const TENS = [
  "",
  "",
  "TWENTY",
  "THIRTY",
  "FORTY",
  "FIFTY",
  "SIXTY",
  "SEVENTY",
  "EIGHTY",
  "NINETY",
];

/** Convert 0-99 to words (empty string for 0). Uses hyphens for 21-99. */
function twoDigitsToWords(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  if (one === 0) return TENS[ten];
  return `${TENS[ten]}-${ONES[one]}`;
}

/** Convert 0-999 to words. */
function threeDigitsToWords(n: number): string {
  if (n === 0) return "";
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundred > 0) {
    parts.push(`${ONES[hundred]} HUNDRED`);
  }
  if (rest > 0) {
    parts.push(twoDigitsToWords(rest));
  }
  return parts.join(" ");
}

/**
 * Convert a non-negative integer rupee string to Indian words
 * (CRORE / LAKH / THOUSAND / HUNDRED). Supports up to 999999999 (9 digits).
 */
export function rupeesToIndianWords(rupees: string): string {
  const digits = rupees.replace(/^0+(?=\d)/, "") || "0";
  if (digits === "0") return "";

  if (!/^\d+$/.test(digits)) {
    throw new Error("Rupees must be a non-negative integer string");
  }

  if (digits.length > 9) {
    throw new Error("Amount exceeds supported maximum (99,99,99,999)");
  }

  const n = Number.parseInt(digits, 10);
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = n % 1000;

  const parts: string[] = [];

  if (crore > 0) {
    parts.push(`${threeDigitsToWords(crore)} CRORE`);
  }
  if (lakh > 0) {
    parts.push(`${twoDigitsToWords(lakh)} LAKH`);
  }
  if (thousand > 0) {
    parts.push(`${twoDigitsToWords(thousand)} THOUSAND`);
  }
  if (hundred > 0) {
    parts.push(threeDigitsToWords(hundred));
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function paiseToWords(paise: number): string {
  if (paise <= 0) return "";
  return `${twoDigitsToWords(paise)} PAISE`;
}

/** Build amount-in-words for the cheque (no leading "RUPEES" - already printed on the leaf). */
export function amountToIndianWordsFromParsed(parsed: ParsedAmount): string {
  const rupeeWords = rupeesToIndianWords(parsed.rupees);
  const paiseWords = paiseToWords(parsed.paise);

  if (!rupeeWords && !paiseWords) {
    throw new Error("Amount must be greater than zero");
  }

  if (rupeeWords && paiseWords) {
    return `${rupeeWords} AND ${paiseWords} ONLY`;
  }

  if (!rupeeWords && paiseWords) {
    return `${paiseWords} ONLY`;
  }

  return `${rupeeWords} ONLY`;
}

/**
 * Convert a user amount input to Indian cheque amount-in-words.
 * Returns null if the input is invalid.
 */
export function amountToIndianWords(input: string): string | null {
  const parsed = parseAmountInput(input);
  if (!parsed.ok) return null;
  return amountToIndianWordsFromParsed(parsed.value);
}

export type AmountWordsResult =
  | { ok: true; words: string }
  | { ok: false; error: string };

export function amountToIndianWordsResult(input: string): AmountWordsResult {
  const parsed = parseAmountInput(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  try {
    return { ok: true, words: amountToIndianWordsFromParsed(parsed.value) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to convert amount",
    };
  }
}
