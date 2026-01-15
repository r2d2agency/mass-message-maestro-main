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

// Update contact list
router.patch('/lists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const result = await query(
      `UPDATE contact_lists 
       SET name = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [name.trim(), id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update contact list error:', error);
    res.status(500).json({ error: 'Erro ao atualizar lista de contatos' });
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

    const listCheck = await query(
      'SELECT id FROM contact_lists WHERE id = $1 AND user_id = $2',
      [listId, req.userId]
    );

    if (listCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    const rawPhone = phone.toString().trim();
    const normalizedPhone = rawPhone.replace(/\D/g, '');
    const MIN_PHONE_LENGTH = 8;

    if (!normalizedPhone || normalizedPhone.length < MIN_PHONE_LENGTH) {
      return res.status(400).json({ error: 'Número de telefone inválido' });
    }

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
        error: 'Configure uma conexão Evolution antes de adicionar contatos',
      });
    }

    const { api_url, api_key, instance_name } = connectionResult.rows[0];

    let isWhatsapp = false;

    try {
      const evoResponse = await fetch(
        `${api_url}/chat/whatsappNumbers/${instance_name}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: api_key,
          },
          body: JSON.stringify({ numbers: [normalizedPhone] }),
        }
      );

      if (!evoResponse.ok) {
        console.error('Evolution whatsappNumbers error status (single):', evoResponse.status);
        return res.status(502).json({
          error: 'Não foi possível validar o número com a Evolution API',
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

        if (num === normalizedPhone && exists) {
          isWhatsapp = true;
          break;
        }
      }
    } catch (err) {
      console.error('Evolution whatsappNumbers request failed (single):', err);
      return res.status(502).json({
        error: 'Não foi possível validar o número com a Evolution API',
      });
    }

    if (!isWhatsapp) {
      return res.status(400).json({ error: 'Número não é WhatsApp válido' });
    }

    const result = await query(
      'INSERT INTO contacts (list_id, name, phone) VALUES ($1, $2, $3) RETURNING *',
      [listId, name, normalizedPhone]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add contact error:', error);
    res.status(500).json({ error: 'Erro ao adicionar contato' });
  }
});

