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
