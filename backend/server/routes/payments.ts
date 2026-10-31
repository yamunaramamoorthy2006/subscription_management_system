import { Router, Response } from 'express';
import { dbManager } from '../db/database';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { round2, getTodayIso } from '../utils/math';
import { logActivity, createNotification } from '../utils/audit';

export const paymentsRouter = Router();

paymentsRouter.use(authenticate);

// GET /api/payments - List payments with filtering
paymentsRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const { customer_id, invoice_id, method, status, search } = req.query;

  let sql = `
    SELECT p.*,
      c.name AS customer_name,
      c.email AS customer_email,
      c.customer_code,
      i.invoice_number,
      i.total_amount AS invoice_total,
      u.name AS recorded_by_name
    FROM payments p
    JOIN customers c ON p.customer_id = c.id
    JOIN invoices i ON p.invoice_id = i.id
    LEFT JOIN users u ON p.recorded_by_user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (req.user?.role === 'CUSTOMER') {
    sql += ` AND p.customer_id = ?`;
    params.push(req.user.customerId || -1);
  } else if (customer_id) {
    sql += ` AND p.customer_id = ?`;
    params.push(customer_id);
  }

  if (invoice_id) {
    sql += ` AND p.invoice_id = ?`;
    params.push(invoice_id);
  }

  if (method && method !== 'ALL') {
    sql += ` AND p.payment_method = ?`;
    params.push(method);
  }

  if (status && status !== 'ALL') {
    sql += ` AND p.status = ?`;
    params.push(status);
  }

  if (search) {
    sql += ` AND (p.payment_reference LIKE ? OR i.invoice_number LIKE ? OR c.name LIKE ? OR p.transaction_reference LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
  }

  sql += ` ORDER BY p.id DESC`;

  const payments = dbManager.query(sql, params);
  res.json({ payments });
});

// POST /api/payments - Record a payment against an invoice (ADMIN and STAFF)
paymentsRouter.post('/', authorizeRoles('ADMIN', 'STAFF'), (req: AuthenticatedRequest, res: Response): void => {
  const {
    invoice_id,
    amount,
    payment_date = getTodayIso(),
    payment_method = 'BANK_TRANSFER',
    transaction_reference,
    notes
  } = req.body;

  if (!invoice_id || amount === undefined) {
    res.status(400).json({ error: 'Invoice ID and payment amount are required.' });
    return;
  }

  const payAmount = round2(Number(amount));
  if (payAmount <= 0) {
    res.status(400).json({ error: 'Payment amount must be greater than zero.' });
    return;
  }

  const invoice = dbManager.get('SELECT * FROM invoices WHERE id = ?', [invoice_id]);
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found.' });
    return;
  }

  if (invoice.status === 'CANCELLED') {
    res.status(400).json({ error: 'Cannot record payments against a CANCELLED invoice.' });
    return;
  }

  if (invoice.status === 'DRAFT') {
    res.status(400).json({ error: 'Invoice must be CONFIRMED before payments can be recorded.' });
    return;
  }

  if (payAmount > Number(invoice.amount_due) + 0.001) {
    res.status(400).json({
      error: `Payment amount ($${payAmount.toFixed(2)}) exceeds current outstanding balance ($${Number(invoice.amount_due).toFixed(2)}).`
    });
    return;
  }

  // Prevent duplicate transaction reference if supplied
  if (transaction_reference && transaction_reference.trim()) {
    const existingRef = dbManager.get(
      'SELECT id FROM payments WHERE transaction_reference = ? AND status = "SUCCESS"',
      [transaction_reference.trim()]
    );
    if (existingRef) {
      res.status(409).json({ error: 'A payment record with this transaction reference already exists.' });
      return;
    }
  }

  // Generate unique payment reference
  const countRow = dbManager.get('SELECT COUNT(*) as count FROM payments');
  const nextNum = (countRow?.count || 0) + 1;
  const payment_reference = `PAY-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

  // Execute in transaction
  dbManager.transaction(() => {
    // 1. Insert payment
    dbManager.run(
      `INSERT INTO payments (
         payment_reference, invoice_id, customer_id, amount, payment_date,
         payment_method, transaction_reference, notes, recorded_by_user_id, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESS')`,
      [
        payment_reference,
        invoice.id,
        invoice.customer_id,
        payAmount,
        payment_date,
        payment_method,
        transaction_reference ? transaction_reference.trim() : null,
        notes || null,
        req.user?.id || null
      ]
    );

    // 2. Update invoice balances
    const newPaid = round2(Number(invoice.amount_paid) + payAmount);
    const newDue = Math.max(0, round2(Number(invoice.total_amount) - newPaid));
    const newStatus = newDue <= 0.001 ? 'PAID' : 'CONFIRMED';

    dbManager.run(
      'UPDATE invoices SET amount_paid = ?, amount_due = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newPaid, newDue, newStatus, invoice.id]
    );
  });

  logActivity({
    entityType: 'PAYMENT',
    action: 'RECORD',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { payment_reference, invoice_number: invoice.invoice_number, amount: payAmount, method: payment_method }
  });

  createNotification({
    title: 'Payment Recorded',
    message: `Received $${payAmount.toFixed(2)} for ${invoice.invoice_number} via ${payment_method}.`,
    type: 'SUCCESS',
    link: `/invoices/${invoice.id}`
  });

  res.status(201).json({
    message: 'Payment recorded successfully.',
    payment_reference,
    amount: payAmount
  });
});

// POST /api/payments/:id/reverse - Controlled audit reversal of a payment (ADMIN only)
paymentsRouter.post('/:id/reverse', authorizeRoles('ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const payment = dbManager.get('SELECT * FROM payments WHERE id = ?', [id]);

  if (!payment) {
    res.status(404).json({ error: 'Payment record not found.' });
    return;
  }

  if (payment.status === 'REVERSED') {
    res.status(400).json({ error: 'This payment has already been reversed.' });
    return;
  }

  const invoice = dbManager.get('SELECT * FROM invoices WHERE id = ?', [payment.invoice_id]);
  if (!invoice) {
    res.status(404).json({ error: 'Linked invoice not found.' });
    return;
  }

  const reversalReason = req.body.reason || 'Administrative correction';

  dbManager.transaction(() => {
    // 1. Mark payment reversed
    dbManager.run(
      'UPDATE payments SET status = "REVERSED", notes = COALESCE(notes || " | ", "") || ? WHERE id = ?',
      [`Reversed: ${reversalReason}`, id]
    );

    // 2. Adjust invoice balances
    const newPaid = Math.max(0, round2(Number(invoice.amount_paid) - Number(payment.amount)));
    const newDue = round2(Number(invoice.total_amount) - newPaid);
    const newStatus = 'CONFIRMED';

    dbManager.run(
      'UPDATE invoices SET amount_paid = ?, amount_due = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newPaid, newDue, newStatus, invoice.id]
    );
  });

  logActivity({
    entityType: 'PAYMENT',
    entityId: id,
    action: 'REVERSE',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { payment_reference: payment.payment_reference, amount: payment.amount, reason: reversalReason }
  });

  res.json({ message: `Payment ${payment.payment_reference} reversed successfully.` });
});
