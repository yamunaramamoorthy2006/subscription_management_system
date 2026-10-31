import { Router, Response } from 'express';
import { dbManager } from '../db/database';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { calculateLine, round2, addBillingInterval, getTodayIso } from '../utils/math';
import { logActivity, createNotification } from '../utils/audit';

export const quotationsRouter = Router();

quotationsRouter.use(authenticate);
quotationsRouter.use(authorizeRoles('ADMIN', 'STAFF'));

// GET /api/quotations - List quotations with filtering
quotationsRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const { status, customer_id, search } = req.query;

  let sql = `
    SELECT q.*, c.name AS customer_name, c.email AS customer_email, p.name AS plan_name
    FROM quotations q
    JOIN customers c ON q.customer_id = c.id
    LEFT JOIN subscription_plans p ON q.plan_id = p.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status && status !== 'ALL') {
    sql += ` AND q.status = ?`;
    params.push(status);
  }

  if (customer_id) {
    sql += ` AND q.customer_id = ?`;
    params.push(customer_id);
  }

  if (search) {
    sql += ` AND (q.quotation_number LIKE ? OR c.name LIKE ? OR c.email LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  sql += ` ORDER BY q.id DESC`;

  const quotations = dbManager.query(sql, params);
  res.json({ quotations });
});

// GET /api/quotations/:id - Detailed quotation with lines
quotationsRouter.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const quotation = dbManager.get(
    `SELECT q.*, c.name AS customer_name, c.email AS customer_email, c.billing_address, c.tax_id, p.name AS plan_name, p.billing_interval
     FROM quotations q
     JOIN customers c ON q.customer_id = c.id
     LEFT JOIN subscription_plans p ON q.plan_id = p.id
     WHERE q.id = ?`,
    [id]
  );

  if (!quotation) {
    res.status(404).json({ error: 'Quotation not found.' });
    return;
  }

  const lines = dbManager.query(
    `SELECT ql.*, prod.name AS product_name, prod.code AS product_code, pv.variant_name
     FROM quotation_lines ql
     JOIN products prod ON ql.product_id = prod.id
     LEFT JOIN product_variants pv ON ql.variant_id = pv.id
     WHERE ql.quotation_id = ?
     ORDER BY ql.id ASC`,
    [id]
  );

  res.json({ quotation, lines });
});

// POST /api/quotations - Create quotation
quotationsRouter.post('/', (req: AuthenticatedRequest, res: Response): void => {
  const {
    customer_id,
    plan_id,
    quotation_date = getTodayIso(),
    expiration_date,
    payment_terms = 'NET30',
    notes,
    lines = []
  } = req.body;

  if (!customer_id) {
    res.status(400).json({ error: 'Customer is required.' });
    return;
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    res.status(400).json({ error: 'At least one line item is required.' });
    return;
  }

  const customer = dbManager.get('SELECT id, name FROM customers WHERE id = ?', [customer_id]);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }

  const expDate = expiration_date || addBillingInterval(quotation_date, 'MONTHLY', 1);

  // Generate unique quotation number
  const countRow = dbManager.get('SELECT COUNT(*) as count FROM quotations');
  const nextNum = (countRow?.count || 0) + 1;
  const quotation_number = `QT-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

  // Calculate totals
  let subtotal = 0;
  let discount_total = 0;
  let tax_total = 0;
  let grand_total = 0;

  const calculatedLines = lines.map((line: any) => {
    const calc = calculateLine(
      Number(line.quantity) || 1,
      Number(line.unit_price) || 0,
      Number(line.variant_adjustment) || 0,
      Number(line.tax_rate) || 0,
      Number(line.discount_amount) || 0
    );

    subtotal = round2(subtotal + calc.subtotal);
    discount_total = round2(discount_total + calc.discountAmount);
    tax_total = round2(tax_total + calc.taxAmount);
    grand_total = round2(grand_total + calc.lineTotal);

    return {
      productId: line.product_id,
      variantId: line.variant_id || null,
      description: line.description || '',
      quantity: Number(line.quantity) || 1,
      unitPrice: calc.effectiveUnitPrice,
      taxRate: calc.taxRate,
      discountAmount: calc.discountAmount,
      lineTotal: calc.lineTotal
    };
  });

  const quotationResult = dbManager.run(
    `INSERT INTO quotations (
       quotation_number, customer_id, plan_id, quotation_date, expiration_date, payment_terms,
       status, subtotal, discount_total, tax_total, grand_total, notes
     ) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)`,
    [
      quotation_number,
      customer_id,
      plan_id || null,
      quotation_date,
      expDate,
      payment_terms,
      subtotal,
      discount_total,
      tax_total,
      grand_total,
      notes || null
    ]
  );

  const quotationId = quotationResult.lastInsertRowid;

  for (const line of calculatedLines) {
    dbManager.run(
      `INSERT INTO quotation_lines (
         quotation_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quotationId,
        line.productId,
        line.variantId,
        line.description,
        line.quantity,
        line.unitPrice,
        line.taxRate,
        line.discountAmount,
        line.lineTotal
      ]
    );
  }

  logActivity({
    entityType: 'QUOTATION',
    entityId: quotationId,
    action: 'CREATE',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { quotation_number, customer_id, grand_total }
  });

  res.status(201).json({
    message: 'Quotation created successfully.',
    id: quotationId,
    quotation_number
  });
});

