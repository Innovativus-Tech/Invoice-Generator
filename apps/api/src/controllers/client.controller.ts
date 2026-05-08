import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { cacheGet, cacheSet, cacheDel, CacheKeys } from '../lib/cache.js';
import type { CreateClientInput, UpdateClientInput } from '../schemas/client.schema.js';

function serializeClient(client: any) {
  return {
    ...client,
    userId: undefined,
    user_id: client.userId,
    orgId: undefined,
    org_id: client.orgId,
    stateCode: undefined,
    state_code: client.stateCode,
    createdAt: undefined,
    created_at: client.createdAt,
  };
}

export class ClientController {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const key = CacheKeys.clients(req.org.id);
      const cached = await cacheGet<any[]>(key);
      if (cached) {
        res.json({ data: cached, error: null, meta: null });
        return;
      }

      const clients = await prisma.client.findMany({
        where: { orgId: req.org.id },
        orderBy: { createdAt: 'desc' },
      });

      const clientsWithStats = await Promise.all(
        clients.map(async (client) => {
          const invoices = await prisma.invoice.findMany({
            where: { clientId: client.id, orgId: req.org.id },
            select: { total: true, status: true },
          });

          const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
          const outstanding = invoices
            .filter((inv) => !['paid', 'cancelled'].includes(inv.status))
            .reduce((sum, inv) => sum + Number(inv.total), 0);
          const invoiceCount = invoices.length;

          return { ...serializeClient(client), totalInvoiced, outstanding, invoiceCount };
        })
      );

      await cacheSet(key, clientsWithStats, 60);
      res.json({ data: clientsWithStats, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async get(req: AuthenticatedRequest<{ id: string }>, res: Response) {
    try {
      const client = await prisma.client.findFirst({
        where: { id: req.params.id as string, orgId: req.org.id },
      });

      if (!client) {
        res.status(404).json({ data: null, error: { message: 'Client not found', code: 'NOT_FOUND' }, meta: null });
        return;
      }

      const invoices = await prisma.invoice.findMany({
        where: { clientId: client.id, orgId: req.org.id },
        orderBy: { createdAt: 'desc' },
      });

      const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
      const outstanding = invoices
        .filter((inv) => !['paid', 'cancelled'].includes(inv.status))
        .reduce((sum, inv) => sum + Number(inv.total), 0);

      res.json({
        data: { ...serializeClient(client), invoices, totalInvoiced, outstanding },
        error: null,
        meta: null,
      });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async create(req: AuthenticatedRequest<any, any, CreateClientInput>, res: Response) {
    try {
      const input = req.body;
      const client = await prisma.client.create({
        data: {
          userId: req.userId,
          orgId: req.org.id,
          name: input.name,
          email: input.email || null,
          company: input.company || null,
          address: input.address || null,
          phone: input.phone || null,
          notes: input.notes || null,
          gstin: input.gstin || null,
          state: input.state || null,
          stateCode: input.state_code || null,
        },
      });
      await cacheDel(CacheKeys.clients(req.org.id));
      res.status(201).json({ data: serializeClient(client), error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async update(req: AuthenticatedRequest<{ id: string }, any, UpdateClientInput>, res: Response) {
    try {
      const input = req.body;
      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.company !== undefined) updateData.company = input.company;
      if (input.address !== undefined) updateData.address = input.address;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.gstin !== undefined) updateData.gstin = input.gstin;
      if (input.state !== undefined) updateData.state = input.state;
      if ((input as any).state_code !== undefined) updateData.stateCode = (input as any).state_code;

      const count = await prisma.client.updateMany({
        where: { id: req.params.id as string, orgId: req.org.id },
        data: updateData,
      });

      if (count.count === 0) {
        res.status(404).json({ data: null, error: { message: 'Client not found', code: 'NOT_FOUND' }, meta: null });
        return;
      }

      const client = await prisma.client.findFirst({ where: { id: req.params.id as string } });
      await cacheDel(CacheKeys.clients(req.org.id));
      res.json({ data: serializeClient(client), error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }

  async delete(req: AuthenticatedRequest<{ id: string }>, res: Response) {
    try {
      await prisma.client.deleteMany({
        where: { id: req.params.id as string, orgId: req.org.id },
      });
      await cacheDel(CacheKeys.clients(req.org.id));
      res.json({ data: { success: true }, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }
}

export const clientController = new ClientController();
