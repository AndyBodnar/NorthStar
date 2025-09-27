import { Memory, MemoryType } from '@north-star/shared-types';
import { pgPool, redisClient } from '../config/database';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Define request/response interfaces
interface CreateMemoryRequest {
  content: Record<string, any>;
  type: MemoryType;
  ownerId: string;
  tags?: string[];
  importance?: number;
  expiresAt?: Date;
  isEncrypted?: boolean;
  relatedMemories?: string[];
}

interface SearchMemoryRequest {
  types?: MemoryType[];
  tags?: string[];
  minImportance?: number;
  query?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  createdAfter?: Date;
  createdBefore?: Date;
}

interface MemorySearchResult {
  memories: Memory[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export class MemoryService {

  // Create a new memory
  async createMemory(request: CreateMemoryRequest): Promise<Memory> {
    const client = await pgPool.connect();

    try {
      const memoryId = uuidv4();

      const query = `
        INSERT INTO memories (
          id, content, memory_type, importance_score,
          expires_at, is_encrypted, tags, metadata,
          related_memories, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const values = [
        memoryId,
        JSON.stringify(request.content),
        request.type,
        request.importance || 0.5,
        request.expiresAt || null,
        request.isEncrypted || false,
        request.tags || [],
        JSON.stringify({}),
        request.relatedMemories || [],
        request.ownerId
      ];

      const result = await client.query(query, values);
      const memory = result.rows[0];

      // Cache in Redis for quick access
      if (memory.memory_type === 'working' || memory.memory_type === 'short_term') {
        await redisClient.setEx(
          `memory:${memoryId}`,
          3600, // 1 hour cache
          JSON.stringify(memory)
        );
      }

      logger.info(`Created memory: ${memoryId} of type: ${memory.memory_type}`);

      return this.mapDatabaseToMemory(memory);

    } catch (error) {
      logger.error('Error creating memory:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Retrieve memory by ID
  async getMemory(id: string): Promise<Memory | null> {
    try {
      // Try Redis cache first
      const cached = await redisClient.get(`memory:${id}`);
      if (cached) {
        const memory = JSON.parse(cached);
        await this.updateAccessCount(id);
        return this.mapDatabaseToMemory(memory);
      }

      // Fall back to database
      const client = await pgPool.connect();

      try {
        const result = await client.query(
          'SELECT * FROM memories WHERE id = $1 AND (expires_at IS NULL OR expires_at > NOW())',
          [id]
        );

        if (result.rows.length === 0) {
          return null;
        }

        const memory = result.rows[0];
        await this.updateAccessCount(id);

        return this.mapDatabaseToMemory(memory);

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error(`Error retrieving memory ${id}:`, error);
      throw error;
    }
  }

  // Search memories
  async searchMemories(request: SearchMemoryRequest): Promise<MemorySearchResult> {
    const client = await pgPool.connect();

    try {
      let query = `
        SELECT *, COUNT(*) OVER() as total_count
        FROM memories
        WHERE (expires_at IS NULL OR expires_at > NOW())
      `;

      const values: any[] = [];
      let paramCount = 0;

      // Add filters
      if (request.types && request.types.length > 0) {
        query += ` AND memory_type = ANY($${++paramCount})`;
        values.push(request.types);
      }

      if (request.tags && request.tags.length > 0) {
        query += ` AND tags && $${++paramCount}`;
        values.push(request.tags);
      }

      if (request.minImportance !== undefined) {
        query += ` AND importance_score >= $${++paramCount}`;
        values.push(request.minImportance);
      }

      if (request.query) {
        query += ` AND content::text ILIKE $${++paramCount}`;
        values.push(`%${request.query}%`);
      }

      // Add sorting
      const sortBy = request.sortBy || 'created_at';
      const sortOrder = request.sortOrder || 'desc';
      query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

      // Add pagination
      const limit = Math.min(request.limit || 50, 1000);
      const offset = ((request.page || 1) - 1) * limit;
      query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      values.push(limit, offset);

      const result = await client.query(query, values);

      const memories = result.rows.map(row => this.mapDatabaseToMemory(row));
      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

      return {
        memories,
        totalCount,
        page: request.page || 1,
        limit,
        hasMore: (request.page || 1) * limit < totalCount
      };

    } catch (error) {
      logger.error('Error searching memories:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Update memory
  async updateMemory(id: string, updates: Partial<Memory>): Promise<Memory | null> {
    const client = await pgPool.connect();

    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      // Build dynamic update query
      if (updates.content !== undefined) {
        setClauses.push(`content = $${++paramCount}`);
        values.push(JSON.stringify(updates.content));
      }

      if (updates.importance !== undefined) {
        setClauses.push(`importance_score = $${++paramCount}`);
        values.push(updates.importance);
      }

      if (updates.tags !== undefined) {
        setClauses.push(`tags = $${++paramCount}`);
        values.push(updates.tags);
      }

      if (updates.relatedMemories !== undefined) {
        setClauses.push(`related_memories = $${++paramCount}`);
        values.push(updates.relatedMemories);
      }

      if (setClauses.length === 0) {
        return await this.getMemory(id);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE memories
        SET ${setClauses.join(', ')}
        WHERE id = $${++paramCount}
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      const memory = result.rows[0];

      // Update cache
      await redisClient.del(`memory:${id}`);

      logger.info(`Updated memory: ${id}`);

      return this.mapDatabaseToMemory(memory);

    } catch (error) {
      logger.error(`Error updating memory ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete memory
  async deleteMemory(id: string): Promise<boolean> {
    const client = await pgPool.connect();

    try {
      const result = await client.query(
        'DELETE FROM memories WHERE id = $1',
        [id]
      );

      // Remove from cache
      await redisClient.del(`memory:${id}`);

      logger.info(`Deleted memory: ${id}`);

      return (result.rowCount || 0) > 0;

    } catch (error) {
      logger.error(`Error deleting memory ${id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get memories by type
  async getMemoriesByType(type: MemoryType, limit: number = 100): Promise<Memory[]> {
    const client = await pgPool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM memories
         WHERE memory_type = $1
         AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY importance_score DESC, created_at DESC
         LIMIT $2`,
        [type, limit]
      );

      return result.rows.map(row => this.mapDatabaseToMemory(row));

    } catch (error) {
      logger.error(`Error getting memories by type ${type}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Clean up expired memories
  async cleanupExpiredMemories(): Promise<number> {
    const client = await pgPool.connect();

    try {
      const result = await client.query(
        'DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at <= NOW()'
      );

      const deletedCount = result.rowCount || 0;

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired memories`);
      }

      return deletedCount;

    } catch (error) {
      logger.error('Error cleaning up expired memories:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Private helper methods
  private async updateAccessCount(id: string): Promise<void> {
    try {
      const client = await pgPool.connect();
      await client.query(
        'UPDATE memories SET access_count = access_count + 1, last_accessed = NOW() WHERE id = $1',
        [id]
      );
      client.release();
    } catch (error) {
      logger.error(`Error updating access count for memory ${id}:`, error);
    }
  }

  private mapDatabaseToMemory(row: any): Memory {
    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version || 1,
      type: row.memory_type,
      ownerId: row.created_by || row.owner_id,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      embedding: row.embedding,
      tags: row.tags || [],
      importance: parseFloat(row.importance_score),
      accessCount: row.access_count || 0,
      lastAccessed: row.last_accessed,
      expiresAt: row.expires_at,
      isEncrypted: row.is_encrypted || false,
      sourceId: row.source_id,
      relatedMemories: row.related_memories || []
    };
  }
}