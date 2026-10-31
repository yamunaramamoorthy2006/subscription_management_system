import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { dbManager } from './db/database';
import { seedDatabase } from './db/seed';

import { authRouter } from './routes/auth';
import { customersRouter } from './routes/customers';
import { productsRouter } from './routes/products';
import { taxesRouter } from './routes/taxes';
import { plansRouter } from './routes/plans';
import { quotationsRouter } from './routes/quotations';
import { subscriptionsRouter } from './routes/subscriptions';
import { billingRouter } from './routes/billing';
import { invoicesRouter } from './routes/invoices';
import { paymentsRouter } from './routes/payments';
import { discountsRouter } from './routes/discounts';
import { reportsRouter } from './routes/reports';
import { searchRouter } from './routes/search';
import { customerPortalRouter } from './routes/customerPortal';
import { settingsRouter } from './routes/settings';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/taxes', taxesRouter);
app.use('/api/plans', plansRouter);
app.use('/api/quotations', quotationsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/billing', billingRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/discounts', discountsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/search', searchRouter);
app.use('/api/portal', customerPortalRouter);
app.use('/api/settings', settingsRouter);

// Health Check
app.get('/api/health', (req: Request, res: Response): void => {
  res.json({
    status: 'ONLINE',
    app: 'Subscription OS',
    company: 'Brightloop Software',
    timestamp: new Date().toISOString()
  });
});

// Seed endpoint for tests / reset
app.post('/api/system/reset-demo-data', (req: Request, res: Response): void => {
  seedDatabase(true);
  res.json({ message: 'Demo data reset and re-seeded successfully.' });
});

// Serve frontend in production build if present
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.use((req: Request, res: Response, next: NextFunction): void => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) {
    next();
    return;
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send('Subscription OS API is running. Client build will be served here once generated.');
    }
  });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected internal server error occurred.'
  });
});

// Start server
async function startServer() {
  try {
    await dbManager.init();
    seedDatabase(); // Seed if first run

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(` Subscription OS API Server running on port ${PORT}`);
      console.log(` Organization: Brightloop Software`);
      console.log(` Health check: http://localhost:${PORT}/api/health`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('Fatal failure starting server:', error);
    process.exit(1);
  }
}

startServer();

