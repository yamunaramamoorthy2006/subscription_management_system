import { Router, Response } from 'express';
import { dbManager } from '../db/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { logActivity } from '../utils/audit';

export const customerPortalRouter = Router();

customerPortalRouter.use(authenticate);

// Middleware to ensure user has a customerId associated or is testing customer portal
function requireCustomerContext(req: AuthenticatedRequest, res: Response, next: Function) {
  if (req.user?.role === 'CUSTOMER') {
    if (!req.user.customerId) {
      res.status(403).json({ error: 'No linked customer profile found for this customer account.' });
      return;
    }
    next();
  } else {
    // If Admin/Staff is previewing portal, check if query param or header specified customerId
    const targetCustId = req.query.customerId ? Number(req.query.customerId) : req.user?.customerId;
    if (targetCustId) {
      req.user = { ...req.user!, customerId: targetCustId };
      next();
    } else {
      res.status(400).json({ error: 'Please specify customerId when previewing customer portal as staff.' });
    }
  }
}

customerPortalRouter.use(requireCustomerContext);

// GET /api/portal/summary - Customer portal dashboard summary
customerPortalRouter.get('/summary', (req: AuthenticatedRequest, res: Response): void => {
  const customerId = req.user!.customerId!;

  const customer = dbManager.get(
    'SELECT id, customer_code, name, email, phone, billing_address, tax_id, customer_type, created_at FROM customers WHERE id = ?',
    [customerId]
  );

  if (!customer) {
    res.status(404).json({ error: 'Customer record not found.' });
    return;
  }

  // Active Subscriptions
  const subscriptions = dbManager.query(
    `SELECT s.id, s.subscription_number, s.start_date, s.next_billing_date, s.expiration_date,
            s.billing_interval, s.status, s.renewal_policy, p.name AS plan_name, p.billing_price,
            (SELECT COALESCE(SUM(line_total), 0) FROM subscription_lines WHERE subscription_id = s.id) AS recurring_total
     FROM subscriptions s
     JOIN subscription_plans p ON s.plan_id = p.id
     WHERE s.customer_id = ?
     ORDER BY s.id DESC`,
    [customerId]
  );

  // Invoices (excluding internal notes)
  const invoices = dbManager.query(
    `SELECT id, invoice_number, invoice_date, due_date, status, subtotal, discount_total, tax_total, total_amount, amount_paid, amount_due
     FROM invoices
     WHERE customer_id = ?
     ORDER BY id DESC LIMIT 20`,
    [customerId]
  );

  // Recent Payments
  const payments = dbManager.query(
    `SELECT p.id, p.payment_reference, p.amount, p.payment_date, p.payment_method, p.transaction_reference, i.invoice_number
     FROM payments p
     JOIN invoices i ON p.invoice_id = i.id
     WHERE p.customer_id = ?
     ORDER BY p.id DESC LIMIT 10`,
    [customerId]
  );

  // Account balances
  const balances = dbManager.get(
    `SELECT
       COALESCE(SUM(amount_due), 0) AS outstanding_amount,
       COALESCE(SUM(CASE WHEN due_date < DATE('now') AND amount_due > 0 THEN amount_due ELSE 0 END), 0) AS overdue_amount,
       COALESCE(SUM(amount_paid), 0) AS total_paid
     FROM invoices
     WHERE customer_id = ? AND status != 'CANCELLED'`,
    [customerId]
  );

  res.json({
    customer,
    balances,
    subscriptions,
    invoices,
    payments
  });
});

// PUT /api/portal/profile - Update permitted profile details
customerPortalRouter.put('/profile', (req: AuthenticatedRequest, res: Response): void => {
  const customerId = req.user!.customerId!;
  const { name, phone, billing_address } = req.body;

  dbManager.run(
    `UPDATE customers
     SET name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         billing_address = COALESCE(?, billing_address),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      name ? name.trim() : null,
      phone !== undefined ? phone : null,
      billing_address !== undefined ? billing_address : null,
      customerId
    ]
  );

  logActivity({
    entityType: 'CUSTOMER',
    entityId: customerId,
    action: 'PORTAL_PROFILE_UPDATE',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { name, phone }
  });

  const updatedCustomer = dbManager.get(
    'SELECT id, customer_code, name, email, phone, billing_address, tax_id FROM customers WHERE id = ?',
    [customerId]
  );

  res.json({
    message: 'Profile updated successfully.',
    customer: updatedCustomer
  });
});