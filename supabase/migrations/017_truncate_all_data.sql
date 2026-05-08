-- ============================================================
-- TRUNCATE ALL PUBLIC TABLE DATA — run in Supabase SQL Editor
-- This deletes all rows but keeps the table structure intact.
-- Auth users (auth.users) are NOT touched — delete them from
-- the Supabase Dashboard → Authentication → Users if needed.
-- ============================================================

TRUNCATE TABLE
  public.org_clients,
  public.org_books,
  public.notifications,
  public.notification_preferences,
  public.invoice_items,
  public.invoices,
  public.purchase_orders,
  public.organization_invitations,
  public.organization_members,
  public.profiles,
  public.clients,
  public.contacts,
  public.inventory_items,
  public.books,
  public.organizations
RESTART IDENTITY CASCADE;
