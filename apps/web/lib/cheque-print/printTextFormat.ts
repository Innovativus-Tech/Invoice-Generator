/**
 * ChequePrint.cloud-style print text (asterisk security padding).
 * Example amount: **12,31,212/**
 */

export function formatPrintPayee(payee: string): string {
  const value = payee.trim().toUpperCase();
  return `**${value}**`;
}

export function formatPrintAmountWords(words: string): string {
  const value = words.trim().toUpperCase();
  return `**${value}**`;
}

/** UI shows ₹ 1,25,000/- - print face uses **1,25,000/** like ChequePrint. */
export function formatPrintAmountDigits(formatted: string): string {
  const inner = formatted
    .replace(/^₹\s*/, "")
    .replace(/\/-\s*$/, "/")
    .trim();
  return `**${inner}**`;
}
