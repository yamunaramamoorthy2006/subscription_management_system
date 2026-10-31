import { Router, Response } from 'express';
import { dbManager } from '../db/database';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { round2, getTodayIso } from '../utils/math';

export const reportsRouter = Router();

reportsRouter.use(authenticate);
reportsRouter.use(authorizeRoles('ADMIN', 'STAFF'));

// GET /api/reports/dashboard - Overview & Control Center metrics and Today's Operations
reportsRouter.get('/dashboard', (req: AuthenticatedRequest, res: Response): void => {
  const today = getTodayIso();

  // Summary Metrics
  const activeSubsRow = dbManager.get("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'ACTIVE'");
  const totalSubsRow = dbManager.get("SELECT COUNT(*) as count FROM subscriptions WHERE status != 'DRAFT'");
  const pausedSubsRow = dbManager.get("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'PAUSED'");

  // Financial aggregates
  const finRow = dbManager.get(`
    SELECT
      COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) AS total_invoiced,
      COALESCE(SUM(amount_paid), 0) AS total_collected,
      COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN amount_due ELSE 0 END), 0) AS total_outstanding,
      COALESCE(SUM(CASE WHEN status = 'OVERDUE' OR (status = 'CONFIRMED' AND due_date < DATE('now') AND amount_due > 0) THEN amount_due ELSE 0 END), 0) AS total_overdue
    FROM invoices
  `);

  // Direct payments collected check
  const paymentsCollectedRow = dbManager.get("SELECT COALESCE(SUM(amount), 0) AS collected FROM payments WHERE status = 'SUCCESS'");
  const collectedCash = round2(Number(paymentsCollectedRow?.collected || finRow?.total_collected || 0));

  // Upcoming renewals within next 14 days
  const upcomingRenewalsRow = dbManager.get(
    `SELECT COUNT(*) as count FROM subscriptions
     WHERE status = 'ACTIVE' AND next_billing_date >= DATE('now') AND next_billing_date <= DATE('now', '+14 days')`
  );

  // Today's Operations action items
  // 1. Overdue invoices
  const overdueInvoices = dbManager.query(
    `SELECT i.id, i.invoice_number, i.due_date, i.amount_due, c.name AS customer_name, 'OVERDUE_INVOICE' AS action_type
     FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     WHERE (i.status = 'OVERDUE' OR (i.status = 'CONFIRMED' AND i.due_date < DATE('now')))
       AND i.amount_due > 0
     ORDER BY i.due_date ASC LIMIT 5`
  );

  // 2. Subscriptions renewing soon (<= 7 days)
  const renewingSoon = dbManager.query(
    `SELECT s.id, s.subscription_number, s.next_billing_date, c.name AS customer_name, p.name AS plan_name, 'RENEWAL_SOON' AS action_type
     FROM subscriptions s
     JOIN customers c ON s.customer_id = c.id
     JOIN subscription_plans p ON s.plan_id = p.id
     WHERE s.status = 'ACTIVE' AND s.next_billing_date <= DATE('now', '+7 days')
     ORDER BY s.next_billing_date ASC LIMIT 5`
  );

  // 3. Draft invoices awaiting confirmation
  const draftInvoices = dbManager.query(
    `SELECT i.id, i.invoice_number, i.total_amount, c.name AS customer_name, 'DRAFT_INVOICE' AS action_type
     FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     WHERE i.status = 'DRAFT'
     ORDER BY i.id DESC LIMIT 5`
  );

  // 4. Draft quotations awaiting follow-up
  const draftQuotations = dbManager.query(
    `SELECT q.id, q.quotation_number, q.grand_total, c.name AS customer_name, 'DRAFT_QUOTATION' AS action_type
     FROM quotations q
     JOIN customers c ON q.customer_id = c.id
     WHERE q.status = 'DRAFT'
     ORDER BY q.id DESC LIMIT 5`
  );

  // 5. Expired or paused subscriptions needing review
  const pausedOrExpired = dbManager.query(
    `SELECT s.id, s.subscription_number, s.status, c.name AS customer_name, 'PAUSED_EXPIRED' AS action_type
     FROM subscriptions s
     JOIN customers c ON s.customer_id = c.id
     WHERE s.status IN ('PAUSED', 'EXPIRED')
     ORDER BY s.updated_at DESC LIMIT 5`
  );

  // Revenue over time (monthly aggregation)
  const monthlyRevenue = dbManager.query(`
    SELECT
      SUBSTR(payment_date, 1, 7) AS month,
      SUM(amount) AS collected
    FROM payments
    WHERE status = 'SUCCESS'
    GROUP BY month
    ORDER BY month ASC
    LIMIT 12
  `);

  // Subscriptions by status
  const subscriptionBreakdown = dbManager.query(`
    SELECT status, COUNT(*) AS count
    FROM subscriptions
    GROUP BY status
  `);

  // Invoices by status
  const invoiceBreakdown = dbManager.query(`
    SELECT
      CASE
        WHEN status = 'CONFIRMED' AND due_date < DATE('now') AND amount_due > 0 THEN 'OVERDUE'
        ELSE status
      END AS status_group,
      COUNT(*) AS count,
      SUM(total_amount) AS total_val,
      SUM(amount_due) AS due_val
    FROM invoices
    GROUP BY status_group
  `);

  res.json({
    metrics: {
      activeSubscriptions: Number(activeSubsRow?.count || 0),
      totalSubscriptions: Number(totalSubsRow?.count || 0),
      pausedSubscriptions: Number(pausedSubsRow?.count || 0),
      revenueCollected: collectedCash,
      totalInvoiced: round2(Number(finRow?.total_invoiced || 0)),
      outstandingReceivables: round2(Number(finRow?.total_outstanding || 0)),
      overdueReceivables: round2(Number(finRow?.total_overdue || 0)),
      upcomingRenewals: Number(upcomingRenewalsRow?.count || 0)
    },
    todaysOperations: {
      overdueInvoices,
      renewingSoon,
      draftInvoices,
      draftQuotations,
      pausedOrExpired
    },
    analytics: {
      monthlyRevenue,
      subscriptionBreakdown,
      invoiceBreakdown
    }
  });
});

