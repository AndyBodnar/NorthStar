'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Activity, Server, Database, Zap, Eye, Brain, Users, Shield, DollarSign, Scale, Wifi, WifiOff } from 'lucide-react'

import { ServiceMonitor } from '@/components/ServiceMonitor'
import { LogsViewer } from '@/components/LogsViewer'
import { APITester } from '@/components/APITester'
import { ServiceControls } from '@/components/ServiceControls'
import { RealTimeProvider, useRealTime } from '@/components/RealTimeProvider'
import { AlertsPanel } from '@/components/AlertsPanel'

function DashboardContent() {
  const [activeTab, setActiveTab] = useState('overview')
  const { serviceStatuses, isConnected } = useRealTime()

  const services = [
    { id: 'api-gateway', name: 'API Gateway', icon: Server, port: 3000 },
    { id: 'identity', name: 'Identity', icon: Users, port: 3001 },
    { id: 'memory', name: 'Memory', icon: Brain, port: 3002 },
    { id: 'sensing', name: 'Sensing', icon: Eye, port: 3003 },
    { id: 'generation', name: 'Generation', icon: Zap, port: 3004 },
    { id: 'interaction', name: 'Interaction', icon: Users, port: 3005 },
    { id: 'autonomy', name: 'Autonomy', icon: Activity, port: 3006 },
    { id: 'truth', name: 'Truth', icon: Shield, port: 3007 },
    { id: 'economy', name: 'Economy', icon: DollarSign, port: 3008 },
    { id: 'governance', name: 'Governance', icon: Scale, port: 3009 }
  ].map(service => ({
    ...service,
    status: serviceStatuses[service.id] || 'unknown'
  }))

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'degraded': return 'text-yellow-600 bg-yellow-100'
      case 'unhealthy': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">North Star Dashboard</h1>
                <p className="text-sm text-gray-500">API Constellation Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-600" />
                    <div className="h-3 w-3 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-600">Live Connection</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-red-600" />
                    <div className="h-3 w-3 bg-red-400 rounded-full"></div>
                    <span className="text-sm text-gray-600">Disconnected</span>
                  </>
                )}
              </div>
              <Button variant="outline" size="sm">
                <Database className="h-4 w-4 mr-2" />
                Export Logs
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="api">API Tester</TabsTrigger>
            <TabsTrigger value="controls">Controls</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Alerts Panel */}
            <AlertsPanel />

            {/* System Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Services</CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{services.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {services.filter(s => s.status === 'healthy').length} healthy
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">API Gateway</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">Online</div>
                  <p className="text-xs text-muted-foreground">
                    Port 3000 • 99.9% uptime
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Database</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">Connected</div>
                  <p className="text-xs text-muted-foreground">
                    PostgreSQL • Redis Cache
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Services Grid */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Service Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map((service) => {
                  const Icon = service.icon
                  return (
                    <Card key={service.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{service.name}</CardTitle>
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Port {service.port}</p>
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
                            {service.status}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services">
            <ServiceMonitor services={services} />
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <LogsViewer />
          </TabsContent>

          {/* API Tester Tab */}
          <TabsContent value="api">
            <APITester services={services} />
          </TabsContent>

          {/* Controls Tab */}
          <TabsContent value="controls">
            <ServiceControls services={services} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default function Dashboard() {
  return (
    <RealTimeProvider>
      <DashboardContent />
    </RealTimeProvider>
  )
}
