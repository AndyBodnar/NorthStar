import {
  State,
  StateType,
  CreateStateRequest,
  UpdateStateRequest,
  StateSearchRequest
} from '@north-star/shared-types';
import { pgPool, redisClient } from '../config/database';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class StateService {

  // Create or update state
  async setState(request: CreateStateRequest): Promise<State> {
    const client = await pgPool.connect();

    try {
      // Check if state already exists
      const existing = await client.query(
        'SELECT * FROM states WHERE key = $1 AND state_type = $2',
        [request.key, request.stateType]
      );

      let state: any;

      if (existing.rows.length > 0) {
        // Update existing state
        const currentState = existing.rows[0];
        const newVersion = currentState.version + 1;

        // Add to change log
        const changeEntry = {
          version: currentState.version,
          oldValue: currentState.value,
          newValue: request.value,
          changedAt: new Date(),
          changedBy: request.createdBy
        };

        const query = `
          UPDATE states
          SET value = $1, version = $2, updated_at = NOW(),
              change_log = array_append(change_log, $3)
          WHERE key = $4 AND state_type = $5
          RETURNING *
        `;

        const result = await client.query(query, [
          request.value,
          newVersion,
          JSON.stringify(changeEntry),
          request.key,
          request.stateType
        ]);

        state = result.rows[0];

      } else {
        // Create new state
        const stateId = uuidv4();
        const query = `
          INSERT INTO states (
            id, key, value, state_type, expires_at, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `;

        const result = await client.query(query, [
          stateId,
          request.key,
          request.value,
          request.stateType,
          request.expiresAt || null,
          request.createdBy
        ]);

        state = result.rows[0];
      }

      // Cache in Redis for fast access
      const cacheKey = `state:${request.stateType}:${request.key}`;
      const ttl = request.expiresAt
        ? Math.floor((new Date(request.expiresAt).getTime() - Date.now()) / 1000)
        : 3600; // Default 1 hour

      await redisClient.setEx(cacheKey, ttl, JSON.stringify(state));

      logger.info(`Set state: ${request.key} (${request.stateType})`);

      return this.mapDatabaseToState(state);

    } catch (error) {
      logger.error(`Error setting state ${request.key}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get state by key and type
  async getState(key: string, stateType: StateType): Promise<State | null> {
    try {
      // Try Redis cache first
      const cacheKey = `state:${stateType}:${key}`;
      const cached = await redisClient.get(cacheKey);

      if (cached) {
        const state = JSON.parse(cached);
        return this.mapDatabaseToState(state);
      }

      // Fall back to database
      const client = await pgPool.connect();

      try {
        const result = await client.query(
          `SELECT * FROM states
           WHERE key = $1 AND state_type = $2
           AND (expires_at IS NULL OR expires_at > NOW())`,
          [key, stateType]
        );

        if (result.rows.length === 0) {
          return null;
        }

        const state = result.rows[0];

        // Cache for future access
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(state));

        return this.mapDatabaseToState(state);

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error(`Error getting state ${key}:`, error);
      throw error;
    }
  }

  // Lock state for atomic operations
  async lockState(key: string, stateType: StateType, lockedBy: string): Promise<boolean> {
    const client = await pgPool.connect();

    try {
      const result = await client.query(
        `UPDATE states
         SET is_locked = true, locked_by = $1, locked_at = NOW()
         WHERE key = $2 AND state_type = $3 AND is_locked = false
         RETURNING id`,
        [lockedBy, key, stateType]
      );

      const success = result.rowCount > 0;

      if (success) {
        logger.info(`Locked state: ${key} (${stateType}) by ${lockedBy}`);
      }

      return success;

    } catch (error) {
      logger.error(`Error locking state ${key}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Unlock state
  async unlockState(key: string, stateType: StateType, unlockedBy: string): Promise<boolean> {
    const client = await pgPool.connect();

    try {
      const result = await client.query(
        `UPDATE states
         SET is_locked = false, locked_by = NULL, locked_at = NULL
         WHERE key = $1 AND state_type = $2 AND locked_by = $3
         RETURNING id`,
        [key, stateType, unlockedBy]
      );

      const success = result.rowCount > 0;

      if (success) {
        logger.info(`Unlocked state: ${key} (${stateType}) by ${unlockedBy}`);

        // Remove from cache to force refresh
        const cacheKey = `state:${stateType}:${key}`;
        await redisClient.del(cacheKey);
      }

      return success;

    } catch (error) {
      logger.error(`Error unlocking state ${key}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Search states
  async searchStates(request: StateSearchRequest): Promise<State[]> {
    const client = await pgPool.connect();

    try {
      let query = `
        SELECT * FROM states
        WHERE (expires_at IS NULL OR expires_at > NOW())
      `;

      const values: any[] = [];
      let paramCount = 0;

      if (request.stateTypes && request.stateTypes.length > 0) {
        query += ` AND state_type = ANY($${++paramCount})`;
        values.push(request.stateTypes);
      }

      if (request.keyPattern) {
        query += ` AND key ILIKE $${++paramCount}`;
        values.push(`%${request.keyPattern}%`);
      }

      if (request.isLocked !== undefined) {
        query += ` AND is_locked = $${++paramCount}`;
        values.push(request.isLocked);
      }

      if (request.createdAfter) {
        query += ` AND created_at >= $${++paramCount}`;
        values.push(request.createdAfter);
      }

      query += ` ORDER BY updated_at DESC`;

      const limit = Math.min(request.limit || 100, 1000);
      query += ` LIMIT $${++paramCount}`;
      values.push(limit);

      const result = await client.query(query, values);

      return result.rows.map(row => this.mapDatabaseToState(row));

    } catch (error) {
      logger.error('Error searching states:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get state history (change log)
  async getStateHistory(key: string, stateType: StateType): Promise<any[]> {
    const client = await pgPool.connect();

    try {
      const result = await client.query(
        'SELECT change_log FROM states WHERE key = $1 AND state_type = $2',
        [key, stateType]
      );

      if (result.rows.length === 0) {
        return [];
      }

      return result.rows[0].change_log || [];

    } catch (error) {
      logger.error(`Error getting state history for ${key}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete state
  async deleteState(key: string, stateType: StateType): Promise<boolean> {
    const client = await pgPool.connect();

    try {
      const result = await client.query(
        'DELETE FROM states WHERE key = $1 AND state_type = $2',
        [key, stateType]
      );

      // Remove from cache
      const cacheKey = `state:${stateType}:${key}`;
      await redisClient.del(cacheKey);

      logger.info(`Deleted state: ${key} (${stateType})`);

      return result.rowCount > 0;

    } catch (error) {
      logger.error(`Error deleting state ${key}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Clean up expired states
  async cleanupExpiredStates(): Promise<number> {
    const client = await pgPool.connect();

    try {
      const result = await client.query(
        'DELETE FROM states WHERE expires_at IS NOT NULL AND expires_at <= NOW()'
      );

      const deletedCount = result.rowCount;

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired states`);
      }

      return deletedCount;

    } catch (error) {
      logger.error('Error cleaning up expired states:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Helper method to map database row to State interface
  private mapDatabaseToState(row: any): State {
    return {
      id: row.id,
      key: row.key,
      value: row.value,
      stateType: row.state_type,
      version: row.version,
      isLocked: row.is_locked,
      lockedBy: row.locked_by,
      lockedAt: row.locked_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      changeLog: row.change_log || [],
      createdBy: row.created_by
    };
  }
}