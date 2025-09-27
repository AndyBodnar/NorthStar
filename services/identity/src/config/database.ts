import { Pool } from 'pg';
import { createClient } from 'redis';
import { logger } from '../utils/logger';

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Redis connection
const redis = createClient({
  url: process.env.REDIS_URL,
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

// Initialize connections
export const initializeDatabase = async () => {
  try {
    // Test PostgreSQL connection
    await pool.query('SELECT NOW()');
    logger.info('Connected to PostgreSQL');

    // Connect to Redis
    await redis.connect();

    logger.info('Database connections established');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

// Create database tables
export const createTables = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS identity.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        avatar_url TEXT,
        type VARCHAR(50) NOT NULL DEFAULT 'human',
        is_active BOOLEAN DEFAULT true,
        is_verified BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}',
        capabilities TEXT[] DEFAULT ARRAY[]::TEXT[],
        permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
        parent_id UUID REFERENCES identity.users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP WITH TIME ZONE,
        version INTEGER DEFAULT 1
      );
    `);

    // Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS identity.sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        refresh_token_hash VARCHAR(255),
        device_id VARCHAR(255),
        ip_address INET,
        user_agent TEXT,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Audit logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS identity.audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES identity.users(id),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100),
        resource_id UUID,
        ip_address INET,
        user_agent TEXT,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON identity.users(email);
      CREATE INDEX IF NOT EXISTS idx_users_type ON identity.users(type);
      CREATE INDEX IF NOT EXISTS idx_users_is_active ON identity.users(is_active);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON identity.sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON identity.sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON identity.sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON identity.audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON identity.audit_logs(action);
    `);

    // Triggers for updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_users_updated_at ON identity.users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON identity.users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_sessions_updated_at ON identity.sessions;
      CREATE TRIGGER update_sessions_updated_at
        BEFORE UPDATE ON identity.sessions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query('COMMIT');
    logger.info('Database tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to create tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

export { pool, redis };