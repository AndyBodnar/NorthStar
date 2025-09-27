'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Send,
  Download,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  Code,
  FileText,
  Settings
} from 'lucide-react'

interface Service {
  id: string
  name: string
  icon: any
  port: number
  status: string
}

interface APITesterProps {
  services: Service[]
}

interface APIRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: string
}

interface APIResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  data: any
  responseTime: number
  timestamp: Date
}

export function APITester({ services }: APITesterProps) {
  const [selectedService, setSelectedService] = useState(services[0]?.id || '')
  const [request, setRequest] = useState<APIRequest>({
    method: 'GET',
    url: '/health',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-token-here'
    },
    body: ''
  })
  const [response, setResponse] = useState<APIResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [requestHistory, setRequestHistory] = useState<Array<APIRequest & { response: APIResponse }>>([])

  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

  const commonEndpoints = {
    'api-gateway': ['/health', '/docs', '/api/identity/users', '/api/memory/memories'],
    'identity': ['/health', '/users', '/auth/login', '/auth/register'],
    'memory': ['/health', '/memories', '/state', '/forks'],
    'sensing': ['/health', '/sensors', '/data', '/emotional-state'],
    'generation': ['/health', '/generate', '/worlds', '/content'],
    'interaction': ['/health', '/sessions', '/messages', '/presence'],
    'autonomy': ['/health', '/agents', '/tasks', '/contracts'],
    'truth': ['/health', '/claims', '/verifications', '/fact-checks'],
    'economy': ['/health', '/transactions', '/wallets', '/marketplace'],
    'governance': ['/health', '/proposals', '/votes', '/compliance']
  }

  const selectedServiceData = services.find(s => s.id === selectedService)
  const baseUrl = `http://localhost:${selectedServiceData?.port || 3000}`

  const sendRequest = async () => {
    setIsLoading(true)
    const startTime = Date.now()

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))

      const mockResponse: APIResponse = {
        status: Math.random() > 0.8 ? (Math.random() > 0.5 ? 404 : 500) : 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': Math.random().toString(36).substr(2, 9)
        },
        data: request.method === 'GET' ? {
          message: 'Service is healthy',
          timestamp: new Date().toISOString(),
          service: selectedService,
          version: '1.0.0'
        } : {
          message: 'Request processed successfully',
          id: Math.random().toString(36).substr(2, 9)
        },
        responseTime: Date.now() - startTime,
        timestamp: new Date()
      }

      if (mockResponse.status >= 400) {
        mockResponse.statusText = mockResponse.status === 404 ? 'Not Found' : 'Internal Server Error'
        mockResponse.data = {
          error: mockResponse.statusText,
          message: `${request.method} ${request.url} failed`
        }
      }

      setResponse(mockResponse)

      // Add to history
      setRequestHistory(prev => [...prev.slice(-9), {
        ...request,
        response: mockResponse
      }])

    } catch (error) {
      const errorResponse: APIResponse = {
        status: 0,
        statusText: 'Network Error',
        headers: {},
        data: { error: 'Failed to connect to service' },
        responseTime: Date.now() - startTime,
        timestamp: new Date()
      }
      setResponse(errorResponse)
    } finally {
      setIsLoading(false)
    }
  }

  const updateHeader = (key: string, value: string) => {
    setRequest(prev => ({
      ...prev,
      headers: { ...prev.headers, [key]: value }
    }))
  }

  const removeHeader = (key: string) => {
    setRequest(prev => {
      const newHeaders = { ...prev.headers }
      delete newHeaders[key]
      return { ...prev, headers: newHeaders }
    })
  }

  const addHeader = () => {
    updateHeader('New-Header', 'value')
  }

  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response.data, null, 2))
    }
  }

  const exportRequest = () => {
    if (response) {
      const exportData = {
        request,
        response,
        service: selectedService,
        timestamp: response.timestamp
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `api-test-${selectedService}-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const loadFromHistory = (historyItem: any) => {
    setRequest({
      method: historyItem.method,
      url: historyItem.url,
      headers: historyItem.headers,
      body: historyItem.body
    })
    setResponse(historyItem.response)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">API Tester</h2>
          <p className="text-gray-600">Test and debug API endpoints</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Send className="h-5 w-5 mr-2" />
                Request
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Service Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {services.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name} (:{service.port})
                    </option>
                  ))}
                </select>
              </div>

              {/* Method and URL */}
              <div className="flex space-x-2">
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                  <select
                    value={request.method}
                    onChange={(e) => setRequest(prev => ({ ...prev, method: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {methods.map(method => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                      {baseUrl}
                    </span>
                    <input
                      type="text"
                      value={request.url}
                      onChange={(e) => setRequest(prev => ({ ...prev, url: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="/endpoint"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Endpoints */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quick Endpoints</label>
                <div className="flex flex-wrap gap-2">
                  {(commonEndpoints[selectedService as keyof typeof commonEndpoints] || []).map(endpoint => (
                    <Button
                      key={endpoint}
                      variant="outline"
                      size="sm"
                      onClick={() => setRequest(prev => ({ ...prev, url: endpoint }))}
                    >
                      {endpoint}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Headers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Headers</label>
                  <Button onClick={addHeader} variant="outline" size="sm">
                    Add Header
                  </Button>
                </div>
                <div className="space-y-2">
                  {Object.entries(request.headers).map(([key, value]) => (
                    <div key={key} className="flex space-x-2">
                      <input
                        type="text"
                        value={key}
                        onChange={(e) => {
                          const newKey = e.target.value
                          removeHeader(key)
                          updateHeader(newKey, value)
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Header name"
                      />
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => updateHeader(key, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Header value"
                      />
                      <Button onClick={() => removeHeader(key)} variant="outline" size="sm">
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Body */}
              {['POST', 'PUT', 'PATCH'].includes(request.method) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Request Body</label>
                  <textarea
                    value={request.body}
                    onChange={(e) => setRequest(prev => ({ ...prev, body: e.target.value }))}
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder='{"key": "value"}'
                  />
                </div>
              )}

              <Button
                onClick={sendRequest}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Request
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Response Panel */}
          {response && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Code className="h-5 w-5 mr-2" />
                    Response
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button onClick={copyResponse} variant="outline" size="sm">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button onClick={exportRequest} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="body" className="w-full">
                  <TabsList>
                    <TabsTrigger value="body">Body</TabsTrigger>
                    <TabsTrigger value="headers">Headers</TabsTrigger>
                    <TabsTrigger value="meta">Meta</TabsTrigger>
                  </TabsList>

                  <TabsContent value="body" className="mt-4">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="flex items-center space-x-2">
                        {response.status >= 200 && response.status < 300 ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className={`font-medium ${
                          response.status >= 200 && response.status < 300 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {response.status} {response.statusText}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {response.responseTime}ms
                      </span>
                    </div>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto text-sm">
                      {JSON.stringify(response.data, null, 2)}
                    </pre>
                  </TabsContent>

                  <TabsContent value="headers" className="mt-4">
                    <div className="space-y-2">
                      {Object.entries(response.headers).map(([key, value]) => (
                        <div key={key} className="flex">
                          <span className="font-medium w-48 text-gray-700">{key}:</span>
                          <span className="text-gray-600">{value}</span>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="meta" className="mt-4">
                    <div className="space-y-2">
                      <div className="flex">
                        <span className="font-medium w-32 text-gray-700">Status:</span>
                        <span className="text-gray-600">{response.status} {response.statusText}</span>
                      </div>
                      <div className="flex">
                        <span className="font-medium w-32 text-gray-700">Time:</span>
                        <span className="text-gray-600">{response.responseTime}ms</span>
                      </div>
                      <div className="flex">
                        <span className="font-medium w-32 text-gray-700">Timestamp:</span>
                        <span className="text-gray-600">{response.timestamp.toLocaleString()}</span>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>

        {/* History Panel */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                History
              </CardTitle>
              <CardDescription>Recent API requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {requestHistory.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No requests yet</p>
                ) : (
                  requestHistory.slice().reverse().map((item, index) => (
                    <div
                      key={index}
                      onClick={() => loadFromHistory(item)}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{item.method} {item.url}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          item.response.status >= 200 && item.response.status < 300
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.response.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {item.response.timestamp.toLocaleTimeString()} • {item.response.responseTime}ms
                      </p>
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