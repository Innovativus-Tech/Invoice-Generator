import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';

// Rate card: binding charge per copy by binding type (Paperback, Hardbound…).
// Purchase lines pre-fill their binding charge from here; it stays editable per line.

const DEFAULTS = ['Paperback', 'Hardbound', 'Spiral', 'Saddle Stitch'];

const serialize = (r: { id: string; name: string; charge: unknown; sortOrder: number }) => ({
  id: r.id,
  name: r.name,
  charge: Number(r.charge),
  sort_order: r.sortOrder,
});

export class BindingRatesService {
  async list(orgId: string) {
    let rows = await prisma.bindingRate.findMany({ where: { orgId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    if (rows.length === 0) {
      await prisma.bindingRate.createMany({
        data: DEFAULTS.map((name, i) => ({ orgId, name, charge: 0, sortOrder: i })),
        skipDuplicates: true,
      });
      rows = await prisma.bindingRate.findMany({ where: { orgId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    }
    return rows.map(serialize);
  }

  /** Replaces the whole rate card. */
  async replace(orgId: string, rates: { name: string; charge: number }[]) {
    const clean = rates
      .map((r) => ({ name: String(r.name ?? '').trim(), charge: Number(r.charge) }))
      .filter((r) => r.name);
    const names = new Set<string>();
    for (const r of clean) {
      if (r.name.length > 60) throw new AppError('Binding names can be up to 60 characters', 422, 'VALIDATION_ERROR');
      if (!Number.isFinite(r.charge) || r.charge < 0) throw new AppError(`Enter a valid charge for ${r.name}`, 422, 'VALIDATION_ERROR');
      const key = r.name.toLowerCase();
      if (names.has(key)) throw new AppError(`${r.name} is listed twice`, 422, 'VALIDATION_ERROR');
      names.add(key);
    }
    await prisma.$transaction([
      prisma.bindingRate.deleteMany({ where: { orgId } }),
      prisma.bindingRate.createMany({ data: clean.map((r, i) => ({ orgId, name: r.name, charge: r.charge, sortOrder: i })) }),
    ]);
    return this.list(orgId);
  }
}

export const bindingRatesService = new BindingRatesService();
