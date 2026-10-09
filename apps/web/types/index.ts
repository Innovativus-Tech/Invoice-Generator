// ============================================
// Shared TypeScript types for QuickInvoice
// ============================================

// Base types
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'cancelled' | 'converted';

export type SupplyType = 'IGST' | 'CGST_SGST';

export interface Profile {
  id: string;
  business_name: string | null;
  business_email: string | null;
  business_address: string | null;
  business_phone: string | null;
  logo_url: string | null;
  signature_url: string | null;
  signatory_name: string | null;
  currency: string;
  payment_terms: string;
  invoice_prefix: string;
  next_invoice_number: number;
  created_at: string;
  // GST fields
  gstin: string | null;
  website: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_branch: string | null;
  show_book_metadata?: boolean;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  company: string | null;
  address: string | null;
  phone: string | null;
  logo_url?: string | null;
  notes: string | null;
  created_at: string;
  // GST fields
  gstin: string | null;
  state: string | null;
  state_code: string | null;
  // Party fields
  party_type?: PartyType;
  credit_days?: number;
  credit_limit?: number;
  /** Positive = party owes us (Dr), negative = we owe the party (Cr). */
  opening_balance?: number;
  pincode?: string | null;
  shipping_address?: string | null;
  shipping_state?: string | null;
  shipping_pincode?: string | null;
  // Computed fields from API
  /** Signed ledger balance: + receivable, − payable. */
  balance?: number;
  totalInvoiced?: number;
  totalPurchased?: number;
  outstanding?: number;
  payable?: number;
  invoiceCount?: number;
}

export type PartyType = 'customer' | 'supplier' | 'binder' | 'both';

export interface PartyDocumentRow {
  id: string;
  doc_type: DocType;
  invoice_number: string;
  status: InvoiceStatus;
  approval_status: ApprovalStatus | null;
  issue_date: string;
  due_date: string | null;
  total: number;
  amount_paid: number;
  payment_mode: PaymentMode;
  currency: string | null;
  created_at: string;
}

export interface ClientWithInvoices extends Client {
  invoices: PartyDocumentRow[];
  totalInvoiced: number;
  outstanding: number;
  overdue_amount: number;
  max_days_overdue: number;
  next_due_date: string | null;
  open_bills: OpenItem[];
}

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  // GST fields
  hsn_sac: string;
  gst_rate: number;
  discount_percent: number;
  isbn?: string | null;
  author?: string | null;
  item_id?: string | null;
  binding?: string | null;
  damaged_qty?: number;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;

  order_id?: string | null;
  order_date?: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  currency: string;
  notes: string | null;
  terms: string | null;
  pdf_url: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  // GST fields
  supply_type: SupplyType | null;
  bill_number: string | null;
  place_of_supply: string | null;
  // Joined
  clients?: {
    name: string;
    email: string;
    company: string | null;
    address?: string | null;
    phone?: string | null;
    gstin?: string | null;
    state?: string | null;
    state_code?: string | null;
  } | null;
  items?: InvoiceItem[];
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
}

// Form types
export interface InvoiceFormValues {
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  order_id: string;
  order_date: string;
  client_id: string | null;
  tax_rate: number;
  discount_amount: number;
  notes: string;
  terms: string;
  items: InvoiceItem[];
  // GST fields
  supply_type: SupplyType;
  bill_number: string;
  place_of_supply: string;
}

export interface ClientFormValues {
  name: string;
  email: string;
  company: string;
  address: string;
  phone: string;
  notes: string;
  // GST fields
  gstin: string;
  state: string;
  state_code: string;
  // Party fields
  party_type: PartyType;
  credit_days: number;
  credit_limit: number;
  opening_balance: number;
  pincode: string;
  shipping_address: string;
  shipping_state: string;
  shipping_pincode: string;
}

export interface SettingsFormValues {
  business_name: string;
  business_email: string;
  business_address: string;
  business_phone: string;
  currency: string;
  payment_terms: string;
  invoice_prefix: string;
  next_invoice_number: number;
  signatory_name: string;
  logo_url?: string | null;
  signature_url?: string | null;
  // GST fields
  gstin: string;
  website: string;
  bank_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_branch: string;
  show_book_metadata?: boolean;
}

