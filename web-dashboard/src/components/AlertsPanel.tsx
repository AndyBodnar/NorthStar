'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle, X, Bell } from 'lucide-react'
import { useRealTime } from './RealTimeProvider'

export function AlertsPanel() {
  const { alerts, acknowledgeAlert, clearAlerts } = useRealTime()

  const unacknowledgedAlerts = alerts.filter(alert => !alert.acknowledged)

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  if (unacknowledgedAlerts.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="flex items-center justify-center py-6">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
            <p className="text-green-800 font-medium">All Clear</p>
            <p className="text-green-600 text-sm">No active alerts</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
            System Alerts ({unacknowledgedAlerts.length})
          </CardTitle>
          <Button onClick={clearAlerts} variant="outline" size="sm">
            Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {unacknowledgedAlerts.map(alert => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {alert.type}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{alert.message}</p>
                    <p className="text-xs opacity-75 mt-1">
                      {alert.timestamp.toLocaleString()}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => acknowledgeAlert(alert.id)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}