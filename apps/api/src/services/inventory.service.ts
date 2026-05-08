import { prisma } from '../lib/prisma.js';
import { cacheGet, cacheSet, cacheDel, CacheKeys } from '../lib/cache.js';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

function mapItem(item: any) {
  return {
    id: item.id,
    user_id: item.userId,
    org_id: item.orgId,
    book_title: item.bookTitle,
    isbn: item.isbn,
    author: item.author,
    publisher: item.publisher,
    product_form: item.productForm,
    language: item.language,
    applicant_type: item.applicantType,
    imprint: item.imprint,
    publication_date: item.publicationDate,
    price: item.price !== null ? Number(item.price) : 0,
    gst_rate: item.gstRate !== null ? Number(item.gstRate) : 0,
    stock: item.stock ?? 1,
    created_at: item.createdAt,
  };
}

export class InventoryService {
  async getInventory(orgId: string) {
    const key = CacheKeys.inventory(orgId);
    const cached = await cacheGet<ReturnType<typeof mapItem>[]>(key);
    if (cached) return cached;

    const items = await prisma.inventoryItem.findMany({
      where: { orgId },
      orderBy: { bookTitle: 'asc' },
      select: {
        id: true,
        userId: true,
        orgId: true,
        bookTitle: true,
        isbn: true,
        author: true,
        publisher: true,
        productForm: true,
        language: true,
        applicantType: true,
        imprint: true,
        publicationDate: true,
        price: true,
        gstRate: true,
        stock: true,
        createdAt: true,
      },
    });
    const result = items.map(mapItem);
    await cacheSet(key, result, 300);
    return result;
  }

  async searchInventory(orgId: string, q: string, limit = 10) {
    const trimmed = q.trim();
    if (trimmed.length < 2) return [];

    // Full-text search via raw SQL (tsvector column is not writable by Prisma)
    const tsQuery = trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word + ':*')
      .join(' & ');

    const ftsResults = await prisma.$queryRaw<any[]>`
      SELECT id, user_id, org_id, "Book Title" as "bookTitle", "ISBN" as isbn,
             "Name of Author/Editor" as author,
             "Name of Publishing Agency/Publisher" as publisher,
             "Product Form" as "productForm", "Language" as language,
             "Applicant Type" as "applicantType", "Imprint" as imprint,
             "Publication Date" as "publicationDate",
             price, gst_rate as "gstRate", stock, created_at as "createdAt"
      FROM inventory_items
      WHERE org_id = ${orgId}::uuid
        AND search_vector @@ to_tsquery('simple', ${tsQuery})
      LIMIT ${limit}
    `;

    const isbnResults = await prisma.$queryRaw<any[]>`
      SELECT id, user_id, org_id, "Book Title" as "bookTitle", "ISBN" as isbn,
             "Name of Author/Editor" as author,
             "Name of Publishing Agency/Publisher" as publisher,
             "Product Form" as "productForm", "Language" as language,
             "Applicant Type" as "applicantType", "Imprint" as imprint,
             "Publication Date" as "publicationDate",
             price, gst_rate as "gstRate", stock, created_at as "createdAt"
      FROM inventory_items
      WHERE org_id = ${orgId}::uuid
        AND "ISBN" ILIKE ${trimmed + '%'}
      LIMIT 5
    `;

    const seen = new Set<string>();
    const merged = [...(ftsResults || []), ...(isbnResults || [])]
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, limit);

    return merged.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      org_id: row.org_id,
      book_title: row.bookTitle,
      isbn: row.isbn,
      author: row.author,
      publisher: row.publisher,
      product_form: row.productForm,
      language: row.language,
      applicant_type: row.applicantType,
      imprint: row.imprint,
      publication_date: row.publicationDate,
      price: row.price !== null ? Number(row.price) : 0,
      gst_rate: row.gstRate !== null ? Number(row.gstRate) : 0,
      stock: row.stock ?? 1,
      created_at: row.createdAt,
    }));
  }

  async createItem(orgId: string, userId: string, itemData: any) {
    await cacheDel(CacheKeys.inventory(orgId));
    const item = await prisma.inventoryItem.create({
      data: {
        userId,
        orgId,
        bookTitle: itemData.book_title,
        isbn: itemData.isbn || null,
        productForm: itemData.product_form || null,
        language: itemData.language || null,
        applicantType: itemData.applicant_type || null,
        publisher: itemData.publisher || null,
        imprint: itemData.imprint || null,
        author: itemData.author || null,
        publicationDate: itemData.publication_date || null,
        price: itemData.price || 0,
        gstRate: itemData.gst_rate ?? 0,
        stock: itemData.stock ?? 1,
      },
    });
    return mapItem(item);
  }

  async updateItem(orgId: string, id: string, itemData: any) {
    await cacheDel(CacheKeys.inventory(orgId));
    await prisma.inventoryItem.updateMany({
      where: { id, orgId },
      data: {
        bookTitle: itemData.book_title,
        isbn: itemData.isbn || null,
        productForm: itemData.product_form || null,
        language: itemData.language || null,
        applicantType: itemData.applicant_type || null,
        publisher: itemData.publisher || null,
        imprint: itemData.imprint || null,
        author: itemData.author || null,
        publicationDate: itemData.publication_date || null,
        price: itemData.price || 0,
        gstRate: itemData.gst_rate ?? 0,
        stock: itemData.stock ?? 1,
      },
    });
    const item = await prisma.inventoryItem.findFirst({ where: { id, orgId } });
    if (!item) throw new Error('Item not found');
    return mapItem(item);
  }

  async deleteItem(orgId: string, id: string) {
    await cacheDel(CacheKeys.inventory(orgId));
    await prisma.inventoryItem.deleteMany({ where: { id, orgId } });
    return true;
  }

  async processCSV(orgId: string, userId: string, csvBuffer: Buffer): Promise<{ inserted: number; skipped: number }> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      let skipped = 0;

      Readable.from(csvBuffer)
        .pipe(csvParser())
        .on('data', (row) => {
          const bookTitle = row['Book Title'];
          if (!bookTitle || bookTitle.trim() === '') {
            skipped++;
            return;
          }
          results.push({
            userId,
            orgId,
            bookTitle: row['Book Title'],
            isbn: row['ISBN'] || null,
            productForm: row['Product Form'] || null,
            language: row['Language'] || null,
            applicantType: row['Applicant Type'] || null,
            publisher: row['Name of Publishing Agency/Publisher'] || null,
            imprint: row['Imprint'] || null,
            author: row['Name of Author/Editor'] || null,
            publicationDate: row['Publication Date'] || null,
            price: 0,
            gstRate: 0,
            stock: 1,
          });
        })
        .on('end', async () => {
          try {
            const BATCH_SIZE = 500;
            let inserted = 0;
            for (let i = 0; i < results.length; i += BATCH_SIZE) {
              const batch = results.slice(i, i + BATCH_SIZE);
              await prisma.inventoryItem.createMany({ data: batch, skipDuplicates: false });
              inserted += batch.length;
            }
            await cacheDel(CacheKeys.inventory(orgId));
            resolve({ inserted, skipped });
          } catch (err) {
            reject(err);
          }
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }
}

export const inventoryService = new InventoryService();
