import { Router, Response } from 'express';
import { dbManager } from '../db/database';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { calculateLine, round2, addBillingInterval, getTodayIso } from '../utils/math';
import { logActivity, createNotification } from '../utils/audit';

export const billingRouter = Router();

billingRouter.use(authenticate);

// GET /api/billing/runs - View billing run history
billingRouter.get('/runs', authorizeRoles('ADMIN', 'STAFF'), (req: AuthenticatedRequest, res: Response): void => {
  const runs = dbManager.query(
    `SELECT b.*, u.name AS triggered_by_user_name
     FROM billing_runs b
     LEFT JOIN users u ON b.triggered_by_user_id = u.id
     ORDER BY b.id DESC LIMIT 50`
  );
  res.json({ runs });
});

// GET /api/billing/eligible - Preview subscriptions currently eligible for billing
billingRouter.get('/eligible', authorizeRoles('ADMIN', 'STAFF'), (req: AuthenticatedRequest, res: Response): void => {
  const targetDate = (req.query.target_date as string) || getTodayIso();

  const eligibleSubs = dbManager.query(
    `SELECT s.*, c.name AS customer_name, c.email AS customer_email, p.name AS plan_name,
       (SELECT COALESCE(SUM(line_total), 0) FROM subscription_lines WHERE subscription_id = s.id) AS recurring_amount,
       (SELECT COUNT(*) FROM invoices i WHERE i.subscription_id = s.id AND i.billing_period_start = s.next_billing_date) AS already_invoiced_for_period
     FROM subscriptions s
     JOIN customers c ON s.customer_id = c.id
     JOIN subscription_plans p ON s.plan_id = p.id
     WHERE s.status = 'ACTIVE'
       AND s.next_billing_date <= ?
       AND (s.expiration_date IS NULL OR s.next_billing_date <= s.expiration_date)
     ORDER BY s.next_billing_date ASC`,
    [targetDate]
  );

  res.json({
    targetDate,
    eligibleCount: eligibleSubs.length,
    subscriptions: eligibleSubs
  });
});

