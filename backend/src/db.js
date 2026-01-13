import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Parse DATABASE_URL manually to handle special characters in password
function parseConnectionString(url) {
  if (!url) return {};
  
  // Format: postgres://user:password@host:port/database?options
  const regex = /^postgres(?:ql)?:\/\/([^:]+):(.+)@([^:]+):(\d+)\/([^?]+)(?:\?(.*))?$/;
  const match = url.match(regex);
  
  if (match) {
    const config = {
      user: match[1],
      password: match[2],
      host: match[3],
      port: parseInt(match[4], 10),
      database: match[5],
    };
    
    // Parse query options like sslmode
    if (match[6]) {
      const params = new URLSearchParams(match[6]);
      if (params.get('sslmode') === 'disable') {
        config.ssl = false;
      } else if (params.get('sslmode')) {
        config.ssl = { rejectUnauthorized: false };
      }
    }
    
    return config;
  }
  
  // Fallback to connectionString if parsing fails
  return { connectionString: url };
}

const dbConfig = parseConnectionString(process.env.DATABASE_URL);

// Log connection attempt (hiding password)
if (dbConfig) {
  const { password, ...safeConfig } = dbConfig;
  // If connectionString is present, mask it too
  if (safeConfig.connectionString) {
    console.log('Attempting to connect with connection string (masked)...');
  } else {
    console.log('Attempting DB connection with config:', safeConfig);
  }
} else {
  console.error('No database configuration found! Check DATABASE_URL.');
}

export const pool = new Pool(dbConfig);

// Pool error handling
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
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
    
    console.log('Existing tables:', res.rows.map(r => r.table_name).join(', '));
    
    if (res.rows.length === 0) {
      console.warn('WARNING: No tables found in database. Did you run schema.sql?');
    }
    
    client.release();
    return true;
  } catch (err) {
    console.error('Database connection failed:', err.message);
    return false;
  }
};

