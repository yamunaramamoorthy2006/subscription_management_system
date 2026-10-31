import { Router, Response } from 'express';
import { dbManager } from '../db/database';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { calculateLine, round2, addBillingInterval, daysDifference, getTodayIso } from '../utils/math';
import { logActivity, createNotification } from '../utils/audit';

export const subscriptionsRouter = Router();

subscriptionsRouter.use(authenticate);

/**
 * Computes health status based on transparent business rules
 */
export function computeSubscriptionHealth(sub: any, hasOverdueInvoices: boolean): {
  health: 'HEALTHY' | 'RENEWAL_APPROACHING' | 'PAYMENT_OVERDUE' | 'PAUSED' | 'EXPIRING' | 'CLOSED';
  reason: string;
} {
  const today = getTodayIso();

  if (sub.status === 'CLOSED') {
    return { health: 'CLOSED', reason: 'Subscription has been closed.' };
  }
  if (sub.status === 'PAUSED') {
    return { health: 'PAUSED', reason: 'Subscription billing and service are paused.' };
  }
  if (hasOverdueInvoices) {
    return { health: 'PAYMENT_OVERDUE', reason: 'Has one or more overdue invoices awaiting payment.' };
  }
  if (sub.status === 'EXPIRED' || (sub.expiration_date && sub.expiration_date < today)) {
    return { health: 'EXPIRING', reason: 'Subscription has reached its expiration date.' };
  }
  if (sub.expiration_date && daysDifference(today, sub.expiration_date) <= 14) {
    return { health: 'EXPIRING', reason: `Expiring in ${daysDifference(today, sub.expiration_date)} days.` };
  }
  if (sub.status === 'ACTIVE' && daysDifference(today, sub.next_billing_date) <= 7) {
    return { health: 'RENEWAL_APPROACHING', reason: `Renewal invoice due within ${Math.max(0, daysDifference(today, sub.next_billing_date))} days.` };
  }
  if (sub.status === 'ACTIVE') {
    return { health: 'HEALTHY', reason: 'Active and in good standing.' };
  }

  return { health: 'HEALTHY', reason: `Status is ${sub.status}` };
}

