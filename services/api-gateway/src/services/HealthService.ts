import { ServiceRegistry, ServiceInfo } from './ServiceRegistry';

export interface OverallHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    [serviceId: string]: {
      status: ServiceInfo['status'];
      lastCheck: string;
      url?: string;
    };
  };
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    unknown: number;
  };
}

export class HealthService {
  constructor(private serviceRegistry: ServiceRegistry) {}

  getOverallHealth(): OverallHealthStatus {
    const services = this.serviceRegistry.getAllServices();
    const servicesHealth: OverallHealthStatus['services'] = {};

    let healthyCount = 0;
    let unhealthyCount = 0;
    let unknownCount = 0;

    services.forEach(service => {
      servicesHealth[service.id] = {
        status: service.status,
        lastCheck: service.lastHealthCheck.toISOString(),
        url: service.url,
      };

      switch (service.status) {
        case 'healthy':
          healthyCount++;
          break;
        case 'unhealthy':
          unhealthyCount++;
          break;
        case 'unknown':
          unknownCount++;
          break;
      }
    });

    const total = services.length;
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

    if (total === 0) {
      overallStatus = 'healthy'; // No services to check
    } else if (unhealthyCount === 0 && unknownCount === 0) {
      overallStatus = 'healthy'; // All services healthy
    } else if (unhealthyCount < total / 2) {
      overallStatus = 'degraded'; // Some services unhealthy but majority healthy
    } else {
      overallStatus = 'unhealthy'; // Majority of services unhealthy
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: servicesHealth,
      summary: {
        total,
        healthy: healthyCount,
        unhealthy: unhealthyCount,
        unknown: unknownCount,
      },
    };
  }

  isServiceHealthy(serviceId: string): boolean {
    const service = this.serviceRegistry.getService(serviceId);
    return service?.status === 'healthy' || false;
  }

  getServiceHealth(serviceId: string): ServiceInfo | null {
    return this.serviceRegistry.getService(serviceId) || null;
  }
}