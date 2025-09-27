'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Play,
  Square,
  RotateCcw,
  Settings,
  Database,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Terminal,
  Cpu,
  HardDrive,
  Network,
  Activity
} from 'lucide-react'

interface Service {
  id: string
  name: string
  icon: any
  port: number
  status: string
}

interface ServiceControlsProps {
  services: Service[]
}

interface ServiceAction {
  id: string
  action: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  timestamp: Date
  output?: string
}

export function ServiceControls({ services }: ServiceControlsProps) {
  const [selectedService, setSelectedService] = useState(services[0]?.id || '')
  const [actions, setActions] = useState<ServiceAction[]>([])
  const [isActionRunning, setIsActionRunning] = useState(false)

  const selectedServiceData = services.find(s => s.id === selectedService)

  const executeAction = async (action: string) => {
    setIsActionRunning(true)

    const actionId = Math.random().toString(36).substr(2, 9)
    const newAction: ServiceAction = {
      id: actionId,
      action,
      status: 'running',
      timestamp: new Date()
    }

    setActions(prev => [newAction, ...prev])

    // Simulate action execution
    setTimeout(() => {
      const success = Math.random() > 0.2 // 80% success rate
      const updatedAction: ServiceAction = {
        ...newAction,
        status: success ? 'completed' : 'failed',
        output: success
          ? `${action} completed successfully for ${selectedServiceData?.name}`
          : `${action} failed: Connection timeout`
      }

      setActions(prev => prev.map(a => a.id === actionId ? updatedAction : a))
      setIsActionRunning(false)
    }, 2000 + Math.random() * 3000)
  }

  const clearActions = () => {
    setActions([])
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'degraded': return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'unhealthy': return <XCircle className="h-5 w-5 text-red-600" />
      default: return <Activity className="h-5 w-5 text-gray-600" />
    }
  }

  const getActionIcon = (status: ServiceAction['status']) => {
    switch (status) {
      case 'running': return <Activity className="h-4 w-4 text-blue-600 animate-spin" />
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-600" />
      default: return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const mockResourceUsage = {
    cpu: Math.random() * 100,
    memory: Math.random() * 100,
    disk: Math.random() * 100,
    network: Math.random() * 100
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Service Controls</h2>
          <p className="text-gray-600">Manage and control individual services</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Selection and Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Service Selection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {services.map(service => {
                  const Icon = service.icon
                  return (
                    <div
                      key={service.id}
                      onClick={() => setSelectedService(service.id)}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedService === service.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Icon className="h-5 w-5 text-gray-700" />
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="text-xs text-gray-500">Port {service.port}</p>
                          </div>
                        </div>
                        {getStatusIcon(service.status)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Resource Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Cpu className="h-5 w-5 mr-2" />
                Resource Usage
              </CardTitle>
              <CardDescription>{selectedServiceData?.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">CPU</span>
                    <span className="text-sm font-medium">{mockResourceUsage.cpu.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${mockResourceUsage.cpu}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Memory</span>
                    <span className="text-sm font-medium">{mockResourceUsage.memory.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${mockResourceUsage.memory}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Disk I/O</span>
                    <span className="text-sm font-medium">{mockResourceUsage.disk.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${mockResourceUsage.disk}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Network</span>
                    <span className="text-sm font-medium">{mockResourceUsage.network.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-600 h-2 rounded-full transition-all"
                      style={{ width: `${mockResourceUsage.network}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Control Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Terminal className="h-5 w-5 mr-2" />
                  Control Panel
                </div>
                <span className="text-sm text-gray-500">
                  {selectedServiceData?.name} (:{selectedServiceData?.port})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="lifecycle" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
                  <TabsTrigger value="configuration">Config</TabsTrigger>
                  <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                </TabsList>

                <TabsContent value="lifecycle" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      onClick={() => executeAction('Start Service')}
                      disabled={isActionRunning}
                      className="flex items-center justify-center"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start
                    </Button>
                    <Button
                      onClick={() => executeAction('Stop Service')}
                      disabled={isActionRunning}
                      variant="destructive"
                      className="flex items-center justify-center"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                    <Button
                      onClick={() => executeAction('Restart Service')}
                      disabled={isActionRunning}
                      variant="outline"
                      className="flex items-center justify-center"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restart
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      onClick={() => executeAction('Health Check')}
                      disabled={isActionRunning}
                      variant="outline"
                      className="flex items-center justify-center"
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      Health Check
                    </Button>
                    <Button
                      onClick={() => executeAction('Scale Service')}
                      disabled={isActionRunning}
                      variant="outline"
                      className="flex items-center justify-center"
                    >
                      <Cpu className="h-4 w-4 mr-2" />
                      Scale
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="configuration" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      onClick={() => executeAction('Update Configuration')}
                      disabled={isActionRunning}
                      variant="outline"
                      className="flex items-center justify-center"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Update Config
                    </Button>
                    <Button
                      onClick={() => executeAction('Reload Configuration')}
                      disabled={isActionRunning}
                      variant="outline"
                      className="flex items-center justify-center"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reload Config
                    </Button>
                    <Button
                      onClick={() => executeAction('View Environment Variables')}
                      disabled={isActionRunning}
                      variant="outline"
                      className="flex items-center justify-center"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View ENV
                    </Button>
                    <Button
                      onClick={() => executeAction('Export Configuration')}
                      disabled={isActionRunning}
                      variant="outline"
                      className="flex items-center justify-center"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Export Config
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="maintenance" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      onClick={() => executeAction('Clear Cache')}
                      disabled={isActionRunning}
                      variant="outline"
                      className="flex items-center justify-center"
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Clear Cache
                    </Button>
                    <Button
                      onClick={() => executeAction('Run Migrations')}
                      disabled={isActionRunning}
                      variant="outline"
                      className="flex items-center justify-center"
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Run Migrations
                    </Button>
                    <Button
                      onClick={() => executeAction('Backup Data')}
                      disabled={isActionRunning}
                      variant="outline"
                      className="flex items-center justify-center"
                    >
                      <HardDrive className="h-4 w-4 mr-2" />
                      Backup Data
                    </Button>
                    <Button
                      onClick={() => executeAction('Clean Logs')}
                      disabled={isActionRunning}
                      variant="outline"
                      className="flex items-center justify-center"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Clean Logs
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Action History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Action History
                </CardTitle>
                <Button onClick={clearActions} variant="outline" size="sm">
                  Clear History
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {actions.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No actions performed yet</p>
                ) : (
                  actions.map(action => (
                    <div key={action.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      {getActionIcon(action.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">{action.action}</p>
                          <span className="text-xs text-gray-500">
                            {action.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 capitalize">
                          Status: {action.status}
                        </p>
                        {action.output && (
                          <p className="text-xs text-gray-700 mt-1 bg-white p-2 rounded border">
                            {action.output}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}