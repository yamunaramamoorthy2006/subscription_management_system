import { Router, Response } from 'express';
import { dbManager } from '../db/database';
import { authenticate, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { logActivity } from '../utils/audit';

export const productsRouter = Router();

productsRouter.use(authenticate);

// GET /api/products - List all products with their variants and tax rates
productsRouter.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const { status, type, search } = req.query;

  let sql = `
    SELECT p.*, t.name AS tax_name, t.rate AS tax_rate
    FROM products p
    LEFT JOIN taxes t ON p.tax_rate_id = t.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status && status !== 'ALL') {
    sql += ` AND p.status = ?`;
    params.push(status);
  }

  if (type && type !== 'ALL') {
    sql += ` AND p.product_type = ?`;
    params.push(type);
  }

  if (search) {
    sql += ` AND (p.name LIKE ? OR p.code LIKE ? OR p.description LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  sql += ` ORDER BY p.id ASC`;

  const products = dbManager.query(sql, params);

  // Attach variants to each product
  const variants = dbManager.query('SELECT * FROM product_variants ORDER BY id ASC');
  const productsWithVariants = products.map((prod) => ({
    ...prod,
    variants: variants.filter((v) => v.product_id === prod.id)
  }));

  res.json({ products: productsWithVariants });
});

// GET /api/products/:id - Single product with variants
productsRouter.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const product = dbManager.get(
    `SELECT p.*, t.name AS tax_name, t.rate AS tax_rate
     FROM products p
     LEFT JOIN taxes t ON p.tax_rate_id = t.id
     WHERE p.id = ?`,
    [id]
  );

  if (!product) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const variants = dbManager.query('SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC', [id]);
  res.json({ product: { ...product, variants } });
});

// POST /api/products - Create product and optional variants (ADMIN only)
productsRouter.post('/', authorizeRoles('ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const { code, name, product_type = 'SOFTWARE', sales_price = 0, cost_price = 0, description, tax_rate_id, variants } = req.body;

  if (!code || !name) {
    res.status(400).json({ error: 'Product code and name are required.' });
    return;
  }

  const existing = dbManager.get('SELECT id FROM products WHERE code = ?', [code.trim()]);
  if (existing) {
    res.status(409).json({ error: 'A product with this code already exists.' });
    return;
  }

  const prodResult = dbManager.run(
    `INSERT INTO products (code, name, product_type, sales_price, cost_price, description, status, tax_rate_id)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    [
      code.trim().toUpperCase(),
      name.trim(),
      product_type,
      Number(sales_price) || 0,
      Number(cost_price) || 0,
      description || null,
      tax_rate_id || null
    ]
  );

  const productId = prodResult.lastInsertRowid;

  // Insert variants if provided
  if (Array.isArray(variants) && variants.length > 0) {
    for (const v of variants) {
      if (v.variant_name) {
        dbManager.run(
          `INSERT INTO product_variants (product_id, variant_name, price_adjustment, is_default)
           VALUES (?, ?, ?, ?)`,
          [productId, v.variant_name.trim(), Number(v.price_adjustment) || 0, v.is_default ? 1 : 0]
        );
      }
    }
  }

  logActivity({
    entityType: 'PRODUCT',
    entityId: productId,
    action: 'CREATE',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { code, name, sales_price }
  });

  const createdVariants = dbManager.query('SELECT * FROM product_variants WHERE product_id = ?', [productId]);
  const product = dbManager.get('SELECT * FROM products WHERE id = ?', [productId]);

  res.status(201).json({ product: { ...product, variants: createdVariants } });
});

// PUT /api/products/:id - Update product and variants (ADMIN only)
productsRouter.put('/:id', authorizeRoles('ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const productId = parseInt(req.params.id, 10);
  const { code, name, product_type, sales_price, cost_price, description, status, tax_rate_id, variants } = req.body;

  const existing = dbManager.get('SELECT * FROM products WHERE id = ?', [productId]);
  if (!existing) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  dbManager.run(
    `UPDATE products
     SET code = COALESCE(?, code),
         name = COALESCE(?, name),
         product_type = COALESCE(?, product_type),
         sales_price = COALESCE(?, sales_price),
         cost_price = COALESCE(?, cost_price),
         description = COALESCE(?, description),
         status = COALESCE(?, status),
         tax_rate_id = COALESCE(?, tax_rate_id),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      code ? code.trim().toUpperCase() : null,
      name ? name.trim() : null,
      product_type || null,
      sales_price !== undefined ? Number(sales_price) : null,
      cost_price !== undefined ? Number(cost_price) : null,
      description !== undefined ? description : null,
      status || null,
      tax_rate_id !== undefined ? tax_rate_id : null,
      productId
    ]
  );

  // If variants array is passed, update variants
  if (Array.isArray(variants)) {
    // Remove existing and insert new
    dbManager.run('DELETE FROM product_variants WHERE product_id = ?', [productId]);
    for (const v of variants) {
      if (v.variant_name) {
        dbManager.run(
          `INSERT INTO product_variants (product_id, variant_name, price_adjustment, is_default)
           VALUES (?, ?, ?, ?)`,
          [productId, v.variant_name.trim(), Number(v.price_adjustment) || 0, v.is_default ? 1 : 0]
        );
      }
    }
  }

  logActivity({
    entityType: 'PRODUCT',
    entityId: productId,
    action: 'UPDATE',
    userId: req.user?.id,
    userName: req.user?.name,
    details: { name, sales_price, status }
  });

  const updatedProduct = dbManager.get('SELECT * FROM products WHERE id = ?', [productId]);
  const currentVariants = dbManager.query('SELECT * FROM product_variants WHERE product_id = ?', [productId]);

  res.json({ product: { ...updatedProduct, variants: currentVariants } });
});

// DELETE /api/products/:id - Archive product (ADMIN only)
productsRouter.delete('/:id', authorizeRoles('ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const productId = parseInt(req.params.id, 10);
  const existing = dbManager.get('SELECT * FROM products WHERE id = ?', [productId]);
  if (!existing) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  // Preserve historical invoice lines by archiving rather than hard deleting
  dbManager.run('UPDATE products SET status = "ARCHIVED", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [productId]);

  logActivity({
    entityType: 'PRODUCT',
    entityId: productId,
    action: 'ARCHIVE',
    userId: req.user?.id,
    userName: req.user?.name
  });

  res.json({ message: 'Product archived successfully. Historical transactions remain preserved.' });
});
