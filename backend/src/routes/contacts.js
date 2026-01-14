import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// List all contacts for current user
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, cl.name as list_name
       FROM contacts c
       JOIN contact_lists cl ON c.list_id = cl.id
       WHERE cl.user_id = $1
       ORDER BY c.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List contacts error:', error);
    res.status(500).json({ error: 'Erro ao listar contatos' });
  }
});

// List user contact lists
router.get('/lists', async (req, res) => {
  try {
    const result = await query(
      `SELECT cl.*, COUNT(c.id) as contact_count
       FROM contact_lists cl
       LEFT JOIN contacts c ON c.list_id = cl.id
       WHERE cl.user_id = $1
       GROUP BY cl.id
       ORDER BY cl.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List contact lists error:', error);
    res.status(500).json({ error: 'Erro ao listar listas de contatos' });
  }
});

// Create contact list
router.post('/lists', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const result = await query(
      'INSERT INTO contact_lists (user_id, name) VALUES ($1, $2) RETURNING *',
      [req.userId, name]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create contact list error:', error);
    res.status(500).json({ error: 'Erro ao criar lista de contatos' });
  }
});

// Delete contact list
router.delete('/lists/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM contact_lists WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete contact list error:', error);
    res.status(500).json({ error: 'Erro ao deletar lista' });
  }
});

// List contacts from a list
router.get('/lists/:listId/contacts', async (req, res) => {
  try {
    const { listId } = req.params;

    // Verify list belongs to user
    const listCheck = await query(
      'SELECT id FROM contact_lists WHERE id = $1 AND user_id = $2',
      [listId, req.userId]
    );

    if (listCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    const result = await query(
      'SELECT * FROM contacts WHERE list_id = $1 ORDER BY name ASC',
      [listId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List contacts error:', error);
    res.status(500).json({ error: 'Erro ao listar contatos' });
  }
});

// Add contact to list
router.post('/lists/:listId/contacts', async (req, res) => {
  try {
    const { listId } = req.params;
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
    }

    // Verify list belongs to user
    const listCheck = await query(
      'SELECT id FROM contact_lists WHERE id = $1 AND user_id = $2',
      [listId, req.userId]
    );

    if (listCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    const result = await query(
      'INSERT INTO contacts (list_id, name, phone) VALUES ($1, $2, $3) RETURNING *',
      [listId, name, phone]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add contact error:', error);
    res.status(500).json({ error: 'Erro ao adicionar contato' });
  }
});

// Bulk import contacts with Evolution validation
router.post('/lists/:listId/import', async (req, res) => {
  try {
    const { listId } = req.params;
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Lista de contatos inválida' });
    }

    // Verify list belongs to user
    const listCheck = await query(
      'SELECT id FROM contact_lists WHERE id = $1 AND user_id = $2',
      [listId, req.userId]
    );

    if (listCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    const rawContacts = contacts.map(c => ({
      name: (c.name || '').toString().trim() || 'Sem nome',
      phone: (c.phone || '').toString().trim(),
    }));

    // Normalize phones (digits only) and discard clearly invalid formats
    const normalized = rawContacts.map(c => {
      const digits = c.phone.replace(/\D/g, '');
      return { ...c, normalizedPhone: digits };
    });

    const MIN_PHONE_LENGTH = 8;

    const candidates = normalized.filter(
      c => c.normalizedPhone && c.normalizedPhone.length >= MIN_PHONE_LENGTH
    );

    const total = rawContacts.length;
    let totalErrors = total - candidates.length;

    if (candidates.length === 0) {
      return res.status(400).json({
        error: 'Nenhum número válido encontrado para importação',
        total,
        imported: 0,
        totalWhatsapp: 0,
        totalErrors: total,
      });
    }

    // Use user's latest Evolution connection to validate numbers
    const connectionResult = await query(
      `SELECT api_url, api_key, instance_name
       FROM connections
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.userId]
    );

    if (connectionResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Configure uma conexão Evolution antes de importar contatos',
      });
    }

    const { api_url, api_key, instance_name } = connectionResult.rows[0];

    // Call Evolution API to check which numbers are WhatsApp
    const numbersToCheck = candidates.map(c => c.normalizedPhone);

    let whatsappNumbers = new Set();

    try {
      const evoResponse = await fetch(
        `${api_url}/chat/whatsappNumbers/${instance_name}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: api_key,
          },
          body: JSON.stringify({ numbers: numbersToCheck }),
        }
      );

      if (!evoResponse.ok) {
        console.error('Evolution whatsappNumbers error status:', evoResponse.status);
        return res.status(502).json({
          error: 'Não foi possível validar os números com a Evolution API',
        });
      }

      const evoData = await evoResponse.json();

      const resultsArray = Array.isArray(evoData)
        ? evoData
        : Array.isArray(evoData.numbers)
        ? evoData.numbers
        : Array.isArray(evoData.result)
        ? evoData.result
        : Array.isArray(evoData.response)
        ? evoData.response
        : [];

      for (const item of resultsArray) {
        const num = (item.number || item.phone || '').toString().replace(/\D/g, '');
        const exists =
          item.exists === true ||
          item.isWhatsapp === true ||
          item.is_whatsapp === true ||
          item.isWhatsApp === true;

        if (num && exists) {
          whatsappNumbers.add(num);
        }
      }
    } catch (err) {
      console.error('Evolution whatsappNumbers request failed:', err);
      return res.status(502).json({
        error: 'Não foi possível validar os números com a Evolution API',
      });
    }

    const validContacts = [];
    let totalWhatsapp = 0;

    for (const c of candidates) {
      const isWhatsapp = whatsappNumbers.has(c.normalizedPhone);

      if (isWhatsapp) {
        totalWhatsapp += 1;
        validContacts.push({
          name: c.name,
          phone: c.normalizedPhone,
        });
      } else {
        totalErrors += 1;
      }
    }

    const imported = validContacts.length;

    if (imported > 0) {
      const values = validContacts
        .map((c, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
        .join(', ');

      const params = [listId, ...validContacts.flatMap(c => [c.name, c.phone])];

      await query(
        `INSERT INTO contacts (list_id, name, phone) VALUES ${values}`,
        params
      );
    }

    res.json({
      success: true,
      total,
      imported,
      totalWhatsapp,
      totalErrors,
    });
  } catch (error) {
    console.error('Import contacts error:', error);
    res.status(500).json({ error: 'Erro ao importar contatos' });
  }
});

// Delete contact
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify contact belongs to user's list
    const result = await query(
      `DELETE FROM contacts 
       WHERE id = $1 AND list_id IN (
         SELECT id FROM contact_lists WHERE user_id = $2
       ) RETURNING id`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Erro ao deletar contato' });
  }
});

export default router;
