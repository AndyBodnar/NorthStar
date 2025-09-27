'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useRealTimeData } from '@/hooks/useRealTimeData'
import type { ServiceMetrics, LogEntry, SystemAlert } from '@/hooks/useRealTimeData'

interface RealTimeContextType {
  serviceMetrics: Record<string, ServiceMetrics>
  serviceStatuses: Record<string, string>
  logs: LogEntry[]
  alerts: SystemAlert[]
  isConnected: boolean
  acknowledgeAlert: (alertId: string) => void
  clearAlerts: () => void
  clearLogs: () => void
  connect: () => void
  disconnect: () => void
}

const RealTimeContext = createContext<RealTimeContextType | null>(null)

export function RealTimeProvider({ children }: { children: ReactNode }) {
  const realTimeData = useRealTimeData()

  return (
    <RealTimeContext.Provider value={realTimeData}>
      {children}
    </RealTimeContext.Provider>
  )
}

export function useRealTime() {
  const context = useContext(RealTimeContext)
  if (!context) {
    throw new Error('useRealTime must be used within RealTimeProvider')
  }
  return context
}