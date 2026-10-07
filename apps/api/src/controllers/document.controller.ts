import { prisma } from '../lib/prisma.js';
import { docConfig, type DocType } from '../lib/doc-types.js';
import { AppError, notFound } from '../lib/errors.js';
import { assertCan, pdfFileName, route } from '../lib/http.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { documentService, type Actor } from '../services/document.service.js';
import { pdfService } from '../services/pdf.service.js';
import { storageService } from '../services/storage.service.js';
import { sendInvoiceEmail } from '../services/email.service.js';
import { createDocumentSchema, docTypeSchema } from '../schemas/document.schema.js';
import type { DocumentQuery, UpdateDocumentInput, CreateDocumentInput, DeliveryUpdateInput } from '../schemas/document.schema.js';

const actorOf = (req: AuthenticatedRequest): Actor => ({ id: req.userId, role: req.org.role });

function assertDocPermission(req: AuthenticatedRequest, type: string, action: string) {
  const cfg = docConfig(type);
  assertCan(req, cfg.resource, action, `${cfg.label.toLowerCase()}s`);
}

async function docTypeOf(orgId: string, id: string): Promise<DocType> {
  const doc = await prisma.invoice.findFirst({ where: { id, orgId }, select: { docType: true } });
  if (!doc) throw notFound('Document');
  return doc.docType as DocType;
}

/**
 * Handlers for /api/documents. `forcedType` pins them to one document type —
 * used to keep the original /api/invoices endpoints working as sales invoices.
 */
export function documentHandlers(forcedType?: DocType) {
  return {
    list: route(async (req) => {
      const q = { ...(req.query as unknown as DocumentQuery), ...(forcedType && { type: forcedType }) };
      if (q.type) assertDocPermission(req, q.type, 'read');
      else {
        const resources = q.side
          ? [q.side === 'sales' ? 'invoices' : 'purchases']
          : ['invoices', 'purchases'];
        for (const r of resources) assertCan(req, r, 'read', 'documents');
      }
      return documentService.list(req.org.id, q);
    }),

    nextNumber: route(async (req) => {
      const type = forcedType ?? docTypeSchema.parse(req.query.type);
      assertDocPermission(req, type, 'read');
      const number = await documentService.nextNumber(req.org.id, type);
      return { invoice_number: number, doc_type: type };
    }),

    get: route(async (req) => {
      const type = await docTypeOf(req.org.id, req.params.id);
      assertDocPermission(req, type, 'read');
      return documentService.get(req.org.id, req.params.id);
    }),

    create: route(async (req) => {
      const body = forcedType
        ? createDocumentSchema.parse({ ...req.body, doc_type: forcedType })
        : (req.body as CreateDocumentInput);
      assertDocPermission(req, body.doc_type, 'create');
      return documentService.create(req.org.id, actorOf(req), body);
    }, { status: 201 }),

    update: route(async (req) => {
      const type = await docTypeOf(req.org.id, req.params.id);
      assertDocPermission(req, type, 'update');
      return documentService.update(req.org.id, actorOf(req), req.params.id, req.body as UpdateDocumentInput);
    }),

    remove: route(async (req) => {
      const type = await docTypeOf(req.org.id, req.params.id);
      assertDocPermission(req, type, 'delete');
      await storageService.deletePdf(req.org.id, req.params.id).catch(() => {});
      return documentService.delete(req.org.id, actorOf(req), req.params.id);
    }),

    updateStatus: route(async (req) => {
      const type = await docTypeOf(req.org.id, req.params.id);
      assertDocPermission(req, type, 'update');
      return documentService.updateStatus(req.org.id, actorOf(req), req.params.id, req.body.status);
    }),

    approve: route(async (req) => {
      assertCan(req, 'approvals', 'approve', 'returns — ask an owner or admin');
      return documentService.approve(req.org.id, actorOf(req), req.params.id);
    }),

    reject: route(async (req) => {
      assertCan(req, 'approvals', 'approve', 'returns — ask an owner or admin');
      return documentService.reject(req.org.id, actorOf(req), req.params.id, req.body.reason);
    }),

    updateDelivery: route(async (req) => {
      const type = await docTypeOf(req.org.id, req.params.id);
      assertDocPermission(req, type, 'update');
      return documentService.updateDelivery(req.org.id, req.params.id, req.body as DeliveryUpdateInput);
    }),

    downloadPdf: route(async (req, res) => {
      const type = await docTypeOf(req.org.id, req.params.id);
      assertDocPermission(req, type, 'read');
      const data = await documentService.buildPdfData(req.org.id, req.params.id);
      const pdf = await pdfService.generatePdf(data);

      // Keep pdf_url fresh, but storage problems must never block the download.
      try {
        const pdfUrl = await storageService.uploadPdf(req.org.id, req.params.id, pdf);
        await prisma.invoice.update({ where: { id: req.params.id }, data: { pdfUrl } });
      } catch { /* non-fatal */ }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdfFileName(data.doc_label, data.invoice_number)}"`);
      res.send(pdf);
    }, { errorCode: 'PDF_ERROR' }),

    generatePdf: route(async (req) => {
      const type = await docTypeOf(req.org.id, req.params.id);
      assertDocPermission(req, type, 'read');
      const data = await documentService.buildPdfData(req.org.id, req.params.id);
      const pdfUrl = await pdfService.generateAndUpload(req.org.id, req.params.id, data);
      return { pdf_url: pdfUrl };
    }, { errorCode: 'PDF_ERROR' }),

    send: route(async (req) => {
      const type = await docTypeOf(req.org.id, req.params.id);
      assertDocPermission(req, type, 'send');
      const data = await documentService.buildPdfData(req.org.id, req.params.id);
      if (!data.client_email) throw new AppError('This party has no email address', 400, 'VALIDATION_ERROR');

      const pdf = Buffer.from(await pdfService.generatePdf(data));
      const pdfUrl = await storageService.uploadPdf(req.org.id, req.params.id, pdf);
      await prisma.invoice.update({ where: { id: req.params.id }, data: { pdfUrl } });

      await sendInvoiceEmail({
        to: data.client_email,
        clientName: data.client_name || 'Valued Customer',
        businessName: data.business_name || 'QuickInvoice',
        invoiceNumber: data.invoice_number,
        invoiceTotal: data.total,
        currency: data.currency || 'INR',
        dueDate: data.is_bill && data.payment_mode === 'credit' && data.due_date
          ? new Date(data.due_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
          : undefined,
        pdfBuffer: pdf,
        pdfFilename: pdfFileName(data.doc_label, data.invoice_number),
        documentLabel: data.doc_label === 'Sales Invoice' ? 'Invoice' : data.doc_label,
      });

      if (data.status === 'draft') {
        return documentService.updateStatus(req.org.id, actorOf(req), req.params.id, 'sent');
      }
      return documentService.get(req.org.id, req.params.id);
    }, { errorCode: 'SEND_ERROR' }),
  };
}
