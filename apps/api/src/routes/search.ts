import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (req: any, res) => {
  try {
    const q = (req.query.q as string || '').trim();

    if (q.length < 2) {
      res.status(400).json({
        data: null,
        error: { message: 'Query must be at least 2 characters', code: 'VALIDATION_ERROR' },
        meta: null,
      });
      return;
    }

    const orgId = req.org.id;

    const [invoices, clients] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          orgId,
          OR: [
            { invoiceNumber: { contains: q, mode: 'insensitive' } },
            { billNumber: { contains: q, mode: 'insensitive' } },
            { orderId: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: { client: { select: { name: true } } },
        take: 5,
      }),
      prisma.client.findMany({
        where: {
          orgId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { company: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { gstin: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
      }),
    ]);

    const formattedInvoices = invoices.map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoiceNumber,
      bill_number: inv.billNumber,
      client_name: inv.client?.name || '',
      total: Number(inv.total),
      status: inv.status,
      issue_date: inv.issueDate,
    }));

    const formattedClients = clients.map((c) => ({
      id: c.id,
      name: c.name,
      company: c.company,
      email: c.email,
    }));

    res.json({
      data: {
        invoices: formattedInvoices,
        clients: formattedClients,
      },
      error: null,
      meta: null,
    });
  } catch (err: any) {
    res.status(500).json({
      data: null,
      error: { message: err.message, code: 'SERVER_ERROR' },
      meta: null,
    });
  }
});

export default router;
