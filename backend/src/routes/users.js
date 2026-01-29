import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.name, u.status, u.plan_name, u.monthly_message_limit,
              u.logo_url, u.favicon_url,
              u.created_at, u.updated_at,
              COALESCE((
                SELECT role FROM user_roles ur
                WHERE ur.user_id = u.id
                ORDER BY CASE WHEN ur.role = 'admin' THEN 1 ELSE 2 END
                LIMIT 1
              ), 'user') AS role
       FROM users u
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { email, password, name, role = 'user', plan_name, monthly_message_limit } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, nome e senha são obrigatórios' });
    }

    if (!['admin', 'manager', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Papel inválido' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await query(
      `INSERT INTO users (email, password_hash, name, plan_name, monthly_message_limit)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, status, plan_name, monthly_message_limit, created_at, updated_at`,
      [email, passwordHash, name, plan_name || null, monthly_message_limit || null]
    );

    const user = created.rows[0];

    await query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING',
      [user.id, role]
    );

    res.status(201).json({ ...user, role });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['active', 'inactive', 'blocked'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    if (id === req.userId && status !== 'active') {
      return res.status(400).json({ error: 'Você não pode alterar seu próprio status' });
    }

    const result = await query(
      `UPDATE users 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, name, status`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar status do usuário' });
  }
});

// Update user details
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      email, 
      password, 
      role, 
      plan_name, 
      monthly_message_limit,
      status 
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nome e Email são obrigatórios' });
    }

    // Check if email exists for another user
    const existing = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email já em uso por outro usuário' });
    }

    let passwordHash = null;
    if (password && password.trim()) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Update basic info
    let updateQuery = `
      UPDATE users 
      SET name = $1, 
          email = $2, 
          plan_name = $3, 
          monthly_message_limit = $4,
          updated_at = NOW()
    `;
    
    const params = [name, email, plan_name || null, monthly_message_limit || null];
    let paramCount = 5;

    if (passwordHash) {
      updateQuery += `, password_hash = $${paramCount}`;
      params.push(passwordHash);
      paramCount++;
    }

    if (status) {
      const allowedStatus = ['active', 'inactive', 'blocked'];
      if (allowedStatus.includes(status)) {
         updateQuery += `, status = $${paramCount}`;
         params.push(status);
         paramCount++;
      }
    }

    updateQuery += ` WHERE id = $${paramCount} RETURNING id, email, name, status, plan_name, monthly_message_limit, created_at, updated_at`;
    params.push(id);

    const result = await query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const updatedUser = result.rows[0];

    // Update role if provided
    if (role && ['admin', 'manager', 'user'].includes(role)) {
       // Check if trying to change own role if admin? (Optional safety)
       await query(
         `INSERT INTO user_roles (user_id, role) 
          VALUES ($1, $2) 
          ON CONFLICT (user_id, role) 
          DO UPDATE SET role = EXCLUDED.role`,
         [id, role]
       );
       updatedUser.role = role;
    } else {
       // Fetch current role
       const roleRes = await query(
        `SELECT role FROM user_roles WHERE user_id = $1 
         ORDER BY CASE WHEN role = 'admin' THEN 1 ELSE 2 END LIMIT 1`,
        [id]
       );
       updatedUser.role = roleRes.rows[0]?.role || 'user';
    }

    res.json(updatedUser);

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

router.patch('/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `UPDATE users 
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, name`,
      [passwordHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar senha do usuário' });
  }
});

router.patch('/:id/plan', async (req, res) => {
  try {
    const { id } = req.params;
    const { plan_name, monthly_message_limit } = req.body;

    const result = await query(
      `UPDATE users 
       SET plan_name = COALESCE($1, plan_name),
           monthly_message_limit = COALESCE($2, monthly_message_limit),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, name, status, plan_name, monthly_message_limit`,
      [plan_name ?? null, monthly_message_limit ?? null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar plano do usuário' });
  }
});

router.patch('/:id/branding', async (req, res) => {
  try {
    const { id } = req.params;
    const { logoUrl, faviconUrl } = req.body;

    const result = await query(
      `UPDATE users 
       SET logo_url = COALESCE($1, logo_url),
           favicon_url = COALESCE($2, favicon_url),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, name, status, logo_url, favicon_url`,
      [logoUrl ?? null, faviconUrl ?? null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      logoUrl: user.logo_url,
      faviconUrl: user.favicon_url,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar branding do usuário' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.userId) {
      return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário' });
    }

    const result = await query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar usuário' });
  }
});

export default router;
