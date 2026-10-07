// How each document type behaves in the UI. Mirrors apps/api/src/lib/doc-types.ts.
import type { DocType, DeliveryStatus, PartyType, ApprovalStatus } from '@/types';

export interface DocTypeUi {
  label: string;
  plural: string;
  /** URL segment under /documents (sales invoices keep their /invoices routes). */
  slug: string;
  side: 'sales' | 'purchase';
  resource: 'invoices' | 'purchases';
  numberLabel: string;
  partyLabel: string;
  description: string;
  stock: 'none' | 'in' | 'out';
  isBill: boolean;
  requiresApproval: boolean;
  tracksDamage: boolean;
  showDispatch: boolean;
  /** Line rate defaults to the item's purchase rate instead of its selling price. */
  usesPurchaseRate: boolean;
  convertsTo: DocType[];
  /** Party types offered in the party picker, most relevant first. */
  partyTypes: PartyType[];
}

export const DOC_TYPES: DocType[] = [
  'sales_invoice', 'estimate', 'delivery_challan', 'sales_return', 'credit_note',
  'purchase_bill', 'binding_order', 'purchase_return', 'debit_note',
];

const CUSTOMER: PartyType[] = ['customer', 'both'];
const SUPPLIER: PartyType[] = ['supplier', 'binder', 'both'];

export const DOC_TYPE_UI: Record<DocType, DocTypeUi> = {
  sales_invoice: {
    label: 'Sales Invoice', plural: 'Sales Invoices', slug: 'sales-invoices', side: 'sales', resource: 'invoices',
    numberLabel: 'Invoice No.', partyLabel: 'Customer', description: 'Bills to customers — cash or credit',
    stock: 'out', isBill: true, requiresApproval: false, tracksDamage: false, showDispatch: true, usesPurchaseRate: false,
    convertsTo: ['sales_return', 'credit_note'], partyTypes: CUSTOMER,
  },
  estimate: {
    label: 'Estimate', plural: 'Estimates', slug: 'estimates', side: 'sales', resource: 'invoices',
    numberLabel: 'Estimate No.', partyLabel: 'Customer', description: 'Approximate bills / quotations — no stock or ledger effect',
    stock: 'none', isBill: false, requiresApproval: false, tracksDamage: false, showDispatch: false, usesPurchaseRate: false,
    convertsTo: ['sales_invoice', 'delivery_challan'], partyTypes: CUSTOMER,
  },
  delivery_challan: {
    label: 'Delivery Challan', plural: 'Delivery Challans', slug: 'challans', side: 'sales', resource: 'invoices',
    numberLabel: 'Challan No.', partyLabel: 'Customer', description: 'Goods sent to parties before billing (e.g. on approval)',
    stock: 'out', isBill: false, requiresApproval: false, tracksDamage: false, showDispatch: true, usesPurchaseRate: false,
    convertsTo: ['sales_invoice'], partyTypes: CUSTOMER,
  },
  sales_return: {
    label: 'Sales Return', plural: 'Sales Returns', slug: 'sales-returns', side: 'sales', resource: 'invoices',
    numberLabel: 'Return No.', partyLabel: 'Customer', description: 'Books returned by customers — needs owner/admin approval',
    stock: 'in', isBill: false, requiresApproval: true, tracksDamage: true, showDispatch: true, usesPurchaseRate: false,
    convertsTo: [], partyTypes: CUSTOMER,
  },
  credit_note: {
    label: 'Credit Note', plural: 'Credit Notes', slug: 'credit-notes', side: 'sales', resource: 'invoices',
    numberLabel: 'Credit Note No.', partyLabel: 'Party', description: 'Reduce what a party owes you (rate difference, discount after sale)',
    stock: 'none', isBill: false, requiresApproval: false, tracksDamage: false, showDispatch: false, usesPurchaseRate: false,
    convertsTo: [], partyTypes: CUSTOMER,
  },
  purchase_bill: {
    label: 'Purchase Bill', plural: 'Purchase Bills', slug: 'purchase-bills', side: 'purchase', resource: 'purchases',
    numberLabel: 'Bill No.', partyLabel: 'Supplier / Binder', description: 'Books bought from binders and suppliers — record print damage',
    stock: 'in', isBill: true, requiresApproval: false, tracksDamage: true, showDispatch: true, usesPurchaseRate: true,
    convertsTo: ['purchase_return', 'debit_note'], partyTypes: SUPPLIER,
  },
  purchase_return: {
    label: 'Purchase Return', plural: 'Purchase Returns', slug: 'purchase-returns', side: 'purchase', resource: 'purchases',
    numberLabel: 'Return No.', partyLabel: 'Supplier / Binder', description: 'Send books (e.g. damaged copies) back to the supplier',
    stock: 'out', isBill: false, requiresApproval: false, tracksDamage: true, showDispatch: true, usesPurchaseRate: true,
    convertsTo: [], partyTypes: SUPPLIER,
  },
  debit_note: {
    label: 'Debit Note', plural: 'Debit Notes', slug: 'debit-notes', side: 'purchase', resource: 'purchases',
    numberLabel: 'Debit Note No.', partyLabel: 'Party', description: 'Reduce what you owe a supplier (short supply, rate difference)',
    stock: 'none', isBill: false, requiresApproval: false, tracksDamage: false, showDispatch: false, usesPurchaseRate: true,
    convertsTo: [], partyTypes: SUPPLIER,
  },
  binding_order: {
    label: 'Binding Order', plural: 'Binding Orders', slug: 'binding-orders', side: 'purchase', resource: 'purchases',
    numberLabel: 'Order No.', partyLabel: 'Binder', description: 'Paperback / hardbound jobs sent to binders, at the binder\'s rate',
    stock: 'none', isBill: false, requiresApproval: false, tracksDamage: false, showDispatch: true, usesPurchaseRate: true,
    convertsTo: ['purchase_bill'], partyTypes: ['binder', 'supplier', 'both'],
  },
};