// GET /api/subscriptions - List subscriptions with health and stats
subscriptionsRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const { status, customer_id, plan_id, health, search } = req.query;

  let sql = `
    SELECT s.*,
      c.name AS customer_name,
      c.email AS customer_email,
      c.customer_code,
      p.name AS plan_name,
      p.billing_price AS plan_billing_price,
      (SELECT COALESCE(SUM(line_total), 0) FROM subscription_lines WHERE subscription_id = s.id) AS recurring_amount,
      (SELECT COUNT(*) FROM invoices i WHERE i.subscription_id = s.id AND i.status = 'OVERDUE') AS overdue_invoice_count,
      (SELECT COUNT(*) FROM invoices i WHERE i.subscription_id = s.id AND (i.status = 'CONFIRMED' OR i.status = 'OVERDUE') AND i.due_date < DATE('now') AND i.amount_due > 0) AS overdue_count_calc
    FROM subscriptions s
    JOIN customers c ON s.customer_id = c.id
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE 1=1
  `;
  const params: any[] = [];

  // If role is CUSTOMER, restrict strictly to their customer_id
  if (req.user?.role === 'CUSTOMER') {
    sql += ` AND s.customer_id = ?`;
    params.push(req.user.customerId || -1);
  } else if (customer_id) {
    sql += ` AND s.customer_id = ?`;
    params.push(customer_id);
  }

  if (status && status !== 'ALL') {
    sql += ` AND s.status = ?`;
    params.push(status);
  }

  if (plan_id) {
    sql += ` AND s.plan_id = ?`;
    params.push(plan_id);
  }

  if (search) {
    sql += ` AND (s.subscription_number LIKE ? OR c.name LIKE ? OR c.email LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  sql += ` ORDER BY s.id DESC`;

  const rows = dbManager.query(sql, params);

  const enriched = rows.map((sub) => {
    const hasOverdue = Number(sub.overdue_invoice_count) > 0 || Number(sub.overdue_count_calc) > 0;
    const healthInfo = computeSubscriptionHealth(sub, hasOverdue);
    return {
      ...sub,
      health: healthInfo.health,
      health_reason: healthInfo.reason
    };
  });

  const finalFiltered = health && health !== 'ALL'
    ? enriched.filter((s) => s.health === health)
    : enriched;

  res.json({ subscriptions: finalFiltered });
});

// GET /api/subscriptions/:id - Detailed subscription view with lines, invoices, timeline
subscriptionsRouter.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const sub = dbManager.get(
    `SELECT s.*,
       c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, c.billing_address,
       p.name AS plan_name, p.allow_pause, p.allow_early_closure, p.auto_close_on_expiry, p.billing_interval AS plan_interval
     FROM subscriptions s
     JOIN customers c ON s.customer_id = c.id
     JOIN subscription_plans p ON s.plan_id = p.id
     WHERE s.id = ?`,
    [id]
  );

  if (!sub) {
    res.status(404).json({ error: 'Subscription not found.' });
    return;
  }

  // Customer authorization check
  if (req.user?.role === 'CUSTOMER' && req.user.customerId !== sub.customer_id) {
    res.status(403).json({ error: 'Forbidden: You do not have access to this subscription.' });
    return;
  }

  const lines = dbManager.query(
    `SELECT sl.*, prod.name AS product_name, prod.code AS product_code, pv.variant_name
     FROM subscription_lines sl
     JOIN products prod ON sl.product_id = prod.id
     LEFT JOIN product_variants pv ON sl.variant_id = pv.id
     WHERE sl.subscription_id = ?
     ORDER BY sl.id ASC`,
    [id]
  );

  const invoices = dbManager.query(
    `SELECT * FROM invoices WHERE subscription_id = ? ORDER BY id DESC`,
    [id]
  );

  const payments = dbManager.query(
    `SELECT p.*, i.invoice_number
     FROM payments p
     JOIN invoices i ON p.invoice_id = i.id
     WHERE i.subscription_id = ?
     ORDER BY p.id DESC`,
    [id]
  );

  const activityLogs = dbManager.query(
    `SELECT * FROM activity_logs WHERE entity_type = 'SUBSCRIPTION' AND entity_id = ? ORDER BY id DESC`,
    [id]
  );

  const overdueInvoices = invoices.filter(
    (inv: any) => inv.status === 'OVERDUE' || ((inv.status === 'CONFIRMED') && inv.due_date < getTodayIso() && inv.amount_due > 0)
  );

  const healthInfo = computeSubscriptionHealth(sub, overdueInvoices.length > 0);

  // Construct Subscription Timeline events
  const timelineEvents: Array<{ title: string; date: string; type: string; description: string }> = [];

  timelineEvents.push({
    title: 'Subscription Created',
    date: sub.created_at ? sub.created_at.split(' ')[0] : sub.start_date,
    type: 'CREATED',
    description: `Created under plan "${sub.plan_name}" with interval ${sub.billing_interval}.`
  });

  if (sub.start_date) {
    timelineEvents.push({
      title: 'Service Commenced',
      date: sub.start_date,
      type: 'START',
      description: 'Subscription lifecycle formally activated.'
    });
  }

  for (const inv of invoices) {
    timelineEvents.push({
      title: `Invoice Generated (${inv.invoice_number})`,
      date: inv.invoice_date,
      type: 'INVOICE',
      description: `Period: ${inv.billing_period_start || ''} to ${inv.billing_period_end || ''}. Amount: $${Number(inv.total_amount).toFixed(2)} (${inv.status}).`
    });
  }

  for (const pay of payments) {
    timelineEvents.push({
      title: `Payment Recorded ($${Number(pay.amount).toFixed(2)})`,
      date: pay.payment_date,
      type: 'PAYMENT',
      description: `Method: ${pay.payment_method}. Ref: ${pay.payment_reference}.`
    });
  }

  if (sub.next_billing_date) {
    timelineEvents.push({
      title: 'Next Expected Billing',
      date: sub.next_billing_date,
      type: 'UPCOMING_BILLING',
      description: `Next invoice scheduled for ${sub.next_billing_date}.`
    });
  }

  if (sub.expiration_date) {
    timelineEvents.push({
      title: 'Subscription Expiration / Renewal Target',
      date: sub.expiration_date,
      type: 'EXPIRY',
      description: `Configured expiration date: ${sub.expiration_date}. Renewal policy: ${sub.renewal_policy}.`
    });
  }

  // Sort timeline chronologically
  timelineEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  res.json({
    subscription: {
      ...sub,
      health: healthInfo.health,
      health_reason: healthInfo.reason
    },
    lines,
    invoices,
    payments,
    activityLogs,
    timeline: timelineEvents
  });
});

// POST /api/subscriptions - Create direct subscription (ADMIN and STAFF)
subscriptionsRouter.post('/', authorizeRoles('ADMIN', 'STAFF'), (req: AuthenticatedRequest, res: Response): void => {
  const {
    customer_id,
    plan_id,
    start_date = getTodayIso(),
    expiration_date,
    payment_terms = 'NET30',
    renewal_policy = 'AUTO_RENEW',
    notes,
    lines = []
  } = req.body;

  if (!customer_id || !plan_id) {
    res.status(400).json({ error: 'Customer and subscription plan are required.' });
    return;
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    res.status(400).json({ error: 'At least one line item is required.' });
    return;
  }

  const plan = dbManager.get('SELECT * FROM subscription_plans WHERE id = ?', [plan_id]);
  if (!plan) {
    res.status(404).json({ error: 'Subscription plan not found.' });
    return;
  }

  const expDate = expiration_date || plan.end_date || addBillingInterval(start_date, 'YEARLY', 1);

  // Generate unique subscription number
  const countRow = dbManager.get('SELECT COUNT(*) as count FROM subscriptions');
  const nextNum = (countRow?.count || 0) + 1;
  const subscription_number = `SUB-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

  const subResult = dbManager.run(
    `INSERT INTO subscriptions (
       subscription_number, customer_id, plan_id, start_date, next_billing_date,
       expiration_date, billing_interval, payment_terms, status, renewal_policy, notes
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    [
      subscription_number,
      customer_id,
      plan_id,
      start_date,
      start_date, // Next billing begins on start date
      expDate,
      plan.billing_interval,
      payment_terms,
      renewal_policy,
      notes || null
    ]
  );

  const subId = subResult.lastInsertRowid;

  for (const line of lines) {
    const calc = calculateLine(
      Number(line.quantity) || 1,
      Number(line.unit_price) || 0,
      Number(line.variant_adjustment) || 0,
      Number(line.tax_rate) || 0,
      Number(line.discount_amount) || 0
    );

    dbManager.run(
      `INSERT INTO subscription_lines (
         subscription_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subId,
        line.product_id,
        line.variant_id || null,
        line.description || '',
        Number(line.quantity) || 1,
        calc.effectiveUnitPrice,
        calc.taxRate,
        calc.discountAmount,
        calc.lineTotal
      ]
    );
  }

  logActivity({
    entityType: 'SUBSCRIPTION',
    entityId: subId,
    action: 'CREATE',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { subscription_number, plan: plan.name }
  });

  res.status(201).json({
    message: 'Subscription created successfully.',
    id: subId,
    subscription_number
  });
});

