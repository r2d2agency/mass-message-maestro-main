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
      message_ids,
      scheduled_at,
      end_at,
      min_delay,
      max_delay 
    } = req.body;

    // Normalize message_ids
    let finalMessageIds = [];
    if (Array.isArray(message_ids) && message_ids.length > 0) {
      finalMessageIds = message_ids;
    } else if (message_id) {
      finalMessageIds = [message_id];
    }

    if (!name || !connection_id || !list_id || finalMessageIds.length === 0) {
      return res.status(400).json({ 
        error: 'Nome, conexão, lista e pelo menos uma mensagem são obrigatórios' 
      });
    }

    // Verify ownership of related resources
    const checks = await Promise.all([
      query('SELECT id FROM connections WHERE id = $1 AND user_id = $2', [connection_id, req.userId]),
      query('SELECT id FROM contact_lists WHERE id = $1 AND user_id = $2', [list_id, req.userId]),
      // Verify all messages exist using ANY
      query('SELECT id FROM message_templates WHERE id = ANY($1::uuid[]) AND user_id = $2', [finalMessageIds, req.userId]),
    ]);

    if (checks[0].rows.length === 0 || checks[1].rows.length === 0) {
      return res.status(400).json({ error: 'Conexão ou Lista inválida' });
    }

    if (checks[2].rows.length !== finalMessageIds.length) {
      return res.status(400).json({ error: 'Uma ou mais mensagens selecionadas são inválidas' });
    }

    const mainMessageId = finalMessageIds[0];

    const result = await query(
      `INSERT INTO campaigns 
       (user_id, name, connection_id, list_id, message_id, message_ids, scheduled_at, end_at, min_delay, max_delay)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [
        req.userId, 
        name, 
        connection_id, 
        list_id, 
        mainMessageId,
        JSON.stringify(finalMessageIds),
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
      message_ids,
      scheduled_at,
      end_at,
      min_delay,
      max_delay
    } = req.body;

    // Normalize message_ids
    let finalMessageIds = [];
    if (Array.isArray(message_ids) && message_ids.length > 0) {
      finalMessageIds = message_ids;
    } else if (message_id) {
      finalMessageIds = [message_id];
    }

    if (!name || !connection_id || !list_id || finalMessageIds.length === 0) {
      return res.status(400).json({
        error: 'Nome, conexão, lista e pelo menos uma mensagem são obrigatórios'
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

    const mainMessageId = finalMessageIds[0];

    const result = await query(
      `UPDATE campaigns 
       SET name = $1, connection_id = $2, list_id = $3, message_id = $4, message_ids = $5,
           scheduled_at = $6, end_at = $7, min_delay = $8, max_delay = $9, updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        name, 
        connection_id, 
        list_id, 
        mainMessageId,
        JSON.stringify(finalMessageIds),
        scheduled_at || null,
        end_at || null,
        min_delay || 90,
        max_delay || 300,
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({ error: 'Erro ao atualizar campanha' });
  }
});

// Export campaign messages
router.get('/:id/export', async (req, res) => {
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

    const result = await query(
      `SELECT cm.id, ct.name, ct.phone, cm.status, cm.error_message, cm.scheduled_for, cm.sent_at
       FROM campaign_messages cm
       LEFT JOIN contacts ct ON cm.contact_id = ct.id
       WHERE cm.campaign_id = $1
       ORDER BY cm.scheduled_for ASC`,
      [id]
    );

    const headers = ['Nome', 'Telefone', 'Status', 'Erro', 'Agendado Para', 'Enviado Em'];
    const csvRows = [headers.join(',')];

    for (const row of result.rows) {
      const line = [
        `"${(row.name || '').replace(/"/g, '""')}"`,
        `"${(row.phone || '').replace(/"/g, '""')}"`,
        row.status,
        `"${(row.error_message || '').replace(/"/g, '""')}"`,
        row.scheduled_for ? new Date(row.scheduled_for).toLocaleString() : '',
        row.sent_at ? new Date(row.sent_at).toLocaleString() : ''
      ];
      csvRows.push(line.join(','));
    }

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${id}-export.csv"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export campaign error:', error);
    res.status(500).json({ error: 'Erro ao exportar campanha' });
  }
});

// Get campaign logs
router.get('/:id/logs', async (req, res) => {
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
      `SELECT 
         cm.id, 
         ct.name as "contactName", 
         ct.phone, 
         cm.status, 
         cm.error_message as "errorMessage", 
         cm.scheduled_for as "scheduledAt", 
         cm.sent_at as "sentAt"
       FROM campaign_messages cm
       LEFT JOIN contacts ct ON cm.contact_id = ct.id
       WHERE cm.campaign_id = $1
       ORDER BY cm.scheduled_for ASC, cm.created_at ASC
       LIMIT 1000`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get campaign logs error:', error);
    res.status(500).json({ error: 'Erro ao buscar logs da campanha' });
  }
});

// Delete campaign
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First check if campaign exists and belongs to user
    const campaign = await query(
      'SELECT status FROM campaigns WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (campaign.rows.length === 0) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    // Optional: Prevent deleting running campaigns
    if (campaign.rows[0].status === 'running') {
      return res.status(400).json({ error: 'Não é possível excluir uma campanha em execução' });
    }

    // Delete related messages first (cascade should handle this if configured, but explicit is safer)
    await query('DELETE FROM campaign_messages WHERE campaign_id = $1', [id]);
    
    // Delete campaign
    await query('DELETE FROM campaigns WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ error: 'Erro ao deletar campanha' });
  }
});

export default router;