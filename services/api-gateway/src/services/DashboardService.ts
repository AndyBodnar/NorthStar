import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import { ServiceRegistry } from './ServiceRegistry';
import { HealthService } from './HealthService';
import { logger } from '../utils/logger';

interface ServiceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
  requestCount: number;
  errorRate: number;
  uptime: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  message: string;
  metadata?: Record<string, any>;
}

interface SystemAlert {
  id: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

export class DashboardService {
  private io: SocketIOServer;
  private serviceRegistry: ServiceRegistry;
  private healthService: HealthService;
  private logs: LogEntry[] = [];
  private alerts: SystemAlert[] = [];
  private metricsInterval?: NodeJS.Timeout;
  private logsInterval?: NodeJS.Timeout;

  constructor(
    server: Server,
    serviceRegistry: ServiceRegistry,
    healthService: HealthService
  ) {
    this.serviceRegistry = serviceRegistry;
    this.healthService = healthService;

    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.DASHBOARD_ORIGIN || "http://localhost:4000",
        methods: ["GET", "POST"]
      }
    });

    this.setupSocketHandlers();
    this.startPeriodicUpdates();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Dashboard client connected: ${socket.id}`);

      // Send initial data
      socket.emit('service-status', this.getAllServiceStatuses());
      socket.emit('system-alerts', this.alerts);
      socket.emit('logs', this.logs.slice(-100)); // Send last 100 logs

      socket.on('disconnect', () => {
        logger.info(`Dashboard client disconnected: ${socket.id}`);
      });

      socket.on('acknowledge-alert', (alertId: string) => {
        this.acknowledgeAlert(alertId);
      });

      socket.on('clear-alerts', () => {
        this.clearAlerts();
      });

      socket.on('clear-logs', () => {
        this.clearLogs();
      });

      socket.on('service-control', (data: { serviceId: string; action: string }) => {
        this.handleServiceControl(data.serviceId, data.action);
      });
    });
  }

  private startPeriodicUpdates() {
    // Update service metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      this.updateServiceMetrics();
    }, 30000);

    // Generate simulated logs every 5 seconds
    this.logsInterval = setInterval(() => {
      this.generateSimulatedLogs();
    }, 5000);

    // Check for alerts every 60 seconds
    setInterval(() => {
      this.checkForAlerts();
    }, 60000);
  }

  private updateServiceMetrics() {
    const services = this.serviceRegistry.getAllServices();

    services.forEach(service => {
      // Simulate real metrics (in production, these would come from actual monitoring)
      const metrics: ServiceMetrics = {
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        responseTime: Math.random() * 1000 + 50,
        requestCount: Math.floor(Math.random() * 10000),
        errorRate: Math.random() * 5,
        uptime: `${Math.floor(Math.random() * 30)}d ${Math.floor(Math.random() * 24)}h`
      };

      const healthStatus = this.healthService.getServiceHealth(service.id);

      this.io.emit('service-status', {
        serviceId: service.id,
        status: healthStatus?.status || 'unknown',
        metrics: metrics
      });
    });
  }

  private generateSimulatedLogs() {
    const services = ['api-gateway', 'identity', 'memory', 'sensing', 'generation'];
    const levels: LogEntry['level'][] = ['info', 'warn', 'error', 'debug'];
    const messages = [
      'Request processed successfully',
      'Database connection established',
      'Authentication token validated',
      'Cache miss for key: user_data_123',
      'Rate limit applied to client',
      'Background job completed',
      'Invalid request format detected',
      'Service health check passed'
    ];

    // Generate 1-3 logs per interval
    const logCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < logCount; i++) {
      const log: LogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        level: levels[Math.floor(Math.random() * levels.length)],
        service: services[Math.floor(Math.random() * services.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
        metadata: Math.random() > 0.7 ? {
          requestId: Math.random().toString(36).substr(2, 9),
          userId: `user_${Math.floor(Math.random() * 1000)}`
        } : undefined
      };

      this.addLog(log);
    }
  }

  private checkForAlerts() {
    // Simulate alert generation based on service health
    const services = this.serviceRegistry.getAllServices();

    services.forEach(service => {
      const healthStatus = this.healthService.getServiceHealth(service.id);

      if (Math.random() > 0.9) { // 10% chance of alert
        const alert: SystemAlert = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'performance',
          message: `Service ${service.name} showing performance degradation`,
          severity: healthStatus?.status === 'healthy' ? 'medium' : 'high',
          timestamp: new Date().toISOString()
        };

        this.addAlert(alert);
      }
    });
  }

  public addLog(log: LogEntry) {
    this.logs.push(log);

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    this.io.emit('log-entry', log);
  }

  public addAlert(alert: SystemAlert) {
    this.alerts.unshift(alert);

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(0, 50);
    }

    this.io.emit('system-alert', alert);
  }

  private acknowledgeAlert(alertId: string) {
    const alertIndex = this.alerts.findIndex(alert => alert.id === alertId);
    if (alertIndex !== -1) {
      // Remove acknowledged alert
      this.alerts.splice(alertIndex, 1);
      this.io.emit('alert-acknowledged', alertId);
    }
  }

  private clearAlerts() {
    this.alerts = [];
    this.io.emit('alerts-cleared');
  }

  private clearLogs() {
    this.logs = [];
    this.io.emit('logs-cleared');
  }

  private getAllServiceStatuses() {
    const services = this.serviceRegistry.getAllServices();
    const statuses: Record<string, any> = {};

    services.forEach(service => {
      const healthStatus = this.healthService.getServiceHealth(service.id);
      statuses[service.id] = {
        status: service.status,
        lastCheck: service.lastHealthCheck?.toISOString() || null
      };
    });

    return statuses;
  }

  private async handleServiceControl(serviceId: string, action: string) {
    try {
      logger.info(`Service control action: ${action} on ${serviceId}`);

      // In a real implementation, this would interact with container orchestration
      // For now, we'll just emit a status update

      let newStatus = 'unknown';
      switch (action) {
        case 'start':
          newStatus = 'healthy';
          break;
        case 'stop':
          newStatus = 'unhealthy';
          break;
        case 'restart':
          newStatus = 'healthy';
          break;
      }

      // Simulate delay
      setTimeout(() => {
        this.io.emit('service-status', {
          serviceId,
          status: newStatus,
          action: action
        });

        this.addLog({
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'api-gateway',
          message: `Service ${serviceId} ${action} completed`,
          metadata: { serviceId, action }
        });
      }, 2000);

    } catch (error) {
      logger.error(`Error handling service control: ${error}`);

      this.addAlert({
        id: Math.random().toString(36).substr(2, 9),
        type: 'error',
        message: `Failed to ${action} service ${serviceId}`,
        severity: 'high',
        timestamp: new Date().toISOString()
      });
    }
  }

  public getLogs(limit: number = 100): LogEntry[] {
    return this.logs.slice(-limit);
  }

  public getAlerts(): SystemAlert[] {
    return this.alerts;
  }

  public getServiceMetrics(serviceId: string): ServiceMetrics | null {
    // In a real implementation, this would fetch actual metrics
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      responseTime: Math.random() * 1000 + 50,
      requestCount: Math.floor(Math.random() * 10000),
      errorRate: Math.random() * 5,
      uptime: `${Math.floor(Math.random() * 30)}d ${Math.floor(Math.random() * 24)}h`
    };
  }

  public shutdown() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.logsInterval) {
      clearInterval(this.logsInterval);
    }
    this.io.close();
  }
}