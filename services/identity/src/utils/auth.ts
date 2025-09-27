import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logger } from './logger';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export interface TokenPayload {
  sub: string; // user ID
  email: string;
  type: string;
  permissions: string[];
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

// Password hashing
export const hashPassword = async (password: string): Promise<string> => {
  try {
    return await bcrypt.hash(password, BCRYPT_ROUNDS);
  } catch (error) {
    logger.error('Password hashing failed:', error);
    throw new Error('Password hashing failed');
  }
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logger.error('Password verification failed:', error);
    return false;
  }
};

// JWT token generation
export const generateTokenPair = (payload: Omit<TokenPayload, 'iat' | 'exp'>): TokenPair => {
  try {
    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'north-star-identity',
      audience: 'north-star-services',
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(
      { sub: payload.sub, sessionId: payload.sessionId },
      JWT_REFRESH_SECRET,
      {
        expiresIn: JWT_REFRESH_EXPIRES_IN,
        issuer: 'north-star-identity',
        audience: 'north-star-services',
      } as jwt.SignOptions
    );

    // Calculate expiration time in seconds
    const decoded = jwt.decode(accessToken) as any;
    const expiresIn = decoded.exp - decoded.iat;

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  } catch (error) {
    logger.error('Token generation failed:', error);
    throw new Error('Token generation failed');
  }
};

// JWT token verification
export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'north-star-identity',
      audience: 'north-star-services',
    }) as TokenPayload;
  } catch (error) {
    logger.warn('Access token verification failed:', error);
    throw new Error('Invalid or expired token');
  }
};

export const verifyRefreshToken = (token: string): { sub: string; sessionId: string } => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'north-star-identity',
      audience: 'north-star-services',
    }) as { sub: string; sessionId: string };
  } catch (error) {
    logger.warn('Refresh token verification failed:', error);
    throw new Error('Invalid or expired refresh token');
  }
};

// Token hash generation (for storing in database)
export const generateTokenHash = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Session token generation
export const generateSessionToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// API key generation
export const generateApiKey = (): string => {
  const prefix = 'nsk_'; // North Star Key
  const randomBytes = crypto.randomBytes(24).toString('base64url');
  return `${prefix}${randomBytes}`;
};

// Decode token without verification (for extracting payload)
export const decodeToken = (token: string): TokenPayload | null => {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch (error) {
    logger.warn('Token decode failed:', error);
    return null;
  }
};

// Check if token is expired
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    return true;
  }
};

// Generate secure random string
export const generateSecureRandom = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

// Validate password strength
export const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};