// GET /api/reports/detailed - Comprehensive financial report breakdowns
reportsRouter.get('/detailed', (req: AuthenticatedRequest, res: Response): void => {
  // Payment methods breakdown
  const paymentMethods = dbManager.query(`
    SELECT payment_method, COUNT(*) AS transaction_count, SUM(amount) AS total_collected
    FROM payments
    WHERE status = 'SUCCESS'
    GROUP BY payment_method
    ORDER BY total_collected DESC
  `);

  // Top Customers by Invoiced & Paid
  const customerBreakdown = dbManager.query(`
    SELECT
      c.id, c.customer_code, c.name, c.email,
      COUNT(DISTINCT s.id) AS subscription_count,
      COALESCE(SUM(CASE WHEN i.status != 'CANCELLED' THEN i.total_amount ELSE 0 END), 0) AS total_invoiced,
      COALESCE(SUM(i.amount_paid), 0) AS total_paid,
      COALESCE(SUM(CASE WHEN i.status != 'CANCELLED' THEN i.amount_due ELSE 0 END), 0) AS balance_due
    FROM customers c
    LEFT JOIN subscriptions s ON s.customer_id = c.id
    LEFT JOIN invoices i ON i.customer_id = c.id
    WHERE c.status != 'ARCHIVED'
    GROUP BY c.id
    ORDER BY total_invoiced DESC
    LIMIT 25
  `);

  // Plan Revenue Contribution
  const planBreakdown = dbManager.query(`
    SELECT
      p.id, p.name, p.billing_interval, p.billing_price,
      COUNT(s.id) AS active_subscribers,
      ROUND(COUNT(s.id) * p.billing_price, 2) AS estimated_recurring_value
    FROM subscription_plans p
    LEFT JOIN subscriptions s ON s.plan_id = p.id AND s.status = 'ACTIVE'
    GROUP BY p.id
    ORDER BY estimated_recurring_value DESC
  `);

  // Discount Usages
  const discountStats = dbManager.query(`
    SELECT
      d.code, d.name, d.discount_type, d.value, d.current_usage_count, d.usage_limit,
      COALESCE(SUM(du.amount_saved), 0) AS total_discount_given
    FROM discounts d
    LEFT JOIN discount_usages du ON du.discount_id = d.id
    GROUP BY d.id
    ORDER BY total_discount_given DESC
  `);

  res.json({
    paymentMethods,
    customerBreakdown,
    planBreakdown,
    discountStats
  });
});

// GET /api/reports/export-csv - Generate CSV export of financial transactions
reportsRouter.get('/export-csv', (req: AuthenticatedRequest, res: Response): void => {
  const type = (req.query.type as string) || 'invoices';

  if (type === 'payments') {
    const rows = dbManager.query(`
      SELECT p.payment_reference, p.payment_date, c.name AS customer_name, i.invoice_number,
             p.amount, p.payment_method, p.transaction_reference, p.status
      FROM payments p
      JOIN customers c ON p.customer_id = c.id
      JOIN invoices i ON p.invoice_id = i.id
      ORDER BY p.id DESC
    `);

    let csv = 'Payment Reference,Date,Customer,Invoice,Amount,Method,Transaction Ref,Status\n';
    for (const r of rows) {
      csv += `"${r.payment_reference}","${r.payment_date}","${r.customer_name}","${r.invoice_number}",${Number(r.amount).toFixed(2)},"${r.payment_method}","${r.transaction_reference || ''}","${r.status}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="payments_report.csv"');
    res.send(csv);
    return;
  }

  // Default: invoices
  const rows = dbManager.query(`
    SELECT i.invoice_number, i.invoice_date, i.due_date, c.name AS customer_name,
           s.subscription_number, i.subtotal, i.discount_total, i.tax_total,
           i.total_amount, i.amount_paid, i.amount_due, i.status
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN subscriptions s ON i.subscription_id = s.id
    ORDER BY i.id DESC
  `);

  let csv = 'Invoice Number,Invoice Date,Due Date,Customer,Subscription,Subtotal,Discount,Tax,Total,Paid,Due,Status\n';
  for (const r of rows) {
    csv += `"${r.invoice_number}","${r.invoice_date}","${r.due_date}","${r.customer_name}","${r.subscription_number || 'Direct'}",${Number(r.subtotal).toFixed(2)},${Number(r.discount_total).toFixed(2)},${Number(r.tax_total).toFixed(2)},${Number(r.total_amount).toFixed(2)},${Number(r.amount_paid).toFixed(2)},${Number(r.amount_due).toFixed(2)},"${r.status}"\n`;
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="invoices_report.csv"');
  res.send(csv);
});
