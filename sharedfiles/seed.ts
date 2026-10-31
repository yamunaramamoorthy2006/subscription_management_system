import bcrypt from 'bcryptjs';
import { dbManager } from './database';
import { addBillingInterval, getTodayIso, round2 } from '../utils/math';

export function seedDatabase(force: boolean = false): void {
  // Check if users already exist
  const existingUsers = dbManager.get('SELECT COUNT(*) as count FROM users');
  if (existingUsers && existingUsers.count > 0 && !force) {
    console.log('Database already populated with seed data.');
    return;
  }

  console.log('Seeding Subscription OS with realistic enterprise data...');

  if (force) {
    dbManager.exec(`
      DELETE FROM discount_usages;
      DELETE FROM payments;
      DELETE FROM invoice_lines;
      DELETE FROM invoices;
      DELETE FROM subscription_lines;
      DELETE FROM subscriptions;
      DELETE FROM quotation_lines;
      DELETE FROM quotations;
      DELETE FROM discounts;
      DELETE FROM product_variants;
      DELETE FROM products;
      DELETE FROM subscription_plans;
      DELETE FROM taxes;
      DELETE FROM users;
      DELETE FROM customers;
      DELETE FROM billing_runs;
      DELETE FROM activity_logs;
      DELETE FROM notifications;
      DELETE FROM sqlite_sequence;
    `);
  }

  const today = getTodayIso();
  const salt = bcrypt.genSaltSync(10);
  const adminPass = bcrypt.hashSync('BrightloopAdmin2026!', salt);
  const staffPass = bcrypt.hashSync('BrightloopStaff2026!', salt);
  const custPass = bcrypt.hashSync('CustomerUser2026!', salt);

  dbManager.transaction(() => {
    // 1. Company Settings
    dbManager.run(`
      INSERT OR REPLACE INTO company_settings (id, company_name, support_email, phone, address, currency, tax_id)
      VALUES (1, 'Brightloop Software', 'billing@brightloop.io', '+1 (800) 555-0199', '100 Innovation Way, Suite 400, San Francisco, CA 94105', 'USD', 'US-84920491')
    `);

    // 2. Taxes
    const vatRes = dbManager.run('INSERT INTO taxes (name, rate, is_active, is_default) VALUES (?, ?, 1, 0)', ['VAT (20%)', 20.0]);
    const salesTaxRes = dbManager.run('INSERT INTO taxes (name, rate, is_active, is_default) VALUES (?, ?, 1, 1)', ['US State Tax (8.5%)', 8.5]);
    const zeroTaxRes = dbManager.run('INSERT INTO taxes (name, rate, is_active, is_default) VALUES (?, ?, 1, 0)', ['Exempt / Zero Tax (0%)', 0.0]);

    const salesTaxId = salesTaxRes.lastInsertRowid;
    const vatTaxId = vatRes.lastInsertRowid;

    // 3. Customers
    const c1 = dbManager.run(
      `INSERT INTO customers (customer_code, name, email, phone, billing_address, tax_id, customer_type, status, internal_notes)
       VALUES (?, ?, ?, ?, ?, ?, 'BUSINESS', 'ACTIVE', ?)`,
      ['CUST-1001', 'Acme Cloud Technologies', 'sarah.connor@acmecloud.io', '+1 (555) 234-5678', '450 Mission St, San Francisco, CA 94105', 'US-77889911', 'Enterprise key customer, high retention.']
    ).lastInsertRowid;

    const c2 = dbManager.run(
      `INSERT INTO customers (customer_code, name, email, phone, billing_address, tax_id, customer_type, status, internal_notes)
       VALUES (?, ?, ?, ?, ?, ?, 'BUSINESS', 'ACTIVE', ?)`,
      ['CUST-1002', 'Apex Dynamics AI', 'alex.rivers@apexdynamics.io', '+1 (555) 345-6789', '800 Boylston St, Boston, MA 02199', 'US-44332211', 'Fast-growing AI research lab.']
    ).lastInsertRowid;

    const c3 = dbManager.run(
      `INSERT INTO customers (customer_code, name, email, phone, billing_address, tax_id, customer_type, status, internal_notes)
       VALUES (?, ?, ?, ?, ?, ?, 'BUSINESS', 'ACTIVE', ?)`,
      ['CUST-1003', 'Nova Financial Global', 'finance@novaglobal.com', '+44 20 7946 0912', '1 Canada Square, Canary Wharf, London, UK', 'GB-99882211', 'Tier-1 investment bank with strict SLA.']
    ).lastInsertRowid;

    const c4 = dbManager.run(
      `INSERT INTO customers (customer_code, name, email, phone, billing_address, tax_id, customer_type, status, internal_notes)
       VALUES (?, ?, ?, ?, ?, ?, 'INDIVIDUAL', 'ACTIVE', ?)`,
      ['CUST-1004', 'David Miller (Solo Architect)', 'david.miller@cloudeng.me', '+1 (555) 887-1290', '1200 Pine St, Seattle, WA 98101', null, 'Pro consultant on monthly plan.']
    ).lastInsertRowid;

    const c5 = dbManager.run(
      `INSERT INTO customers (customer_code, name, email, phone, billing_address, tax_id, customer_type, status, internal_notes)
       VALUES (?, ?, ?, ?, ?, ?, 'BUSINESS', 'ACTIVE', ?)`,
      ['CUST-1005', 'Solaria Health Systems', 'procurement@solariahealth.org', '+1 (555) 912-3344', '77 Medical Center Blvd, Chicago, IL 60611', 'US-11223344', 'HIPAA compliant cloud deployment.']
    ).lastInsertRowid;

    // 4. Users
    // Admin
    dbManager.run(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Elena Vance (Admin)', 'admin@brightloop.io', adminPass, 'ADMIN']
    );

    // Staff
    dbManager.run(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Marcus Brody (Billing Ops)', 'staff@brightloop.io', staffPass, 'STAFF']
    );

    // Customer
    dbManager.run(
      'INSERT INTO users (name, email, password_hash, role, customer_id) VALUES (?, ?, ?, ?, ?)',
      ['Sarah Connor (Acme Cloud)', 'sarah.connor@acmecloud.io', custPass, 'CUSTOMER', c1]
    );

    // 5. Products & Variants
    // Product 1: Brightloop OS Platform
    const p1 = dbManager.run(
      `INSERT INTO products (code, name, product_type, sales_price, cost_price, description, status, tax_rate_id)
       VALUES (?, ?, 'SOFTWARE', 199.00, 45.00, ?, 'ACTIVE', ?)`,
      ['PROD-BL-OS', 'Brightloop Cloud Core Platform', 'Core multi-tenant subscription engine and orchestration.', salesTaxId]
    ).lastInsertRowid;

    dbManager.run('INSERT INTO product_variants (product_id, variant_name, price_adjustment, is_default) VALUES (?, ?, 0.0, 1)', [p1, 'Standard Instance']);
    dbManager.run('INSERT INTO product_variants (product_id, variant_name, price_adjustment, is_default) VALUES (?, ?, 150.0, 0)', [p1, 'High-Availability Cluster (+ $150)']);
    dbManager.run('INSERT INTO product_variants (product_id, variant_name, price_adjustment, is_default) VALUES (?, ?, 400.0, 0)', [p1, 'Dedicated Private VPC (+ $400)']);

    // Product 2: Analytics & Intelligence Addon
    const p2 = dbManager.run(
      `INSERT INTO products (code, name, product_type, sales_price, cost_price, description, status, tax_rate_id)
       VALUES (?, ?, 'ADDON', 79.00, 15.00, ?, 'ACTIVE', ?)`,
      ['PROD-BL-AI', 'Predictive Revenue & Churn Analytics', 'Machine learning based renewal probability and MRR metrics.', salesTaxId]
    ).lastInsertRowid;

    dbManager.run('INSERT INTO product_variants (product_id, variant_name, price_adjustment, is_default) VALUES (?, ?, 0.0, 1)', [p2, 'Standard 100k Events']);
    dbManager.run('INSERT INTO product_variants (product_id, variant_name, price_adjustment, is_default) VALUES (?, ?, 80.0, 0)', [p2, 'High-Throughput 1M Events (+ $80)']);

    // Product 3: 24/7 Dedicated Support & SLA
    const p3 = dbManager.run(
      `INSERT INTO products (code, name, product_type, sales_price, cost_price, description, status, tax_rate_id)
       VALUES (?, ?, 'SERVICE', 250.00, 75.00, ?, 'ACTIVE', ?)`,
      ['PROD-BL-SLA', 'Enterprise 24/7 Priority Support SLA', 'Guaranteed 15-minute response time with assigned technical account manager.', zeroTaxRes.lastInsertRowid]
    ).lastInsertRowid;

    dbManager.run('INSERT INTO product_variants (product_id, variant_name, price_adjustment, is_default) VALUES (?, ?, 0.0, 1)', [p3, 'Standard 99.9% SLA']);
    dbManager.run('INSERT INTO product_variants (product_id, variant_name, price_adjustment, is_default) VALUES (?, ?, 250.0, 0)', [p3, 'Mission-Critical 99.99% SLA (+ $250)']);

    // 6. Subscription Plans
    const planMonthly = dbManager.run(
      `INSERT INTO subscription_plans (code, name, description, billing_interval, billing_price, minimum_quantity, start_date, auto_close_on_expiry, allow_early_closure, allow_pause, renewal_policy, status)
       VALUES (?, ?, ?, 'MONTHLY', 199.00, 1, '2026-01-01', 0, 1, 1, 'AUTO_RENEW', 'ACTIVE')`,
      ['PLAN-PRO-M', 'Professional Monthly Cloud', 'Monthly recurring plan with standard support and core billing tools.']
    ).lastInsertRowid;

    const planAnnual = dbManager.run(
      `INSERT INTO subscription_plans (code, name, description, billing_interval, billing_price, minimum_quantity, start_date, auto_close_on_expiry, allow_early_closure, allow_pause, renewal_policy, status)
       VALUES (?, ?, ?, 'YEARLY', 1990.00, 1, '2026-01-01', 0, 1, 1, 'AUTO_RENEW', 'ACTIVE')`,
      ['PLAN-ENT-Y', 'Enterprise Annual Dedicated', 'Annual billing with 2 months free discount and dedicated infrastructure.']
    ).lastInsertRowid;

    const planWeekly = dbManager.run(
      `INSERT INTO subscription_plans (code, name, description, billing_interval, billing_price, minimum_quantity, start_date, auto_close_on_expiry, allow_early_closure, allow_pause, renewal_policy, status)
       VALUES (?, ?, ?, 'WEEKLY', 65.00, 1, '2026-01-01', 0, 1, 1, 'AUTO_RENEW', 'ACTIVE')`,
      ['PLAN-DEV-W', 'Developer Weekly Sandbox', 'Short-cycle weekly environment for ephemeral testing and pipelines.']
    ).lastInsertRowid;

    // 7. Discounts
    dbManager.run(
      `INSERT INTO discounts (code, name, discount_type, value, min_purchase_amount, min_quantity, start_date, end_date, usage_limit, current_usage_count, is_active)
       VALUES (?, ?, 'PERCENTAGE', 15.0, 100.0, 1, '2026-01-01', '2026-12-31', 100, 12, 1)`,
      ['SCALE15', 'Enterprise Growth 15% Off']
    );

    dbManager.run(
      `INSERT INTO discounts (code, name, discount_type, value, min_purchase_amount, min_quantity, start_date, end_date, usage_limit, current_usage_count, is_active)
       VALUES (?, ?, 'FIXED_AMOUNT', 50.0, 200.0, 1, '2026-01-01', '2026-12-31', 50, 8, 1)`,
      ['WELCOME50', '$50 Flat Welcome Credit']
    );

    dbManager.run(
      `INSERT INTO discounts (code, name, discount_type, value, min_purchase_amount, min_quantity, start_date, end_date, usage_limit, current_usage_count, is_active)
       VALUES (?, ?, 'PERCENTAGE', 25.0, 50.0, 1, '2025-01-01', '2025-12-31', 20, 20, 0)`,
      ['EXPIRED25', '2025 Early Adopter Special (Expired)']
    );

    // 8. Subscriptions
    // Sub 1: Acme Cloud - Healthy Active Subscription
    const sub1 = dbManager.run(
      `INSERT INTO subscriptions (subscription_number, customer_id, plan_id, start_date, next_billing_date, expiration_date, billing_interval, payment_terms, status, renewal_policy, notes)
       VALUES ('SUB-2026-0001', ?, ?, '2026-01-15', '2026-11-15', '2027-01-15', 'MONTHLY', 'NET30', 'ACTIVE', 'AUTO_RENEW', 'Production deployment with 2 add-on modules.')`,
      [c1, planMonthly]
    ).lastInsertRowid;

    dbManager.run(
      `INSERT INTO subscription_lines (subscription_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 1, 'Brightloop Cloud Core Platform (Standard)', 1, 199.00, 8.5, 0.0, 215.92)`,
      [sub1, p1]
    );
    dbManager.run(
      `INSERT INTO subscription_lines (subscription_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 4, 'Predictive Revenue & Churn Analytics', 1, 79.00, 8.5, 0.0, 85.72)`,
      [sub1, p2]
    );

    // Sub 2: Apex Dynamics - Approaching Renewal in 3 days!
    const renewSoonDate = addBillingInterval(today, 'DAILY', 3);
    const sub2 = dbManager.run(
      `INSERT INTO subscriptions (subscription_number, customer_id, plan_id, start_date, next_billing_date, expiration_date, billing_interval, payment_terms, status, renewal_policy, notes)
       VALUES ('SUB-2026-0002', ?, ?, '2026-02-01', ?, '2027-02-01', 'MONTHLY', 'NET15', 'ACTIVE', 'AUTO_RENEW', 'High-throughput cluster with priority SLA. Approaching renewal.')`,
      [c2, planMonthly, renewSoonDate]
    ).lastInsertRowid;

    dbManager.run(
      `INSERT INTO subscription_lines (subscription_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 2, 'Brightloop Cloud Core Platform (High-Availability Cluster)', 1, 349.00, 8.5, 0.0, 378.67)`,
      [sub2, p1]
    );
    dbManager.run(
      `INSERT INTO subscription_lines (subscription_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 6, 'Enterprise 24/7 Priority Support SLA', 1, 250.00, 0.0, 0.0, 250.00)`,
      [sub2, p3]
    );

    // Sub 3: Solaria Health - Explicitly PAUSED subscription
    const sub3 = dbManager.run(
      `INSERT INTO subscriptions (subscription_number, customer_id, plan_id, start_date, next_billing_date, expiration_date, billing_interval, payment_terms, status, renewal_policy, notes)
       VALUES ('SUB-2026-0003', ?, ?, '2026-03-01', '2026-12-01', '2027-03-01', 'MONTHLY', 'NET30', 'PAUSED', 'AUTO_RENEW', 'Customer requested temporary pause during clinical system audit.')`,
      [c5, planMonthly]
    ).lastInsertRowid;

    dbManager.run(
      `INSERT INTO subscription_lines (subscription_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 3, 'Brightloop Cloud Core Platform (Dedicated Private VPC)', 1, 599.00, 8.5, 0.0, 649.92)`,
      [sub3, p1]
    );

    // Sub 4: Nova Financial - Annual Active
    const sub4 = dbManager.run(
      `INSERT INTO subscriptions (subscription_number, customer_id, plan_id, start_date, next_billing_date, expiration_date, billing_interval, payment_terms, status, renewal_policy, notes)
       VALUES ('SUB-2026-0004', ?, ?, '2026-01-01', '2027-01-01', '2027-01-01', 'YEARLY', 'NET30', 'ACTIVE', 'AUTO_RENEW', 'Global tier-1 banking annual license.')`,
      [c3, planAnnual]
    ).lastInsertRowid;

    dbManager.run(
      `INSERT INTO subscription_lines (subscription_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 3, 'Enterprise Annual Dedicated Suite with 24/7 SLA', 2, 2240.00, 0.0, 0.0, 4480.00)`,
      [sub4, p1]
    );

    // Sub 5: David Miller - Closed / Finished subscription
    const sub5 = dbManager.run(
      `INSERT INTO subscriptions (subscription_number, customer_id, plan_id, start_date, next_billing_date, expiration_date, billing_interval, payment_terms, status, renewal_policy, notes)
       VALUES ('SUB-2026-0005', ?, ?, '2026-01-10', '2026-06-10', '2026-06-10', 'WEEKLY', 'DUE_ON_RECEIPT', 'CLOSED', 'MANUAL', 'Short-term consulting sandbox completed.')`,
      [c4, planWeekly]
    ).lastInsertRowid;

    dbManager.run(
      `INSERT INTO subscription_lines (subscription_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 1, 'Developer Sandbox Weekly Instance', 1, 65.00, 8.5, 0.0, 70.53)`,
      [sub5, p1]
    );

    // 9. Quotations (Draft, Quotation, Confirmed)
    // Quote 1: Confirmed and converted to Sub 1
    const q1 = dbManager.run(
      `INSERT INTO quotations (quotation_number, customer_id, plan_id, quotation_date, expiration_date, payment_terms, status, subtotal, discount_total, tax_total, grand_total, notes, converted_subscription_id)
       VALUES ('QT-2026-0001', ?, ?, '2026-01-10', '2026-02-10', 'NET30', 'CONFIRMED', 278.00, 0.00, 23.64, 301.64, 'Initial enterprise cloud quotation.', ?)`,
      [c1, planMonthly, sub1]
    ).lastInsertRowid;

    dbManager.run(
      `INSERT INTO quotation_lines (quotation_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 1, 'Brightloop Cloud Core Platform', 1, 199.00, 8.5, 0.0, 215.92)`,
      [q1, p1]
    );
    dbManager.run(
      `INSERT INTO quotation_lines (quotation_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 4, 'Predictive Revenue & Churn Analytics', 1, 79.00, 8.5, 0.0, 85.72)`,
      [q1, p2]
    );

    // Quote 2: Active Draft Quotation under negotiation
    const q2 = dbManager.run(
      `INSERT INTO quotations (quotation_number, customer_id, plan_id, quotation_date, expiration_date, payment_terms, status, subtotal, discount_total, tax_total, grand_total, notes)
       VALUES ('QT-2026-0002', ?, ?, ?, ?, 'NET15', 'DRAFT', 599.00, 50.00, 46.67, 595.67, 'Multi-region expansion proposal with $50 welcome credit applied.')`,
      [c2, planMonthly, today, addBillingInterval(today, 'MONTHLY', 1)]
    ).lastInsertRowid;

    dbManager.run(
      `INSERT INTO quotation_lines (quotation_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 3, 'Brightloop Dedicated Private VPC', 1, 599.00, 8.5, 50.0, 595.67)`,
      [q2, p1]
    );

    // 10. Invoices (Paid, Overdue, Confirmed Unpaid, Draft)
    // Invoice 1: Paid invoice for Sub 1 (Acme)
    const inv1 = dbManager.run(
      `INSERT INTO invoices (invoice_number, customer_id, subscription_id, billing_period_start, billing_period_end, invoice_date, due_date, status, subtotal, discount_total, tax_total, total_amount, amount_paid, amount_due, notes)
       VALUES ('INV-2026-0001', ?, ?, '2026-01-15', '2026-02-15', '2026-01-15', '2026-02-15', 'PAID', 278.00, 0.00, 23.64, 301.64, 301.64, 0.00, 'January billing cycle paid in full.')`,
      [c1, sub1]
    ).lastInsertRowid;

    dbManager.run(
      `INSERT INTO invoice_lines (invoice_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 1, 'Brightloop Cloud Core Platform (Standard)', 1, 199.00, 8.5, 0.0, 215.92)`,
      [inv1, p1]
    );
    dbManager.run(
      `INSERT INTO invoice_lines (invoice_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 4, 'Predictive Revenue & Churn Analytics', 1, 79.00, 8.5, 0.0, 85.72)`,
      [inv1, p2]
    );

    // Payment for Invoice 1
    dbManager.run(
      `INSERT INTO payments (payment_reference, invoice_id, customer_id, amount, payment_date, payment_method, transaction_reference, notes, recorded_by_user_id, status)
       VALUES ('PAY-2026-0001', ?, ?, 301.64, '2026-01-20', 'BANK_TRANSFER', 'ACH-99882201', 'Direct automated ACH transfer.', 1, 'SUCCESS')`,
      [inv1, c1]
    );

    // Invoice 2: Annual Paid invoice for Sub 4 (Nova)
    const inv2 = dbManager.run(
      `INSERT INTO invoices (invoice_number, customer_id, subscription_id, billing_period_start, billing_period_end, invoice_date, due_date, status, subtotal, discount_total, tax_total, total_amount, amount_paid, amount_due, notes)
       VALUES ('INV-2026-0002', ?, ?, '2026-01-01', '2027-01-01', '2026-01-01', '2026-01-31', 'PAID', 4480.00, 0.00, 0.00, 4480.00, 4480.00, 0.00, 'Annual enterprise license prepayment.')`,
      [c3, sub4]
    ).lastInsertRowid;

    dbManager.run(
      `INSERT INTO invoice_lines (invoice_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 3, 'Enterprise Annual Dedicated Suite with 24/7 SLA', 2, 2240.00, 0.0, 0.0, 4480.00)`,
      [inv2, p1]
    );

    // Payment for Invoice 2
    dbManager.run(
      `INSERT INTO payments (payment_reference, invoice_id, customer_id, amount, payment_date, payment_method, transaction_reference, notes, recorded_by_user_id, status)
       VALUES ('PAY-2026-0002', ?, ?, 4480.00, '2026-01-05', 'BANK_TRANSFER', 'WIRE-CHASE-0029', 'Wire received from Nova Financial Group.', 1, 'SUCCESS')`,
      [inv2, c3]
    );

    // Invoice 3: OVERDUE Invoice for Apex Dynamics (c2)
    // Past due date with remaining positive balance
    const pastDueDate = addBillingInterval(today, 'DAILY', -12);
    const pastInvDate = addBillingInterval(pastDueDate, 'MONTHLY', -1);

    const inv3 = dbManager.run(
      `INSERT INTO invoices (invoice_number, customer_id, subscription_id, billing_period_start, billing_period_end, invoice_date, due_date, status, subtotal, discount_total, tax_total, total_amount, amount_paid, amount_due, notes)
       VALUES ('INV-2026-0003', ?, ?, ?, ?, ?, ?, 'OVERDUE', 599.00, 0.00, 29.67, 628.67, 100.00, 528.67, 'Partially paid, reminder notice dispatched.')`,
      [c2, sub2, pastInvDate, pastDueDate, pastInvDate, pastDueDate]
    ).lastInsertRowid;

    dbManager.run(
      `INSERT INTO invoice_lines (invoice_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 2, 'Brightloop Cloud Core Platform (High-Availability)', 1, 349.00, 8.5, 0.0, 378.67)`,
      [inv3, p1]
    );
    dbManager.run(
      `INSERT INTO invoice_lines (invoice_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 6, 'Enterprise 24/7 Priority Support SLA', 1, 250.00, 0.0, 0.0, 250.00)`,
      [inv3, p3]
    );

    // Partial Payment for Invoice 3
    dbManager.run(
      `INSERT INTO payments (payment_reference, invoice_id, customer_id, amount, payment_date, payment_method, transaction_reference, notes, recorded_by_user_id, status)
       VALUES ('PAY-2026-0003', ?, ?, 100.00, ?, 'CREDIT_CARD', 'CC-AUTH-8871', 'Partial installment payment.', 2, 'SUCCESS')`,
      [inv3, c2, pastInvDate]
    );

    // Invoice 4: Confirmed Unpaid Invoice (Due soon)
    const futureDueDate = addBillingInterval(today, 'DAILY', 10);
    const inv4 = dbManager.run(
      `INSERT INTO invoices (invoice_number, customer_id, subscription_id, billing_period_start, billing_period_end, invoice_date, due_date, status, subtotal, discount_total, tax_total, total_amount, amount_paid, amount_due, notes)
       VALUES ('INV-2026-0004', ?, ?, ?, ?, ?, ?, 'CONFIRMED', 278.00, 0.00, 23.64, 301.64, 0.00, 301.64, 'Current active cycle invoice.')`,
      [c1, sub1, today, addBillingInterval(today, 'MONTHLY', 1), today, futureDueDate]
    ).lastInsertRowid;

    dbManager.run(
      `INSERT INTO invoice_lines (invoice_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 1, 'Brightloop Cloud Core Platform (Standard)', 1, 199.00, 8.5, 0.0, 215.92)`,
      [inv4, p1]
    );
    dbManager.run(
      `INSERT INTO invoice_lines (invoice_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 4, 'Predictive Revenue & Churn Analytics', 1, 79.00, 8.5, 0.0, 85.72)`,
      [inv4, p2]
    );

    // Invoice 5: Draft Invoice
    const inv5 = dbManager.run(
      `INSERT INTO invoices (invoice_number, customer_id, subscription_id, invoice_date, due_date, status, subtotal, discount_total, tax_total, total_amount, amount_paid, amount_due, notes)
       VALUES ('INV-2026-0005', ?, NULL, ?, ?, 'DRAFT', 250.00, 0.00, 0.00, 250.00, 0.00, 250.00, 'Ad-hoc consulting draft invoice awaiting confirmation.')`,
      [c4, today, addBillingInterval(today, 'MONTHLY', 1)]
    ).lastInsertRowid;

    dbManager.run(
      `INSERT INTO invoice_lines (invoice_id, product_id, variant_id, description, quantity, unit_price, tax_rate, discount_amount, line_total)
       VALUES (?, ?, 6, 'Architecture Review Consulting Session', 1, 250.00, 0.0, 0.0, 250.00)`,
      [inv5, p3]
    );

    // 11. Initial Billing Run Record
    dbManager.run(
      `INSERT INTO billing_runs (run_date, triggered_by_user_id, eligible_count, invoices_created_count, skipped_count, details_json)
       VALUES (?, 1, 4, 3, 1, ?)`,
      [
        today,
        JSON.stringify([
          { subscriptionId: sub1, status: 'SUCCESS', invoiceNumber: 'INV-2026-0004' },
          { subscriptionId: sub4, status: 'SKIPPED', reason: 'Annual billing date is in 2027.' },
          { subscriptionId: sub3, status: 'SKIPPED', reason: 'Subscription is PAUSED.' }
        ])
      ]
    );

    // 12. Activity Logs
    dbManager.run(`
      INSERT INTO activity_logs (entity_type, entity_id, action, user_id, user_name, details_json)
      VALUES ('SYSTEM', 1, 'INITIALIZE_SYSTEM', 1, 'Elena Vance', '{"message": "Subscription OS initialization and base catalog setup."}')
    `);
    dbManager.run(`
      INSERT INTO activity_logs (entity_type, entity_id, action, user_id, user_name, details_json)
      VALUES ('SUBSCRIPTION', ?, 'ACTIVATE', 1, 'Elena Vance', '{"subscription_number": "SUB-2026-0001", "customer": "Acme Cloud Technologies"}')
    `, [sub1]);
    dbManager.run(`
      INSERT INTO activity_logs (entity_type, entity_id, action, user_id, user_name, details_json)
      VALUES ('PAYMENT', 1, 'RECORD', 1, 'Elena Vance', '{"amount": 301.64, "method": "BANK_TRANSFER", "invoice": "INV-2026-0001"}')
    `);

    // 13. System Notifications
    dbManager.run(`
      INSERT INTO notifications (user_id, role, title, message, type, is_read, link)
      VALUES (NULL, 'ADMIN', 'Overdue Invoice Alert', 'Invoice INV-2026-0003 for Apex Dynamics has an outstanding balance of $528.67 past due date.', 'ALERT', 0, '/invoices')
    `);
    dbManager.run(`
      INSERT INTO notifications (user_id, role, title, message, type, is_read, link)
      VALUES (NULL, 'STAFF', 'Renewal Approaching', 'Subscription SUB-2026-0002 for Apex Dynamics renews in 3 days.', 'WARNING', 0, '/subscriptions')
    `);
    dbManager.run(`
      INSERT INTO notifications (user_id, role, title, message, type, is_read, link)
      VALUES (NULL, 'ADMIN', 'Payment Received', 'Wire transfer of $4,480.00 cleared for Nova Financial Global (INV-2026-0002).', 'SUCCESS', 0, '/payments')
    `);
  });

  console.log('Seed completed successfully. Demo accounts:');
  console.log('  Admin:    admin@brightloop.io / BrightloopAdmin2026!');
  console.log('  Staff:    staff@brightloop.io / BrightloopStaff2026!');
  console.log('  Customer: sarah.connor@acmecloud.io / CustomerUser2026!');
}
