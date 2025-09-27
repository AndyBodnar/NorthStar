import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

import { logger } from './utils/logger';
import { initializeDatabase, createTables } from './config/database-mock';
import { rateLimitGeneral } from './middleware/rateLimit';

// Routes
import authRoutes from './routes/auth';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true
}));
app.use(compression());

// Rate limiting
app.use(rateLimitGeneral);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substr(2, 9);

  // Add request ID to headers
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);

  logger.info({
    message: 'Incoming request',
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    logger.info({
      message: 'Request completed',
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration
    });

    return originalSend.call(this, data);
  };

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'identity',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/auth', authRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'North Star Identity Service',
    version: '1.0.0',
    description: 'Authentication and identity management for the North Star constellation',
    endpoints: {
      health: '/health',
      auth: '/auth',
      docs: '/docs'
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = req.headers['x-request-id'];

  logger.error({
    message: 'Unhandled error',
    error: error.message,
    stack: error.stack,
    requestId,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    requestId,
    timestamp: new Date().toISOString()
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Initialize database connections
    await initializeDatabase();

    // Create database tables
    await createTables();

    // Start server
    app.listen(PORT, () => {
      logger.info(`Identity Service running on port ${PORT}`);
      logger.info(`Health check available at http://localhost:${PORT}/health`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();

export default app;