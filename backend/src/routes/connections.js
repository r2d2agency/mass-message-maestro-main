import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM connections 
       WHERE user_id IN (
         SELECT id FROM users WHERE id = $1 OR manager_id = $1
       )
       ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List connections error:', error);
    res.status(500).json({ error: 'Erro ao listar conexões' });
  }
});

// Create connection
router.post('/', async (req, res) => {
  try {
    const { api_url, api_key, instance_name, name } = req.body;

    if (!api_url || !api_key || !instance_name) {
      return res.status(400).json({ error: 'URL, API Key e nome da instância são obrigatórios' });
    }

    const result = await query(
      `INSERT INTO connections (user_id, api_url, api_key, instance_name, name)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.userId, api_url, api_key, instance_name, name || instance_name]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create connection error:', error);
    res.status(500).json({ error: 'Erro ao criar conexão' });
  }
});

// Update connection
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { api_url, api_key, instance_name, name, status } = req.body;

    const result = await query(
      `UPDATE connections 
       SET api_url = COALESCE($1, api_url),
           api_key = COALESCE($2, api_key),
           instance_name = COALESCE($3, instance_name),
           name = COALESCE($4, name),
           status = COALESCE($5, status),
           updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [api_url, api_key, instance_name, name, status, id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update connection error:', error);
    res.status(500).json({ error: 'Erro ao atualizar conexão' });
  }
});

// Delete connection
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM connections WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete connection error:', error);
    res.status(500).json({ error: 'Erro ao deletar conexão' });
  }
});

router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const { phone, text } = req.body;

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Telefone de destino é obrigatório' });
    }

    const connectionRes = await query(
      `SELECT * FROM connections 
       WHERE id = $1 
         AND user_id IN (
           SELECT id FROM users WHERE id = $2 OR manager_id = $2
         )`,
      [id, req.userId]
    );

    if (connectionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    const connection = connectionRes.rows[0];

    const apiUrl = connection.api_url.replace(/\/$/, '');
    const apiKey = connection.api_key;
    const instanceName = connection.instance_name;

    const payload = {
      number: phone,
      text:
        typeof text === 'string' && text.trim().length > 0
          ? text
          : 'Mensagem de teste enviada pelo Blaster para validar sua conexão.',
    };

    const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify(payload),
    });

    const bodyText = await response.text().catch(() => '');

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Erro ao enviar mensagem de teste',
        details: bodyText || `Evolution API error (${response.status})`,
      });
    }

    res.json({
      success: true,
      message: 'Mensagem de teste enviada com sucesso',
      rawResponse: bodyText || null,
    });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({
      error: 'Erro ao testar conexão',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

export default router;
