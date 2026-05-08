import { Router } from 'express';
import multer from 'multer';
import { inventoryController } from '../controllers/inventory.controller.js';
import { requirePermission } from '../middleware/rbac.middleware.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', (req: any, res) => {
  inventoryController.getInventory(req, res);
});
router.get('/search', (req: any, res) => {
  inventoryController.searchInventory(req, res);
});
router.post('/', requirePermission('inventory', 'create') as any, (req: any, res) => {
  inventoryController.createItem(req, res);
});
router.put('/:id', requirePermission('inventory', 'update') as any, (req: any, res) => {
  inventoryController.updateItem(req, res);
});
router.delete('/:id', requirePermission('inventory', 'delete') as any, (req: any, res) => {
  inventoryController.deleteItem(req, res);
});
router.post('/upload-csv', requirePermission('inventory', 'create') as any, upload.single('file'), (req: any, res) => {
  inventoryController.uploadCSV(req, res);
});
router.post('/seed', (req: any, res) => {
  inventoryController.seed(req, res);
});

export default router;
