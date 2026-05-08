// ============================================
// Shared TypeScript types for QuickInvoice
// ============================================

// Base types
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'cancelled';

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
  // Computed fields from API
  totalInvoiced?: number;
  outstanding?: number;
  invoiceCount?: number;
}

export interface ClientWithInvoices extends Client {
  invoices: Invoice[];
  totalInvoiced: number;
  outstanding: number;
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
