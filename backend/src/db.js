import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Validate DATABASE_URL existence
if (!process.env.DATABASE_URL) {
  console.error('❌ CRITICAL ERROR: DATABASE_URL environment variable is MISSING!');
  console.error('The application cannot start without a database connection.');
  console.error('Please ensure DATABASE_URL is defined in your environment variables.');
  process.exit(1);
}

// Configure pool using connectionString
// Since special characters are removed/handled, we can trust standard parsing
const config = {
  connectionString: process.env.DATABASE_URL,
};

// Add SSL configuration if needed
// This handles typical production requirements (e.g. Supabase, Neon, DigitalOcean)
const isProduction = process.env.NODE_ENV === 'production';
const urlHasSSL = process.env.DATABASE_URL.includes('sslmode=');

if (isProduction || urlHasSSL) {
  config.ssl = {
    rejectUnauthorized: false // Allows self-signed certificates (common in managed DBs)
  };
}

console.log('Attempting DB connection...');

export const pool = new Pool(config);

// Pool error handling
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

export const query = (text, params) => pool.query(text, params);

export const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to database');
    
    // Check if tables exist
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tables = res.rows.map(r => r.table_name);
    console.log('Existing tables:', tables.join(', '));
    
    if (tables.length === 0) {
      console.warn('WARNING: No tables found in database. Schema migration might have failed.');
    }
    
    client.release();
    return true;
  } catch (err) {
    console.error('Database connection failed:', err.message);
    return false;
  }
};
