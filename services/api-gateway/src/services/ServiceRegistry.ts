import { logger } from '../utils/logger';

export interface ServiceInfo {
  id: string;
  name: string;
  version: string;
  url: string;
  healthEndpoint: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck: Date;
  metadata?: Record<string, any>;
}

export class ServiceRegistry {
  private services = new Map<string, ServiceInfo>();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHealthChecks();
  }

  register(service: Omit<ServiceInfo, 'status' | 'lastHealthCheck'>): void {
    const serviceInfo: ServiceInfo = {
      ...service,
      status: 'unknown',
      lastHealthCheck: new Date(),
    };

    this.services.set(service.id, serviceInfo);
    logger.info(`Registered service: ${service.name} (${service.id})`);
  }

  unregister(serviceId: string): void {
    if (this.services.delete(serviceId)) {
      logger.info(`Unregistered service: ${serviceId}`);
    }
  }

  getService(serviceId: string): ServiceInfo | undefined {
    return this.services.get(serviceId);
  }

  getAllServices(): ServiceInfo[] {
    return Array.from(this.services.values());
  }

  getHealthyServices(): ServiceInfo[] {
    return this.getAllServices().filter(service => service.status === 'healthy');
  }

  updateServiceStatus(serviceId: string, status: ServiceInfo['status']): void {
    const service = this.services.get(serviceId);
    if (service) {
      service.status = status;
      service.lastHealthCheck = new Date();
      logger.debug(`Updated service status: ${serviceId} -> ${status}`);
    }
  }

  async checkServiceHealth(service: ServiceInfo): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${service.url}${service.healthEndpoint}`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const isHealthy = response.ok;
      this.updateServiceStatus(service.id, isHealthy ? 'healthy' : 'unhealthy');
      return isHealthy;
    } catch (error) {
      logger.warn(`Health check failed for ${service.name}: ${error}`);
      this.updateServiceStatus(service.id, 'unhealthy');
      return false;
    }
  }

  private async performHealthChecks(): Promise<void> {
    const services = this.getAllServices();
    const healthChecks = services.map(service => this.checkServiceHealth(service));

    try {
      await Promise.allSettled(healthChecks);
    } catch (error) {
      logger.error(`Error during health checks: ${error}`);
    }
  }

  private startHealthChecks(): void {
    const interval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'); // 30 seconds default

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, interval);

    logger.info(`Started health checks with ${interval}ms interval`);
  }

  registerDefaultServices(): void {
    const services = [
      {
        id: 'identity',
        name: 'Identity Service',
        version: '1.0.0',
        url: process.env.IDENTITY_SERVICE_URL || 'http://localhost:3002',
        healthEndpoint: '/health',
      },
      {
        id: 'memory',
        name: 'Memory Service',
        version: '1.0.0',
        url: process.env.MEMORY_SERVICE_URL || 'http://localhost:3003',
        healthEndpoint: '/health',
      },
      {
        id: 'sensing',
        name: 'Sensing Service',
        version: '1.0.0',
        url: process.env.SENSING_SERVICE_URL || 'http://localhost:3004',
        healthEndpoint: '/health',
      },
      {
        id: 'generation',
        name: 'Generation Service',
        version: '1.0.0',
        url: process.env.GENERATION_SERVICE_URL || 'http://localhost:3005',
        healthEndpoint: '/health',
      },
      {
        id: 'interaction',
        name: 'Interaction Service',
        version: '1.0.0',
        url: process.env.INTERACTION_SERVICE_URL || 'http://localhost:3006',
        healthEndpoint: '/health',
      },
      {
        id: 'autonomy',
        name: 'Autonomy Service',
        version: '1.0.0',
        url: process.env.AUTONOMY_SERVICE_URL || 'http://localhost:3007',
        healthEndpoint: '/health',
      },
      {
        id: 'truth',
        name: 'Truth Service',
        version: '1.0.0',
        url: process.env.TRUTH_SERVICE_URL || 'http://localhost:3008',
        healthEndpoint: '/health',
      },
      {
        id: 'economy',
        name: 'Economy Service',
        version: '1.0.0',
        url: process.env.ECONOMY_SERVICE_URL || 'http://localhost:3009',
        healthEndpoint: '/health',
      },
      {
        id: 'governance',
        name: 'Governance Service',
        version: '1.0.0',
        url: process.env.GOVERNANCE_SERVICE_URL || 'http://localhost:3010',
        healthEndpoint: '/health',
      },
    ];

    services.forEach(service => this.register(service));
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}