// POST /api/billing/run - Execute automated recurring billing run with critical safeguards
billingRouter.post('/run', authorizeRoles('ADMIN', 'STAFF'), (req: AuthenticatedRequest, res: Response): void => {
  const targetDate = (req.body.target_date as string) || getTodayIso();

  // Find all active subscriptions where next_billing_date is on or before targetDate
  const eligibleSubs = dbManager.query(
    `SELECT s.*, p.name AS plan_name, p.auto_close_on_expiry
     FROM subscriptions s
     JOIN subscription_plans p ON s.plan_id = p.id
     WHERE s.status = 'ACTIVE'
       AND s.next_billing_date <= ?
     ORDER BY s.id ASC`,
    [targetDate]
  );

  let invoicesCreated = 0;
  let skippedCount = 0;
  const executionLogs: Array<{ subscriptionId: number; subscriptionNumber: string; status: string; reason?: string; invoiceNumber?: string }> = [];

  for (const sub of eligibleSubs) {
    try {
      // SAFEGUARD 1: Check if subscription has expired
      if (sub.expiration_date && sub.next_billing_date > sub.expiration_date) {
        if (sub.auto_close_on_expiry) {
          dbManager.run('UPDATE subscriptions SET status = "EXPIRED", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sub.id]);
          logActivity({
            entityType: 'SUBSCRIPTION',
            entityId: sub.id,
            action: 'AUTO_EXPIRE',
            details: { reason: 'Exceeded expiration date with auto_close_on_expiry enabled.' }
          });
        }
        skippedCount++;
        executionLogs.push({
          subscriptionId: sub.id,
          subscriptionNumber: sub.subscription_number,
          status: 'SKIPPED',
          reason: 'Subscription exceeded expiration date.'
        });
        continue;
      }

      const periodStart = sub.next_billing_date;
      const periodEnd = addBillingInterval(periodStart, sub.billing_interval, 1);

      // SAFEGUARD 2: Critical duplicate invoice prevention for same billing period
      const existingInvoice = dbManager.get(
        `SELECT id, invoice_number FROM invoices WHERE subscription_id = ? AND billing_period_start = ?`,
        [sub.id, periodStart]
      );

      if (existingInvoice) {
        skippedCount++;
        executionLogs.push({
          subscriptionId: sub.id,
          subscriptionNumber: sub.subscription_number,
          status: 'SKIPPED',
          reason: `Invoice ${existingInvoice.invoice_number} already generated for billing period starting ${periodStart}. Duplicate generation blocked.`
        });
        continue;
      }

      // Fetch subscription lines
      const lines = dbManager.query('SELECT * FROM subscription_lines WHERE subscription_id = ?', [sub.id]);
      if (lines.length === 0) {
        skippedCount++;
        executionLogs.push({
          subscriptionId: sub.id,
          subscriptionNumber: sub.subscription_number,
          status: 'SKIPPED',
          reason: 'Subscription has no configured line items.'
        });
        continue;
      }

      // Calculate totals
      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;
      let grandTotal = 0;

      const preparedLines = lines.map((l: any) => {
        const calc = calculateLine(
          Number(l.quantity) || 1,
          Number(l.unit_price) || 0,
          0,
          Number(l.tax_rate) || 0,
          Number(l.discount_amount) || 0
        );

        subtotal = round2(subtotal + calc.subtotal);
        discountTotal = round2(discountTotal + calc.discountAmount);
        taxTotal = round2(taxTotal + calc.taxAmount);
        grandTotal = round2(grandTotal + calc.lineTotal);

        return {
          productId: l.product_id,
          variantId: l.variant_id,
          description: l.description,
          quantity: l.quantity,
          unitPrice: calc.effectiveUnitPrice,
          taxRate: calc.taxRate,
          discountAmount: calc.discountAmount,
          lineTotal: calc.lineTotal
        };
      });

      // Calculate invoice and due dates
      const invoiceDate = targetDate;
      let dueDate = addBillingInterval(invoiceDate, 'MONTHLY', 1); // default NET30
      if (sub.payment_terms === 'NET15') {
        dueDate = addBillingInterval(invoiceDate, 'DAILY', 15);
      } else if (sub.payment_terms === 'DUE_ON_RECEIPT') {
        dueDate = invoiceDate;
      }

      // Generate unique invoice number
      const countRow = dbManager.get('SELECT COUNT(*) as count FROM invoices');
      const nextInvNum = (countRow?.count || 0) + 1;
      const invoice_number = `INV-${new Date().getFullYear()}-${String(nextInvNum).padStart(4, '0')}`;

      // Insert invoice in CONFIRMED state with amount_due = grandTotal
      const invResult = dbManager.run(
        `INSERT INTO invoices (
           invoice_number, customer_id, subscription_id, billing_period_start, billing_period_end,
           invoice_date, due_date, status, subtotal, discount_total, tax_total, total_amount, amount_paid, amount_due, notes
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, ?, 0.0, ?, ?)`,
        [
          invoice_number,
          sub.customer_id,
          sub.id,
          periodStart,
          periodEnd,
          invoiceDate,
          dueDate,
          subtotal,
          discountTotal,
          taxTotal,
          grandTotal,
          grandTotal,
          `Automated recurring billing invoice for period ${periodStart} to ${periodEnd}.`
        ]
      );

      const invoiceId = invResult.lastInsertRowid;

      for (const line of preparedLines) {
        dbManager.run(
          `INSERT INTO invoice_lines (
             invoice_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceId,
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

      // Advance subscription next_billing_date to periodEnd
      dbManager.run(
        'UPDATE subscriptions SET next_billing_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [periodEnd, sub.id]
      );

      invoicesCreated++;
      executionLogs.push({
        subscriptionId: sub.id,
        subscriptionNumber: sub.subscription_number,
        status: 'SUCCESS',
        invoiceNumber: invoice_number
      });

      logActivity({
        entityType: 'INVOICE',
        entityId: invoiceId,
        action: 'GENERATE_RECURRING',
        userId: req.user?.id,
        userName: req.user?.name,
        details: { invoice_number, subscription_number: sub.subscription_number, total_amount: grandTotal }
      });
    } catch (err: any) {
      skippedCount++;
      executionLogs.push({
        subscriptionId: sub.id,
        subscriptionNumber: sub.subscription_number,
        status: 'ERROR',
        reason: err.message || 'Unknown error occurred during invoice generation.'
      });
    }
  }

  // Record billing run history
  const runResult = dbManager.run(
    `INSERT INTO billing_runs (run_date, triggered_by_user_id, eligible_count, invoices_created_count, skipped_count, details_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      targetDate,
      req.user?.id || null,
      eligibleSubs.length,
      invoicesCreated,
      skippedCount,
      JSON.stringify(executionLogs)
    ]
  );

  createNotification({
    title: 'Billing Run Completed',
    message: `Processed ${eligibleSubs.length} eligible subscription(s). Generated ${invoicesCreated} invoice(s), skipped ${skippedCount}.`,
    type: invoicesCreated > 0 ? 'SUCCESS' : 'INFO',
    link: '/invoices'
  });

  res.json({
    message: 'Recurring billing run completed.',
    runId: runResult.lastInsertRowid,
    runDate: targetDate,
    eligibleCount: eligibleSubs.length,
    invoicesCreated,
    skippedCount,
    logs: executionLogs
  });
});
