'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface Service {
  id: string
  name: string
  icon: any
  port: number
  status: string
}

interface ServiceMonitorProps {
  services: Service[]
}

interface ServiceMetrics {
  cpuUsage: number
  memoryUsage: number
  responseTime: number
  requestCount: number
  errorRate: number
  uptime: string
}

export function ServiceMonitor({ services }: ServiceMonitorProps) {
  const [serviceMetrics, setServiceMetrics] = useState<Record<string, ServiceMetrics>>({})
  const [isLoading, setIsLoading] = useState(false)

  const generateMockMetrics = (): ServiceMetrics => ({
    cpuUsage: Math.random() * 100,
    memoryUsage: Math.random() * 100,
    responseTime: Math.random() * 1000 + 50,
    requestCount: Math.floor(Math.random() * 10000),
    errorRate: Math.random() * 5,
    uptime: `${Math.floor(Math.random() * 30)}d ${Math.floor(Math.random() * 24)}h`
  })

  const refreshMetrics = async () => {
    setIsLoading(true)

    // Simulate API call
    setTimeout(() => {
      const newMetrics: Record<string, ServiceMetrics> = {}
      services.forEach(service => {
        newMetrics[service.id] = generateMockMetrics()
      })
      setServiceMetrics(newMetrics)
      setIsLoading(false)
    }, 1000)
  }

  useEffect(() => {
    refreshMetrics()

    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshMetrics, 30000)
    return () => clearInterval(interval)
  }, [services])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'degraded': return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'unhealthy': return <XCircle className="h-5 w-5 text-red-600" />
      default: return <Activity className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'border-green-200 bg-green-50'
      case 'degraded': return 'border-yellow-200 bg-yellow-50'
      case 'unhealthy': return 'border-red-200 bg-red-50'
      default: return 'border-gray-200 bg-gray-50'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Service Monitor</h2>
          <p className="text-gray-600">Real-time metrics and health status</p>
        </div>
        <Button onClick={refreshMetrics} disabled={isLoading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {services.map((service) => {
          const Icon = service.icon
          const metrics = serviceMetrics[service.id]

          return (
            <Card key={service.id} className={`${getStatusColor(service.status)} transition-all`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Icon className="h-6 w-6 text-gray-700" />
                    <div>
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      <CardDescription>Port {service.port}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(service.status)}
                    <span className="text-sm font-medium capitalize">{service.status}</span>
                  </div>
                </div>
              </CardHeader>

              {metrics && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-gray-600">CPU Usage</p>
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${metrics.cpuUsage}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{metrics.cpuUsage.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-gray-600">Memory Usage</p>
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all"
                            style={{ width: `${metrics.memoryUsage}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{metrics.memoryUsage.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <p className="text-xs text-gray-600">Response Time</p>
                      <p className="text-sm font-medium">{metrics.responseTime.toFixed(0)}ms</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Requests/min</p>
                      <p className="text-sm font-medium">{metrics.requestCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Error Rate</p>
                      <p className="text-sm font-medium">{metrics.errorRate.toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Uptime</p>
                      <p className="text-sm font-medium">{metrics.uptime}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <Button size="sm" variant="outline" className="w-full">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}