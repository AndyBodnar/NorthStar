import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    type: string;
    permissions: string[];
  };
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No valid authorization token provided'
      });
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

    const decoded = jwt.verify(token, jwtSecret) as any;

    req.user = {
      id: decoded.sub,
      type: decoded.type,
      permissions: decoded.permissions || []
    };

    logger.debug(`Authenticated user: ${req.user.id} (${req.user.type})`);
    next();
  } catch (error) {
    logger.warn(`Authentication failed: ${error}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (!req.user.permissions.includes(permission)) {
      logger.warn(`Permission denied: User ${req.user.id} lacks permission ${permission}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. Required: ${permission}`
      });
    }

    next();
  };
};