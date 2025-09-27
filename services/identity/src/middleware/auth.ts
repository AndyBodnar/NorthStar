import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, generateTokenHash } from '../utils/auth';
import { SessionModel } from '../models/Session';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    type: string;
    permissions: string[];
    sessionId: string;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'MISSING_TOKEN',
        message: 'Authorization token is required'
      });
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = verifyAccessToken(token);

    // Verify session exists and is active
    const session = await SessionModel.findByTokenHash(generateTokenHash(token));
    if (!session) {
      return res.status(401).json({
        error: 'INVALID_SESSION',
        message: 'Session not found or expired'
      });
    }

    // Add user info to request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      type: decoded.type,
      permissions: decoded.permissions,
      sessionId: session.id
    };

    next();
  } catch (error) {
    logger.warn('Token authentication failed:', error);

    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Invalid or expired token'
    });
  }
};

export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHENTICATED',
        message: 'Authentication required'
      });
    }

    if (!req.user.permissions.includes(permission) && !req.user.permissions.includes('admin:*')) {
      return res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `Permission required: ${permission}`
      });
    }

    next();
  };
};

export const requireRole = (allowedTypes: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHENTICATED',
        message: 'Authentication required'
      });
    }

    if (!allowedTypes.includes(req.user.type)) {
      return res.status(403).json({
        error: 'INSUFFICIENT_ROLE',
        message: `Role required: ${allowedTypes.join(', ')}`
      });
    }

    next();
  };
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.slice(7);

    try {
      const decoded = verifyAccessToken(token);
      const session = await SessionModel.findByTokenHash(generateTokenHash(token));

      if (session) {
        req.user = {
          id: decoded.sub,
          email: decoded.email,
          type: decoded.type,
          permissions: decoded.permissions,
          sessionId: session.id
        };
      }
    } catch (error) {
      // Invalid token, but continue without authentication
      logger.debug('Optional auth failed:', error);
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next();
  }
};