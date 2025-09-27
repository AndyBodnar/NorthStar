import { pool, redis } from '../config/database-mock';
import { ActorType } from '@north-star/shared-types';
import { logger } from '../utils/logger';
import { hashPassword, verifyPassword } from '../utils/auth';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  displayName?: string;
  avatarUrl?: string;
  type: ActorType;
  isActive: boolean;
  isVerified: boolean;
  metadata: Record<string, any>;
  capabilities: string[];
  permissions: string[];
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  version: number;
}

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  displayName?: string;
  avatarUrl?: string;
  type?: ActorType;
  capabilities?: string[];
  permissions?: string[];
  parentId?: string;
  metadata?: Record<string, any>;
}

export interface UpdateUserData {
  name?: string;
  displayName?: string;
  avatarUrl?: string;
  isActive?: boolean;
  isVerified?: boolean;
  capabilities?: string[];
  permissions?: string[];
  metadata?: Record<string, any>;
}

export class UserModel {
  // Create a new user
  static async create(userData: CreateUserData): Promise<User> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM identity.users WHERE email = $1',
        [userData.email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await hashPassword(userData.password);

      // Insert user
      const result = await client.query(`
        INSERT INTO identity.users (
          email, password_hash, name, display_name, avatar_url, type,
          capabilities, permissions, parent_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        userData.email.toLowerCase(),
        passwordHash,
        userData.name,
        userData.displayName || null,
        userData.avatarUrl || null,
        userData.type || ActorType.HUMAN,
        userData.capabilities || [],
        userData.permissions || ['read:own_profile'],
        userData.parentId || null,
        userData.metadata || {}
      ]);

      await client.query('COMMIT');

      const user = this.mapRowToUser(result.rows[0]);
      logger.info(`User created: ${user.email} (${user.id})`);

      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Find user by ID
  static async findById(id: string): Promise<User | null> {
    try {
      // Try cache first
      const cached = await redis.get(`user:${id}`);
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await pool.query(
        'SELECT * FROM identity.users WHERE id = $1 AND is_active = true',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = this.mapRowToUser(result.rows[0]);

      // Cache for 5 minutes
      await redis.setEx(`user:${id}`, 300, JSON.stringify(user));

      return user;
    } catch (error) {
      logger.error('Failed to find user by ID:', error);
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM identity.users WHERE email = $1 AND is_active = true',
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find user by email:', error);
      throw error;
    }
  }

  // Authenticate user
  static async authenticate(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.findByEmail(email);
      if (!user) {
        return null;
      }

      const isValidPassword = await verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        return null;
      }

      // Update last login
      await this.updateLastLogin(user.id);

      return user;
    } catch (error) {
      logger.error('Authentication failed:', error);
      throw error;
    }
  }

  // Update user
  static async update(id: string, updateData: UpdateUserData): Promise<User | null> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updateData.name !== undefined) {
        setParts.push(`name = $${paramIndex++}`);
        values.push(updateData.name);
      }

      if (updateData.displayName !== undefined) {
        setParts.push(`display_name = $${paramIndex++}`);
        values.push(updateData.displayName);
      }

      if (updateData.avatarUrl !== undefined) {
        setParts.push(`avatar_url = $${paramIndex++}`);
        values.push(updateData.avatarUrl);
      }

      if (updateData.isActive !== undefined) {
        setParts.push(`is_active = $${paramIndex++}`);
        values.push(updateData.isActive);
      }

      if (updateData.isVerified !== undefined) {
        setParts.push(`is_verified = $${paramIndex++}`);
        values.push(updateData.isVerified);
      }

      if (updateData.capabilities !== undefined) {
        setParts.push(`capabilities = $${paramIndex++}`);
        values.push(updateData.capabilities);
      }

      if (updateData.permissions !== undefined) {
        setParts.push(`permissions = $${paramIndex++}`);
        values.push(updateData.permissions);
      }

      if (updateData.metadata !== undefined) {
        setParts.push(`metadata = $${paramIndex++}`);
        values.push(updateData.metadata);
      }

      if (setParts.length === 0) {
        await client.query('ROLLBACK');
        return this.findById(id);
      }

      setParts.push(`version = version + 1`);
      values.push(id);

      const query = `
        UPDATE identity.users
        SET ${setParts.join(', ')}
        WHERE id = $${paramIndex} AND is_active = true
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query('COMMIT');

      const user = this.mapRowToUser(result.rows[0]);

      // Invalidate cache
      await redis.del(`user:${id}`);

      logger.info(`User updated: ${user.email} (${user.id})`);
      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Update last login timestamp
  static async updateLastLogin(id: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE identity.users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );

      // Invalidate cache
      await redis.del(`user:${id}`);
    } catch (error) {
      logger.error('Failed to update last login:', error);
      // Don't throw, this is not critical
    }
  }

  // Delete user (soft delete)
  static async delete(id: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'UPDATE identity.users SET is_active = false WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        return false;
      }

      // Invalidate cache
      await redis.del(`user:${id}`);

      logger.info(`User soft deleted: ${id}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete user:', error);
      throw error;
    }
  }

  // List users with pagination
  static async list(offset = 0, limit = 20, filters: any = {}): Promise<{ users: User[]; total: number }> {
    try {
      const whereClauses: string[] = ['is_active = true'];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters.type) {
        whereClauses.push(`type = $${paramIndex++}`);
        values.push(filters.type);
      }

      if (filters.isVerified !== undefined) {
        whereClauses.push(`is_verified = $${paramIndex++}`);
        values.push(filters.isVerified);
      }

      if (filters.search) {
        whereClauses.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
        values.push(`%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = whereClauses.join(' AND ');

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM identity.users WHERE ${whereClause}`,
        values
      );

      // Get users
      const usersResult = await pool.query(`
        SELECT * FROM identity.users
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...values, limit, offset]);

      return {
        users: usersResult.rows.map(this.mapRowToUser),
        total: parseInt(countResult.rows[0].count),
      };
    } catch (error) {
      logger.error('Failed to list users:', error);
      throw error;
    }
  }

  // Map database row to User object
  private static mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      type: row.type,
      isActive: row.is_active,
      isVerified: row.is_verified,
      metadata: row.metadata || {},
      capabilities: row.capabilities || [],
      permissions: row.permissions || [],
      parentId: row.parent_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
      version: row.version,
    };
  }
}