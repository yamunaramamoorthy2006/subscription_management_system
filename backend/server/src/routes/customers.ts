import { Router, Response } from 'express';
import { dbManager } from '../db/database';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { logActivity } from '../utils/audit';

export const customersRouter = Router();

// Apply auth to all customer operations: ADMIN and STAFF
customersRouter.use(authenticate);
customersRouter.use(authorizeRoles('ADMIN', 'STAFF'));

// GET /api/customers - List customers with search, status filter, and pagination
customersRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const { search, status, type, limit = 50, offset = 0 } = req.query;

  let sql = `
    SELECT c.*,
      (SELECT COUNT(*) FROM subscriptions s WHERE s.customer_id = c.id AND s.status = 'ACTIVE') AS active_subscriptions_count,
      (SELECT COALESCE(SUM(i.amount_due), 0) FROM invoices i WHERE i.customer_id = c.id AND i.status != 'CANCELLED') AS total_outstanding
    FROM customers c
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    sql += ` AND (c.name LIKE ? OR c.email LIKE ? OR c.customer_code LIKE ? OR c.phone LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
  }

  if (status && status !== 'ALL') {
    sql += ` AND c.status = ?`;
    params.push(status);
  }

  if (type && type !== 'ALL') {
    sql += ` AND c.customer_type = ?`;
    params.push(type);
  }

  sql += ` ORDER BY c.id DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const customers = dbManager.query(sql, params);

  const totalCountRow = dbManager.get(
    'SELECT COUNT(*) as total FROM customers WHERE status != "ARCHIVED"'
  );

  res.json({
    customers,
    total: totalCountRow ? totalCountRow.total : customers.length
  });
});

// GET /api/customers/:id - Detailed customer view with tabs data
customersRouter.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const customerId = parseInt(req.params.id, 10);
  const customer = dbManager.get('SELECT * FROM customers WHERE id = ?', [customerId]);

  if (!customer) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }

  // Get Subscriptions
  const subscriptions = dbManager.query(
    `SELECT s.*, p.name AS plan_name, p.billing_interval AS plan_interval
     FROM subscriptions s
     LEFT JOIN subscription_plans p ON s.plan_id = p.id
     WHERE s.customer_id = ?
     ORDER BY s.id DESC`,
    [customerId]
  );

  // Get Quotations
  const quotations = dbManager.query(
    `SELECT q.*, p.name AS plan_name
     FROM quotations q
     LEFT JOIN subscription_plans p ON q.plan_id = p.id
     WHERE q.customer_id = ?
     ORDER BY q.id DESC`,
    [customerId]
  );

  // Get Invoices
  const invoices = dbManager.query(
    `SELECT i.*, s.subscription_number
     FROM invoices i
     LEFT JOIN subscriptions s ON i.subscription_id = s.id
     WHERE i.customer_id = ?
     ORDER BY i.id DESC`,
    [customerId]
  );

  // Get Payments
  const payments = dbManager.query(
    `SELECT p.*, i.invoice_number
     FROM payments p
     LEFT JOIN invoices i ON p.invoice_id = i.id
     WHERE p.customer_id = ?
     ORDER BY p.id DESC`,
    [customerId]
  );

  // Financial Summary
  const financialSummary = dbManager.get(
    `SELECT
       COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) AS total_invoiced,
       COALESCE(SUM(amount_paid), 0) AS total_paid,
       COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN amount_due ELSE 0 END), 0) AS total_outstanding,
       COALESCE(SUM(CASE WHEN status = 'OVERDUE' OR (status = 'CONFIRMED' AND due_date < DATE('now')) THEN amount_due ELSE 0 END), 0) AS total_overdue
     FROM invoices
     WHERE customer_id = ?`,
    [customerId]
  );

  // Activity Logs
  const activityLogs = dbManager.query(
    `SELECT * FROM activity_logs
     WHERE (entity_type = 'CUSTOMER' AND entity_id = ?)
        OR (entity_type IN ('SUBSCRIPTION', 'INVOICE', 'PAYMENT', 'QUOTATION') AND details_json LIKE ?)
     ORDER BY id DESC LIMIT 50`,
    [customerId, `%"customerId":${customerId}%`]
  );

  res.json({
    customer,
    subscriptions,
    quotations,
    invoices,
    payments,
    financialSummary,
    activityLogs
  });
});

// POST /api/customers - Create new customer
customersRouter.post('/', (req: AuthenticatedRequest, res: Response): void => {
  const {
    name,
    email,
    phone,
    billing_address,
    tax_id,
    customer_type = 'BUSINESS',
    status = 'ACTIVE',
    internal_notes
  } = req.body;

  if (!name || !email) {
    res.status(400).json({ error: 'Customer name and unique email are required.' });
    return;
  }

  // Check unique email
  const existing = dbManager.get('SELECT id FROM customers WHERE email = ?', [email.trim().toLowerCase()]);
  if (existing) {
    res.status(409).json({ error: 'A customer with this email address already exists.' });
    return;
  }

  // Generate unique customer code
  const lastCustomer = dbManager.get('SELECT MAX(id) as max_id FROM customers');
  const nextId = (lastCustomer?.max_id || 0) + 1;
  const customer_code = `CUST-${1000 + nextId}`;

  const result = dbManager.run(
    `INSERT INTO customers (customer_code, name, email, phone, billing_address, tax_id, customer_type, status, internal_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customer_code,
      name.trim(),
      email.trim().toLowerCase(),
      phone || null,
      billing_address || null,
      tax_id || null,
      customer_type,
      status,
      internal_notes || null
    ]
  );

  const newCustomer = dbManager.get('SELECT * FROM customers WHERE id = ?', [result.lastInsertRowid]);

  logActivity({
    entityType: 'CUSTOMER',
    entityId: result.lastInsertRowid,
    action: 'CREATE',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { code: customer_code, name, email }
  });

  res.status(201).json({ customer: newCustomer });
});

