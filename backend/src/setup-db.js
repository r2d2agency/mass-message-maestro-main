import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_SCRIPT_VERSION = 'setup-db-v2-idx-fix-2026-01-14';

const setupDb = async () => {
  try {
    console.log('Running DB setup script version:', MIGRATION_SCRIPT_VERSION);
    const schemaPath = path.join(__dirname, '../schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.error(`Schema file not found at: ${schemaPath}`);
      process.exit(1);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Connecting to database...');
    // A simple query to test connection before running the big script
    await pool.query('SELECT 1');
    console.log('Connected. Running schema migration...');

    try {
      await pool.query(schemaSql);
      console.log('Schema migration completed successfully.');
    } catch (error) {
      if (error.code === '42P07' && String(error.message).includes('idx_message_templates_user_id')) {
        console.warn('Index idx_message_templates_user_id already exists. Continuing migration...');
      } else {
        throw error;
      }
    }

    // Manual migration fix to ensure end_at exists (double check)
    try {
      console.log('Verifying schema updates...');
      await pool.query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS end_at TIMESTAMP WITH TIME ZONE;');
      console.log('Verified: campaigns.end_at column exists.');

      // Fix missing status in users table
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';");
      console.log('Verified: users.status column exists.');

      // Fix missing columns in campaign_messages table
      await pool.query('ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE;');
      await pool.query('ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;');
      console.log('Verified: campaign_messages columns exist.');

      // Multi-message support migration
      await pool.query("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS message_ids JSONB DEFAULT '[]';");
      await pool.query('ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS message_id UUID REFERENCES message_templates(id) ON DELETE SET NULL;');
      console.log('Verified: multi-message columns exist.');
      
      // Migrate existing single message_id to message_ids array if empty
      await pool.query(`
        UPDATE campaigns 
        SET message_ids = jsonb_build_array(message_id) 
        WHERE message_id IS NOT NULL AND (message_ids IS NULL OR jsonb_array_length(message_ids) = 0);
      `);

      // Add missing index on campaign_messages(contact_id) for performance
      await pool.query('CREATE INDEX IF NOT EXISTS idx_campaign_messages_contact_id ON campaign_messages(contact_id);');
      console.log('Verified: performance indexes exist.');

    } catch (err) {
      console.warn('Manual check for schema updates failed:', err.message);
    }

  } catch (error) {
    if (error.code === '42P07' && String(error.message).includes('idx_message_templates_user_id')) {
      console.warn('Ignoring duplicate index error for idx_message_templates_user_id at top level. Continuing.');
    } else {
      console.error('Error running schema migration:', error);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
};

setupDb();
