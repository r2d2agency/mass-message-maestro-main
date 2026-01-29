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
    const { name, phone, active } = req.body;

    if (!name && !phone && active === undefined) {
      return res.status(400).json({ error: 'Nada para atualizar' });
    }

    const contactResult = await query(
      `SELECT c.id, c.list_id, c.phone, c.name, c.active
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
    let newActive = active !== undefined ? active : current.active;

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
        return res.status(400).json({ error: 'Este número já existe nesta lista' });
      }

      normalizedPhone = digits;
    }

    await query(
      `UPDATE contacts 
       SET name = $1, phone = $2, active = $3, updated_at = NOW() 
       WHERE id = $4`,
      [newName || current.name, normalizedPhone, newActive, id]
    );

    res.json({ success: true });
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
    
    // Filter out duplicates from candidates (current list)
    const newContacts = candidates.filter(c => !existingPhones.has(c.normalizedPhone));
    const currentListDuplicatesCount = candidates.length - newContacts.length;

    // GLOBAL DUPLICATE CHECK: Check if new contacts exist in other lists
    let globalDuplicates = [];
    const newContactPhones = newContacts.map(c => c.normalizedPhone);

    if (newContactPhones.length > 0) {
      const globalCheckResult = await query(
        `SELECT c.phone, cl.name as list_name 
         FROM contacts c
         JOIN contact_lists cl ON c.list_id = cl.id
         WHERE cl.user_id = $1 AND c.phone = ANY($2) AND c.list_id != $3`,
        [req.userId, newContactPhones, listId]
      );

      // Group by phone
      const duplicatesMap = {};
      globalCheckResult.rows.forEach(row => {
        if (!duplicatesMap[row.phone]) {
          duplicatesMap[row.phone] = new Set();
        }
        duplicatesMap[row.phone].add(row.list_name);
      });

      globalDuplicates = Object.keys(duplicatesMap).map(phone => ({
        phone,
        lists: Array.from(duplicatesMap[phone])
      }));
    }

    const total = rawContacts.length;
    // totalErrors here includes invalid formats + duplicates in current list
    // But usually totalErrors implies "failed to import". 
    // Duplicates in current list are technically "failed to import" as new.
    let totalErrors = total - newContacts.length;

    if (newContacts.length === 0) {
      // If all were duplicates or invalid
      return res.status(200).json({
        success: true,
        total,
        imported: 0,
        totalWhatsapp: 0,
        totalErrors,
        duplicates: currentListDuplicatesCount,
        globalDuplicates,
        message: 'Nenhum contato novo ou válido para importar.'
      });
    }

    // Prepare for insertion
    const validContacts = newContacts.map(c => ({
      name: c.name,
      phone: c.normalizedPhone,
    }));

    const imported = validContacts.length;

    if (imported > 0) {
      const values = validContacts
        .map((c, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3}, NULL)`) // NULL for is_whatsapp
        .join(', ');

      const params = [listId, ...validContacts.flatMap(c => [c.name, c.phone])];
      
      // Use ON CONFLICT DO NOTHING just in case
      await query(
        `INSERT INTO contacts (list_id, name, phone, is_whatsapp) VALUES ${values} ON CONFLICT DO NOTHING`,
        params
      );
    }

    res.json({
      success: true,
      total,
      imported,
      totalWhatsapp: 0,
      totalErrors, 
      duplicates: currentListDuplicatesCount,
      globalDuplicates,
      message: 'Contatos importados com sucesso. Use a opção "Validar" para verificar quais possuem WhatsApp.'
    });
  } catch (error) {
    console.error('Import contacts error:', error);
    res.status(500).json({ error: 'Erro ao importar contatos' });
  }
});

// Validate contacts in a list
router.post('/lists/:listId/validate', async (req, res) => {
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

    // Get connection
    const connectionResult = await query(
      `SELECT api_url, api_key, instance_name
       FROM connections
       WHERE user_id = $1 AND status = 'connected'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [req.userId]
    );

    let connection = null;

    if (connectionResult.rows.length === 0) {
      // Fallback to any connection if status is not reliably updated
       const anyConnection = await query(
        `SELECT api_url, api_key, instance_name
         FROM connections
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [req.userId]
      );
      if (anyConnection.rows.length === 0) {
         return res.status(400).json({ error: 'Nenhuma conexão Evolution disponível.' });
      }
      connection = anyConnection.rows[0];
    } else {
      connection = connectionResult.rows[0];
    }

    const { api_url, api_key, instance_name } = connection;

    // Get contacts to validate (is_whatsapp IS NULL)
    const contactsResult = await query(
      'SELECT id, phone FROM contacts WHERE list_id = $1 AND is_whatsapp IS NULL',
      [listId]
    );

    const contactsToValidate = contactsResult.rows;

    if (contactsToValidate.length === 0) {
      return res.json({ message: 'Todos os contatos já foram validados ou a lista está vazia.', validated: 0 });
    }

    // Process in chunks to avoid timeout
    const CHUNK_SIZE = 50; 
    let validatedCount = 0;
    
    for (let i = 0; i < contactsToValidate.length; i += CHUNK_SIZE) {
        const chunk = contactsToValidate.slice(i, i + CHUNK_SIZE);
        const numbersToCheck = chunk.map(c => c.phone);

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
                console.error('Validation error:', evoResponse.status);
                continue; 
            }

            const evoData = await evoResponse.json();
            
             const resultsArray = Array.isArray(evoData) ? evoData : (evoData.numbers || []);
             
             const validNumbers = new Set();
             
             for (const item of resultsArray) {
                 const rawNum = (item.number || item.phone || '').toString().replace(/\D/g, '');
                 const exists = item.exists === true || item.isWhatsapp === true || (item.jid && item.jid.includes('@s.whatsapp.net'));
                 
                 if (rawNum && exists) {
                     validNumbers.add(rawNum);
                 }
             }

             const validIds = [];
             const invalidIds = [];
             
             for (const c of chunk) {
                 let isValid = validNumbers.has(c.phone);
                 if (!isValid) {
                     for (const v of validNumbers) {
                         if (v.endsWith(c.phone) || c.phone.endsWith(v)) {
                             isValid = true;
                             break;
                         }
                     }
                 }
                 
                 if (isValid) validIds.push(c.id);
                 else invalidIds.push(c.id);
             }
             
             if (validIds.length > 0) {
                 await query(`UPDATE contacts SET is_whatsapp = TRUE WHERE id = ANY($1::uuid[])`, [validIds]);
             }
             if (invalidIds.length > 0) {
                 await query(`UPDATE contacts SET is_whatsapp = FALSE WHERE id = ANY($1::uuid[])`, [invalidIds]);
             }
             
             validatedCount += chunk.length;

        } catch (err) {
            console.error('Validation chunk failed:', err);
        }
    }

    res.json({ success: true, validated: validatedCount });

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Erro ao validar contatos' });
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
