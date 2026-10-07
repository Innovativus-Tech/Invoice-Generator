import { type ClassValue, clsx } from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';
import type { InvoiceStatus } from '@/types';

// Simple class name merge (no tailwind-merge needed)
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

// Currency formatting (existing – for web UI)
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number in Indian lakh/crore notation with ₹ symbol.
 * e.g. 265000 → "₹2,65,000.00"
 */
export function formatIndianCurrency(amount: number): string {
  const fixed = Math.abs(amount).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  let result = '';
  const n = intPart.length;
  if (n <= 3) {
    result = intPart;
  } else {
    result = intPart.slice(n - 3);
    let remaining = intPart.slice(0, n - 3);
    while (remaining.length > 2) {
      result = remaining.slice(remaining.length - 2) + ',' + result;
      remaining = remaining.slice(0, remaining.length - 2);
    }
    result = remaining + ',' + result;
  }
  return `Rs. ${amount < 0 ? '-' : ''}${result}.${decPart}`;
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function numToWords(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ONES[n % 10] : '');
  return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + numToWords(n % 100) : '');
}

/**
 * Convert a numeric amount to Indian English words.
 * e.g. 314470 → "Rupees Three Lakh Fourteen Thousand Four Hundred and Seventy Only"
 */
export function convertToIndianWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let words = '';
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;
  if (crore > 0) words += numToWords(crore) + ' Crore ';
  if (lakh > 0) words += numToWords(lakh) + ' Lakh ';
  if (thousand > 0) words += numToWords(thousand) + ' Thousand ';
  if (rest > 0) words += numToWords(rest);
  let result = 'Rupees ' + words.trim();
  if (paise > 0) result += ' and ' + numToWords(paise) + ' Paise';
  return result + ' Only';
}

// Date formatting
export function formatDate(date: string | Date, fmt: string = 'MMM dd, yyyy'): string {
  return format(new Date(date), fmt);
}

export function formatRelativeDate(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/** Format date as "06th April 2026" for GST invoices */
export function formatGstDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate();
  const suffix =
    day === 1 || day === 21 || day === 31 ? 'st'
    : day === 2 || day === 22 ? 'nd'
    : day === 3 || day === 23 ? 'rd'
    : 'th';
  const month = d.toLocaleDateString('en-IN', { month: 'long' });
  return `${String(day).padStart(2, '0')}${suffix} ${month} ${d.getFullYear()}`;
}

// Status colors
export const statusConfig: Record<InvoiceStatus, { label: string; className: string; dotColor: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    dotColor: 'bg-gray-400',
  },
  sent: {
    label: 'Sent',
    className: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    dotColor: 'bg-blue-500',
  },
  viewed: {
    label: 'Viewed',
    className: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    dotColor: 'bg-purple-500',
  },
  paid: {
    label: 'Paid',
    className: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    dotColor: 'bg-green-500',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
    dotColor: 'bg-gray-300',
  },
  converted: {
    label: 'Converted',
    className: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    dotColor: 'bg-teal-500',
  },
};

// Generate initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Calculate invoice totals (legacy helper for non-GST usage)
export function calculateInvoiceTotals(
  items: { quantity: number; unit_price: number }[],
  taxRate: number = 0,
  discountAmount: number = 0
) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discountAmount;
  return { subtotal, taxAmount, total: Math.max(0, total) };
}

/**
 * Calculate GST invoice totals from line items.
 * Each item can have its own gst_rate and discount_percent.
 */
export function calculateGstTotals(
  items: { quantity: number; unit_price: number; gst_rate?: number; discount_percent?: number }[]
) {
  let subtotal = 0;
  let totalGst = 0;
  items.forEach((item) => {
    const disc = item.discount_percent ?? 0;
    const lineAmt = item.quantity * item.unit_price * (1 - disc / 100);
    const gst = lineAmt * ((item.gst_rate ?? 18) / 100);
    subtotal += lineAmt;
    totalGst += gst;
  });
  const total = subtotal + totalGst;
  return { subtotal, totalGst, total: Math.max(0, total) };
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/** ₹ amount in Indian grouping, e.g. 265000 → "₹2,65,000" (paise shown only when present). */
export function inr(amount: number | null | undefined, opts: { decimals?: boolean } = {}): string {
  const n = Number(amount) || 0;
  const hasPaise = Math.round(Math.abs(n) * 100) % 100 !== 0;
  const digits = (opts.decimals ?? hasPaise) ? 2 : 0;
  return `${n < 0 ? '-' : ''}₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(n))}`;
}

/** Compact ₹ for charts and tiles, e.g. 1250000 → "₹12.5L". */
export function inrCompact(amount: number | null | undefined): string {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

/** "1 bill", "3 bills". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Party balance with Dr/Cr suffix: + receivable (Dr), − payable (Cr). */
export function balanceLabel(balance: number | null | undefined): string {
  const n = Number(balance) || 0;
  if (Math.abs(n) < 0.005) return '₹0';
  return `${inr(Math.abs(n))} ${n > 0 ? 'Dr' : 'Cr'}`;
}

/** Today as YYYY-MM-DD in the browser's timezone. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysISO(iso: string, days: number): string {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from today until `iso` (negative when in the past). */
export function daysUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const a = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const t = todayISO();
  const b = Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10));
  return Math.round((a - b) / 86_400_000);
}

/** Short date for tables: "07 Oct 2026". */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'dd MMM yyyy');
}

/** Download rows as a CSV file (Excel-friendly). */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '\uFEFF' + rows.map((r) => r.map(escape).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Extracts the API error message from an axios error. */
export function apiError(error: unknown, fallback = 'Something went wrong'): string {
  const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
  return err?.response?.data?.error?.message || err?.message || fallback;
}
