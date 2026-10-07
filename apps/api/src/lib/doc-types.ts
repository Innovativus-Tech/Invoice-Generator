// Every trading document is a row in the `invoices` table, distinguished by
// `doc_type`. This file is the single source of truth for how each type
// behaves: numbering prefix, stock effect, party-ledger effect, conversions.
// Keep in sync with apps/web/lib/doc-types.ts.

export const DOC_TYPES = [
  'sales_invoice',
  'estimate',
  'delivery_challan',
  'sales_return',
  'credit_note',
  'purchase_bill',
  'purchase_return',
  'debit_note',
  'binding_order',
] as const;

export type DocType = (typeof DOC_TYPES)[number];

/** Payments have their own number series alongside documents. */
export type SeriesKey = DocType | 'payment_in' | 'payment_out';

export type StockEffect = 'none' | 'in' | 'out';
/** Effect on the party's account: debit = party owes us more, credit = party owes us less. */
export type LedgerEffect = 'none' | 'debit' | 'credit';

export interface DocTypeConfig {
  label: string;
  /** Heading printed on the PDF. */
  title: string;
  prefix: string;
  side: 'sales' | 'purchase';
  /** RBAC resource that guards this document type. */
  resource: 'invoices' | 'purchases';
  stock: StockEffect;
  ledger: LedgerEffect;
  /** Bills support cash/credit, due dates and settlement tracking. */
  isBill: boolean;
  requiresApproval: boolean;
  /** Types this document can be converted into. */
  convertsTo: DocType[];
  /** When a document is created from this type, the source is marked "converted". */
  closesOnConversion: boolean;
}

export const DOC_TYPE_CONFIG: Record<DocType, DocTypeConfig> = {
  sales_invoice: {
    label: 'Sales Invoice', title: 'Tax Invoice', prefix: 'INV', side: 'sales', resource: 'invoices',
    stock: 'out', ledger: 'debit', isBill: true, requiresApproval: false,
    convertsTo: ['sales_return', 'credit_note'], closesOnConversion: false,
  },
  estimate: {
    label: 'Estimate', title: 'Estimate', prefix: 'EST', side: 'sales', resource: 'invoices',
    stock: 'none', ledger: 'none', isBill: false, requiresApproval: false,
    convertsTo: ['sales_invoice', 'delivery_challan'], closesOnConversion: true,
  },
  delivery_challan: {
    label: 'Delivery Challan', title: 'Delivery Challan', prefix: 'DC', side: 'sales', resource: 'invoices',
    stock: 'out', ledger: 'none', isBill: false, requiresApproval: false,
    convertsTo: ['sales_invoice'], closesOnConversion: true,
  },
  sales_return: {
    label: 'Sales Return', title: 'Sales Return / Credit Note', prefix: 'SR', side: 'sales', resource: 'invoices',
    stock: 'in', ledger: 'credit', isBill: false, requiresApproval: true,
    convertsTo: [], closesOnConversion: false,
  },
  credit_note: {
    label: 'Credit Note', title: 'Credit Note', prefix: 'CN', side: 'sales', resource: 'invoices',
    stock: 'none', ledger: 'credit', isBill: false, requiresApproval: false,
    convertsTo: [], closesOnConversion: false,
  },
  purchase_bill: {
    label: 'Purchase Bill', title: 'Purchase Bill', prefix: 'PB', side: 'purchase', resource: 'purchases',
    stock: 'in', ledger: 'credit', isBill: true, requiresApproval: false,
    convertsTo: ['purchase_return', 'debit_note'], closesOnConversion: false,
  },
  purchase_return: {
    label: 'Purchase Return', title: 'Purchase Return / Debit Note', prefix: 'PR', side: 'purchase', resource: 'purchases',
    stock: 'out', ledger: 'debit', isBill: false, requiresApproval: false,
    convertsTo: [], closesOnConversion: false,
  },
  debit_note: {
    label: 'Debit Note', title: 'Debit Note', prefix: 'DN', side: 'purchase', resource: 'purchases',
    stock: 'none', ledger: 'debit', isBill: false, requiresApproval: false,
    convertsTo: [], closesOnConversion: false,
  },
  binding_order: {
    label: 'Binding Order', title: 'Binding Order', prefix: 'BO', side: 'purchase', resource: 'purchases',
    stock: 'none', ledger: 'none', isBill: false, requiresApproval: false,
    convertsTo: ['purchase_bill'], closesOnConversion: true,
  },
};

export const PAYMENT_SERIES_PREFIX: Record<'payment_in' | 'payment_out', string> = {
  payment_in: 'RCPT',
  payment_out: 'PAY',
};

export function isDocType(value: unknown): value is DocType {
  return typeof value === 'string' && (DOC_TYPES as readonly string[]).includes(value);
}

export function docConfig(type: string): DocTypeConfig {
  if (!isDocType(type)) throw new Error(`Unknown document type: ${type}`);
  return DOC_TYPE_CONFIG[type];
}

interface PostingState {
  docType: string;
  status: string;
  approvalStatus: string | null;
  affectsStock: boolean;
  clientId: string | null;
}

/** A document is "posted" (counts for stock and ledger) unless cancelled or awaiting approval. */
export function isPosted(doc: PostingState): boolean {
  const cfg = docConfig(doc.docType);
  if (doc.status === 'cancelled') return false;
  if (cfg.requiresApproval && doc.approvalStatus !== 'approved') return false;
  return true;
}

export function hasStockEffect(doc: PostingState): boolean {
  const cfg = docConfig(doc.docType);
  if (cfg.stock === 'none' || !doc.affectsStock || !isPosted(doc)) return false;
  // Once a challan is invoiced, the invoice carries the stock movement instead.
  if (doc.docType === 'delivery_challan' && doc.status === 'converted') return false;
  return true;
}

export function hasLedgerEffect(doc: PostingState): boolean {
  const cfg = docConfig(doc.docType);
  return cfg.ledger !== 'none' && !!doc.clientId && isPosted(doc);
}
