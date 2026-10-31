-- SUBSCRIPTION OS: Relational Schema for Brightloop Software
-- SQLite with foreign keys enabled

PRAGMA foreign_keys = ON;

-- Users for Authentication & RBAC
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'STAFF', 'CUSTOMER')),
  customer_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  billing_address TEXT,
  tax_id TEXT,
  customer_type TEXT NOT NULL DEFAULT 'BUSINESS' CHECK(customer_type IN ('BUSINESS', 'INDIVIDUAL')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  internal_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Taxes
CREATE TABLE IF NOT EXISTS taxes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rate REAL NOT NULL, -- e.g. 10.0 for 10%
  is_active INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Products Catalog
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'SOFTWARE' CHECK(product_type IN ('SOFTWARE', 'SERVICE', 'ADDON')),
  sales_price REAL NOT NULL DEFAULT 0.0,
  cost_price REAL NOT NULL DEFAULT 0.0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'ARCHIVED')),
  tax_rate_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tax_rate_id) REFERENCES taxes(id) ON DELETE SET NULL
);

-- Product Variants (Price modifier: Final Unit Price = Base + Variant Adjustment)
CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  variant_name TEXT NOT NULL,
  price_adjustment REAL NOT NULL DEFAULT 0.0,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  billing_interval TEXT NOT NULL CHECK(billing_interval IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
  billing_price REAL NOT NULL DEFAULT 0.0,
  minimum_quantity INTEGER NOT NULL DEFAULT 1,
  start_date DATE,
  end_date DATE,
  auto_close_on_expiry INTEGER NOT NULL DEFAULT 0,
  allow_early_closure INTEGER NOT NULL DEFAULT 1,
  allow_pause INTEGER NOT NULL DEFAULT 1,
  renewal_policy TEXT NOT NULL DEFAULT 'AUTO_RENEW' CHECK(renewal_policy IN ('AUTO_RENEW', 'MANUAL')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'ARCHIVED')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Discounts
CREATE TABLE IF NOT EXISTS discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK(discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
  value REAL NOT NULL,
  min_purchase_amount REAL DEFAULT 0.0,
  min_quantity INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  usage_limit INTEGER DEFAULT NULL,
  current_usage_count INTEGER NOT NULL DEFAULT 0,
  applicable_product_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (applicable_product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Quotations
CREATE TABLE IF NOT EXISTS quotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL,
  plan_id INTEGER,
  quotation_date DATE NOT NULL,
  expiration_date DATE NOT NULL,
  payment_terms TEXT DEFAULT 'NET30',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'QUOTATION', 'CONFIRMED')),
  subtotal REAL NOT NULL DEFAULT 0.0,
  discount_total REAL NOT NULL DEFAULT 0.0,
  tax_total REAL NOT NULL DEFAULT 0.0,
  grand_total REAL NOT NULL DEFAULT 0.0,
  notes TEXT,
  converted_subscription_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT
);

-- Quotation Lines
CREATE TABLE IF NOT EXISTS quotation_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  variant_id INTEGER,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  tax_rate REAL NOT NULL DEFAULT 0.0,
  discount_amount REAL NOT NULL DEFAULT 0.0,
  line_total REAL NOT NULL,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  start_date DATE NOT NULL,
  next_billing_date DATE NOT NULL,
  expiration_date DATE,
  billing_interval TEXT NOT NULL CHECK(billing_interval IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
  payment_terms TEXT DEFAULT 'NET30',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CLOSED')),
  renewal_policy TEXT NOT NULL DEFAULT 'AUTO_RENEW' CHECK(renewal_policy IN ('AUTO_RENEW', 'MANUAL')),
  discount_id INTEGER,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE SET NULL
);

-- Subscription Lines
CREATE TABLE IF NOT EXISTS subscription_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  variant_id INTEGER,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  tax_rate REAL NOT NULL DEFAULT 0.0,
  discount_amount REAL NOT NULL DEFAULT 0.0,
  line_total REAL NOT NULL,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL,
  subscription_id INTEGER,
  billing_period_start DATE,
  billing_period_end DATE,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'CONFIRMED', 'PAID', 'OVERDUE', 'CANCELLED')),
  subtotal REAL NOT NULL DEFAULT 0.0,
  discount_total REAL NOT NULL DEFAULT 0.0,
  tax_total REAL NOT NULL DEFAULT 0.0,
  total_amount REAL NOT NULL DEFAULT 0.0,
  amount_paid REAL NOT NULL DEFAULT 0.0,
  amount_due REAL NOT NULL DEFAULT 0.0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

-- Invoice Lines
CREATE TABLE IF NOT EXISTS invoice_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  product_id INTEGER,
  variant_id INTEGER,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  tax_rate REAL NOT NULL DEFAULT 0.0,
  discount_amount REAL NOT NULL DEFAULT 0.0,
  line_total REAL NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_reference TEXT NOT NULL UNIQUE,
  invoice_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('BANK_TRANSFER', 'CREDIT_CARD', 'DIRECT_DEBIT', 'CHECK')),
  transaction_reference TEXT,
  notes TEXT,
  recorded_by_user_id INTEGER,
  status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK(status IN ('SUCCESS', 'REVERSED')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (recorded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Discount Usages
CREATE TABLE IF NOT EXISTS discount_usages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discount_id INTEGER NOT NULL,
  invoice_id INTEGER,
  subscription_id INTEGER,
  quotation_id INTEGER,
  customer_id INTEGER NOT NULL,
  amount_saved REAL NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

-- Billing Runs History
CREATE TABLE IF NOT EXISTS billing_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_date DATE NOT NULL,
  triggered_by_user_id INTEGER,
  eligible_count INTEGER NOT NULL DEFAULT 0,
  invoices_created_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  details_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (triggered_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Activity Logs (Audit Trail)
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  user_id INTEGER,
  user_name TEXT,
  details_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  role TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'INFO' CHECK(type IN ('INFO', 'WARNING', 'SUCCESS', 'ALERT')),
  is_read INTEGER NOT NULL DEFAULT 0,
  link TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Company Settings
CREATE TABLE IF NOT EXISTS company_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  company_name TEXT NOT NULL DEFAULT 'Brightloop Software',
  support_email TEXT NOT NULL DEFAULT 'billing@brightloop.io',
  phone TEXT DEFAULT '+1 (800) 555-0199',
  address TEXT DEFAULT '100 Innovation Way, Suite 400, San Francisco, CA 94105',
  currency TEXT DEFAULT 'USD',
  tax_id TEXT DEFAULT 'US-84920491',
  invoice_prefix TEXT DEFAULT 'INV-',
  quotation_prefix TEXT DEFAULT 'QT-',
  subscription_prefix TEXT DEFAULT 'SUB-'
);

-- Indexes for high performance queries
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_billing_period_guard ON invoices(subscription_id, billing_period_start);
