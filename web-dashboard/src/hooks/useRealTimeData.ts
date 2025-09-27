import { useState, useEffect, useCallback } from 'react'
import { useWebSocket } from '@/lib/websocket'
import { apiClient } from '@/lib/api'

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
      id: logData.id || Math.random().toString(36).substr(2, 9),
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
      id: alertData.id || Math.random().toString(36).substr(2, 9),
      type: alertData.type,
      message: alertData.message,
      severity: alertData.severity,
      timestamp: new Date(alertData.timestamp),
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
      prev.filter(alert => alert.id !== alertId) // Remove acknowledged alert
    )
  }, [])

  const clearAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  // Load initial data from API
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load initial logs
        const initialLogs = await apiClient.getLogs({ limit: 100 })
        setLogs(initialLogs.map(log => ({
          ...log,
          timestamp: new Date(log.timestamp)
        })))

        // Load initial alerts
        const initialAlerts = await apiClient.getAlerts()
        setAlerts(initialAlerts.map(alert => ({
          ...alert,
          timestamp: new Date(alert.timestamp),
          acknowledged: false
        })))

        // Load initial service statuses
        const services = await apiClient.getServices()
        const statuses: Record<string, string> = {}
        const metrics: Record<string, ServiceMetrics> = {}

        services.forEach(service => {
          statuses[service.id] = service.status
          if (service.metrics) {
            metrics[service.id] = service.metrics
          }
        })

        setServiceStatuses(statuses)
        setServiceMetrics(metrics)

      } catch (error) {
        console.error('Failed to load initial data:', error)
      }
    }

    loadInitialData()
  }, [])

  // WebSocket connection and event handling
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
  }, [connect, subscribe, checkConnection, updateServiceStatus, addLog, addAlert, handleHealthCheck])

  // Fallback: Refresh data periodically if WebSocket is not connected
  useEffect(() => {
    if (isConnected) return // Don't poll if WebSocket is working

    const refreshData = async () => {
      try {
        const services = await apiClient.getServices()
        const statuses: Record<string, string> = {}
        const metrics: Record<string, ServiceMetrics> = {}

        services.forEach(service => {
          statuses[service.id] = service.status
          if (service.metrics) {
            metrics[service.id] = service.metrics
          }
        })

        setServiceStatuses(statuses)
        setServiceMetrics(metrics)

      } catch (error) {
        console.error('Failed to refresh service data:', error)
      }
    }

    const interval = setInterval(refreshData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [isConnected])

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