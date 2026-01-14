import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const setupDb = async () => {
  try {
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
    
    // Split commands by semicolon might be safer if the driver doesn't support multiple statements,
    // but pg driver usually supports multiple statements in one query call.
    // However, for better error reporting, executing the whole file is the standard first try.
    await pool.query(schemaSql);
    
    console.log('Schema migration completed successfully.');

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

    } catch (err) {
      console.warn('Manual check for schema updates failed:', err.message);
    }

  } catch (error) {
    console.error('Error running schema migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

setupDb();
