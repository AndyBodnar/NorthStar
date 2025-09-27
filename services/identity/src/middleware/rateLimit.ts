import rateLimit from 'express-rate-limit';
import { redis } from '../config/database-mock';
import { logger } from '../utils/logger';

// Redis-based rate limiter store
class RedisStore {
  constructor(private keyPrefix: string = 'rl:') {}

  async incr(key: string): Promise<number> {
    const fullKey = this.keyPrefix + key;
    const current = await redis.incr(fullKey);

    if (current === 1) {
      // Set expiration on first increment
      await redis.expire(fullKey, 60); // 1 minute
    }

    return current;
  }

  async decrement(key: string): Promise<void> {
    const fullKey = this.keyPrefix + key;
    await redis.decr(fullKey);
  }

  async resetKey(key: string): Promise<void> {
    const fullKey = this.keyPrefix + key;
    await redis.del(fullKey);
  }
}

const store = new RedisStore();

// General rate limiter
export const rateLimitGeneral = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    });
  }
});

// Authentication-specific rate limiter (more restrictive)
export const rateLimitAuth = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 auth attempts per window per IP
  message: {
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts, please try again in 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    res.status(429).json({
      error: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again in 15 minutes'
    });
  }
});

// API key generation rate limiter
export const rateLimitApiKey = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 API key generations per hour per user
  message: {
    error: 'API_KEY_RATE_LIMIT_EXCEEDED',
    message: 'Too many API key generation requests, please try again later'
  },
  keyGenerator: (req: any) => {
    // Rate limit by user ID instead of IP
    return req.user?.id || req.ip;
  },
  handler: (req: any, res: any) => {
    logger.warn(`API key generation rate limit exceeded for user: ${req.user?.id || req.ip}`);
    res.status(429).json({
      error: 'API_KEY_RATE_LIMIT_EXCEEDED',
      message: 'Too many API key generation requests, please try again later'
    });
  }
});

// Password reset rate limiter
export const rateLimitPasswordReset = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour per IP
  message: {
    error: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
    message: 'Too many password reset attempts, please try again later'
  },
  handler: (req, res) => {
    logger.warn(`Password reset rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset attempts, please try again later'
    });
  }
});

// User creation rate limiter (for admin endpoints)
export const rateLimitUserCreation = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 user creations per hour per authenticated user
  message: {
    error: 'USER_CREATION_RATE_LIMIT_EXCEEDED',
    message: 'Too many user creation requests, please try again later'
  },
  keyGenerator: (req: any) => {
    return req.user?.id || req.ip;
  },
  handler: (req: any, res: any) => {
    logger.warn(`User creation rate limit exceeded for user: ${req.user?.id || req.ip}`);
    res.status(429).json({
      error: 'USER_CREATION_RATE_LIMIT_EXCEEDED',
      message: 'Too many user creation requests, please try again later'
    });
  }
});