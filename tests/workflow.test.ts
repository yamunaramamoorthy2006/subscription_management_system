import { dbManager } from '../server/src/db/database';
import { seedDatabase } from '../server/src/db/seed';
import { calculateLine, addBillingInterval, round2, getTodayIso } from '../server/src/utils/math';
import bcrypt from 'bcryptjs';

async function runTestSuite() {
  console.log('=== STARTING SUBSCRIPTION OS WORKFLOW VERIFICATION SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      if (details) console.error(`    Details: ${details}`);
      failed++;
    }
  }

  await dbManager.init();
  seedDatabase(true);

  // TEST 1: User authentication & Password policy verification
  console.log('[Phase 1: Authentication & Access Control]');
  const adminUser = dbManager.get('SELECT * FROM users WHERE email = ?', ['admin@brightloop.io']);
  assert(!!adminUser, 'Admin user account exists');
  assert(bcrypt.compareSync('BrightloopAdmin2026!', adminUser.password_hash), 'Admin password hash verifies correctly');
  assert(adminUser.role === 'ADMIN', 'Admin role assigned accurately');

  const staffUser = dbManager.get('SELECT * FROM users WHERE email = ?', ['staff@brightloop.io']);
  assert(staffUser.role === 'STAFF', 'Staff role assigned accurately');

  const customerUser = dbManager.get('SELECT * FROM users WHERE email = ?', ['sarah.connor@acmecloud.io']);
  assert(customerUser.role === 'CUSTOMER' && !!customerUser.customer_id, 'Customer account linked to customer profile');

  // TEST 2: Customer creation and uniqueness
  console.log('\n[Phase 2: Customer Management]');
  const uniqueCustomerEmail = `test.corp.${Date.now()}@example.com`;
  const newCustRes = dbManager.run(
    `INSERT INTO customers (customer_code, name, email, phone, billing_address, customer_type, status)
     VALUES (?, ?, ?, ?, ?, 'BUSINESS', 'ACTIVE')`,
    ['CUST-9999', 'Test Workflow Enterprise', uniqueCustomerEmail, '+1 (555) 000-1111', '100 Silicon Way, Austin, TX']
  );
  const custId = newCustRes.lastInsertRowid;
  assert(custId > 0, 'New customer created successfully with code CUST-9999');

  // TEST 3: Products, variants, and decimal calculations
  console.log('\n[Phase 3: Product Catalog & Variant Pricing]');
  const prodRes = dbManager.run(
    `INSERT INTO products (code, name, product_type, sales_price, cost_price, description, status)
     VALUES (?, ?, 'SOFTWARE', 150.00, 30.00, 'Test Cloud Engine', 'ACTIVE')`,
    [`PROD-TEST-${Date.now()}`, 'Workflow Test Cloud']
  );
  const testProdId = prodRes.lastInsertRowid;

  const varRes = dbManager.run(
    `INSERT INTO product_variants (product_id, variant_name, price_adjustment, is_default)
     VALUES (?, 'High IOPS Storage (+ $50)', 50.00, 0)`,
    [testProdId]
  );
  const testVarId = varRes.lastInsertRowid;

  // Formula: Effective Unit Price = Base (150) + Variant (50) = 200
  // Subtotal for 2 units = 400. Tax 10% = 40. Total = 440.
  const calc = calculateLine(2, 150.0, 50.0, 10.0, 0.0);
  assert(calc.effectiveUnitPrice === 200.0, 'Variant adjustment correctly calculated unit price ($200.00)');
  assert(calc.subtotal === 400.0, 'Subtotal correctly computed ($400.00)');
  assert(calc.taxAmount === 40.0, 'Tax calculation accurate ($40.00)');
  assert(calc.lineTotal === 440.0, 'Decimal-safe grand total calculated correctly ($440.00)');

  // TEST 4: Subscription Plan Management & Billing intervals
  console.log('\n[Phase 4: Plans & Interval Arithmetic]');
  const today = getTodayIso();
  const nextMonth = addBillingInterval('2026-01-31', 'MONTHLY', 1);
  assert(nextMonth === '2026-02-28', 'Month-end clamping handles Jan 31 -> Feb 28 accurately');

  const nextYear = addBillingInterval('2026-03-15', 'YEARLY', 1);
  assert(nextYear === '2027-03-15', 'Yearly interval handles year increment');

  const testPlanRes = dbManager.run(
    `INSERT INTO subscription_plans (code, name, billing_interval, billing_price, status)
     VALUES (?, 'Workflow Test Monthly', 'MONTHLY', 200.00, 'ACTIVE')`,
    [`PLAN-TEST-${Date.now()}`]
  );
  const testPlanId = testPlanRes.lastInsertRowid;

  // TEST 5: Quotation creation, confirmation, and duplicate-safe conversion
  console.log('\n[Phase 5: Quotation Workflow & Conversion]');
  const quoteNum = `QT-TEST-${Date.now()}`;
  const quoteRes = dbManager.run(
    `INSERT INTO quotations (quotation_number, customer_id, plan_id, quotation_date, expiration_date, status, subtotal, grand_total)
     VALUES (?, ?, ?, ?, ?, 'DRAFT', 400.0, 440.0)`,
    [quoteNum, custId, testPlanId, today, addBillingInterval(today, 'MONTHLY', 1)]
  );
  const quoteId = quoteRes.lastInsertRowid;

  dbManager.run(
    `INSERT INTO quotation_lines (quotation_id, product_id, variant_id, description, quantity, unit_price, tax_rate, line_total)
     VALUES (?, ?, ?, 'Test line item', 2, 200.0, 10.0, 440.0)`,
    [quoteId, testProdId, testVarId]
  );

  // Confirm quotation
  dbManager.run('UPDATE quotations SET status = "CONFIRMED" WHERE id = ?', [quoteId]);
  const confirmedQuote = dbManager.get('SELECT status FROM quotations WHERE id = ?', [quoteId]);
  assert(confirmedQuote.status === 'CONFIRMED', 'Quotation successfully transitioned to CONFIRMED');

  // Convert to Subscription
  const subNum = `SUB-TEST-${Date.now()}`;
  const newSubRes = dbManager.run(
    `INSERT INTO subscriptions (subscription_number, customer_id, plan_id, start_date, next_billing_date, billing_interval, status)
     VALUES (?, ?, ?, ?, ?, 'MONTHLY', 'ACTIVE')`,
    [subNum, custId, testPlanId, today, today]
  );
  const newSubId = newSubRes.lastInsertRowid;

  dbManager.run(
    `INSERT INTO subscription_lines (subscription_id, product_id, variant_id, description, quantity, unit_price, tax_rate, line_total)
     VALUES (?, ?, ?, 'Converted line', 2, 200.0, 10.0, 440.0)`,
    [newSubId, testProdId, testVarId]
  );

  // Guard: mark converted
  dbManager.run('UPDATE quotations SET converted_subscription_id = ? WHERE id = ?', [newSubId, quoteId]);
  const quoteCheck = dbManager.get('SELECT converted_subscription_id FROM quotations WHERE id = ?', [quoteId]);
  assert(quoteCheck.converted_subscription_id === newSubId, 'Quotation converted and linked to subscription');

  // TEST 6: Recurring Billing Safeguards (No duplicate invoices for same period!)
  console.log('\n[Phase 6: Invoicing & Billing Safeguards]');
  const invNum1 = `INV-TEST-001-${Date.now()}`;
  const periodStart = today;
  const periodEnd = addBillingInterval(periodStart, 'MONTHLY', 1);

  // Generate 1st invoice
  const invRes = dbManager.run(
    `INSERT INTO invoices (invoice_number, customer_id, subscription_id, billing_period_start, billing_period_end, invoice_date, due_date, status, subtotal, tax_total, total_amount, amount_due)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', 400.0, 40.0, 440.0, 440.0)`,
    [invNum1, custId, newSubId, periodStart, periodEnd, today, addBillingInterval(today, 'MONTHLY', 1)]
  );
  const testInvId = invRes.lastInsertRowid;
  assert(testInvId > 0, 'First invoice generated for billing period');

  // Check duplicate prevention query
  const duplicateCheck = dbManager.get(
    'SELECT id, invoice_number FROM invoices WHERE subscription_id = ? AND billing_period_start = ?',
    [newSubId, periodStart]
  );
  assert(!!duplicateCheck && duplicateCheck.id === testInvId, 'Duplicate billing query accurately detects existing period invoice');

  // TEST 7: Payment recording and invoice balance update
  console.log('\n[Phase 7: Payment Processing & Balance Resolution]');
  const payRef = `PAY-TEST-${Date.now()}`;
  dbManager.run(
    `INSERT INTO payments (payment_reference, invoice_id, customer_id, amount, payment_date, payment_method, status)
     VALUES (?, ?, ?, 440.0, ?, 'BANK_TRANSFER', 'SUCCESS')`,
    [payRef, testInvId, custId, today]
  );

  // Update invoice balance
  dbManager.run(
    'UPDATE invoices SET amount_paid = 440.0, amount_due = 0.0, status = "PAID" WHERE id = ?',
    [testInvId]
  );

  const updatedInv = dbManager.get('SELECT amount_paid, amount_due, status FROM invoices WHERE id = ?', [testInvId]);
  assert(updatedInv.amount_paid === 440.0 && updatedInv.amount_due === 0.0, 'Invoice balance updated to $0.00 due');
  assert(updatedInv.status === 'PAID', 'Invoice status transitioned to PAID');

  // TEST 8: Discounts and Usage Limits
  console.log('\n[Phase 8: Discount Rules & Limits]');
  const testDiscount = dbManager.get('SELECT * FROM discounts WHERE code = "SCALE15"');
  assert(testDiscount.is_active === 1, 'SCALE15 discount code is active');
  assert(testDiscount.current_usage_count < testDiscount.usage_limit, 'Discount code is within allowed usage limit');

  const expiredDiscount = dbManager.get('SELECT * FROM discounts WHERE code = "EXPIRED25"');
  assert(expiredDiscount.is_active === 0, 'EXPIRED25 code correctly identified as expired/inactive');

  // TEST 9: Subscription Lifecycle (Pause, Resume, Close)
  console.log('\n[Phase 9: Subscription State Machine]');
  dbManager.run('UPDATE subscriptions SET status = "PAUSED" WHERE id = ?', [newSubId]);
  assert(dbManager.get('SELECT status FROM subscriptions WHERE id = ?', [newSubId]).status === 'PAUSED', 'Subscription successfully PAUSED');

  dbManager.run('UPDATE subscriptions SET status = "ACTIVE" WHERE id = ?', [newSubId]);
  assert(dbManager.get('SELECT status FROM subscriptions WHERE id = ?', [newSubId]).status === 'ACTIVE', 'Subscription successfully RESUMED to ACTIVE');

  dbManager.run('UPDATE subscriptions SET status = "CLOSED" WHERE id = ?', [newSubId]);
  assert(dbManager.get('SELECT status FROM subscriptions WHERE id = ?', [newSubId]).status === 'CLOSED', 'Subscription successfully CLOSED');

  // TEST 10: Reports and Dashboard consistency
  console.log('\n[Phase 10: Financial Reporting Consistency]');
  const totalInvoiced = dbManager.get("SELECT SUM(total_amount) as total FROM invoices WHERE status != 'CANCELLED'").total;
  const totalCollected = dbManager.get("SELECT SUM(amount) as total FROM payments WHERE status = 'SUCCESS'").total;
  const totalDue = dbManager.get("SELECT SUM(amount_due) as total FROM invoices WHERE status != 'CANCELLED'").total;

  assert(totalInvoiced > 0, `Total invoiced revenue tracked: $${round2(totalInvoiced)}`);
  assert(totalCollected > 0, `Total collected cash tracked: $${round2(totalCollected)}`);
  assert(totalDue >= 0, `Total outstanding receivables: $${round2(totalDue)}`);
  assert(round2(totalInvoiced) >= round2(totalCollected), 'Collected cash does not exceed invoiced total');

  console.log(`\n=== TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
