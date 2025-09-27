import { Pool } from 'pg';
import { createClient } from 'redis';
import { logger } from '../utils/logger';

// PostgreSQL connection for persistent memory storage
export const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'north_star_memory',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis connection for high-speed state management and caching
export const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
  password: process.env.REDIS_PASSWORD || undefined,
});

// Initialize database connections
export async function initializeDatabase() {
  try {
    // Test PostgreSQL connection
    const pgClient = await pgPool.connect();
    await pgClient.query('SELECT NOW()');
    pgClient.release();
    logger.info('PostgreSQL connected successfully');

    // Connect to Redis
    await redisClient.connect();
    logger.info('Redis connected successfully');

    // Create tables if they don't exist
    await createTables();

  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

async function createTables() {
  const client = await pgPool.connect();

  try {
    // Memory storage table
    await client.query(`
      CREATE TABLE IF NOT EXISTS memories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        memory_type VARCHAR(20) NOT NULL CHECK (memory_type IN ('short_term', 'long_term', 'episodic', 'semantic', 'procedural', 'working')),
        embedding VECTOR(1536),
        importance_score DECIMAL(3,2) DEFAULT 0.5,
        access_count INTEGER DEFAULT 0,
        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        is_encrypted BOOLEAN DEFAULT FALSE,
        tags TEXT[],
        metadata JSONB DEFAULT '{}'::jsonb,
        related_memories UUID[],
        created_by UUID,
        INDEX (memory_type),
        INDEX (importance_score),
        INDEX (created_at),
        INDEX (expires_at),
        INDEX USING GIN (tags),
        INDEX USING GIN (metadata)
      );
    `);

    // State storage table
    await client.query(`
      CREATE TABLE IF NOT EXISTS states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(255) NOT NULL,
        value JSONB NOT NULL,
        state_type VARCHAR(20) NOT NULL CHECK (state_type IN ('global', 'user', 'session', 'temporal', 'contextual')),
        version INTEGER DEFAULT 1,
        is_locked BOOLEAN DEFAULT FALSE,
        locked_by UUID,
        locked_at TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        change_log JSONB[] DEFAULT ARRAY[]::jsonb[],
        created_by UUID,
        UNIQUE(key, state_type)
      );
    `);

    // Time forks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS time_forks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        parent_fork_id UUID REFERENCES time_forks(id),
        branch_point TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID,
        INDEX (parent_fork_id),
        INDEX (branch_point),
        INDEX (is_active)
      );
    `);

    logger.info('Database tables created successfully');

  } catch (error) {
    logger.error('Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Graceful shutdown
export async function closeDatabase() {
  try {
    await pgPool.end();
    await redisClient.quit();
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }
}