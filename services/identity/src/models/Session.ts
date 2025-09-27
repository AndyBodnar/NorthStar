import { pool, redis } from '../config/database-mock';
import { logger } from '../utils/logger';
import { generateTokenHash } from '../utils/auth';

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  refreshTokenHash?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  lastAccessedAt: Date;
  isActive: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionData {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

export class SessionModel {
  // Create a new session
  static async create(sessionData: CreateSessionData): Promise<Session> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Clean up expired sessions for this user
      await this.cleanupExpiredSessions(sessionData.userId, client);

      // Check session limit per user
      const sessionCount = await client.query(
        'SELECT COUNT(*) FROM identity.sessions WHERE user_id = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP',
        [sessionData.userId]
      );

      const maxSessions = parseInt(process.env.MAX_SESSIONS_PER_USER || '5');
      if (parseInt(sessionCount.rows[0].count) >= maxSessions) {
        // Remove oldest session
        await client.query(`
          UPDATE identity.sessions
          SET is_active = false
          WHERE id = (
            SELECT id FROM identity.sessions
            WHERE user_id = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP
            ORDER BY last_accessed_at ASC
            LIMIT 1
          )
        `, [sessionData.userId]);
      }

      // Create new session
      const result = await client.query(`
        INSERT INTO identity.sessions (
          user_id, token_hash, refresh_token_hash, device_id, ip_address,
          user_agent, expires_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        sessionData.userId,
        generateTokenHash(sessionData.accessToken),
        sessionData.refreshToken ? generateTokenHash(sessionData.refreshToken) : null,
        sessionData.deviceId || null,
        sessionData.ipAddress || null,
        sessionData.userAgent || null,
        sessionData.expiresAt,
        sessionData.metadata || {}
      ]);

      await client.query('COMMIT');

      const session = this.mapRowToSession(result.rows[0]);
      logger.info(`Session created for user: ${sessionData.userId} (${session.id})`);

      return session;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create session:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Find session by ID
  static async findById(id: string): Promise<Session | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM identity.sessions WHERE id = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToSession(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find session by ID:', error);
      throw error;
    }
  }

  // Find session by token hash
  static async findByTokenHash(tokenHash: string): Promise<Session | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM identity.sessions WHERE token_hash = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP',
        [tokenHash]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const session = this.mapRowToSession(result.rows[0]);

      // Update last accessed time
      await this.updateLastAccessed(session.id);

      return session;
    } catch (error) {
      logger.error('Failed to find session by token hash:', error);
      throw error;
    }
  }

  // Find session by refresh token hash
  static async findByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM identity.sessions WHERE refresh_token_hash = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP',
        [refreshTokenHash]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToSession(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find session by refresh token hash:', error);
      throw error;
    }
  }

  // Update session tokens
  static async updateTokens(id: string, accessToken: string, refreshToken?: string): Promise<Session | null> {
    try {
      const result = await pool.query(`
        UPDATE identity.sessions
        SET token_hash = $1, refresh_token_hash = $2, last_accessed_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND is_active = true AND expires_at > CURRENT_TIMESTAMP
        RETURNING *
      `, [
        generateTokenHash(accessToken),
        refreshToken ? generateTokenHash(refreshToken) : null,
        id
      ]);

      if (result.rows.length === 0) {
        return null;
      }

      const session = this.mapRowToSession(result.rows[0]);
      logger.info(`Session tokens updated: ${id}`);

      return session;
    } catch (error) {
      logger.error('Failed to update session tokens:', error);
      throw error;
    }
  }

  // Update last accessed time
  static async updateLastAccessed(id: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE identity.sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
    } catch (error) {
      logger.error('Failed to update last accessed:', error);
      // Don't throw, this is not critical
    }
  }

  // Invalidate session
  static async invalidate(id: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'UPDATE identity.sessions SET is_active = false WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        return false;
      }

      logger.info(`Session invalidated: ${id}`);
      return true;
    } catch (error) {
      logger.error('Failed to invalidate session:', error);
      throw error;
    }
  }

  // Invalidate all sessions for a user
  static async invalidateAllForUser(userId: string): Promise<number> {
    try {
      const result = await pool.query(
        'UPDATE identity.sessions SET is_active = false WHERE user_id = $1 AND is_active = true',
        [userId]
      );

      logger.info(`${result.rowCount} sessions invalidated for user: ${userId}`);
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to invalidate all sessions for user:', error);
      throw error;
    }
  }

  // Get active sessions for a user
  static async getActiveForUser(userId: string): Promise<Session[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM identity.sessions
        WHERE user_id = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP
        ORDER BY last_accessed_at DESC
      `, [userId]);

      return result.rows.map(this.mapRowToSession);
    } catch (error) {
      logger.error('Failed to get active sessions for user:', error);
      throw error;
    }
  }

  // Clean up expired sessions
  static async cleanupExpiredSessions(userId?: string, client?: any): Promise<number> {
    const dbClient = client || pool;

    try {
      let query = 'UPDATE identity.sessions SET is_active = false WHERE expires_at <= CURRENT_TIMESTAMP AND is_active = true';
      const values: any[] = [];

      if (userId) {
        query += ' AND user_id = $1';
        values.push(userId);
      }

      const result = await dbClient.query(query, values);

      const cleaned = result.rowCount || 0;
      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} expired sessions${userId ? ` for user ${userId}` : ''}`);
      }

      return cleaned;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error);
      throw error;
    }
  }

  // Map database row to Session object
  private static mapRowToSession(row: any): Session {
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      refreshTokenHash: row.refresh_token_hash,
      deviceId: row.device_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      expiresAt: new Date(row.expires_at),
      lastAccessedAt: new Date(row.last_accessed_at),
      isActive: row.is_active,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}