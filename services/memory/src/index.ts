import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { logger } from './utils/logger';
import { initializeDatabase, closeDatabase } from './config/database';
import memoryRoutes from './routes/memory';
import stateRoutes from './routes/state';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:4000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'memory',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/memory', memoryRoutes);
app.use('/state', stateRoutes);

// Time fork routes (basic implementation)
app.get('/forks', (req, res) => {
  // TODO: Implement time fork functionality
  res.json({ forks: [], message: 'Time fork functionality coming soon' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'North Star Memory Service',
    version: '1.0.0',
    description: 'Memory and State Management Service',
    endpoints: {
      health: '/health',
      memory: '/memory',
      state: '/state',
      forks: '/forks'
    }
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Start server
async function startServer() {
  try {
    // Initialize database connections
    await initializeDatabase();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`Memory Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Service endpoints available:');
      logger.info(`  Health: http://localhost:${PORT}/health`);
      logger.info(`  Memory: http://localhost:${PORT}/memory`);
      logger.info(`  State: http://localhost:${PORT}/state`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await closeDatabase();
          logger.info('Database connections closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force close after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });

  } catch (error) {
    logger.error('Failed to start Memory Service:', error);
    process.exit(1);
  }
}

// Auto-register with API Gateway (if available)
async function registerWithGateway() {
  if (!process.env.GATEWAY_URL) {
    logger.info('No gateway URL configured, skipping registration');
    return;
  }

  try {
    const axios = require('axios');
    const registration = {
      id: process.env.SERVICE_ID || 'memory',
      name: process.env.SERVICE_NAME || 'Memory Service',
      url: `http://localhost:${PORT}`,
      healthCheck: `http://localhost:${PORT}/health`,
      version: '1.0.0',
      tags: ['memory', 'state', 'storage']
    };

    await axios.post(`${process.env.GATEWAY_URL}/register`, registration);
    logger.info(`Registered with API Gateway at ${process.env.GATEWAY_URL}`);

  } catch (error) {
    logger.error('Failed to register with API Gateway:', error);
  }
}

// Start the service
startServer().then(() => {
  // Register with gateway after startup
  setTimeout(registerWithGateway, 5000);
});

export default app;