import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { UserModel } from '../models/User';
import { SessionModel } from '../models/Session';
import { generateTokenPair, verifyRefreshToken, validatePasswordStrength, generateTokenHash } from '../utils/auth';
import { logger } from '../utils/logger';
import { ActorType } from '@north-star/shared-types';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    type: string;
    permissions: string[];
    sessionId: string;
  };
}

export class AuthController {
  // Register a new user
  static async register(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: errors.array()
        });
      }

      const { email, password, name, displayName, type } = req.body;

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: 'WEAK_PASSWORD',
          message: 'Password does not meet security requirements',
          details: passwordValidation.errors
        });
      }

      // Create user
      const user = await UserModel.create({
        email,
        password,
        name,
        displayName,
        type: type || ActorType.HUMAN,
        permissions: ['read:own_profile', 'update:own_profile']
      });

      // Generate tokens
      const tokenPair = generateTokenPair({
        sub: user.id,
        email: user.email,
        type: user.type,
        permissions: user.permissions,
        sessionId: 'temp-session-id' // Will be updated after session creation
      });

      // Create session
      const session = await SessionModel.create({
        userId: user.id,
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        deviceId: req.headers['x-device-id'] as string,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        expiresAt: new Date(Date.now() + (tokenPair.expiresIn * 1000)),
        metadata: {
          registrationMethod: 'email',
          clientInfo: {
            userAgent: req.headers['user-agent'],
            acceptLanguage: req.headers['accept-language']
          }
        }
      });

      logger.info(`User registered: ${user.email} (${user.id})`);

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          displayName: user.displayName,
          type: user.type,
          isVerified: user.isVerified,
          createdAt: user.createdAt
        },
        tokens: tokenPair,
        session: {
          id: session.id,
          expiresAt: session.expiresAt
        }
      });
    } catch (error) {
      logger.error('Registration failed:', error);

      if (error instanceof Error && error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'USER_EXISTS',
          message: 'User with this email already exists'
        });
      }

      res.status(500).json({
        error: 'REGISTRATION_FAILED',
        message: 'Failed to register user'
      });
    }
  }

  // Login user
  static async login(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: errors.array()
        });
      }

      const { email, password } = req.body;

      // Authenticate user
      const user = await UserModel.authenticate(email, password);
      if (!user) {
        return res.status(401).json({
          error: 'AUTHENTICATION_FAILED',
          message: 'Invalid email or password'
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          error: 'ACCOUNT_DISABLED',
          message: 'Account has been disabled'
        });
      }

      // Generate tokens
      const tokenPair = generateTokenPair({
        sub: user.id,
        email: user.email,
        type: user.type,
        permissions: user.permissions,
        sessionId: 'temp-session-id'
      });

      // Create session
      const session = await SessionModel.create({
        userId: user.id,
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        deviceId: req.headers['x-device-id'] as string,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        expiresAt: new Date(Date.now() + (tokenPair.expiresIn * 1000)),
        metadata: {
          loginMethod: 'email',
          clientInfo: {
            userAgent: req.headers['user-agent'],
            acceptLanguage: req.headers['accept-language']
          }
        }
      });

      logger.info(`User logged in: ${user.email} (${user.id})`);

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          displayName: user.displayName,
          type: user.type,
          isVerified: user.isVerified,
          lastLoginAt: user.lastLoginAt
        },
        tokens: tokenPair,
        session: {
          id: session.id,
          expiresAt: session.expiresAt
        }
      });
    } catch (error) {
      logger.error('Login failed:', error);

      res.status(500).json({
        error: 'LOGIN_FAILED',
        message: 'Failed to login user'
      });
    }
  }

  // Refresh access token
  static async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          error: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required'
        });
      }

      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Find session
      const session = await SessionModel.findByRefreshTokenHash(generateTokenHash(refreshToken));
      if (!session || session.userId !== decoded.sub) {
        return res.status(401).json({
          error: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token'
        });
      }

      // Get user
      const user = await UserModel.findById(decoded.sub);
      if (!user || !user.isActive) {
        return res.status(401).json({
          error: 'USER_NOT_FOUND',
          message: 'User not found or inactive'
        });
      }

      // Generate new tokens
      const tokenPair = generateTokenPair({
        sub: user.id,
        email: user.email,
        type: user.type,
        permissions: user.permissions,
        sessionId: session.id
      });

      // Update session with new tokens
      await SessionModel.updateTokens(session.id, tokenPair.accessToken, tokenPair.refreshToken);

      logger.info(`Tokens refreshed for user: ${user.email} (${user.id})`);

      res.json({
        message: 'Tokens refreshed successfully',
        tokens: tokenPair
      });
    } catch (error) {
      logger.error('Token refresh failed:', error);

      res.status(401).json({
        error: 'REFRESH_FAILED',
        message: 'Failed to refresh token'
      });
    }
  }

  // Logout user
  static async logout(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.sessionId) {
        return res.status(400).json({
          error: 'NO_SESSION',
          message: 'No active session found'
        });
      }

      // Invalidate session
      await SessionModel.invalidate(req.user.sessionId);

      logger.info(`User logged out: ${req.user.email} (${req.user.id})`);

      res.json({
        message: 'Logout successful'
      });
    } catch (error) {
      logger.error('Logout failed:', error);

      res.status(500).json({
        error: 'LOGOUT_FAILED',
        message: 'Failed to logout user'
      });
    }
  }

  // Logout from all devices
  static async logoutAll(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(400).json({
          error: 'NO_USER',
          message: 'No user found in request'
        });
      }

      // Invalidate all sessions for user
      const invalidatedCount = await SessionModel.invalidateAllForUser(req.user.id);

      logger.info(`User logged out from all devices: ${req.user.email} (${req.user.id}), sessions: ${invalidatedCount}`);

      res.json({
        message: 'Logged out from all devices successfully',
        sessionsInvalidated: invalidatedCount
      });
    } catch (error) {
      logger.error('Logout all failed:', error);

      res.status(500).json({
        error: 'LOGOUT_ALL_FAILED',
        message: 'Failed to logout from all devices'
      });
    }
  }

  // Get current user profile
  static async me(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'NO_USER',
          message: 'No user found in request'
        });
      }

      const user = await UserModel.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          type: user.type,
          isActive: user.isActive,
          isVerified: user.isVerified,
          capabilities: user.capabilities,
          permissions: user.permissions,
          metadata: user.metadata,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt
        }
      });
    } catch (error) {
      logger.error('Get profile failed:', error);

      res.status(500).json({
        error: 'PROFILE_FETCH_FAILED',
        message: 'Failed to fetch user profile'
      });
    }
  }

  // Get active sessions
  static async sessions(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'NO_USER',
          message: 'No user found in request'
        });
      }

      const sessions = await SessionModel.getActiveForUser(req.user.id);

      res.json({
        sessions: sessions.map(session => ({
          id: session.id,
          deviceId: session.deviceId,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          lastAccessedAt: session.lastAccessedAt,
          expiresAt: session.expiresAt,
          isCurrent: session.id === req.user?.sessionId,
          metadata: session.metadata
        }))
      });
    } catch (error) {
      logger.error('Get sessions failed:', error);

      res.status(500).json({
        error: 'SESSIONS_FETCH_FAILED',
        message: 'Failed to fetch sessions'
      });
    }
  }
}