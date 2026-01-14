import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.name, u.status, u.created_at, u.updated_at,
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

