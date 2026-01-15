import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { scheduleCampaign } from '../services/scheduler.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, 
              cl.name as list_name,
              mt.name as message_name,
              conn.name as connection_name
       FROM campaigns c
       LEFT JOIN contact_lists cl ON c.list_id = cl.id
       LEFT JOIN message_templates mt ON c.message_id = mt.id
       LEFT JOIN connections conn ON c.connection_id = conn.id
       WHERE c.user_id IN (
         SELECT id FROM users WHERE id = $1 OR manager_id = $1
       )
       ORDER BY c.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List campaigns error:', error);
    res.status(500).json({ error: 'Erro ao listar campanhas' });
  }
});

// Create campaign
router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      connection_id, 
      list_id, 
      message_id, 
      scheduled_at,
      end_at,
      min_delay,
      max_delay 
    } = req.body;

    if (!name || !connection_id || !list_id || !message_id) {
      return res.status(400).json({ 
        error: 'Nome, conexão, lista e mensagem são obrigatórios' 
      });
    }

    // Verify ownership of related resources
    const checks = await Promise.all([
      query('SELECT id FROM connections WHERE id = $1 AND user_id = $2', [connection_id, req.userId]),
      query('SELECT id FROM contact_lists WHERE id = $1 AND user_id = $2', [list_id, req.userId]),
      query('SELECT id FROM message_templates WHERE id = $1 AND user_id = $2', [message_id, req.userId]),
    ]);

    if (checks.some(c => c.rows.length === 0)) {
      return res.status(400).json({ error: 'Recursos inválidos' });
    }

    const result = await query(
      `INSERT INTO campaigns 
       (user_id, name, connection_id, list_id, message_id, scheduled_at, end_at, min_delay, max_delay)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [
        req.userId, 
        name, 
        connection_id, 
        list_id, 
        message_id, 
        scheduled_at || null,
        end_at || null,
        min_delay || 90,
        max_delay || 300
      ]
    );

    const campaign = result.rows[0];

    // Trigger scheduling
    // We don't await this so the UI response is fast
    scheduleCampaign(campaign.id).catch(err => 
      console.error(`Failed to schedule campaign ${campaign.id}:`, err)
    );

    res.status(201).json(campaign);
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ error: 'Erro ao criar campanha' });
  }
});

// Update campaign status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'running', 'paused', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const result = await query(
      `UPDATE campaigns 
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [status, id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update campaign status error:', error);
    res.status(500).json({ error: 'Erro ao atualizar campanha' });
  }
});

// Get campaign stats
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await query(
      `SELECT * FROM campaigns 
       WHERE id = $1 
         AND user_id IN (
           SELECT id FROM users WHERE id = $2 OR manager_id = $2
         )`,
      [id, req.userId]
    );

    if (campaign.rows.length === 0) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    const stats = await query(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'sent') as sent,
         COUNT(*) FILTER (WHERE status = 'failed') as failed,
         COUNT(*) FILTER (WHERE status = 'pending') as pending
       FROM campaign_messages WHERE campaign_id = $1`,
      [id]
    );

    res.json({
      campaign: campaign.rows[0],
      stats: stats.rows[0]
    });
  } catch (error) {
    console.error('Get campaign stats error:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// Update campaign
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      connection_id,
      list_id,
      message_id,
      scheduled_at,
      end_at,
      min_delay,
      max_delay
    } = req.body;

    if (!name || !connection_id || !list_id || !message_id) {
      return res.status(400).json({
        error: 'Nome, conexão, lista e mensagem são obrigatórios'
      });
    }

    const existing = await query(
      'SELECT * FROM campaigns WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    const current = existing.rows[0];
    if (current.status === 'completed' || current.status === 'cancelled') {
      return res.status(400).json({ error: 'Campanhas concluídas não podem ser editadas' });
    }

    const checks = await Promise.all([
      query('SELECT id FROM connections WHERE id = $1 AND user_id = $2', [connection_id, req.userId]),
      query('SELECT id FROM contact_lists WHERE id = $1 AND user_id = $2', [list_id, req.userId]),
      query('SELECT id FROM message_templates WHERE id = $1 AND user_id = $2', [message_id, req.userId]),
    ]);

    if (checks.some(c => c.rows.length === 0)) {
      return res.status(400).json({ error: 'Recursos inválidos' });
    }

    await query(
      'DELETE FROM campaign_messages WHERE campaign_id = $1',
      [id]
    );

    const result = await query(
      `UPDATE campaigns
       SET name = $1,
           connection_id = $2,
           list_id = $3,
           message_id = $4,
           scheduled_at = $5,
           end_at = $6,
           min_delay = $7,
           max_delay = $8,
           status = 'pending',
           sent_count = 0,
           failed_count = 0,
           updated_at = NOW()
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [
        name,
        connection_id,
        list_id,
        message_id,
        scheduled_at || null,
        end_at || null,
        min_delay || 90,
        max_delay || 300,
        id,
        req.userId
      ]
    );

    const campaign = result.rows[0];

    scheduleCampaign(campaign.id).catch(err =>
      console.error(`Failed to reschedule campaign ${campaign.id}:`, err)
    );

    res.json(campaign);
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({ error: 'Erro ao atualizar campanha' });
  }
});

router.get('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await query(
      `SELECT id FROM campaigns 
       WHERE id = $1 
         AND user_id IN (
           SELECT id FROM users WHERE id = $2 OR manager_id = $2
         )`,
      [id, req.userId]
    );

    if (campaign.rows.length === 0) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    const result = await query(
      `SELECT cm.id,
              cm.campaign_id,
              cm.contact_id,
              cm.phone,
              cm.status,
              cm.scheduled_for,
              cm.sent_at,
              cm.error_message,
              cm.created_at,
              c.name as contact_name
       FROM campaign_messages cm
       LEFT JOIN contacts c ON cm.contact_id = c.id
       WHERE cm.campaign_id = $1
       ORDER BY cm.created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List campaign messages error:', error);
    res.status(500).json({ error: 'Erro ao listar mensagens da campanha' });
  }
});

// Delete campaign
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM campaigns WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ error: 'Erro ao deletar campanha' });
  }
});

export default router;
