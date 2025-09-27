'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Play,
  Pause,
  Download,
  Filter,
  Search,
  AlertTriangle,
  Info,
  XCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { apiClient } from '@/lib/api'

interface LogEntry {
  id: string
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'debug'
  service: string
  message: string
  metadata?: Record<string, any>
}

export function LogsViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [isStreaming, setIsStreaming] = useState(true)
  const [selectedService, setSelectedService] = useState<string>('all')
  const [selectedLevel, setSelectedLevel] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const logsEndRef = useRef<HTMLDivElement>(null)

  const services = ['all', 'api-gateway', 'identity', 'memory', 'sensing', 'generation', 'interaction', 'autonomy', 'truth', 'economy', 'governance']
  const levels = ['all', 'debug', 'info', 'warn', 'error']

  const generateMockLog = (): LogEntry => {
    const serviceNames = services.slice(1) // Remove 'all'
    const levelNames: LogEntry['level'][] = ['info', 'warn', 'error', 'debug']

    const messages = [
      'Request processed successfully',
      'Database connection established',
      'Authentication token validated',
      'Cache miss for key: user_data_123',
      'Rate limit applied to client',
      'Background job completed',
      'Invalid request format detected',
      'Service health check passed',
      'Memory usage: 75%',
      'New user registered: user_456'
    ]

    return {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      level: levelNames[Math.floor(Math.random() * levelNames.length)],
      service: serviceNames[Math.floor(Math.random() * serviceNames.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      metadata: Math.random() > 0.7 ? {
        requestId: Math.random().toString(36).substr(2, 9),
        userId: `user_${Math.floor(Math.random() * 1000)}`,
        duration: Math.floor(Math.random() * 1000) + 'ms'
      } : undefined
    }
  }

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (!isStreaming) return

    const interval = setInterval(() => {
      const newLog = generateMockLog()
      setLogs(prev => {
        const updated = [...prev, newLog]
        return updated.slice(-1000) // Keep only last 1000 logs
      })
    }, 1000 + Math.random() * 2000) // Random interval between 1-3 seconds

    return () => clearInterval(interval)
  }, [isStreaming])

  useEffect(() => {
    scrollToBottom()
  }, [logs])

  useEffect(() => {
    let filtered = logs

    if (selectedService !== 'all') {
      filtered = filtered.filter(log => log.service === selectedService)
    }

    if (selectedLevel !== 'all') {
      filtered = filtered.filter(log => log.level === selectedLevel)
    }

    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.service.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredLogs(filtered)
  }, [logs, selectedService, selectedLevel, searchTerm])

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />
      case 'warn': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'info': return <Info className="h-4 w-4 text-blue-600" />
      case 'debug': return <CheckCircle className="h-4 w-4 text-gray-600" />
      default: return <Info className="h-4 w-4 text-gray-600" />
    }
  }

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'bg-red-50 border-red-200'
      case 'warn': return 'bg-yellow-50 border-yellow-200'
      case 'info': return 'bg-blue-50 border-blue-200'
      case 'debug': return 'bg-gray-50 border-gray-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  const exportLogs = async () => {
    try {
      const blob = await apiClient.exportLogs()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `north-star-logs-${new Date().toISOString().split('T')[0]}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export logs:', error)
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Logs Viewer</h2>
          <p className="text-gray-600">Real-time log streaming and filtering</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setIsStreaming(!isStreaming)}
            variant={isStreaming ? 'default' : 'outline'}
            size="sm"
          >
            {isStreaming ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Resume
              </>
            )}
          </Button>
          <Button onClick={exportLogs} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={clearLogs} variant="outline" size="sm">
            Clear
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {services.map(service => (
                  <option key={service} value={service}>
                    {service === 'all' ? 'All Services' : service}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {levels.map(level => (
                  <option key={level} value={level}>
                    {level === 'all' ? 'All Levels' : level.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search logs..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredLogs.length} of {logs.length} log entries
          </div>
        </CardContent>
      </Card>

      {/* Logs Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Live Logs
            </div>
            {isStreaming && (
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-600">Streaming</span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-black rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
            {filteredLogs.length === 0 ? (
              <div className="text-gray-400 text-center py-8">
                No logs match the current filters
              </div>
            ) : (
              <div className="space-y-1">
                {filteredLogs.slice(-100).map((log) => (
                  <div
                    key={log.id}
                    className={`p-2 rounded border-l-4 ${getLevelColor(log.level)} bg-opacity-10`}
                  >
                    <div className="flex items-start space-x-2 text-gray-300">
                      {getLevelIcon(log.level)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 text-xs">
                          <span className="text-gray-400">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                          <span className="text-blue-400 bg-blue-900 px-2 py-1 rounded">
                            {log.service}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            log.level === 'error' ? 'bg-red-900 text-red-200' :
                            log.level === 'warn' ? 'bg-yellow-900 text-yellow-200' :
                            log.level === 'info' ? 'bg-blue-900 text-blue-200' :
                            'bg-gray-900 text-gray-200'
                          }`}>
                            {log.level.toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-1 text-white">
                          {log.message}
                        </div>
                        {log.metadata && (
                          <div className="mt-1 text-xs text-gray-400">
                            {Object.entries(log.metadata).map(([key, value]) => (
                              <span key={key} className="mr-3">
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}