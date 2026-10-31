import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbManager } from '../db/database';
import { authenticate, authorizeRoles, AuthenticatedRequest, JWT_SECRET, AuthUser } from '../middleware/auth';
import { logActivity } from '../utils/audit';

export const authRouter = Router();

// In-memory or persisted dev reset tokens
const devPasswordResetTokens = new Map<string, { email: string; expiresAt: number }>();

function validatePasswordPolicy(password: string): { isValid: boolean; message?: string } {
  if (!password || password.length <= 8) {
    return { isValid: false, message: 'Password must be longer than 8 characters.' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>_~\-+=\[\]\\\/]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character.' };
  }
  return { isValid: true };
}

// POST /api/auth/register
authRouter.post('/register', (req, res: Response): void => {
  const { name, email, password, role = 'STAFF', customerId } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required.' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: 'Please provide a valid email address.' });
    return;
  }

  const policyCheck = validatePasswordPolicy(password);
  if (!policyCheck.isValid) {
    res.status(400).json({ error: policyCheck.message });
    return;
  }

  // Check unique email
  const existingUser = dbManager.get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (existingUser) {
    res.status(409).json({ error: 'A user with this email address already exists.' });
    return;
  }

  const allowedRoles = ['ADMIN', 'STAFF', 'CUSTOMER'];
  const userRole = allowedRoles.includes(role) ? role : 'STAFF';

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const result = dbManager.run(
    `INSERT INTO users (name, email, password_hash, role, customer_id)
     VALUES (?, ?, ?, ?, ?)`,
    [name.trim(), email.trim().toLowerCase(), passwordHash, userRole, customerId || null]
  );

  const newUser: AuthUser = {
    id: result.lastInsertRowid,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: userRole as any,
    customerId: customerId || null
  };

  const token = jwt.sign(newUser, JWT_SECRET, { expiresIn: '7d' });

  logActivity({
    entityType: 'USER',
    entityId: newUser.id,
    action: 'REGISTER',
    userId: newUser.id,
    userName: newUser.name,
    details: { email: newUser.email, role: newUser.role }
  });

  res.status(201).json({
    message: 'User registered successfully.',
    token,
    user: newUser
  });
});

// POST /api/auth/login
authRouter.post('/login', (req, res: Response): void => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = dbManager.get(
    'SELECT id, name, email, password_hash, role, customer_id FROM users WHERE email = ?',
    [email.trim().toLowerCase()]
  );

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password credentials.' });
    return;
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    res.status(401).json({ error: 'Invalid email or password credentials.' });
    return;
  }

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    customerId: user.customer_id
  };

  const token = jwt.sign(authUser, JWT_SECRET, { expiresIn: '7d' });

  logActivity({
    entityType: 'USER',
    entityId: authUser.id,
    action: 'LOGIN',
    userId: authUser.id,
    userName: authUser.name
  });

  res.json({
    message: 'Login successful.',
    token,
    user: authUser
  });
});

// GET /api/auth/me
authRouter.get('/me', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const user = dbManager.get(
    'SELECT id, name, email, role, customer_id, created_at FROM users WHERE id = ?',
    [req.user.id]
  );

  if (!user) {
    res.status(404).json({ error: 'User record not found.' });
    return;
  }

  res.json({ user });
});

// POST /api/auth/reset-password-request
authRouter.post('/reset-password-request', (req, res: Response): void => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Email is required for password reset.' });
    return;
  }

  const user = dbManager.get('SELECT id, email, name FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (!user) {
    // Avoid user enumeration in public responses, but in dev mode provide clarity
    res.json({
      message: 'If the email matches an account, a reset token has been generated.',
      devModeNotice: 'External SMTP service is not configured. For development testing, you can use the dev reset endpoint.'
    });
    return;
  }

  // Generate safe development reset token
  const resetToken = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins
  devPasswordResetTokens.set(resetToken, { email: user.email, expiresAt });

  res.json({
    message: 'Password reset code generated.',
    devModeNotice: 'External email service is not configured. Development reset code provided below.',
    devResetCode: resetToken,
    expiresInMinutes: 15
  });
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', (req, res: Response): void => {
  const { email, resetCode, newPassword } = req.body;

  if (!email || !resetCode || !newPassword) {
    res.status(400).json({ error: 'Email, reset code, and new password are required.' });
    return;
  }

  const policyCheck = validatePasswordPolicy(newPassword);
  if (!policyCheck.isValid) {
    res.status(400).json({ error: policyCheck.message });
    return;
  }

  const tokenData = devPasswordResetTokens.get(resetCode.trim().toUpperCase());
  if (!tokenData || tokenData.email !== email.trim().toLowerCase() || tokenData.expiresAt < Date.now()) {
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(newPassword, salt);

  dbManager.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?', [
    passwordHash,
    email.trim().toLowerCase()
  ]);

  devPasswordResetTokens.delete(resetCode.trim().toUpperCase());

  logActivity({
    entityType: 'USER',
    action: 'PASSWORD_RESET',
    details: { email }
  });

  res.json({ message: 'Password has been successfully updated. You may now log in.' });
});

// GET /api/auth/users (ADMIN only)
authRouter.get('/users', authenticate, authorizeRoles('ADMIN'), (req: AuthenticatedRequest, res: Response): void => {
  const users = dbManager.query(
    `SELECT u.id, u.name, u.email, u.role, u.customer_id, u.created_at, c.name AS customer_name
     FROM users u
     LEFT JOIN customers c ON u.customer_id = c.id
     ORDER BY u.id ASC`
  );
  res.json({ users });
});