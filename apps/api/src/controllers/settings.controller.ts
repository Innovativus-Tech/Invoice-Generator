import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { cacheGet, cacheSet, cacheDel, CacheKeys } from '../lib/cache.js';
import { storageService } from '../services/storage.service.js';

// BUG 4 FIX: Always return/update the org OWNER's profile, not the current user's.
// All members share the owner's settings (currency, bank details, logo, etc.)
async function getOwnerProfile(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerId: true },
  });
  if (!org) return null;
  return prisma.profile.findUnique({ where: { id: org.ownerId } });
}

function serializeProfile(p: any) {
  if (!p) return null;
  return {
    id: p.id,
    org_id: p.orgId,
    business_name: p.businessName,
    business_email: p.businessEmail,
    business_address: p.businessAddress,
    business_phone: p.businessPhone,
    logo_url: p.logoUrl,
    currency: p.currency ?? 'USD',
    payment_terms: p.paymentTerms ?? 'Net 30',
    invoice_prefix: p.invoicePrefix ?? 'INV',
    next_invoice_number: p.nextInvoiceNumber ?? 1001,
    created_at: p.createdAt,
    signatory_name: p.signatoryName,
    signature_url: p.signatureUrl,
    gstin: p.gstin,
    website: p.website,
    bank_name: p.bankName,
    bank_account_number: p.bankAccountNumber,
    bank_ifsc: p.bankIfsc,
    bank_branch: p.bankBranch,
  };
}

const ALLOWED_FIELDS: Record<string, string> = {
  business_name: 'businessName',
  business_email: 'businessEmail',
  business_address: 'businessAddress',
  business_phone: 'businessPhone',
  currency: 'currency',
  payment_terms: 'paymentTerms',
  invoice_prefix: 'invoicePrefix',
  next_invoice_number: 'nextInvoiceNumber',
  signatory_name: 'signatoryName',
  signature_url: 'signatureUrl',
  gstin: 'gstin',
  website: 'website',
  bank_name: 'bankName',
  bank_account_number: 'bankAccountNumber',
  bank_ifsc: 'bankIfsc',
  bank_branch: 'bankBranch',
};

export class SettingsController {
  async get(req: AuthenticatedRequest, res: Response) {
    try {
      const key = CacheKeys.settings(req.org.id);
      const cached = await cacheGet<any>(key);
      if (cached) {
        res.json({ data: cached, error: null, meta: null });
        return;
      }

      let profile = await getOwnerProfile(req.org.id);

      if (!profile) {
        // Bootstrap: create a profile for the owner if it doesn't exist
        const org = await prisma.organization.findUnique({ where: { id: req.org.id }, select: { ownerId: true } });
        if (org) {
          profile = await prisma.profile.upsert({
            where: { id: org.ownerId },
            update: {},
            create: { id: org.ownerId, orgId: req.org.id, businessEmail: req.userEmail },
          });
        }
      }

      const serialized = serializeProfile(profile);
      await cacheSet(key, serialized, 300);
      res.json({ data: serialized, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async update(req: AuthenticatedRequest<any, any, any>, res: Response) {
    try {
      const org = await prisma.organization.findUnique({ where: { id: req.org.id }, select: { ownerId: true } });
      if (!org) {
        res.status(404).json({ data: null, error: { message: 'Organization not found', code: 'NOT_FOUND' }, meta: null });
        return;
      }

      const updateData: Record<string, unknown> = {};
      for (const [snakeKey, camelKey] of Object.entries(ALLOWED_FIELDS)) {
        if (req.body[snakeKey] !== undefined) {
          updateData[camelKey] = req.body[snakeKey];
        }
      }

      const profile = await prisma.profile.upsert({
        where: { id: org.ownerId },
        update: updateData,
        create: { id: org.ownerId, orgId: req.org.id, ...updateData },
      });

      await cacheDel(CacheKeys.settings(req.org.id));
      res.json({ data: serializeProfile(profile), error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async uploadLogo(req: AuthenticatedRequest, res: Response) {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        res.status(400).json({ data: null, error: { message: 'No file uploaded', code: 'VALIDATION_ERROR' }, meta: null });
        return;
      }

      const logoUrl = await storageService.uploadLogo(req.org.id, file.buffer, file.mimetype);

      const org = await prisma.organization.findUnique({ where: { id: req.org.id }, select: { ownerId: true } });
      if (!org) {
        res.status(404).json({ data: null, error: { message: 'Organization not found', code: 'NOT_FOUND' }, meta: null });
        return;
      }

      const profile = await prisma.profile.upsert({
        where: { id: org.ownerId },
        update: { logoUrl },
        create: { id: org.ownerId, orgId: req.org.id, logoUrl },
      });

      await cacheDel(CacheKeys.settings(req.org.id));
      res.json({ data: serializeProfile(profile), error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async uploadSignature(req: AuthenticatedRequest, res: Response) {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        res.status(400).json({ data: null, error: { message: 'No file uploaded', code: 'VALIDATION_ERROR' }, meta: null });
        return;
      }

      const signatureUrl = await storageService.uploadSignature(req.org.id, file.buffer, file.mimetype);

      const org = await prisma.organization.findUnique({ where: { id: req.org.id }, select: { ownerId: true } });
      if (!org) {
        res.status(404).json({ data: null, error: { message: 'Organization not found', code: 'NOT_FOUND' }, meta: null });
        return;
      }

      const profile = await prisma.profile.upsert({
        where: { id: org.ownerId },
        update: { signatureUrl },
        create: { id: org.ownerId, orgId: req.org.id, signatureUrl },
      });

      await cacheDel(CacheKeys.settings(req.org.id));
      res.json({ data: serializeProfile(profile), error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }
}

export const settingsController = new SettingsController();