export const docUi = (type: DocType) => DOC_TYPE_UI[type];

export function docTypeFromSlug(slug: string): DocType | null {
  return (DOC_TYPES.find((t) => DOC_TYPE_UI[t].slug === slug) as DocType | undefined) ?? null;
}

/** Route for a document list, a document, or one of its sub-pages. */
export function docPath(type: DocType, id?: string, sub?: 'edit'): string {
  const base = type === 'sales_invoice' ? '/invoices' : `/documents/${DOC_TYPE_UI[type].slug}`;
  if (!id) return base;
  return sub ? `${base}/${id}/${sub}` : `${base}/${id}`;
}

export const newDocPath = (type: DocType, params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  return `${docPath(type)}/new${qs}`;
};

export const BINDING_OPTIONS = ['Paperback', 'Hardbound', 'Spiral', 'Saddle Stitch', 'Board Book', 'Perfect Bound'];

export const COURIER_OPTIONS = ['India Post', 'DTDC', 'Blue Dart', 'Delhivery', 'Professional Couriers', 'Trackon', 'Shree Maruti', 'Ekart', 'XpressBees'];

export const PARTY_TYPE_LABEL: Record<PartyType, string> = {
  customer: 'Customer',
  supplier: 'Supplier',
  binder: 'Binder',
  both: 'Customer & Supplier',
};

export const DELIVERY_STATUS: Record<DeliveryStatus, { label: string; className: string }> = {
  pending: { label: 'Not dispatched', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  dispatched: { label: 'Dispatched', className: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  in_transit: { label: 'In transit', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  delivered: { label: 'Delivered', className: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  returned: { label: 'Returned', className: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
};

export const APPROVAL_STATUS: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: { label: 'Awaiting approval', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  approved: { label: 'Approved', className: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', bank: 'Bank transfer', cheque: 'Cheque', card: 'Card', other: 'Other',
};