// PUT /api/quotations/:id - Update quotation
quotationsRouter.put('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const quotationId = parseInt(req.params.id, 10);
  const existing = dbManager.get('SELECT * FROM quotations WHERE id = ?', [quotationId]);

  if (!existing) {
    res.status(404).json({ error: 'Quotation not found.' });
    return;
  }

  if (existing.status === 'CONFIRMED' && existing.converted_subscription_id) {
    res.status(400).json({ error: 'Cannot modify a quotation that has already been converted into a subscription.' });
    return;
  }

  const {
    customer_id,
    plan_id,
    quotation_date,
    expiration_date,
    payment_terms,
    notes,
    status,
    lines
  } = req.body;

  let subtotal = existing.subtotal;
  let discount_total = existing.discount_total;
  let tax_total = existing.tax_total;
  let grand_total = existing.grand_total;

  if (Array.isArray(lines) && lines.length > 0) {
    subtotal = 0;
    discount_total = 0;
    tax_total = 0;
    grand_total = 0;

    dbManager.run('DELETE FROM quotation_lines WHERE quotation_id = ?', [quotationId]);

    for (const line of lines) {
      const calc = calculateLine(
        Number(line.quantity) || 1,
        Number(line.unit_price) || 0,
        Number(line.variant_adjustment) || 0,
        Number(line.tax_rate) || 0,
        Number(line.discount_amount) || 0
      );

      subtotal = round2(subtotal + calc.subtotal);
      discount_total = round2(discount_total + calc.discountAmount);
      tax_total = round2(tax_total + calc.taxAmount);
      grand_total = round2(grand_total + calc.lineTotal);

      dbManager.run(
        `INSERT INTO quotation_lines (
           quotation_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          quotationId,
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
  }

  dbManager.run(
    `UPDATE quotations
     SET customer_id = COALESCE(?, customer_id),
         plan_id = COALESCE(?, plan_id),
         quotation_date = COALESCE(?, quotation_date),
         expiration_date = COALESCE(?, expiration_date),
         payment_terms = COALESCE(?, payment_terms),
         notes = COALESCE(?, notes),
         status = COALESCE(?, status),
         subtotal = ?,
         discount_total = ?,
         tax_total = ?,
         grand_total = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      customer_id || null,
      plan_id || null,
      quotation_date || null,
      expiration_date || null,
      payment_terms || null,
      notes !== undefined ? notes : null,
      status || null,
      subtotal,
      discount_total,
      tax_total,
      grand_total,
      quotationId
    ]
  );

  logActivity({
    entityType: 'QUOTATION',
    entityId: quotationId,
    action: 'UPDATE',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { status: status || existing.status, grand_total }
  });

  res.json({ message: 'Quotation updated successfully.' });
});

