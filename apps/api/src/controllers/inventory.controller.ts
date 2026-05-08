import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { inventoryService } from '../services/inventory.service.js';

export const inventoryController = {
  async getInventory(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await inventoryService.getInventory(req.org.id);
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  },

  async searchInventory(req: AuthenticatedRequest, res: Response) {
    try {
      const q = (req.query.q as string) || '';
      const data = await inventoryService.searchInventory(req.org.id, q);
      res.json({ data: { items: data }, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  },

  async createItem(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.body.book_title) {
        return res.status(400).json({ data: null, error: { message: 'Book Title is required', code: 'VALIDATION_ERROR' }, meta: null });
      }
      const data = await inventoryService.createItem(req.org.id, req.userId, req.body);
      res.status(201).json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  },

  async updateItem(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await inventoryService.updateItem(req.org.id, req.params.id, req.body);
      res.json({ data, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  },

  async deleteItem(req: AuthenticatedRequest, res: Response) {
    try {
      await inventoryService.deleteItem(req.org.id, req.params.id);
      res.json({ data: { success: true }, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  },

  async uploadCSV(req: any, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ data: null, error: { message: 'No file uploaded', code: 'VALIDATION_ERROR' }, meta: null });
      }

      const { inserted, skipped } = await inventoryService.processCSV(req.org.id, req.userId, req.file.buffer);
      res.status(201).json({ data: { inserted, skipped }, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  },

  async seed(req: AuthenticatedRequest, res: Response) {
    try {
      // In a real scenario, this might read from a seeded path
      // but logic handles user requirement to just have the endpoint
      res.status(200).json({ data: { inserted: 0, skipped: 0, message: "Seed endpoint hit" }, error: null, meta: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: { message: err.message, code: 'SERVER_ERROR' }, meta: null });
    }
  }
};
