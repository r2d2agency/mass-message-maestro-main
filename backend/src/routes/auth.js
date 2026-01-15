import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    if (process.env.ALLOW_REGISTRATION !== 'true') {
      return res.status(403).json({ error: 'Registro de novos usuários está desabilitado' });
    }

    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, passwordHash, name]
    );

    const user = result.rows[0];

    await query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING',
      [user.id, 'user']
    );

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const result = await query(
      'SELECT id, email, name, password_hash, status FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Usuário inativo' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Usuário bloqueado' });
    }

    const roleResult = await query(
      "SELECT role FROM user_roles WHERE user_id = $1 ORDER BY CASE WHEN role = 'admin' THEN 1 WHEN role = 'manager' THEN 2 ELSE 3 END LIMIT 1",
      [user.id]
    );

    const role = roleResult.rows[0]?.role || 'user';

    const token = jwt.sign(
      { userId: user.id, email: user.email, role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      'SELECT id, email, name, status, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];

    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Usuário inativo' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Usuário bloqueado' });
    }

    const roleResult = await query(
      "SELECT role FROM user_roles WHERE user_id = $1 ORDER BY CASE WHEN role = 'admin' THEN 1 WHEN role = 'manager' THEN 2 ELSE 3 END LIMIT 1",
      [user.id]
    );

    const role = roleResult.rows[0]?.role || 'user';

    res.json({ user: { ...user, role } });
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

router.get('/branding', async (_req, res) => {
  try {
    const result = await query(
      `SELECT u.logo_url, u.favicon_url
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'admin'
       ORDER BY u.created_at ASC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.json({ logoUrl: null, faviconUrl: null });
    }

    const row = result.rows[0];
    res.json({
      logoUrl: row.logo_url || null,
      faviconUrl: row.favicon_url || null,
    });
  } catch (error) {
    console.error('Branding fetch error:', error);
    res.status(500).json({ error: 'Erro ao carregar branding' });
  }
});

export default router;
