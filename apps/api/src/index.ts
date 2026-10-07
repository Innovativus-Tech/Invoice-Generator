import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import invoiceRoutes from './routes/invoices.js';
import documentRoutes from './routes/documents.js';
import clientRoutes from './routes/clients.js';
import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import searchRoutes from './routes/search.js';
import inventoryRoutes from './routes/inventory.js';
import stockRoutes from './routes/stock.js';
import paymentRoutes from './routes/payments.js';
import reportRoutes from './routes/reports.js';
import dashboardRoutes from './routes/dashboard.js';
import notificationRoutes from './routes/notifications.js';
import salesRoutes from './routes/sales.js';
import purchasesRoutes from './routes/purchases.js';
import organizationRoutes from './routes/organizations.js';
import { authMiddleware } from './middleware/auth.middleware.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/org', organizationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/search', authMiddleware as any, searchRoutes);
app.use('/api/inventory', authMiddleware as any, inventoryRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/purchases', purchasesRoutes);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    data: null,
    error: { message: 'Internal server error', code: 'SERVER_ERROR' },
    meta: null,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 QuickInvoice API running on http://localhost:${PORT}`);
});

export default app;
