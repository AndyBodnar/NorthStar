import { logger } from '../utils/logger';

// Mock in-memory storage for development
let users: any[] = [];
let sessions: any[] = [];

export const mockDb = {
  users,
  sessions,

  // Mock PostgreSQL pool
  query: async (text: string, params?: any[]) => {
    logger.debug('Mock DB Query:', { text, params });

    // Simple mock responses for basic queries
    if (text.includes('SELECT NOW()')) {
      return { rows: [{ now: new Date() }], rowCount: 1 };
    }

    if (text.includes('CREATE TABLE') || text.includes('CREATE INDEX') || text.includes('CREATE TRIGGER')) {
      return { rows: [], rowCount: 0 };
    }

    // Mock user operations
    if (text.includes('SELECT * FROM identity.users WHERE email')) {
      const email = params?.[0];
      const user = users.find(u => u.email === email);
      return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
    }

    if (text.includes('SELECT * FROM identity.users WHERE id')) {
      const id = params?.[0];
      const user = users.find(u => u.id === id);
      return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
    }

    if (text.includes('INSERT INTO identity.users')) {
      const id = 'user_' + Math.random().toString(36).substr(2, 9);
      const user = {
        id,
        email: params?.[0],
        password_hash: params?.[1],
        name: params?.[2],
        display_name: params?.[3],
        avatar_url: params?.[4],
        type: params?.[5] || 'human',
        capabilities: params?.[6] || [],
        permissions: params?.[7] || [],
        parent_id: params?.[8],
        metadata: params?.[9] || {},
        is_active: true,
        is_verified: false,
        created_at: new Date(),
        updated_at: new Date(),
        version: 1
      };
      users.push(user);
      return { rows: [user], rowCount: 1 };
    }

    // Mock session operations
    if (text.includes('INSERT INTO identity.sessions')) {
      const id = 'session_' + Math.random().toString(36).substr(2, 9);
      const session = {
        id,
        user_id: params?.[0],
        token_hash: params?.[1],
        refresh_token_hash: params?.[2],
        device_id: params?.[3],
        ip_address: params?.[4],
        user_agent: params?.[5],
        expires_at: params?.[6],
        metadata: params?.[7] || {},
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
        last_accessed_at: new Date()
      };
      sessions.push(session);
      return { rows: [session], rowCount: 1 };
    }

    if (text.includes('SELECT * FROM identity.sessions WHERE token_hash')) {
      const tokenHash = params?.[0];
      const session = sessions.find(s => s.token_hash === tokenHash && s.is_active);
      return { rows: session ? [session] : [], rowCount: session ? 1 : 0 };
    }

    // Mock COUNT queries
    if (text.includes('SELECT COUNT(*)')) {
      if (text.includes('FROM identity.sessions WHERE user_id')) {
        const userId = params?.[0];
        const count = sessions.filter(s => s.user_id === userId && s.is_active).length;
        return { rows: [{ count: count.toString() }], rowCount: 1 };
      }
      if (text.includes('FROM identity.users')) {
        return { rows: [{ count: users.length.toString() }], rowCount: 1 };
      }
      return { rows: [{ count: '0' }], rowCount: 1 };
    }

    // Mock UPDATE queries
    if (text.includes('UPDATE identity.sessions SET is_active = false WHERE id')) {
      const sessionId = params?.[0];
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        session.is_active = false;
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    return { rows: [], rowCount: 0 };
  },

  connect: async () => ({
    query: mockDb.query,
    release: () => {}
  })
};

// Mock Redis client
export const mockRedis = {
  connected: true,

  connect: async () => {
    logger.info('Mock Redis connected');
  },

  setEx: async (key: string, seconds: number, value: string) => {
    logger.debug('Mock Redis SET:', { key, seconds, value: value.substring(0, 50) + '...' });
    return 'OK';
  },

  get: async (key: string) => {
    logger.debug('Mock Redis GET:', { key });
    return null; // Always return null for cache miss
  },

  del: async (key: string) => {
    logger.debug('Mock Redis DEL:', { key });
    return 1;
  },

  incr: async (key: string) => {
    logger.debug('Mock Redis INCR:', { key });
    return 1;
  },

  expire: async (key: string, seconds: number) => {
    logger.debug('Mock Redis EXPIRE:', { key, seconds });
    return 1;
  },

  decr: async (key: string) => {
    logger.debug('Mock Redis DECR:', { key });
    return 0;
  },

  on: (event: string, callback: () => void) => {
    logger.debug('Mock Redis event listener:', { event });
    if (event === 'connect') {
      setTimeout(callback, 100);
    }
  }
};

// Initialize mock database
export const initializeDatabase = async () => {
  try {
    await mockDb.query('SELECT NOW()');
    logger.info('Mock PostgreSQL connected');

    await mockRedis.connect();

    logger.info('Mock database connections established');
  } catch (error) {
    logger.error('Mock database connection failed:', error);
    throw error;
  }
};

// Create database tables (mock)
export const createTables = async () => {
  try {
    await mockDb.query('CREATE TABLE IF NOT EXISTS identity.users');
    await mockDb.query('CREATE TABLE IF NOT EXISTS identity.sessions');
    await mockDb.query('CREATE TABLE IF NOT EXISTS identity.audit_logs');

    logger.info('Mock database tables created successfully');
  } catch (error) {
    logger.error('Failed to create mock tables:', error);
    throw error;
  }
};

export const pool = mockDb;
export const redis = mockRedis;