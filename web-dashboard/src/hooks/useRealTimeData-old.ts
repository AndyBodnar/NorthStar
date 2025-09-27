import { useState, useEffect, useCallback } from 'react'
import { useWebSocket } from '@/lib/websocket'

export interface ServiceMetrics {
  cpuUsage: number
  memoryUsage: number
  responseTime: number
  requestCount: number
  errorRate: number
  uptime: string
}

export interface LogEntry {
  id: string
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'debug'
  service: string
  message: string
  metadata?: Record<string, any>
}

export interface SystemAlert {
  id: string
  type: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Date
  acknowledged: boolean
}

export function useRealTimeData() {
  const [serviceMetrics, setServiceMetrics] = useState<Record<string, ServiceMetrics>>({})
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, string>>({})
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [alerts, setAlerts] = useState<SystemAlert[]>([])
  const [isConnected, setIsConnected] = useState(false)

  const { connect, disconnect, subscribe, isConnected: checkConnection } = useWebSocket()

  const addLog = useCallback((logData: any) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(logData.timestamp),
      level: logData.level,
      service: logData.service,
      message: logData.message,
      metadata: logData.metadata
    }

    setLogs(prev => {
      const updated = [...prev, newLog]
      return updated.slice(-1000) // Keep only last 1000 logs
    })
  }, [])

  const addAlert = useCallback((alertData: any) => {
    const newAlert: SystemAlert = {
      id: Math.random().toString(36).substr(2, 9),
      type: alertData.type,
      message: alertData.message,
      severity: alertData.severity,
      timestamp: new Date(),
      acknowledged: false
    }

    setAlerts(prev => [newAlert, ...prev.slice(0, 49)]) // Keep only last 50 alerts
  }, [])

  const updateServiceStatus = useCallback((statusData: any) => {
    setServiceStatuses(prev => ({
      ...prev,
      [statusData.serviceId]: statusData.status
    }))

    if (statusData.metrics) {
      setServiceMetrics(prev => ({
        ...prev,
        [statusData.serviceId]: statusData.metrics
      }))
    }
  }, [])

  const handleHealthCheck = useCallback((healthData: any) => {
    setServiceStatuses(prev => ({
      ...prev,
      [healthData.serviceId]: healthData.healthy ? 'healthy' : 'unhealthy'
    }))
  }, [])

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    )
  }, [])

  const clearAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  useEffect(() => {
    const socket = connect()

    // Set up subscriptions
    const unsubscribeStatus = subscribe('service-status', updateServiceStatus)
    const unsubscribeLogs = subscribe('log-entry', addLog)
    const unsubscribeAlerts = subscribe('system-alert', addAlert)
    const unsubscribeHealth = subscribe('health-check', handleHealthCheck)

    // Check connection status periodically
    const connectionInterval = setInterval(() => {
      setIsConnected(checkConnection())
    }, 1000)

    return () => {
      unsubscribeStatus()
      unsubscribeLogs()
      unsubscribeAlerts()
      unsubscribeHealth()
      clearInterval(connectionInterval)
    }
  }, [])

  // Simulate real-time data for demo purposes
  useEffect(() => {
    if (!isConnected) return

    const simulateData = () => {
      // Simulate service metrics updates
      const services = ['api-gateway', 'identity', 'memory', 'sensing', 'generation', 'interaction', 'autonomy', 'truth', 'economy', 'governance']

      services.forEach(serviceId => {
        if (Math.random() > 0.7) { // 30% chance to update each service
          const metrics: ServiceMetrics = {
            cpuUsage: Math.random() * 100,
            memoryUsage: Math.random() * 100,
            responseTime: Math.random() * 1000 + 50,
            requestCount: Math.floor(Math.random() * 10000),
            errorRate: Math.random() * 5,
            uptime: `${Math.floor(Math.random() * 30)}d ${Math.floor(Math.random() * 24)}h`
          }

          updateServiceStatus({
            serviceId,
            status: Math.random() > 0.9 ? 'degraded' : 'healthy',
            metrics
          })
        }

        // Simulate logs
        if (Math.random() > 0.8) { // 20% chance for new log
          const levels: LogEntry['level'][] = ['info', 'warn', 'error', 'debug']
          const messages = [
            'Request processed successfully',
            'Database connection established',
            'Authentication token validated',
            'Cache miss for key: user_data_123',
            'Rate limit applied to client',
            'Background job completed',
            'Invalid request format detected',
            'Service health check passed'
          ]

          addLog({
            timestamp: new Date().toISOString(),
            level: levels[Math.floor(Math.random() * levels.length)],
            service: serviceId,
            message: messages[Math.floor(Math.random() * messages.length)],
            metadata: Math.random() > 0.7 ? {
              requestId: Math.random().toString(36).substr(2, 9),
              userId: `user_${Math.floor(Math.random() * 1000)}`
            } : undefined
          })
        }

        // Simulate alerts
        if (Math.random() > 0.95) { // 5% chance for new alert
          const alertTypes = ['performance', 'security', 'error', 'resource']
          const severities: SystemAlert['severity'][] = ['low', 'medium', 'high', 'critical']

          addAlert({
            type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
            message: `Alert from ${serviceId}: Performance degradation detected`,
            severity: severities[Math.floor(Math.random() * severities.length)]
          })
        }
      })
    }

    const interval = setInterval(simulateData, 2000)
    return () => clearInterval(interval)
  }, [isConnected, updateServiceStatus, addLog, addAlert])

  return {
    serviceMetrics,
    serviceStatuses,
    logs,
    alerts,
    isConnected,
    acknowledgeAlert,
    clearAlerts,
    clearLogs,
    connect,
    disconnect
  }
}