// POST /api/subscriptions/:id/pause - Pause active subscription
subscriptionsRouter.post('/:id/pause', authorizeRoles('ADMIN', 'STAFF'), (req: AuthenticatedRequest, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const sub = dbManager.get(
    `SELECT s.*, p.allow_pause FROM subscriptions s JOIN subscription_plans p ON s.plan_id = p.id WHERE s.id = ?`,
    [id]
  );

  if (!sub) {
    res.status(404).json({ error: 'Subscription not found.' });
    return;
  }

  if (sub.status !== 'ACTIVE') {
    res.status(400).json({ error: `Cannot pause subscription currently in '${sub.status}' state. Only ACTIVE subscriptions can be paused.` });
    return;
  }

  if (sub.allow_pause === 0) {
    res.status(400).json({ error: 'This subscription plan does not permit pausing.' });
    return;
  }

  dbManager.run('UPDATE subscriptions SET status = "PAUSED", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

  logActivity({
    entityType: 'SUBSCRIPTION',
    entityId: id,
    action: 'PAUSE',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { subscription_number: sub.subscription_number }
  });

  res.json({ message: `Subscription ${sub.subscription_number} is now PAUSED.` });
});

// POST /api/subscriptions/:id/resume - Resume paused subscription
subscriptionsRouter.post('/:id/resume', authorizeRoles('ADMIN', 'STAFF'), (req: AuthenticatedRequest, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const sub = dbManager.get('SELECT * FROM subscriptions WHERE id = ?', [id]);

  if (!sub) {
    res.status(404).json({ error: 'Subscription not found.' });
    return;
  }

  if (sub.status !== 'PAUSED') {
    res.status(400).json({ error: `Cannot resume subscription that is in '${sub.status}' status.` });
    return;
  }

  dbManager.run('UPDATE subscriptions SET status = "ACTIVE", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

  logActivity({
    entityType: 'SUBSCRIPTION',
    entityId: id,
    action: 'RESUME',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { subscription_number: sub.subscription_number }
  });

  res.json({ message: `Subscription ${sub.subscription_number} has been resumed to ACTIVE.` });
});

// POST /api/subscriptions/:id/close - Close subscription
subscriptionsRouter.post('/:id/close', authorizeRoles('ADMIN', 'STAFF'), (req: AuthenticatedRequest, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const sub = dbManager.get(
    `SELECT s.*, p.allow_early_closure FROM subscriptions s JOIN subscription_plans p ON s.plan_id = p.id WHERE s.id = ?`,
    [id]
  );

  if (!sub) {
    res.status(404).json({ error: 'Subscription not found.' });
    return;
  }

  if (sub.status === 'CLOSED') {
    res.status(400).json({ error: 'Subscription is already closed.' });
    return;
  }

  dbManager.run('UPDATE subscriptions SET status = "CLOSED", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

  logActivity({
    entityType: 'SUBSCRIPTION',
    entityId: id,
    action: 'CLOSE',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { subscription_number: sub.subscription_number }
  });

  res.json({ message: `Subscription ${sub.subscription_number} has been CLOSED.` });
});

// POST /api/subscriptions/:id/renew - Explicit manual renewal
subscriptionsRouter.post('/:id/renew', authorizeRoles('ADMIN', 'STAFF'), (req: AuthenticatedRequest, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const sub = dbManager.get('SELECT * FROM subscriptions WHERE id = ?', [id]);

  if (!sub) {
    res.status(404).json({ error: 'Subscription not found.' });
    return;
  }

  if (sub.status === 'CLOSED') {
    res.status(400).json({ error: 'Cannot renew a CLOSED subscription.' });
    return;
  }

  // Extend expiration date by 1 year or 1 period
  const currentExp = sub.expiration_date || getTodayIso();
  const newExpiration = addBillingInterval(currentExp, 'YEARLY', 1);

  dbManager.run(
    'UPDATE subscriptions SET status = "ACTIVE", expiration_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newExpiration, id]
  );

  logActivity({
    entityType: 'SUBSCRIPTION',
    entityId: id,
    action: 'RENEW',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { new_expiration_date: newExpiration }
  });

  res.json({
    message: `Subscription ${sub.subscription_number} renewed until ${newExpiration}.`,
    newExpirationDate: newExpiration
  });
});