// POST /api/quotations/:id/confirm - Confirm quotation
quotationsRouter.post('/:id/confirm', (req: AuthenticatedRequest, res: Response): void => {
  const quotationId = parseInt(req.params.id, 10);
  const quotation = dbManager.get('SELECT * FROM quotations WHERE id = ?', [quotationId]);

  if (!quotation) {
    res.status(404).json({ error: 'Quotation not found.' });
    return;
  }

  dbManager.run('UPDATE quotations SET status = "CONFIRMED", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [quotationId]);

  logActivity({
    entityType: 'QUOTATION',
    entityId: quotationId,
    action: 'CONFIRM',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { quotation_number: quotation.quotation_number }
  });

  res.json({ message: 'Quotation confirmed successfully.' });
});

// POST /api/quotations/:id/convert - Convert confirmed quotation to subscription (duplicate safe)
quotationsRouter.post('/:id/convert', (req: AuthenticatedRequest, res: Response): void => {
  const quotationId = parseInt(req.params.id, 10);
  const quotation = dbManager.get('SELECT * FROM quotations WHERE id = ?', [quotationId]);

  if (!quotation) {
    res.status(404).json({ error: 'Quotation not found.' });
    return;
  }

  // Duplicate conversion guard
  if (quotation.converted_subscription_id) {
    const existingSub = dbManager.get('SELECT subscription_number FROM subscriptions WHERE id = ?', [
      quotation.converted_subscription_id
    ]);
    res.status(409).json({
      error: `This quotation has already been converted to Subscription ${existingSub?.subscription_number || quotation.converted_subscription_id}. Duplicate conversion is prevented.`
    });
    return;
  }

  if (quotation.status !== 'CONFIRMED') {
    res.status(400).json({ error: 'Quotation must be in CONFIRMED status before converting to a subscription.' });
    return;
  }

  if (!quotation.plan_id) {
    res.status(400).json({ error: 'Quotation must specify a subscription plan to convert into a subscription.' });
    return;
  }

  const plan = dbManager.get('SELECT * FROM subscription_plans WHERE id = ?', [quotation.plan_id]);
  if (!plan) {
    res.status(400).json({ error: 'Selected subscription plan is invalid or has been removed.' });
    return;
  }

  const lines = dbManager.query('SELECT * FROM quotation_lines WHERE quotation_id = ?', [quotationId]);
  if (lines.length === 0) {
    res.status(400).json({ error: 'Quotation has no line items.' });
    return;
  }

  // Subscription start date is today
  const startDate = getTodayIso();
  const nextBillingDate = startDate; // First billing is due on start
  const expirationDate = plan.end_date || addBillingInterval(startDate, 'YEARLY', 1);

  // Generate subscription number
  const subCountRow = dbManager.get('SELECT COUNT(*) as count FROM subscriptions');
  const nextSubNum = (subCountRow?.count || 0) + 1;
  const subscription_number = `SUB-${new Date().getFullYear()}-${String(nextSubNum).padStart(4, '0')}`;

  const subResult = dbManager.run(
    `INSERT INTO subscriptions (
       subscription_number, customer_id, plan_id, start_date, next_billing_date,
       expiration_date, billing_interval, payment_terms, status, renewal_policy, notes
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    [
      subscription_number,
      quotation.customer_id,
      quotation.plan_id,
      startDate,
      nextBillingDate,
      expirationDate,
      plan.billing_interval,
      quotation.payment_terms || 'NET30',
      plan.renewal_policy,
      `Converted from quotation ${quotation.quotation_number}. ${quotation.notes || ''}`.trim()
    ]
  );

  const newSubId = subResult.lastInsertRowid;

  // Copy quotation lines to subscription lines
  for (const line of lines) {
    dbManager.run(
      `INSERT INTO subscription_lines (
         subscription_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newSubId,
        line.product_id,
        line.variant_id,
        line.description,
        line.quantity,
        line.unit_price,
        line.tax_rate,
        line.discount_amount,
        line.line_total
      ]
    );
  }

  // Mark quotation as converted to prevent duplicate conversion
  dbManager.run('UPDATE quotations SET converted_subscription_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
    newSubId,
    quotationId
  ]);

  logActivity({
    entityType: 'SUBSCRIPTION',
    entityId: newSubId,
    action: 'CONVERT_FROM_QUOTATION',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { subscription_number, quotation_number: quotation.quotation_number }
  });

  createNotification({
    title: 'Quotation Converted',
    message: `Quotation ${quotation.quotation_number} successfully converted to Subscription ${subscription_number}.`,
    type: 'SUCCESS',
    link: `/subscriptions`
  });

  res.status(201).json({
    message: 'Quotation converted successfully into an active subscription.',
    subscriptionId: newSubId,
    subscription_number
  });
});
