import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import dotenv from 'dotenv';
import { createServer } from 'http';

import { logger } from './utils/logger';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { requestLogger } from './middleware/requestLogger';
import { validateRequest } from './middleware/validation';
import { ServiceRegistry } from './services/ServiceRegistry';
import { HealthService } from './services/HealthService';
import { DashboardService } from './services/DashboardService';
import { createDashboardRoutes } from './routes/dashboard';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Security and performance middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Services
const serviceRegistry = new ServiceRegistry();
const healthService = new HealthService(serviceRegistry);
const dashboardService = new DashboardService(server, serviceRegistry, healthService);

// Health check endpoint
app.get('/health', (req, res) => {
  const healthStatus = healthService.getOverallHealth();
  res.status(healthStatus.status === 'healthy' ? 200 : 503).json(healthStatus);
});

// Dashboard API routes
app.use('/api/dashboard', createDashboardRoutes(dashboardService, serviceRegistry, healthService));

// API Documentation
try {
  const swaggerDocument = YAML.load('./docs/api.yaml');
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (error) {
  logger.warn('Could not load API documentation');
}

// Public authentication routes (no auth required)
app.use('/api/auth', createProxyMiddleware({
  target: process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '/auth' },
}));

// Protected identity service routes
app.use('/api/identity', authMiddleware, createProxyMiddleware({
  target: process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: { '^/api/identity': '' },
}));

app.use('/api/memory', authMiddleware, createProxyMiddleware({
  target: process.env.MEMORY_SERVICE_URL || 'http://localhost:3002',
  changeOrigin: true,
  pathRewrite: { '^/api/memory': '' },
}));

app.use('/api/sensing', authMiddleware, createProxyMiddleware({
  target: process.env.SENSING_SERVICE_URL || 'http://localhost:3003',
  changeOrigin: true,
  pathRewrite: { '^/api/sensing': '' },
}));

app.use('/api/generation', authMiddleware, createProxyMiddleware({
  target: process.env.GENERATION_SERVICE_URL || 'http://localhost:3004',
  changeOrigin: true,
  pathRewrite: { '^/api/generation': '' },
}));

app.use('/api/interaction', authMiddleware, createProxyMiddleware({
  target: process.env.INTERACTION_SERVICE_URL || 'http://localhost:3005',
  changeOrigin: true,
  pathRewrite: { '^/api/interaction': '' },
}));

app.use('/api/autonomy', authMiddleware, createProxyMiddleware({
  target: process.env.AUTONOMY_SERVICE_URL || 'http://localhost:3006',
  changeOrigin: true,
  pathRewrite: { '^/api/autonomy': '' },
}));

app.use('/api/truth', authMiddleware, createProxyMiddleware({
  target: process.env.TRUTH_SERVICE_URL || 'http://localhost:3007',
  changeOrigin: true,
  pathRewrite: { '^/api/truth': '' },
}));

app.use('/api/economy', authMiddleware, createProxyMiddleware({
  target: process.env.ECONOMY_SERVICE_URL || 'http://localhost:3008',
  changeOrigin: true,
  pathRewrite: { '^/api/economy': '' },
}));

app.use('/api/governance', authMiddleware, createProxyMiddleware({
  target: process.env.GOVERNANCE_SERVICE_URL || 'http://localhost:3009',
  changeOrigin: true,
  pathRewrite: { '^/api/governance': '' },
}));

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: req.originalUrl,
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Health check available at http://localhost:${PORT}/health`);
  logger.info(`API documentation available at http://localhost:${PORT}/docs`);
  logger.info(`Dashboard WebSocket server ready`);

  // Register services on startup
  serviceRegistry.registerDefaultServices();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  dashboardService.shutdown();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;