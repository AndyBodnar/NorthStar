import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface APIError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const errorHandler = (
  error: APIError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  const code = error.code || 'INTERNAL_ERROR';

  // Log error details
  logger.error({
    message: error.message,
    stack: error.stack,
    statusCode,
    code,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    details: error.details
  });

  // Don't expose internal error details in production
  const response = {
    error: code,
    message: process.env.NODE_ENV === 'production' && statusCode >= 500
      ? 'Internal Server Error'
      : message,
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown',
    ...(process.env.NODE_ENV !== 'production' && statusCode >= 500 && {
      stack: error.stack,
      details: error.details
    })
  };

  res.status(statusCode).json(response);
};

export const createError = (
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): APIError => {
  const error = new Error(message) as APIError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
};