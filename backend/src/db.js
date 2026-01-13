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

const parseConnectionString = (url) => {
  try {
    if (!url) return {};

    // First try standard parsing to see if it's a valid URL
    // This handles properly encoded URLs
    try {
      // If there are multiple @ signs, it implies unencoded characters in user/pass.
      // Standard URL parser might misinterpret this (e.g. treating part of password as host).
      // Force manual parsing in this case.
      if ((url.match(/@/g) || []).length > 1) {
        throw new Error('Multiple @ detected, forcing manual parsing');
      }

      const parsedUrl = new URL(url);
      const config = {
        connectionString: url,
      };
      
      if (parsedUrl.searchParams.get('sslmode') === 'no-verify') {
         config.ssl = { rejectUnauthorized: false };
      } else if (parsedUrl.searchParams.get('sslmode') === 'require') {
         config.ssl = true;
      }
      
      return config;
    } catch (e) {
      // If URL parsing fails, it might be due to unencoded characters
      // Continue to manual parsing
    }

    // Manual parsing for unencoded special characters
    // Format: postgres://user:password@host:port/database?options
    
    // 1. Remove protocol
    let remaining = url;
    if (url.startsWith('postgres://')) remaining = url.substring(11);
    else if (url.startsWith('postgresql://')) remaining = url.substring(13);
    else return { connectionString: url }; // Unknown protocol

    // 2. Separate query params
    let query = '';
    const qIndex = remaining.indexOf('?');
    if (qIndex !== -1) {
      query = remaining.substring(qIndex + 1);
      remaining = remaining.substring(0, qIndex);
    }

    // 3. Separate database (after first /)
    let database = '';
    const slashIndex = remaining.indexOf('/');
    if (slashIndex !== -1) {
      database = remaining.substring(slashIndex + 1);
      remaining = remaining.substring(0, slashIndex);
    }

    // 4. Find last @ to separate auth from host
    const lastAt = remaining.lastIndexOf('@');
    if (lastAt === -1) return { connectionString: url }; // No auth info found

    const auth = remaining.substring(0, lastAt);
    const hostPort = remaining.substring(lastAt + 1);

    // 5. Parse auth (user:password)
    // Password is everything after the first colon
    const firstColon = auth.indexOf(':');
    if (firstColon === -1) return { connectionString: url }; // No password

    const user = auth.substring(0, firstColon);
    const password = auth.substring(firstColon + 1);

    // 6. Parse host:port
    const hostColon = hostPort.lastIndexOf(':');
    let host = hostPort;
    let port = 5432;

    if (hostColon !== -1) {
      host = hostPort.substring(0, hostColon);
      port = parseInt(hostPort.substring(hostColon + 1), 10);
    }

    const config = {
      user,
      password,
      host,
      port,
      database,
    };

    // Handle query params manually
    if (query) {
      const params = new URLSearchParams(query);
      if (params.get('sslmode') === 'disable') {
        config.ssl = false;
      } else if (params.get('sslmode') === 'require' || params.get('sslmode') === 'no-verify') {
        config.ssl = { rejectUnauthorized: false };
      }
    }

    return config;
  } catch (error) {
    console.error('Error parsing connection string:', error);
    return { connectionString: url };
  }
};

const dbConfig = parseConnectionString(process.env.DATABASE_URL);

// Log connection attempt (hiding password)
if (dbConfig) {
  const safeConfig = { ...dbConfig };
  if (safeConfig.password) safeConfig.password = '****';
  if (safeConfig.connectionString) safeConfig.connectionString = 'masked-connection-string';
  
  console.log('Attempting DB connection with config:', safeConfig);
} else {
  console.error('No database configuration found! Check DATABASE_URL.');
}

export const pool = new Pool(dbConfig);

// Pool error handling
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit process here, just log. 
  // Let the health check fail if it's persistent.
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
