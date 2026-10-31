import { Router, Response } from 'express';
import { dbManager } from '../db/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

export const searchRouter = Router();

searchRouter.use(authenticate);

// GET /api/search?q=query - Global multi-entity search
searchRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const query = (req.query.q as string || '').trim();

  if (!query || query.length < 2) {
    res.json({ customers: [], subscriptions: [], invoices: [], products: [] });
    return;
  }

  const searchParam = `%${query}%`;

  // Search Customers (Admin & Staff)
  let customers: any[] = [];
  if (req.user?.role !== 'CUSTOMER') {
    customers = dbManager.query(
      `SELECT id, customer_code, name, email, phone, status
       FROM customers
       WHERE name LIKE ? OR email LIKE ? OR customer_code LIKE ? OR phone LIKE ?
       LIMIT 5`,
      [searchParam, searchParam, searchParam, searchParam]
    );
  }

  // Search Subscriptions
  let subSql = `
    SELECT s.id, s.subscription_number, s.status, s.billing_interval, c.name AS customer_name
    FROM subscriptions s
    JOIN customers c ON s.customer_id = c.id
    WHERE (s.subscription_number LIKE ? OR c.name LIKE ?)
  `;
  const subParams: any[] = [searchParam, searchParam];
  if (req.user?.role === 'CUSTOMER') {
    subSql += ` AND s.customer_id = ?`;
    subParams.push(req.user.customerId || -1);
  }
  subSql += ` LIMIT 5`;
  const subscriptions = dbManager.query(subSql, subParams);

  // Search Invoices
  let invSql = `
    SELECT i.id, i.invoice_number, i.status, i.total_amount, i.amount_due, c.name AS customer_name
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE (i.invoice_number LIKE ? OR c.name LIKE ?)
  `;
  const invParams: any[] = [searchParam, searchParam];
  if (req.user?.role === 'CUSTOMER') {
    invSql += ` AND i.customer_id = ?`;
    invParams.push(req.user.customerId || -1);
  }
  invSql += ` LIMIT 5`;
  const invoices = dbManager.query(invSql, invParams);

  // Search Products (Admin & Staff)
  let products: any[] = [];
  if (req.user?.role !== 'CUSTOMER') {
    products = dbManager.query(
      `SELECT id, code, name, sales_price, status
       FROM products
       WHERE name LIKE ? OR code LIKE ?
       LIMIT 5`,
      [searchParam, searchParam]
    );
  }

  res.json({
    customers,
    subscriptions,
    invoices,
    products
  });
});

// GET /api/notifications - List notifications for user
searchRouter.get('/notifications', (req: AuthenticatedRequest, res: Response): void => {
  const notifications = dbManager.query(
    `SELECT * FROM notifications
     WHERE user_id IS NULL OR user_id = ? OR role = ?
     ORDER BY id DESC LIMIT 20`,
    [req.user?.id || null, req.user?.role || null]
  );

  const unreadCountRow = dbManager.get(
    `SELECT COUNT(*) as count FROM notifications
     WHERE (user_id IS NULL OR user_id = ? OR role = ?) AND is_read = 0`,
    [req.user?.id || null, req.user?.role || null]
  );

  res.json({
    notifications,
    unreadCount: unreadCountRow ? unreadCountRow.count : 0
  });
});

// POST /api/notifications/mark-read - Mark notification as read
searchRouter.post('/notifications/mark-read', (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.body;
  if (id) {
    dbManager.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
  } else {
    // Mark all read for current user
    dbManager.run(
      'UPDATE notifications SET is_read = 1 WHERE user_id IS NULL OR user_id = ? OR role = ?',
      [req.user?.id || null, req.user?.role || null]
    );
  }
  res.json({ success: true });
});