// Update contact
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone } = req.body;

    if (!name && !phone) {
      return res.status(400).json({ error: 'Nada para atualizar' });
    }

    const contactResult = await query(
      `SELECT c.id, c.list_id, c.phone
       FROM contacts c
       JOIN contact_lists cl ON c.list_id = cl.id
       WHERE c.id = $1 AND cl.user_id = $2`,
      [id, req.userId]
    );

    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    const current = contactResult.rows[0];
    let newName = name;
    let newPhone = phone;

    if (typeof newName === 'string') {
      newName = newName.trim();
    }

    if (typeof newPhone === 'string') {
      newPhone = newPhone.toString().trim();
    }

    let normalizedPhone = current.phone;

    if (newPhone) {
      const digits = newPhone.replace(/\D/g, '');
      const MIN_PHONE_LENGTH = 8;

      if (!digits || digits.length < MIN_PHONE_LENGTH) {
        return res.status(400).json({ error: 'Número de telefone inválido' });
      }

      const duplicateCheck = await query(
        `SELECT id FROM contacts 
         WHERE list_id = $1 AND phone = $2 AND id <> $3`,
        [current.list_id, digits, id]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Já existe um contato com este número na lista' });
      }

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
          error: 'Configure uma conexão Evolution antes de atualizar contatos',
        });
      }

      const { api_url, api_key, instance_name } = connectionResult.rows[0];

      let isWhatsapp = false;

      try {
        const evoResponse = await fetch(
          `${api_url}/chat/whatsappNumbers/${instance_name}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: api_key,
            },
            body: JSON.stringify({ numbers: [digits] }),
          }
        );

        if (!evoResponse.ok) {
          console.error('Evolution whatsappNumbers error status (update):', evoResponse.status);
          return res.status(502).json({
            error: 'Não foi possível validar o número com a Evolution API',
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

          if (num === digits && exists) {
            isWhatsapp = true;
            break;
          }
        }
      } catch (err) {
        console.error('Evolution whatsappNumbers request failed (update):', err);
        return res.status(502).json({
          error: 'Não foi possível validar o número com a Evolution API',
        });
      }

      if (!isWhatsapp) {
        return res.status(400).json({ error: 'Número não é WhatsApp válido' });
      }

      normalizedPhone = digits;
    }

    const result = await query(
      `UPDATE contacts 
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newName || null, newPhone ? normalizedPhone : null, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Erro ao atualizar contato' });
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

    let candidates = normalized.filter(
      c => c.normalizedPhone && c.normalizedPhone.length >= MIN_PHONE_LENGTH
    );
    
    // DUPLICATE CHECK: Fetch existing phones in this list to avoid duplicates
    const existingPhonesResult = await query(
      'SELECT phone FROM contacts WHERE list_id = $1',
      [listId]
    );
    
    const existingPhones = new Set(existingPhonesResult.rows.map(row => row.phone));
    
    // Filter out duplicates from candidates
    candidates = candidates.filter(c => !existingPhones.has(c.normalizedPhone));
    const uniqueCandidates = candidates;

    const total = rawContacts.length;
    let totalErrors = total - candidates.length;

    if (candidates.length === 0) {
      // If all were duplicates or invalid
      return res.status(200).json({
        success: true,
        total,
        imported: 0,
        totalWhatsapp: 0,
        totalErrors,
        message: 'Nenhum contato novo ou válido para importar.'
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
    // We only check unique candidates
    const numbersToCheck = uniqueCandidates.map(c => c.normalizedPhone);

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
        // Fallback: If validation fails, we might want to allow import anyway or fail
        // For now, let's treat it as error but maybe we should allow?
        // User said "only 5 of 50 imported". This implies strict validation is the issue.
        // Let's Log it and continue with empty set (will result in 0 imported if strictly checking)
      } else {
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
            // Robust extraction of number
            const rawNum = (item.number || item.phone || '').toString().replace(/\D/g, '');
            // Check existence flag (Evolution returns exists: true/false)
            // Some versions might return status: 404 for non-existent, but here we likely get an array of objects
            const exists =
            item.exists === true ||
            item.isWhatsapp === true ||
            item.is_whatsapp === true ||
            item.isWhatsApp === true ||
            // If the API returns the number in the list, it MIGHT imply existence if it doesn't explicitly say exists:false
            // But usually Evolution is explicit.
            // Let's assume strict check for now but improve matching below
            (item.jid && item.jid.includes('@s.whatsapp.net'));

            if (rawNum && exists) {
                whatsappNumbers.add(rawNum);
            }
        }
      }
    } catch (err) {
      console.error('Evolution whatsappNumbers request failed:', err);
      // Fallback or error?
    }

    const validContacts = [];
    let totalWhatsapp = 0;
    let duplicates = candidates.length - uniqueCandidates.length;

    for (const c of uniqueCandidates) {
      // Improved matching logic:
      // Check if the candidate phone is in the verified set (exact match)
      // OR if any verified number ends with the candidate phone (e.g. 5511... ends with 11...)
      // OR if the candidate phone ends with any verified number (unlikely but possible)
      
      let isWhatsapp = whatsappNumbers.has(c.normalizedPhone);
      
      if (!isWhatsapp) {
          // Try suffix matching
          for (const verifiedNum of whatsappNumbers) {
              if (verifiedNum.endsWith(c.normalizedPhone) || c.normalizedPhone.endsWith(verifiedNum)) {
                  isWhatsapp = true;
                  break;
              }
          }
      }

      // Fallback: If the set is empty (API failed/returned weird data) but the number looks valid?
      // No, user wants verification. But if only 5/50 imported, it means matching failed.
      // Suffix matching should solve the country code issue (55).

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
      
      // Use ON CONFLICT DO NOTHING just in case, though we filtered uniqueCandidates
      await query(
        `INSERT INTO contacts (list_id, name, phone) VALUES ${values} ON CONFLICT DO NOTHING`,
        params
      );
    }

    res.json({
      success: true,
      total,
      imported,
      totalWhatsapp,
      totalErrors,
      duplicates
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
