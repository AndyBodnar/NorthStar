const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface ServiceInfo {
  id: string;
  name: string;
  url?: string;
  port: number;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck?: string;
  responseTime?: number;
  metrics?: {
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    requestCount: number;
    errorRate: number;
    uptime: string;
  };
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface SystemAlert {
  id: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

export interface HealthOverview {
  overall: {
    status: string;
    message?: string;
  };
  services: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export interface APITestRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: any;
}

export interface APITestResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  responseTime: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Services
  async getServices(): Promise<ServiceInfo[]> {
    return this.request<ServiceInfo[]>('/api/dashboard/services');
  }

  async getService(serviceId: string): Promise<ServiceInfo> {
    return this.request<ServiceInfo>(`/api/dashboard/services/${serviceId}`);
  }

  async controlService(serviceId: string, action: 'start' | 'stop' | 'restart'): Promise<any> {
    return this.request(`/api/dashboard/services/${serviceId}/control`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  // Health
  async getHealthOverview(): Promise<HealthOverview> {
    return this.request<HealthOverview>('/api/dashboard/health/overview');
  }

  async getSystemHealth(): Promise<any> {
    return this.request('/health');
  }

  // Logs
  async getLogs(params?: {
    limit?: number;
    service?: string;
    level?: string;
  }): Promise<LogEntry[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.service) searchParams.set('service', params.service);
    if (params?.level) searchParams.set('level', params.level);

    const query = searchParams.toString();
    return this.request<LogEntry[]>(`/api/dashboard/logs${query ? `?${query}` : ''}`);
  }

  async exportLogs(): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/dashboard/logs/export`);
    if (!response.ok) {
      throw new Error(`Failed to export logs: ${response.status} ${response.statusText}`);
    }
    return response.blob();
  }

  // Alerts
  async getAlerts(): Promise<SystemAlert[]> {
    return this.request<SystemAlert[]>('/api/dashboard/alerts');
  }

  // API Testing
  async testApi(request: APITestRequest): Promise<APITestResponse> {
    return this.request<APITestResponse>('/api/dashboard/test', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
}

export const apiClient = new ApiClient();

// Utility functions
export const downloadFile = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleString();
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'healthy': return 'text-green-600 bg-green-100';
    case 'degraded': return 'text-yellow-600 bg-yellow-100';
    case 'unhealthy': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};

export const getLogLevelColor = (level: string) => {
  switch (level) {
    case 'error': return 'text-red-600 bg-red-50 border-red-200';
    case 'warn': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'debug': return 'text-gray-600 bg-gray-50 border-gray-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'text-red-800 bg-red-100 border-red-300';
    case 'high': return 'text-red-700 bg-red-50 border-red-200';
    case 'medium': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    case 'low': return 'text-blue-700 bg-blue-50 border-blue-200';
    default: return 'text-gray-700 bg-gray-50 border-gray-200';
  }
};