import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || generateRequestId();

  // Add request ID to headers for tracking
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);

  // Log request
  logger.info({
    message: 'Incoming request',
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
  });

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void) {
    const duration = Date.now() - start;

    logger.info({
      message: 'Request completed',
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('Content-Length'),
    });

    return originalEnd(chunk, encoding as BufferEncoding, cb);
  };

  next();
};

const generateRequestId = (): string => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};