// PUT /api/customers/:id - Update customer
customersRouter.put('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const customerId = parseInt(req.params.id, 10);
  const {
    name,
    email,
    phone,
    billing_address,
    tax_id,
    customer_type,
    status,
    internal_notes
  } = req.body;

  const existing = dbManager.get('SELECT * FROM customers WHERE id = ?', [customerId]);
  if (!existing) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }

  if (email && email.trim().toLowerCase() !== existing.email.toLowerCase()) {
    const duplicate = dbManager.get('SELECT id FROM customers WHERE email = ? AND id != ?', [
      email.trim().toLowerCase(),
      customerId
    ]);
    if (duplicate) {
      res.status(409).json({ error: 'Another customer with this email address already exists.' });
      return;
    }
  }

  dbManager.run(
    `UPDATE customers
     SET name = COALESCE(?, name),
         email = COALESCE(?, email),
         phone = COALESCE(?, phone),
         billing_address = COALESCE(?, billing_address),
         tax_id = COALESCE(?, tax_id),
         customer_type = COALESCE(?, customer_type),
         status = COALESCE(?, status),
         internal_notes = COALESCE(?, internal_notes),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      name ? name.trim() : null,
      email ? email.trim().toLowerCase() : null,
      phone !== undefined ? phone : null,
      billing_address !== undefined ? billing_address : null,
      tax_id !== undefined ? tax_id : null,
      customer_type || null,
      status || null,
      internal_notes !== undefined ? internal_notes : null,
      customerId
    ]
  );

  const updatedCustomer = dbManager.get('SELECT * FROM customers WHERE id = ?', [customerId]);

  logActivity({
    entityType: 'CUSTOMER',
    entityId: customerId,
    action: 'UPDATE',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { name, email, status }
  });

  res.json({ customer: updatedCustomer });
});

// DELETE /api/customers/:id - Archive or soft delete customer
customersRouter.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const customerId = parseInt(req.params.id, 10);
  const existing = dbManager.get('SELECT * FROM customers WHERE id = ?', [customerId]);
  if (!existing) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }

  // Check if active subscriptions exist
  const activeSubs = dbManager.get(
    'SELECT COUNT(*) as count FROM subscriptions WHERE customer_id = ? AND status = "ACTIVE"',
    [customerId]
  );
  if (activeSubs && activeSubs.count > 0) {
    res.status(400).json({
      error: `Cannot archive customer with ${activeSubs.count} active subscription(s). Please close active subscriptions first.`
    });
    return;
  }

  // Soft delete / archive to protect financial history
  dbManager.run('UPDATE customers SET status = "ARCHIVED", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [customerId]);

  logActivity({
    entityType: 'CUSTOMER',
    entityId: customerId,
    action: 'ARCHIVE',
    userId: req.user?.id,
    userName: req.user?.name
  });

  res.json({ message: 'Customer archived successfully.' });
});