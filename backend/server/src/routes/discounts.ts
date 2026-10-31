import { Router, Response } from 'express';
import { dbManager } from '../db/database';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { round2, getTodayIso } from '../utils/math';
import { logActivity } from '../utils/audit';

export const discountsRouter = Router();

discountsRouter.use(authenticate);

// GET /api/discounts - List discounts
discountsRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const { status, search } = req.query;

  let sql = `
    SELECT d.*, p.name AS applicable_product_name
    FROM discounts d
    LEFT JOIN products p ON d.applicable_product_id = p.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status === 'ACTIVE') {
    sql += ` AND d.is_active = 1 AND (d.end_date IS NULL OR d.end_date >= DATE('now'))`;
  } else if (status === 'INACTIVE') {
    sql += ` AND (d.is_active = 0 OR (d.end_date IS NOT NULL AND d.end_date < DATE('now')))`;
  }

  if (search) {
    sql += ` AND (d.name LIKE ? OR d.code LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam);
  }

  sql += ` ORDER BY d.id DESC`;

  const discounts = dbManager.query(sql, params);
  res.json({ discounts });
});

// POST /api/discounts/validate - Test / validate a discount code for quotation or invoice
discountsRouter.post('/validate', (req: AuthenticatedRequest, res: Response): void => {
  const { code, amount = 0, quantity = 1, productId } = req.body;

  if (!code) {
    res.status(400).json({ error: 'Discount code is required.' });
    return;
  }

  const discount = dbManager.get(
    'SELECT * FROM discounts WHERE code = ?',
    [code.trim().toUpperCase()]
  );

  if (!discount) {
    res.status(404).json({ error: 'Discount code not found.' });
    return;
  }

  if (!discount.is_active) {
    res.status(400).json({ error: 'This discount code is currently inactive.' });
    return;
  }

  const today = getTodayIso();
  if (discount.start_date && discount.start_date > today) {
    res.status(400).json({ error: `This discount code is not valid until ${discount.start_date}.` });
    return;
  }

  if (discount.end_date && discount.end_date < today) {
    res.status(400).json({ error: `This discount code expired on ${discount.end_date}.` });
    return;
  }

  if (discount.usage_limit && discount.current_usage_count >= discount.usage_limit) {
    res.status(400).json({ error: 'This discount code has reached its maximum usage limit.' });
    return;
  }

  if (discount.min_purchase_amount && Number(amount) < Number(discount.min_purchase_amount)) {
    res.status(400).json({
      error: `Order amount ($${Number(amount).toFixed(2)}) is less than minimum required ($${Number(discount.min_purchase_amount).toFixed(2)}).`
    });
    return;
  }

  if (discount.min_quantity && Number(quantity) < Number(discount.min_quantity)) {
    res.status(400).json({
      error: `Order quantity (${quantity}) is less than minimum required (${discount.min_quantity}).`
    });
    return;
  }

  if (discount.applicable_product_id && productId && Number(productId) !== Number(discount.applicable_product_id)) {
    res.status(400).json({ error: 'This discount is only applicable to specific products.' });
    return;
  }

  // Calculate discount value
  let calculatedDiscount = 0;
  if (discount.discount_type === 'PERCENTAGE') {
    calculatedDiscount = round2(Number(amount) * (Number(discount.value) / 100));
  } else {
    calculatedDiscount = round2(Math.min(Number(amount), Number(discount.value)));
  }

  res.json({
    valid: true,
    discount,
    discountAmount: calculatedDiscount
  });
});

// POST /api/discounts - Create discount (ADMIN only)
discountsRouter.post('/', authorizeRoles('ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const {
    code,
    name,
    discount_type = 'PERCENTAGE',
    value,
    min_purchase_amount = 0,
    min_quantity = 0,
    start_date,
    end_date,
    usage_limit,
    applicable_product_id,
    is_active = 1
  } = req.body;

  if (!code || !name || value === undefined) {
    res.status(400).json({ error: 'Discount code, name, and value are required.' });
    return;
  }

  const existing = dbManager.get('SELECT id FROM discounts WHERE code = ?', [code.trim().toUpperCase()]);
  if (existing) {
    res.status(409).json({ error: 'A discount with this code already exists.' });
    return;
  }

  const result = dbManager.run(
    `INSERT INTO discounts (
       code, name, discount_type, value, min_purchase_amount, min_quantity,
       start_date, end_date, usage_limit, current_usage_count, applicable_product_id, is_active
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      code.trim().toUpperCase(),
      name.trim(),
      discount_type,
      Number(value),
      Number(min_purchase_amount) || 0,
      Number(min_quantity) || 0,
      start_date || null,
      end_date || null,
      usage_limit ? Number(usage_limit) : null,
      applicable_product_id ? Number(applicable_product_id) : null,
      is_active ? 1 : 0
    ]
  );

  const newDiscount = dbManager.get('SELECT * FROM discounts WHERE id = ?', [result.lastInsertRowid]);

  logActivity({
    entityType: 'DISCOUNT',
    entityId: result.lastInsertRowid,
    action: 'CREATE',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { code, name, value, discount_type }
  });

  res.status(201).json({ discount: newDiscount });
});

// PUT /api/discounts/:id - Update discount (ADMIN only)
discountsRouter.put('/:id', authorizeRoles('ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const existing = dbManager.get('SELECT * FROM discounts WHERE id = ?', [id]);

  if (!existing) {
    res.status(404).json({ error: 'Discount not found.' });
    return;
  }

  const {
    code,
    name,
    discount_type,
    value,
    min_purchase_amount,
    min_quantity,
    start_date,
    end_date,
    usage_limit,
    applicable_product_id,
    is_active
  } = req.body;

  dbManager.run(
    `UPDATE discounts
     SET code = COALESCE(?, code),
         name = COALESCE(?, name),
         discount_type = COALESCE(?, discount_type),
         value = COALESCE(?, value),
         min_purchase_amount = COALESCE(?, min_purchase_amount),
         min_quantity = COALESCE(?, min_quantity),
         start_date = COALESCE(?, start_date),
         end_date = COALESCE(?, end_date),
         usage_limit = COALESCE(?, usage_limit),
         applicable_product_id = COALESCE(?, applicable_product_id),
         is_active = COALESCE(?, is_active),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      code ? code.trim().toUpperCase() : null,
      name ? name.trim() : null,
      discount_type || null,
      value !== undefined ? Number(value) : null,
      min_purchase_amount !== undefined ? Number(min_purchase_amount) : null,
      min_quantity !== undefined ? Number(min_quantity) : null,
      start_date !== undefined ? start_date : null,
      end_date !== undefined ? end_date : null,
      usage_limit !== undefined ? (usage_limit ? Number(usage_limit) : null) : null,
      applicable_product_id !== undefined ? (applicable_product_id ? Number(applicable_product_id) : null) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      id
    ]
  );

  const updated = dbManager.get('SELECT * FROM discounts WHERE id = ?', [id]);

  logActivity({
    entityType: 'DISCOUNT',
    entityId: id,
    action: 'UPDATE',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { name, code }
  });

  res.json({ discount: updated });
});
