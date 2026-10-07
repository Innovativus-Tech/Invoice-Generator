import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { DOC_TYPES, DOC_TYPE_CONFIG, PAYMENT_SERIES_PREFIX, type SeriesKey } from '../lib/doc-types.js';

type Db = Prisma.TransactionClient | typeof prisma;

export const SERIES_KEYS: SeriesKey[] = [...DOC_TYPES, 'payment_in', 'payment_out'];

export interface SeriesSettings {
  doc_type: SeriesKey;
  prefix: string;
  next_number: number;
  include_year: boolean;
  preview: string;
}

function defaultPrefix(key: SeriesKey): string {
  if (key === 'payment_in' || key === 'payment_out') return PAYMENT_SERIES_PREFIX[key];
  return DOC_TYPE_CONFIG[key].prefix;
}

export function formatNumber(series: { prefix: string; includeYear: boolean }, n: number, year: number): string {
  return series.includeYear ? `${series.prefix}-${year}-${n}` : `${series.prefix}-${n}`;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class NumberingService {
  /** Returns the series row, creating it with defaults on first use. */
  async ensureSeries(db: Db, orgId: string, key: SeriesKey) {
    const existing = await db.numberSeries.findUnique({ where: { orgId_docType: { orgId, docType: key } } });
    if (existing) return existing;

    let prefix = defaultPrefix(key);
    let nextNumber = 1;
    if (key === 'sales_invoice') {
      // Sales invoices historically used the owner's profile settings.
      const org = await db.organization.findUnique({ where: { id: orgId }, select: { ownerId: true } });
      const profile = org
        ? await db.profile.findUnique({ where: { id: org.ownerId }, select: { invoicePrefix: true, nextInvoiceNumber: true } })
        : null;
      prefix = profile?.invoicePrefix || prefix;
      nextNumber = Math.max(profile?.nextInvoiceNumber ?? 1001, 1);
    }

    return db.numberSeries.upsert({
      where: { orgId_docType: { orgId, docType: key } },
      create: { orgId, docType: key, prefix, nextNumber },
      update: {},
    });
  }

  async peek(orgId: string, key: SeriesKey, date = new Date()): Promise<string> {
    const series = await this.ensureSeries(prisma, orgId, key);
    return formatNumber(series, series.nextNumber, date.getUTCFullYear());
  }

  /** Atomically takes the next number. Must run inside the transaction that saves the document. */
  async allocate(tx: Prisma.TransactionClient, orgId: string, key: SeriesKey, date: Date): Promise<string> {
    await this.ensureSeries(tx, orgId, key);
    const updated = await tx.numberSeries.update({
      where: { orgId_docType: { orgId, docType: key } },
      data: { nextNumber: { increment: 1 } },
    });
    if (key === 'sales_invoice') await this.syncProfileCounter(tx, orgId, updated.nextNumber);
    return formatNumber(updated, updated.nextNumber - 1, date.getUTCFullYear());
  }

  /**
   * A number typed by hand that follows this series' format moves the counter
   * past it, so the next suggested number never collides with it.
   */
  async registerManual(tx: Prisma.TransactionClient, orgId: string, key: SeriesKey, number: string) {
    const series = await this.ensureSeries(tx, orgId, key);
    const pattern = new RegExp(`^${escapeRegExp(series.prefix)}-(?:\\d{4}-)?(\\d+)$`);
    const match = number.trim().match(pattern);
    if (!match) return;
    const n = parseInt(match[1], 10);
    if (n >= series.nextNumber) {
      await tx.numberSeries.update({
        where: { orgId_docType: { orgId, docType: key } },
        data: { nextNumber: n + 1 },
      });
      if (key === 'sales_invoice') await this.syncProfileCounter(tx, orgId, n + 1);
    }
  }

  async list(orgId: string): Promise<SeriesSettings[]> {
    const year = new Date().getUTCFullYear();
    const rows = await Promise.all(SERIES_KEYS.map((key) => this.ensureSeries(prisma, orgId, key)));
    return rows.map((s) => ({
      doc_type: s.docType as SeriesKey,
      prefix: s.prefix,
      next_number: s.nextNumber,
      include_year: s.includeYear,
      preview: formatNumber(s, s.nextNumber, year),
    }));
  }

  async update(orgId: string, key: SeriesKey, input: { prefix?: string; next_number?: number; include_year?: boolean }) {
    await this.ensureSeries(prisma, orgId, key);
    const data: Prisma.NumberSeriesUpdateInput = {};
    if (input.prefix !== undefined) data.prefix = input.prefix.trim();
    if (input.next_number !== undefined) data.nextNumber = input.next_number;
    if (input.include_year !== undefined) data.includeYear = input.include_year;
    const updated = await prisma.numberSeries.update({ where: { orgId_docType: { orgId, docType: key } }, data });

    if (key === 'sales_invoice') {
      const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { ownerId: true } });
      if (org) {
        await prisma.profile.updateMany({
          where: { id: org.ownerId },
          data: { invoicePrefix: updated.prefix, nextInvoiceNumber: updated.nextNumber },
        });
      }
    }
    return updated;
  }

  /** Keeps the legacy profile counter (shown in Settings → Defaults) in step. */
  private async syncProfileCounter(db: Db, orgId: string, nextNumber: number) {
    const org = await db.organization.findUnique({ where: { id: orgId }, select: { ownerId: true } });
    if (org) await db.profile.updateMany({ where: { id: org.ownerId }, data: { nextInvoiceNumber: nextNumber } });
  }
}

export const numberingService = new NumberingService();
