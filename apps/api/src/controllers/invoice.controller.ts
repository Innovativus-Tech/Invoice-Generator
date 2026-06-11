import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { invoiceService } from '../services/invoice.service.js';
import { pdfService } from '../services/pdf.service.js';
import { sendInvoiceEmail } from '../services/email.service.js';
import { storageService } from '../services/storage.service.js';
import { prisma } from '../lib/prisma.js';
import type { InvoiceQueryInput, CreateInvoiceInput, UpdateInvoiceInput, UpdateStatusInput } from '../schemas/invoice.schema.js';

export class InvoiceController {
  async list(req: AuthenticatedRequest<any, any, any, InvoiceQueryInput>, res: Response) {
    try {
      const result = await invoiceService.getInvoices(req.org.id, req.query);
      res.json({ data: result, error: null, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async get(req: AuthenticatedRequest<{ id: string }>, res: Response) {
    try {
      const invoice = await invoiceService.getInvoice(req.org.id, req.params.id as string);
      res.json({ data: invoice, error: null, meta: null });
    } catch (err: any) {
      const status = err.message === 'Invoice not found' ? 404 : 500;
      res.status(status).json({ data: null, error: { message: err.message, code: status === 404 ? 'NOT_FOUND' : 'SERVER_ERROR' }, meta: null });
    }
  }

  async create(req: AuthenticatedRequest<any, any, CreateInvoiceInput>, res: Response) {
    try {
      const invoice = await invoiceService.createInvoice(req.org.id, req.userId, req.body);
      res.status(201).json({ data: invoice, error: null, meta: null });
    } catch (err: any) {
      console.error('CREATE INVOICE ERROR', err);
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async update(req: AuthenticatedRequest<{ id: string }, any, UpdateInvoiceInput>, res: Response) {
    try {
      const invoice = await invoiceService.updateInvoice(req.org.id, req.params.id as string, req.body);
      res.json({ data: invoice, error: null, meta: null });
    } catch (err: any) {
      const status = err.message === 'Invoice not found' ? 404 : 500;
      res.status(status).json({ data: null, error: { message: err.message, code: status === 404 ? 'NOT_FOUND' : 'SERVER_ERROR' }, meta: null });
    }
  }

  async delete(req: AuthenticatedRequest<{ id: string }>, res: Response) {
    try {
      await storageService.deletePdf(req.org.id, req.params.id as string).catch(() => {});
      await invoiceService.deleteInvoice(req.org.id, req.params.id as string);
      res.json({ data: { success: true }, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async updateStatus(req: AuthenticatedRequest<{ id: string }, any, UpdateStatusInput>, res: Response) {
    try {
      const { status } = req.body;
      const invoice = await invoiceService.updateStatus(req.org.id, req.userId, req.params.id as string, status);
      res.json({ data: invoice, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  private async getOwnerProfile(orgId: string) {
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { ownerId: true } });
    if (!org) return null;
    const p = await prisma.profile.findUnique({ where: { id: org.ownerId } });
    if (!p) return null;
    return {
      business_name: p.businessName,
      business_email: p.businessEmail,
      business_address: p.businessAddress,
      business_phone: p.businessPhone,
      logo_url: p.logoUrl,
      signature_url: p.signatureUrl,
      signatory_name: p.signatoryName,
      gstin: p.gstin,
      website: p.website,
      bank_name: p.bankName,
      bank_account_number: p.bankAccountNumber,
      bank_ifsc: p.bankIfsc,
      bank_branch: p.bankBranch,
      currency: p.currency,
      show_book_metadata: (p as any).showBookMetadata ?? false,
    };
  }

  private buildPdfData(invoice: any, profile: any) {
    const client = invoice.clients as any;
    return {
      invoice_number: invoice.invoice_number,
      bill_number: invoice.bill_number || invoice.invoice_number,
      status: invoice.status,
      issue_date: invoice.issue_date,

      order_id: invoice.order_id || undefined,
      order_date: invoice.order_date || undefined,
      subtotal: Number(invoice.subtotal),
      tax_rate: Number(invoice.tax_rate),
      tax_amount: Number(invoice.tax_amount),
      discount_amount: Number(invoice.discount_amount),
      total: Number(invoice.total),
      currency: invoice.currency || 'INR',
      notes: invoice.notes || undefined,
      terms: invoice.terms || undefined,
      supply_type: invoice.supply_type || 'IGST',
      place_of_supply: invoice.place_of_supply || undefined,
      items: (invoice.items || []).map((item: any) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        amount: Number(item.amount),
        hsn_sac: item.hsn_sac || '',
        gst_rate: Number(item.gst_rate ?? 18),
        discount_percent: Number(item.discount_percent ?? 0),
        isbn: item.isbn ?? null,
        author: item.author ?? null,
      })),
      business_name: profile?.business_name,
      business_email: profile?.business_email,
      business_address: profile?.business_address,
      business_phone: profile?.business_phone,
      gstin: profile?.gstin,
      website: profile?.website,
      bank_name: profile?.bank_name,
      bank_account_number: profile?.bank_account_number,
      bank_ifsc: profile?.bank_ifsc,
      bank_branch: profile?.bank_branch,
      client_name: client?.name,
      client_email: client?.email,
      client_company: client?.company,
      client_address: client?.address,
      client_gstin: client?.gstin,
      client_state: client?.state,
      client_state_code: client?.state_code,
      logo_url: profile?.logo_url,
      signature_url: profile?.signature_url,
      signatory_name: profile?.signatory_name,
      show_book_metadata: Boolean(profile?.show_book_metadata),
    };
  }

  async generatePdf(req: AuthenticatedRequest<{ id: string }>, res: Response) {
    try {
      const invoice = await invoiceService.getInvoice(req.org.id, req.params.id as string);
      const profile = await this.getOwnerProfile(req.org.id);

      const pdfData = this.buildPdfData(invoice, profile);
      const pdfUrl = await pdfService.generateAndUpload(req.org.id, req.params.id as string, pdfData);
      res.json({ data: { pdf_url: pdfUrl }, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'PDF_ERROR' }, meta: null });
    }
  }

  async downloadPdf(req: AuthenticatedRequest<{ id: string }>, res: Response) {
    try {
      const invoice = await invoiceService.getInvoice(req.org.id, req.params.id as string);
      const profile = await this.getOwnerProfile(req.org.id);

      const pdfData = this.buildPdfData(invoice, profile);
      const pdfBuffer = await pdfService.generatePdf(pdfData);

      // Keep pdfUrl up to date, but storage issues must not block the download
      try {
        const pdfUrl = await storageService.uploadPdf(req.org.id, req.params.id as string, pdfBuffer);
        await prisma.invoice.update({ where: { id: req.params.id as string }, data: { pdfUrl } });
      } catch {}

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoice_number}.pdf"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'PDF_ERROR' }, meta: null });
    }
  }

  async send(req: AuthenticatedRequest<{ id: string }>, res: Response) {
    try {
      const invoice = await invoiceService.getInvoice(req.org.id, req.params.id as string);
      const client = invoice.clients as any;

      if (!client?.email) {
        res.status(400).json({ data: null, error: { message: 'Client has no email address', code: 'VALIDATION_ERROR' }, meta: null });
        return;
      }

      const profile = await this.getOwnerProfile(req.org.id);

      const pdfData = this.buildPdfData(invoice, profile);
      const pdfBuffer = Buffer.from(await pdfService.generatePdf(pdfData));
      const pdfUrl = await storageService.uploadPdf(req.org.id, req.params.id as string, pdfBuffer);

      await prisma.invoice.update({ where: { id: req.params.id as string }, data: { pdfUrl } });

      const formattedDueDate = new Date(invoice.issue_date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      await sendInvoiceEmail({
        to: client.email,
        clientName: client.name || 'Valued Customer',
        businessName: profile?.business_name || 'QuickInvoice',
        invoiceNumber: invoice.invoice_number,
        invoiceTotal: Number(invoice.total),
        currency: invoice.currency || 'INR',
        dueDate: formattedDueDate,
        pdfBuffer,
        pdfFilename: `Invoice-${invoice.invoice_number}.pdf`,
      });

      await invoiceService.updateStatus(req.org.id, req.userId, req.params.id as string, 'sent');
      const updated = await invoiceService.getInvoice(req.org.id, req.params.id as string);
      res.json({ data: updated, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SEND_ERROR' }, meta: null });
    }
  }

  async getNextNumber(req: AuthenticatedRequest, res: Response) {
    try {
      const number = await invoiceService.getNextInvoiceNumber(req.org.id);
      res.json({ data: { invoice_number: number }, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async getDashboardStats(req: AuthenticatedRequest, res: Response) {
    try {
      const stats = await invoiceService.getDashboardStats(req.org.id);
      // Check for overdue invoices and create notifications (non-blocking)
      invoiceService.checkOverdue(req.org.id, req.userId).catch(() => {});
      res.json({ data: stats, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async getRevenueChart(req: AuthenticatedRequest, res: Response) {
    try {
      const period = (req.query.period as string) || '30d';
      const data = await invoiceService.getRevenueChart(req.org.id, period);
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }
}

export const invoiceController = new InvoiceController();
