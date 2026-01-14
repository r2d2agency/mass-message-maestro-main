import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import connectionsRoutes from './routes/connections.js';
import messagesRoutes from './routes/messages.js';
import contactsRoutes from './routes/contacts.js';
import campaignsRoutes from './routes/campaigns.js';
import usersRoutes from './routes/users.js';
import { testConnection, query } from './db.js';
import { startWorker } from './services/worker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const SUPER_ADMIN_EMAIL = 'tnicodemos@gmail.com';

async function ensureSuperAdmin() {
  try {
    const result = await query(
      'SELECT id FROM users WHERE email = $1',
      [SUPER_ADMIN_EMAIL]
    );

    if (result.rows.length === 0) {
      console.warn(`Super admin user not found: ${SUPER_ADMIN_EMAIL}`);
      return;
    }

    const userId = result.rows[0].id;

    await query(
      "INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT (user_id, role) DO NOTHING",
      [userId]
    );
  } catch (error) {
    console.error('Error ensuring super admin:', error);
  }
}

// Test DB connection on startup
testConnection().then(async connected => {
  if (!connected) {
    console.error('CRITICAL: Could not connect to database. Server may not function correctly.');
  } else {
    await ensureSuperAdmin();
    startWorker();
  }
});

// Handle preflight requests explicitly
app.options('*', cors());

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/users', usersRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Blaster API v1.0.3 running on port ${PORT}`);
});
