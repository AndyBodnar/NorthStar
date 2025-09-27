import express from 'express';
import { DashboardService } from '../services/DashboardService';
import { ServiceRegistry } from '../services/ServiceRegistry';
import { HealthService } from '../services/HealthService';

export function createDashboardRoutes(
  dashboardService: DashboardService,
  serviceRegistry: ServiceRegistry,
  healthService: HealthService
) {
  const router = express.Router();

  // Get all services status
  router.get('/services', (req, res) => {
    try {
      const services = serviceRegistry.getAllServices();
      const servicesWithHealth = services.map(service => {
        const health = healthService.getServiceHealth(service.id);
        const metrics = dashboardService.getServiceMetrics(service.id);

        // Extract port from URL
        let port = 80;
        try {
          const urlObj = new URL(service.url);
          port = parseInt(urlObj.port) || (urlObj.protocol === 'https:' ? 443 : 80);
        } catch (e) {
          // Use default port if URL parsing fails
        }

        return {
          id: service.id,
          name: service.name,
          url: service.url,
          port,
          status: service.status,
          lastCheck: service.lastHealthCheck?.toISOString() || null,
          responseTime: null, // Not available in current health service
          metrics
        };
      });

      res.json(servicesWithHealth);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch services' });
    }
  });

  // Get specific service details
  router.get('/services/:serviceId', (req, res) => {
    try {
      const { serviceId } = req.params;
      const service = serviceRegistry.getService(serviceId);

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const health = healthService.getServiceHealth(serviceId);
      const metrics = dashboardService.getServiceMetrics(serviceId);

      // Extract port from URL
      let port = 80;
      try {
        const urlObj = new URL(service.url);
        port = parseInt(urlObj.port) || (urlObj.protocol === 'https:' ? 443 : 80);
      } catch (e) {
        // Use default port if URL parsing fails
      }

      res.json({
        ...service,
        port,
        status: service.status,
        lastCheck: service.lastHealthCheck?.toISOString() || null,
        responseTime: null, // Not available in current health service
        metrics
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch service details' });
    }
  });

  // Get system health overview
  router.get('/health/overview', (req, res) => {
    try {
      const overallHealth = healthService.getOverallHealth();
      const services = serviceRegistry.getAllServices();

      const summary = {
        overall: overallHealth,
        services: {
          total: services.length,
          healthy: services.filter(s => {
            const health = healthService.getServiceHealth(s.id);
            return health?.status === 'healthy';
          }).length,
          degraded: services.filter(s => s.status === 'unknown').length,
          unhealthy: services.filter(s => {
            const health = healthService.getServiceHealth(s.id);
            return health?.status === 'unhealthy';
          }).length
        }
      };

      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch health overview' });
    }
  });

  // Get logs
  router.get('/logs', (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const service = req.query.service as string;
      const level = req.query.level as string;

      let logs = dashboardService.getLogs(limit);

      // Apply filters
      if (service) {
        logs = logs.filter(log => log.service === service);
      }

      if (level) {
        logs = logs.filter(log => log.level === level);
      }

      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  // Get alerts
  router.get('/alerts', (req, res) => {
    try {
      const alerts = dashboardService.getAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  });

  // Service control actions
  router.post('/services/:serviceId/control', (req, res) => {
    try {
      const { serviceId } = req.params;
      const { action } = req.body;

      if (!['start', 'stop', 'restart'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
      }

      const service = serviceRegistry.getService(serviceId);
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      // The actual control is handled by the DashboardService via WebSocket
      // This endpoint just acknowledges the request
      res.json({
        message: `${action} command sent to ${serviceId}`,
        serviceId,
        action,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({ error: 'Failed to control service' });
    }
  });

  // Test API endpoint
  router.post('/test', async (req, res) => {
    try {
      const { method, url, headers, body } = req.body;

      // Basic validation
      if (!method || !url) {
        return res.status(400).json({ error: 'Method and URL are required' });
      }

      // For now, return a mock response
      // In a real implementation, this would make the actual HTTP request
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json',
          'x-response-time': `${Math.floor(Math.random() * 100) + 10}ms`
        },
        data: {
          message: 'Mock API response',
          timestamp: new Date().toISOString(),
          requestedUrl: url,
          method: method.toUpperCase()
        },
        responseTime: Math.floor(Math.random() * 500) + 50
      };

      res.json(mockResponse);

    } catch (error) {
      res.status(500).json({ error: 'Failed to execute API test' });
    }
  });

  // Export logs
  router.get('/logs/export', (req, res) => {
    try {
      const logs = dashboardService.getLogs(1000);
      const logText = logs.map(log =>
        `[${log.timestamp}] ${log.level.toUpperCase()} [${log.service}] ${log.message}${log.metadata ? ' | ' + JSON.stringify(log.metadata) : ''}`
      ).join('\n');

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="north-star-logs-${new Date().toISOString().split('T')[0]}.txt"`);
      res.send(logText);

    } catch (error) {
      res.status(500).json({ error: 'Failed to export logs' });
    }
  });

  return router;
}