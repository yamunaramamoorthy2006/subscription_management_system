import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { dbManager } from '../db/database';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { logActivity } from '../utils/audit';

export const settingsRouter = Router();

settingsRouter.use(authenticate);

// GET /api/settings/company - Retrieve company details
settingsRouter.get('/company', (req: AuthenticatedRequest, res: Response): void => {
  let settings = dbManager.get('SELECT * FROM company_settings WHERE id = 1');
  if (!settings) {
    dbManager.run(`
      INSERT INTO company_settings (id, company_name, support_email, phone, address, currency, tax_id)
      VALUES (1, 'Brightloop Software', 'billing@brightloop.io', '+1 (800) 555-0199', '100 Innovation Way, Suite 400, San Francisco, CA 94105', 'USD', 'US-84920491')
    `);
    settings = dbManager.get('SELECT * FROM company_settings WHERE id = 1');
  }
  res.json({ settings });
});

// PUT /api/settings/company - Update company details (ADMIN only)
settingsRouter.put('/company', authorizeRoles('ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const {
    company_name,
    support_email,
    phone,
    address,
    currency,
    tax_id,
    invoice_prefix,
    quotation_prefix,
    subscription_prefix
  } = req.body;

  dbManager.run(
    `UPDATE company_settings
     SET company_name = COALESCE(?, company_name),
         support_email = COALESCE(?, support_email),
         phone = COALESCE(?, phone),
         address = COALESCE(?, address),
         currency = COALESCE(?, currency),
         tax_id = COALESCE(?, tax_id),
         invoice_prefix = COALESCE(?, invoice_prefix),
         quotation_prefix = COALESCE(?, quotation_prefix),
         subscription_prefix = COALESCE(?, subscription_prefix)
     WHERE id = 1`,
    [
      company_name || null,
      support_email || null,
      phone || null,
      address || null,
      currency || null,
      tax_id || null,
      invoice_prefix || null,
      quotation_prefix || null,
      subscription_prefix || null
    ]
  );

  logActivity({
    entityType: 'SETTINGS',
    action: 'UPDATE_COMPANY',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { company_name }
  });

  const updated = dbManager.get('SELECT * FROM company_settings WHERE id = 1');
  res.json({ settings: updated });
});

// GET /api/settings/staff - List staff & admin accounts (ADMIN only)
settingsRouter.get('/staff', authorizeRoles('ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const staff = dbManager.query(
    `SELECT id, name, email, role, customer_id, created_at, updated_at
     FROM users
     WHERE role IN ('ADMIN', 'STAFF')
     ORDER BY id ASC`
  );
  res.json({ staff });
});

// POST /api/settings/staff - Create new staff account (ADMIN only)
settingsRouter.post('/staff', authorizeRoles('ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const { name, email, password, role = 'STAFF' } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required.' });
    return;
  }

  if (password.length <= 8) {
    res.status(400).json({ error: 'Password must be longer than 8 characters.' });
    return;
  }

  const existing = dbManager.get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (existing) {
    res.status(409).json({ error: 'A user account with this email already exists.' });
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const result = dbManager.run(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name.trim(), email.trim().toLowerCase(), passwordHash, role === 'ADMIN' ? 'ADMIN' : 'STAFF']
  );

  logActivity({
    entityType: 'STAFF',
    entityId: result.lastInsertRowid,
    action: 'CREATE_STAFF',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { email, role }
  });

  const newStaff = dbManager.get(
    'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
    [result.lastInsertRowid]
  );

  res.status(201).json({ staff: newStaff });
});