// API response types
export interface ApiResponse<T> {
  data: T | null;
  error: { message: string; code: string; details?: { field: string; message: string }[] } | null;
  meta: Record<string, unknown> | null;
}

export interface PaginatedResponse<T> {
  data: {
    invoices: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } | null;
  error: { message: string; code: string } | null;
  meta: { page: number; limit: number; total: number; totalPages: number } | null;
}

// Dashboard types
export interface DashboardStats {
  totalRevenue: number;
  paidCount: number;
  pendingAmount: number;
  revenueTrend: number;
  thisMonthRevenue: number;
}

export interface RevenueDataPoint {
  month: string;
  revenue: number;
}

// Query filter types
export interface InvoiceFilters {
  status?: InvoiceStatus;
  client_id?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  search?: string;
  sort?: 'created_at' | 'total' | 'invoice_number';
  order?: 'asc' | 'desc';
}

// Auth types
export interface AuthSession {
  user: {
    id: string;
    email: string;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

export type OrgRole = 'owner' | 'admin' | 'staff';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  org_id: string;
  org_name: string;
  role: OrgRole;
}

export interface OrganizationMember {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: OrgRole;
  joined_at: string;
}

export interface OrganizationInvitation {
  id: string;
  email: string;
  role: 'admin' | 'staff';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  created_at: string;
}

// Inventory types
export interface InventoryItem {
  id: string;
  user_id: string;
  book_title: string;
  isbn: string | null;
  author: string | null;
  publisher: string | null;
  product_form: string | null;
  language: string | null;
  applicant_type: string | null;
  imprint: string | null;
  publication_date: string | null;
  price: number;
  gst_rate: number;
  stock: number;
  binding?: string | null;
  purchase_rate?: number;
  binding_charge?: number;
  min_stock?: number;
  damaged_stock?: number;
  hsn_code?: string | null;
  created_at: string;
}

export interface InventoryFormValues {
  book_title: string;
  isbn: string;
  author: string;
  publisher: string;
  product_form: string;
  language: string;
  applicant_type: string;
  imprint: string;
  publication_date: string;
  price: number;
  gst_rate: number;
  stock: number;
  binding: string;
  purchase_rate: number;
  binding_charge: number;
  min_stock: number;
  hsn_code: string;
}

// Purchase types
export interface PurchaseOrder {
  id: string;
  user_id: string;
  order_id: string;
  client_id: string | null;
  client_name: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  purchase_date: string;
  notes: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface PurchaseFormValues {
  client_id?: string;
  client_name: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  purchase_date: string;
  notes: string;
  status: 'pending' | 'completed' | 'cancelled';
}

// Sales & Purchase analytics types
export interface MonthlyData {
  month: string;
  amount: number;
  count: number;
}

export interface TopClient {
  client_name: string;
  client_id: string;
  total: number;
  invoice_count: number;
}

export interface TopVendor {
  client_name: string;
  total: number;
  order_count: number;
}

export interface SalesSummary {
  total_revenue: number;
  invoice_count: number;
  average_invoice_value: number;
  top_clients: TopClient[];
  monthly_breakdown: MonthlyData[];
  invoices: Invoice[];
}

export interface PurchaseSummary {
  total_spent: number;
  order_count: number;
  average_order_value: number;
  top_vendors: TopVendor[];
  monthly_breakdown: MonthlyData[];
  orders: PurchaseOrder[];
}

// ============================================
// Billing documents (vouchers)
// ============================================

export type DocType =
  | 'sales_invoice'
  | 'estimate'
  | 'delivery_challan'
  | 'sales_return'
  | 'credit_note'
  | 'purchase_bill'
  | 'purchase_return'
  | 'debit_note'
  | 'binding_order';

export type PaymentMode = 'cash' | 'credit';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type DispatchMode = 'none' | 'courier' | 'transport' | 'hand';
export type DeliveryStatus = 'pending' | 'dispatched' | 'in_transit' | 'delivered' | 'returned';
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

export interface DocumentItem extends InvoiceItem {
  item_id?: string | null;
  binding?: string | null;
  damaged_qty?: number;
  /** Per-copy binding charge (purchase lines), added to the rate. */
  binding_charge?: number;
}

/** Fields shared by the document form and the API payload. */
export interface DocumentFields {
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  client_id: string | null;
  payment_mode: PaymentMode;
  party_name: string;
  party_phone: string;
  credit_days: number;
  due_date: string;
  billing_address: string;
  shipping_name: string;
  shipping_address: string;
  order_id: string;
  order_date: string;
  bill_number: string;
  place_of_supply: string;
  supply_type: SupplyType;
  notes: string;
  terms: string;
  party_ref_number: string;
  party_ref_date: string;
  extra_discount_type: 'percent' | 'amount';
  extra_discount_value: number;
  postage_charge: number;
  other_charges: number;
  other_charges_label: string;
  apply_round_off: boolean;
  source_doc_id: string | null;
  affects_stock: boolean;
  valid_until: string;
  reason: string;
  dispatch_mode: DispatchMode;
  delivery_status: DeliveryStatus;
  courier_name: string;
  tracking_number: string;
  dispatch_date: string;
  expected_delivery_date: string;
  delivered_date: string;
  transport_name: string;
  lr_number: string;
  vehicle_number: string;
  cartons: number | null;
  freight_type: '' | 'paid' | 'to_pay';
  delivery_type: '' | 'door' | 'godown';
  transport_details: string;
}

export interface DocumentFormValues extends DocumentFields {
  items: DocumentItem[];
  /** Advance paid when a credit bill is created (new bills only). */
  paid_now_amount?: number;
  paid_now_mode?: PaymentMethod;
  paid_now_reference?: string;
}

export interface BindingRate {
  id?: string;
  name: string;
  charge: number;
  sort_order?: number;
}

export interface DocumentLink {
  id: string;
  doc_type: DocType;
  invoice_number: string;
  status: InvoiceStatus;
  approval_status?: ApprovalStatus | null;
  total?: number;
  issue_date: string | null;
}

export interface DocumentPaymentRow {
  id: string;
  payment_number: string | null;
  direction: 'in' | 'out';
  amount: number;
  payment_date: string;
  mode: PaymentMethod;
  reference: string | null;
}

export interface BillingDocument {
  id: string;
  doc_type: DocType;
  doc_label: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  client_id: string | null;
  payment_mode: PaymentMode;
  party_name: string | null;
  party_phone: string | null;
  credit_days: number;
  billing_address: string | null;
  shipping_name: string | null;
  shipping_address: string | null;
  order_id: string | null;
  order_date: string | null;
  bill_number: string | null;
  place_of_supply: string | null;
  supply_type: SupplyType | null;
  currency: string | null;
  notes: string | null;
  terms: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  taxable_amount: number;
  extra_discount_type: 'percent' | 'amount';
  extra_discount_value: number;
  postage_charge: number;
  other_charges: number;
  other_charges_label: string | null;
  apply_round_off: boolean;
  round_off: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  payment_status: PaymentStatus | null;
  days_overdue: number;
  source_doc_id: string | null;
  party_ref_number: string | null;
  party_ref_date: string | null;
  affects_stock: boolean;
  valid_until: string | null;
  reason: string | null;
  approval_status: ApprovalStatus | null;
  approved_at: string | null;
  rejection_reason: string | null;
  dispatch_mode: DispatchMode;
  delivery_status: DeliveryStatus;
  courier_name: string | null;
  tracking_number: string | null;
  dispatch_date: string | null;
  expected_delivery_date: string | null;
  delivered_date: string | null;
  transport_name: string | null;
  lr_number: string | null;
  vehicle_number: string | null;
  cartons: number | null;
  freight_type: 'paid' | 'to_pay' | null;
  delivery_type: 'door' | 'godown' | null;
  transport_details: string | null;
  pdf_url: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  clients: {
    id: string;
    name: string;
    email: string | null;
    company: string | null;
    phone: string | null;
    address?: string | null;
    gstin?: string | null;
    state?: string | null;
    state_code?: string | null;
    credit_days?: number;
  } | null;
  // Detail-only
  items?: DocumentItem[];
  source_doc?: DocumentLink | null;
  derived_docs?: DocumentLink[];
  payments?: DocumentPaymentRow[];
}

export interface DocumentListResponse {
  documents: BillingDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: { total_amount: number; amount_paid: number };
}

export interface DocumentFilters {
  type?: DocType;
  status?: InvoiceStatus;
  client_id?: string;
  from?: string;
  to?: string;
  search?: string;
  approval_status?: ApprovalStatus;
  delivery_status?: DeliveryStatus;
  payment_mode?: PaymentMode;
  unpaid?: 'true';
  sort?: 'issue_date' | 'created_at' | 'total' | 'invoice_number' | 'due_date';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// ============================================
// Payments, ledger, outstanding
// ============================================

export type PaymentMethod = 'cash' | 'upi' | 'bank' | 'cheque' | 'card' | 'other';

export interface Payment {
  id: string;
  payment_number: string | null;
  direction: 'in' | 'out';
  amount: number;
  payment_date: string;
  mode: PaymentMethod;
  reference: string | null;
  notes: string | null;
  client_id: string | null;
  invoice_id: string | null;
  party_name: string | null;
  invoice_number: string | null;
  invoice_doc_type: DocType | null;
  created_at: string;
}

export interface PaymentFormValues {
  direction: 'in' | 'out';
  client_id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  mode: PaymentMethod;
  reference: string;
  notes: string;
}

export interface LedgerEntry {
  kind: 'opening' | 'document' | 'payment' | 'cash_settlement';
  date: string;
  doc_id: string | null;
  doc_type: DocType | null;
  payment_id: string | null;
  number: string | null;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  due_date?: string | null;
  status?: InvoiceStatus;
}

export interface PartyLedger {
  party: { id: string; name: string; phone: string | null; party_type: PartyType; credit_days: number; credit_limit: number };
  from: string | null;
  to: string | null;
  opening_balance: number;
  total_debit: number;
  total_credit: number;
  closing_balance: number;
  entries: LedgerEntry[];
}

export interface OpenItem {
  key: string;
  kind: 'opening' | 'document' | 'payment';
  doc_id: string | null;
  doc_type: DocType | null;
  payment_id: string | null;
  number: string | null;
  description: string;
  date: string;
  due_date: string;
  amount: number;
  outstanding: number;
  days_overdue: number;
  days_to_due: number;
}

export interface AgingBuckets {
  not_due: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
}

export interface PartyOutstanding {
  client_id: string | null;
  name: string;
  phone: string | null;
  party_type: PartyType;
  credit_days: number;
  credit_limit: number;
  balance: number;
  outstanding: number;
  overdue_amount: number;
  max_days_overdue: number;
  oldest_due_date: string | null;
  next_due_date: string | null;
  buckets: AgingBuckets;
  items: OpenItem[];
}

export interface OutstandingReport {
  side: 'receivable' | 'payable';
  as_of: string;
  parties: PartyOutstanding[];
  totals: { outstanding: number; overdue_amount: number; buckets: AgingBuckets };
  party_count: number;
}

// ============================================
// Stock
// ============================================

export interface StockRow {
  id: string;
  book_title: string;
  isbn: string | null;
  author: string | null;
  publisher: string | null;
  binding: string | null;
  price: number;
  purchase_rate: number;
  binding_charge: number;
  landed_cost: number;
  stock: number;
  damaged_stock: number;
  min_stock: number;
  stock_value: number;
  status: 'ok' | 'low' | 'out';
}

export type StockFilter = 'all' | 'in_stock' | 'low' | 'out' | 'attention' | 'damaged';

export interface StockSummary {
  items: StockRow[];
  totals: {
    item_count: number;
    total_qty: number;
    total_damaged: number;
    value_at_cost: number;
    value_at_price: number;
    low_count: number;
    out_count: number;
    damaged_count: number;
  };
  bindings: string[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StockMovement {
  id: string;
  item_id: string;
  book_title: string;
  isbn: string | null;
  doc_id: string | null;
  doc_type: DocType | 'opening' | 'adjustment';
  doc_number: string | null;
  party_name: string | null;
  date: string;
  qty_change: number;
  damaged_change: number;
  rate: number;
  reason: string | null;
  created_at: string;
}

// ============================================
// Reports & dashboard
// ============================================

export type ReportPeriod = 'month' | 'year' | 'fy';

export interface PeriodReport {
  period: ReportPeriod;
  label: string;
  from: string;
  to: string;
  sales: {
    gross: number; count: number; cash: number; credit: number; taxable: number; tax: number; discount: number;
    postage: number; other_charges: number; returns: number; returns_count: number; credit_notes: number; net: number; qty: number;
  };
  purchases: {
    gross: number; count: number; cash: number; credit: number; tax: number; returns: number; returns_count: number;
    debit_notes: number; net: number; qty: number; damaged_qty: number; quick_purchases: number; quick_purchase_count: number;
  };
  estimates: { count: number; total: number; converted: number };
  challans: { count: number; total: number; converted: number };
  collections: number;
  payments_out: number;
  margin: { revenue: number; cost: number; gross_margin: number; margin_percent: number; lines_with_cost: number; lines_without_cost: number };
  breakdown: {
    key: string; label: string; sales: number; purchases: number; sales_returns: number; purchase_returns: number;
    collections: number; payments_out: number; net_sales: number;
  }[];
  top_customers: { name: string; sales: number; returns: number; count: number; net: number }[];
  top_suppliers: { name: string; purchases: number; returns: number; count: number; net: number }[];
  top_items: { description: string; qty: number; amount: number }[];
  binding_wise: { binding: string; qty: number; amount: number }[];
  documents: {
    id: string; doc_type: DocType; invoice_number: string; issue_date: string; party_name: string;
    payment_mode: PaymentMode; status: InvoiceStatus; total: number;
  }[];
}

export interface DashboardOverview {
  as_of: string;
  today: { sales: number; sales_count: number; collections: number };
  month: {
    sales: number; sales_count: number; returns: number; purchases: number; purchase_count: number;
    collections: number; last_month_to_date: number; trend_percent: number | null;
  };
  receivables: { total: number; overdue: number; overdue_parties: number; buckets: AgingBuckets };
  payables: { total: number; overdue: number };
  stock: {
    item_count: number; total_qty: number; value_at_cost: number; value_at_price: number;
    low_count: number; out_count: number; damaged_qty: number; low_items: StockRow[];
  };
  approvals: {
    count: number;
    items: { id: string; doc_type: DocType; invoice_number: string; party_name: string | null; total: number; issue_date: string }[];
  };
  open_documents: {
    estimates: { count: number; total: number };
    challans: { count: number; total: number };
    binding_orders: { count: number; total: number };
  };
  overdue_parties: {
    client_id: string | null; name: string; phone: string | null; credit_days: number;
    overdue_amount: number; outstanding: number; max_days_overdue: number;
  }[];
  due_soon: { id: string; invoice_number: string; party_name: string | null; due_date: string; days_to_due: number; balance: number }[];
  in_transit: {
    id: string; doc_type: DocType; invoice_number: string; party_name: string | null; dispatch_mode: DispatchMode;
    carrier: string | null; tracking: string | null; dispatch_date: string | null; expected_delivery_date: string | null;
    delivery_status: DeliveryStatus;
  }[];
  recent: {
    id: string; doc_type: DocType; invoice_number: string; status: InvoiceStatus; approval_status: ApprovalStatus | null;
    party_name: string | null; total: number; issue_date: string; payment_mode: PaymentMode;
  }[];
  chart: { month: string; sales: number; purchases: number }[];
}

export interface NumberSeries {
  doc_type: DocType | 'payment_in' | 'payment_out';
  prefix: string;
  next_number: number;
  include_year: boolean;
  preview: string;
}
