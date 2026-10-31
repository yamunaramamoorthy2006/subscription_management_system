import { Router, Response } from 'express';
import { dbManager } from '../db/database';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { logActivity } from '../utils/audit';

export const taxesRouter = Router();

taxesRouter.use(authenticate);

// GET /api/taxes - List tax rules
taxesRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const taxes = dbManager.query('SELECT * FROM taxes ORDER BY id ASC');
  res.json({ taxes });
});

// POST /api/taxes - Create tax rate (ADMIN only)
taxesRouter.post('/', authorizeRoles('ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const { name, rate, is_active = 1, is_default = 0 } = req.body;

  if (!name || rate === undefined) {
    res.status(400).json({ error: 'Tax name and percentage rate are required.' });
    return;
  }

  if (is_default) {
    // Clear existing default
    dbManager.run('UPDATE taxes SET is_default = 0');
  }

  const result = dbManager.run(
    'INSERT INTO taxes (name, rate, is_active, is_default) VALUES (?, ?, ?, ?)',
    [name.trim(), Number(rate), is_active ? 1 : 0, is_default ? 1 : 0]
  );

  const newTax = dbManager.get('SELECT * FROM taxes WHERE id = ?', [result.lastInsertRowid]);

  logActivity({
    entityType: 'TAX',
    entityId: result.lastInsertRowid,
    action: 'CREATE',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { name, rate }
  });

  res.status(201).json({ tax: newTax });
});

// PUT /api/taxes/:id - Update tax rate (ADMIN only)
taxesRouter.put('/:id', authorizeRoles('ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const { name, rate, is_active, is_default } = req.body;

  const existing = dbManager.get('SELECT * FROM taxes WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'Tax rule not found.' });
    return;
  }

  if (is_default) {
    dbManager.run('UPDATE taxes SET is_default = 0 WHERE id != ?', [id]);
  }

  dbManager.run(
    `UPDATE taxes
     SET name = COALESCE(?, name),
         rate = COALESCE(?, rate),
         is_active = COALESCE(?, is_active),
         is_default = COALESCE(?, is_default)
     WHERE id = ?`,
    [
      name ? name.trim() : null,
      rate !== undefined ? Number(rate) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      is_default !== undefined ? (is_default ? 1 : 0) : null,
      id
    ]
  );

  const updated = dbManager.get('SELECT * FROM taxes WHERE id = ?', [id]);
  res.json({ tax: updated });
});
