// Fills ONE account's own business with realistic book-trade data:
// parties, books, binding rates, purchases from binders (with damage and part
// payments), estimates, challans, cash & credit sales over recent months,
// receipts, returns (one awaiting approval), notes, dispatch details and
// quick expenses. Everything goes through the normal services, so stock,
// ledgers and balances stay consistent.
//
//   npm run seed-demo --workspace=apps/api -- [email]   (default yuvrajsinghrock1221@gmail.com)
//
// Only that account's organisation is touched; other accounts are separate
// businesses and never see this data. Uses DATABASE_URL from apps/api/.env and
// refuses to run on a business that already has documents.

import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import { ensureDevUser } from '../src/lib/dev-auth.js';
import { addDays, todayISO } from '../src/lib/dates.js';
import { documentService, type Actor } from '../src/services/document.service.js';
import { paymentService } from '../src/services/payment.service.js';
import { inventoryService } from '../src/services/inventory.service.js';
import { bindingRatesService } from '../src/services/binding-rates.service.js';
import { createDocumentSchema } from '../src/schemas/document.schema.js';
import { createPaymentSchema } from '../src/schemas/payment.schema.js';

const today = todayISO();
const ago = (days: number) => addDays(today, -days);

async function main() {
  const owner = await ensureDevUser(process.argv[2] || 'yuvrajsinghrock1221@gmail.com');
  const orgId = owner.org.id;
  if (owner.org.role !== 'owner') throw new Error(`${owner.email} is not the owner of ${owner.org.name}`);
  const OWNER: Actor = { id: owner.id, role: 'owner' };

  const [otherMembers, existingDocs] = await Promise.all([
    prisma.organizationMember.count({ where: { orgId, userId: { not: owner.id } } }),
    prisma.invoice.count({ where: { orgId } }),
  ]);
  if (otherMembers) throw new Error(`"${owner.org.name}" is shared with ${otherMembers} other account(s) — seed only a private business.`);
  if (existingDocs) {
    console.log(`"${owner.org.name}" already has ${existingDocs} documents — nothing to do.`);
    return;
  }
  console.log(`Seeding demo data into "${owner.org.name}"…`);

  // ── Business profile ──────────────────────────────────────────────────────
  await prisma.profile.update({
    where: { id: owner.id },
    data: {
      businessName: owner.org.name,
      businessAddress: '4/21 Ansari Road, Daryaganj, New Delhi 110002',
      businessPhone: '+91 98110 00000',
      gstin: '07ABCDE1234F1Z5',
      currency: 'INR',
      bankName: 'State Bank of India',
      bankAccountNumber: '30012345678',
      bankIfsc: 'SBIN0000691',
      bankBranch: 'Daryaganj',
      signatoryName: 'Demo Owner',
      showBookMetadata: true,
    },
  });

  await bindingRatesService.replace(orgId, [
    { name: 'Paperback', charge: 12 },
    { name: 'Hardbound', charge: 35 },
    { name: 'Spiral', charge: 18 },
    { name: 'Saddle Stitch', charge: 6 },
  ]);

  // ── Parties ───────────────────────────────────────────────────────────────
  const party = (data: Omit<Prisma.ClientUncheckedCreateInput, 'orgId' | 'userId'>) =>
    prisma.client.create({ data: { ...data, orgId, userId: owner.id } });
  const sharma = await party({ name: 'Sharma Book Depot', company: 'Sharma Book Depot', phone: '9811000001', address: 'Nai Sarak, Chandni Chowk', state: 'Delhi', stateCode: '07', pincode: '110006', creditDays: 30, creditLimit: 150000, shippingAddress: 'Godown 4, Chawri Bazar', shippingState: 'Delhi', shippingPincode: '110006', partyType: 'customer' });
  const vidya = await party({ name: 'Vidya Pustak Bhandar', phone: '9415000002', address: 'Aminabad', state: 'Uttar Pradesh', stateCode: '09', pincode: '226018', creditDays: 45, gstin: '09AAAPV1234K1Z2', partyType: 'customer' });
  const gupta = await party({ name: 'Gupta Stationers', phone: '9829000003', address: 'Johari Bazar', state: 'Rajasthan', stateCode: '08', pincode: '302003', creditDays: 15, openingBalance: 8500, partyType: 'customer' });
  const school = await party({ name: 'St. Mary’s Convent School', phone: '9810000004', email: 'accounts@stmarys.example', address: 'Sector 15, Rohini', state: 'Delhi', stateCode: '07', pincode: '110089', creditDays: 60, partyType: 'customer' });
  const ravi = await party({ name: 'Ravi Binders', phone: '9871000005', address: 'Patparganj Industrial Area', state: 'Delhi', stateCode: '07', creditDays: 15, partyType: 'binder' });
  const kamal = await party({ name: 'Kamal Book Binding Works', phone: '9871000006', address: 'Okhla Phase II', state: 'Delhi', stateCode: '07', creditDays: 30, partyType: 'binder' });
  const press = await party({ name: 'Navyug Offset Press', phone: '9312000007', address: 'Naraina Industrial Area', state: 'Delhi', stateCode: '07', creditDays: 30, openingBalance: -12000, gstin: '07AAACN5678M1Z9', partyType: 'supplier' });
  await party({ name: 'Arora Book House', phone: '9876000008', address: 'Ludhiana', state: 'Punjab', stateCode: '03', creditDays: 30, partyType: 'both' });

  // ── Books (opening stock) ─────────────────────────────────────────────────
  const books = {} as Record<string, { id: string; title: string; price: number }>;
  const addBook = async (key: string, b: Record<string, unknown>) => {
    const item = await inventoryService.createItem(orgId, owner.id, { gst_rate: 0, hsn_code: '4901', language: 'Hindi', ...b });
    books[key] = { id: item.id, title: item.book_title, price: item.price };
  };
  await addBook('vyakaran', { book_title: 'Hindi Vyakaran Class 8', isbn: '9789380000011', author: 'R. K. Sharma', price: 220, purchase_rate: 70, binding_charge: 12, binding: 'Paperback', stock: 120, min_stock: 40 });
  await addBook('maths', { book_title: 'Ganit Abhyas Class 10', isbn: '9789380000028', author: 'S. P. Gupta', price: 340, purchase_rate: 110, binding_charge: 12, binding: 'Paperback', stock: 60, min_stock: 50 });
  await addBook('science', { book_title: 'Vigyan Pravah Class 9', isbn: '9789380000035', author: 'Dr. A. Verma', price: 395, purchase_rate: 125, binding_charge: 12, binding: 'Paperback', stock: 45, min_stock: 30 });
  await addBook('atlas', { book_title: 'Bharat Atlas (Hardbound)', isbn: '9789380000042', author: 'Editorial Board', price: 650, purchase_rate: 210, binding_charge: 35, binding: 'Hardbound', stock: 18, min_stock: 20, language: 'Hindi / English' });
  await addBook('english', { book_title: 'English Grammar & Composition', isbn: '9789380000059', author: 'M. Iyer', price: 280, purchase_rate: 90, binding_charge: 12, binding: 'Paperback', stock: 80, min_stock: 25, language: 'English' });
  await addBook('lab', { book_title: 'Science Lab Manual Class 10', isbn: '9789380000066', author: 'Dr. A. Verma', price: 180, purchase_rate: 48, binding_charge: 18, binding: 'Spiral', stock: 4, min_stock: 15 });
  await addBook('stories', { book_title: 'Panchtantra Ki Kahaniyan', isbn: '9789380000073', author: 'Vishnu Sharma (adapted)', price: 150, purchase_rate: 40, binding_charge: 6, binding: 'Saddle Stitch', stock: 0, min_stock: 30 });
  await addBook('dictionary', { book_title: 'Hindi–English Shabdkosh', isbn: '9789380000080', author: 'Editorial Board', price: 520, purchase_rate: 180, binding_charge: 35, binding: 'Hardbound', stock: 25, min_stock: 10, language: 'Hindi / English' });

  const line = (key: string, quantity: number, extra: Record<string, unknown> = {}) => ({
    item_id: books[key].id,
    description: books[key].title,
    quantity,
    unit_price: books[key].price,
    gst_rate: 0,
    hsn_sac: '4901',
    ...extra,
  });
  const buy = (key: string, quantity: number, rate: number, binding: string, charge: number, extra: Record<string, unknown> = {}) =>
    line(key, quantity, { unit_price: rate, binding, binding_charge: charge, ...extra });
  const doc = (input: Record<string, unknown>, actor: Actor = OWNER) =>
    documentService.create(orgId, actor, createDocumentSchema.parse({ apply_round_off: true, ...input }));
  const pay = (input: Record<string, unknown>) => paymentService.create(orgId, owner.id, createPaymentSchema.parse(input));

  // ── Purchases from binders & press ────────────────────────────────────────
  const bo = await doc({ doc_type: 'binding_order', issue_date: ago(70), client_id: ravi.id, notes: 'Sheets delivered from Navyug Offset Press',
    items: [buy('maths', 300, 0, 'Paperback', 12), buy('science', 200, 0, 'Paperback', 12)] });
  await doc({ doc_type: 'purchase_bill', issue_date: ago(62), client_id: ravi.id, source_doc_id: bo.id, payment_mode: 'credit', party_ref_number: 'RB/2026/118',
    dispatch_mode: 'transport', transport_name: 'Local tempo', cartons: 12, freight_type: 'paid', delivery_type: 'door', delivery_status: 'delivered', dispatch_date: ago(62), delivered_date: ago(62),
    items: [buy('maths', 300, 110, 'Paperback', 12, { damaged_qty: 6 }), buy('science', 200, 125, 'Paperback', 12, { damaged_qty: 3 })] });
  const pbAtlas = await doc({ doc_type: 'purchase_bill', issue_date: ago(40), client_id: kamal.id, payment_mode: 'credit', credit_days: 30, party_ref_number: 'KBW-552',
    paid_now_amount: 5000, paid_now_mode: 'cheque', paid_now_reference: 'Chq 004512',
    items: [buy('atlas', 60, 210, 'Hardbound', 35, { damaged_qty: 4 }), buy('dictionary', 40, 180, 'Hardbound', 35)] });
  await doc({ doc_type: 'purchase_bill', issue_date: ago(25), client_id: press.id, payment_mode: 'cash', party_ref_number: 'NOP/7781',
    items: [buy('stories', 150, 40, 'Saddle Stitch', 6), buy('lab', 80, 48, 'Spiral', 18)] });
  await doc({ doc_type: 'purchase_bill', issue_date: ago(8), client_id: ravi.id, payment_mode: 'credit', party_ref_number: 'RB/2026/141',
    items: [buy('vyakaran', 250, 70, 'Paperback', 12), buy('english', 150, 90, 'Paperback', 12, { damaged_qty: 2 })] });
  await doc({ doc_type: 'binding_order', issue_date: ago(2), client_id: kamal.id, notes: 'Reprint — deliver before school session',
    items: [buy('atlas', 100, 0, 'Hardbound', 35)] });
  await doc({ doc_type: 'purchase_return', issue_date: ago(35), client_id: kamal.id, source_doc_id: pbAtlas.id, reason: 'Print defect — pages misaligned',
    items: [buy('atlas', 4, 210, 'Hardbound', 35, { damaged_qty: 4 })] });
  await doc({ doc_type: 'debit_note', issue_date: ago(55), client_id: ravi.id, reason: 'Short supply — 10 copies less than billed',
    items: [{ description: 'Short supply adjustment', quantity: 1, unit_price: 1220, gst_rate: 0 }] });
  await pay({ direction: 'out', client_id: ravi.id, amount: 30000, payment_date: ago(45), mode: 'bank', reference: 'NEFT 88123' });
  await pay({ direction: 'out', client_id: press.id, amount: 12000, payment_date: ago(20), mode: 'cheque', reference: 'Chq 004530' });

  // ── Sales ─────────────────────────────────────────────────────────────────
  const est = await doc({ doc_type: 'estimate', issue_date: ago(58), client_id: school.id, valid_until: ago(43), notes: 'Session 2026–27 book list',
    items: [line('maths', 120, { discount_percent: 15 }), line('science', 120, { discount_percent: 15 }), line('english', 120, { discount_percent: 15 })] });
  await doc({ doc_type: 'sales_invoice', issue_date: ago(55), client_id: school.id, source_doc_id: est.id, payment_mode: 'credit', order_id: 'SM/PO/2026/07',
    extra_discount_type: 'percent', extra_discount_value: 2,
    dispatch_mode: 'transport', transport_name: 'Shree Ram Transport', lr_number: 'LR-44871', vehicle_number: 'DL1LX4521', cartons: 18, freight_type: 'paid', delivery_type: 'door',
    delivery_status: 'delivered', dispatch_date: ago(54), delivered_date: ago(52),
    items: [line('maths', 120, { discount_percent: 15 }), line('science', 120, { discount_percent: 15 }), line('english', 120, { discount_percent: 15 })] });

  const inv1 = await doc({ doc_type: 'sales_invoice', issue_date: ago(80), client_id: sharma.id, payment_mode: 'credit',
    items: [line('vyakaran', 60, { discount_percent: 25 }), line('dictionary', 10, { discount_percent: 20 })] });
  await doc({ doc_type: 'sales_invoice', issue_date: ago(48), client_id: vidya.id, payment_mode: 'credit', postage_charge: 350,
    dispatch_mode: 'courier', courier_name: 'DTDC', tracking_number: 'D45118802', delivery_status: 'delivered', dispatch_date: ago(47), delivered_date: ago(44),
    items: [line('atlas', 15, { discount_percent: 20 }), line('vyakaran', 40, { discount_percent: 25 })] });
  await doc({ doc_type: 'sales_invoice', issue_date: ago(38), client_id: gupta.id, payment_mode: 'credit', extra_discount_type: 'amount', extra_discount_value: 500,
    items: [line('english', 30, { discount_percent: 20 }), line('stories', 50, { discount_percent: 30 })] });
  const inv4 = await doc({ doc_type: 'sales_invoice', issue_date: ago(18), client_id: sharma.id, payment_mode: 'credit', postage_charge: 180,
    dispatch_mode: 'transport', transport_name: 'VRL Logistics', lr_number: 'LR-90215', cartons: 6, freight_type: 'to_pay', delivery_type: 'godown',
    delivery_status: 'in_transit', dispatch_date: ago(16), expected_delivery_date: addDays(today, 2),
    items: [line('vyakaran', 80, { discount_percent: 25 }), line('maths', 40, { discount_percent: 25 }), line('lab', 30, { discount_percent: 20 })] });
  await doc({ doc_type: 'sales_invoice', issue_date: ago(6), client_id: vidya.id, payment_mode: 'credit',
    paid_now_amount: 3000, paid_now_mode: 'upi', paid_now_reference: 'UPI 552810',
    dispatch_mode: 'courier', courier_name: 'India Post', tracking_number: 'EK123456789IN', delivery_status: 'dispatched', dispatch_date: ago(5), expected_delivery_date: addDays(today, 3),
    items: [line('science', 40, { discount_percent: 20 }), line('dictionary', 8, { discount_percent: 15 })] });
  for (const [days, items, name] of [
    [30, [line('stories', 5), line('vyakaran', 2)], 'Walk-in customer'],
    [12, [line('english', 3)], 'Rahul (parent)'],
    [3, [line('atlas', 1), line('dictionary', 1)], 'Walk-in customer'],
    [0, [line('vyakaran', 4), line('stories', 6)], 'Walk-in customer'],
  ] as const) {
    await doc({ doc_type: 'sales_invoice', issue_date: ago(days), payment_mode: 'cash', party_name: name, items });
  }

  const dc = await doc({ doc_type: 'delivery_challan', issue_date: ago(28), client_id: gupta.id, notes: 'Sent on sale-or-return basis',
    dispatch_mode: 'hand', delivery_status: 'delivered', dispatch_date: ago(28), delivered_date: ago(28),
    items: [line('maths', 20, { discount_percent: 25 }), line('english', 20, { discount_percent: 20 })] });
  await doc({ doc_type: 'sales_invoice', issue_date: ago(10), client_id: gupta.id, source_doc_id: dc.id, payment_mode: 'credit',
    items: [line('maths', 14, { discount_percent: 25 }), line('english', 17, { discount_percent: 20 })] });
  await doc({ doc_type: 'delivery_challan', issue_date: ago(4), client_id: school.id, notes: 'Specimen copies for teachers',
    items: [line('science', 5, { unit_price: 0 }), line('lab', 5, { unit_price: 0 })] });
  await doc({ doc_type: 'estimate', issue_date: ago(1), client_id: vidya.id, valid_until: addDays(today, 14),
    items: [line('atlas', 50, { discount_percent: 20 }), line('dictionary', 50, { discount_percent: 15 })] });

  // Returns: one approved, one waiting for the owner.
  const sr = await doc({ doc_type: 'sales_return', issue_date: ago(70), client_id: sharma.id, source_doc_id: inv1.id, reason: 'Wrong edition supplied',
    items: [line('vyakaran', 6, { discount_percent: 25, damaged_qty: 1 })] });
  await documentService.approve(orgId, OWNER, sr.id);
  await doc({ doc_type: 'sales_return', issue_date: ago(1), client_id: sharma.id, source_doc_id: inv4.id, reason: 'Cartons damaged in transit',
    items: [line('lab', 4, { discount_percent: 20, damaged_qty: 4 })] });
  await doc({ doc_type: 'credit_note', issue_date: ago(40), client_id: vidya.id, reason: 'Rate difference on Bharat Atlas',
    items: [{ description: 'Rate difference — Bharat Atlas × 15', quantity: 15, unit_price: 20, gst_rate: 0 }] });

  // Receipts
  await pay({ direction: 'in', client_id: sharma.id, invoice_id: inv1.id, amount: 8000, payment_date: ago(60), mode: 'cheque', reference: 'Chq 118204' });
  await pay({ direction: 'in', client_id: school.id, amount: 60000, payment_date: ago(20), mode: 'bank', reference: 'RTGS SBIN26' });
  await pay({ direction: 'in', client_id: vidya.id, amount: 5000, payment_date: ago(15), mode: 'upi', reference: 'UPI 449102' });
  await pay({ direction: 'in', client_id: gupta.id, amount: 8500, payment_date: ago(33), mode: 'cash', notes: 'Opening balance cleared' });

  // ── Quick expenses ────────────────────────────────────────────────────────
  for (const [days, name, item, amount] of [
    [50, 'Delhi Packaging Co.', 'Cartons & tape', 4200],
    [22, 'Shree Ram Transport', 'Freight — Rohini delivery', 1800],
    [9, 'Office', 'Printer toner', 2650],
  ] as const) {
    await prisma.purchaseOrder.create({
      data: {
        orgId, userId: owner.id, orderId: `PO-DEMO-${days}`, clientName: name, itemName: item,
        quantity: 1, unitPrice: amount, totalAmount: amount, purchaseDate: new Date(`${ago(days)}T00:00:00Z`), status: 'completed',
      },
    });
  }

  await documentService.invalidate(orgId);
  const [docs, parties, items] = await Promise.all([
    prisma.invoice.count({ where: { orgId } }),
    prisma.client.count({ where: { orgId } }),
    prisma.inventoryItem.count({ where: { orgId } }),
  ]);
  console.log(`Done: ${parties} parties, ${items} books, ${docs} documents, payments and expenses.`);
  console.log(`Log in as ${owner.email} to see it.`);
}

main()
  .catch((err) => {
    console.error(`Failed: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
