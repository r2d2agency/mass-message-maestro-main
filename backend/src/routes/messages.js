import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'media');

fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '-').toLowerCase();
    const unique = Date.now();
    cb(null, `${base}-${unique}${ext}`);
  },
});

const upload = multer({ storage });

// List user message templates
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM message_templates WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List messages error:', error);
    res.status(500).json({ error: 'Erro ao listar mensagens' });
  }
});

router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }

    const protocolHeader = req.headers['x-forwarded-proto'];
    const protocol = Array.isArray(protocolHeader)
      ? protocolHeader[0]
      : protocolHeader || req.protocol;

    const host = req.get('host');
    let url;
    
    if (process.env.PUBLIC_URL) {
      url = `${process.env.PUBLIC_URL}/api/uploads/media/${req.file.filename}`;
    } else {
      url = `${protocol}://${host}/api/uploads/media/${req.file.filename}`;
    }

    console.log('File uploaded:', req.file.filename, 'URL:', url);

    res.json({ url, filename: req.file.filename });
  } catch (error) {
    console.error('Upload media error:', error);
    res.status(500).json({ error: 'Erro ao enviar arquivo' });
  }
});

// Get single message template
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM message_templates WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get message error:', error);
    res.status(500).json({ error: 'Erro ao buscar mensagem' });
  }
});

// Create message template
router.post('/', async (req, res) => {
  try {
    const { name, items } = req.body;

    if (!name || !items) {
      return res.status(400).json({ error: 'Nome e itens são obrigatórios' });
    }

    const result = await query(
      `INSERT INTO message_templates (user_id, name, items)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.userId, name, JSON.stringify(items)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Erro ao criar mensagem' });
  }
});

// Update message template
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, items } = req.body;

    const result = await query(
      `UPDATE message_templates 
       SET name = COALESCE($1, name),
           items = COALESCE($2, items),
           updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [name, items ? JSON.stringify(items) : null, id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update message error:', error);
    res.status(500).json({ error: 'Erro ao atualizar mensagem' });
  }
});

// Delete message template
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM message_templates WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Erro ao deletar mensagem' });
  }
});

export default router;
