import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// In-memory storage for demonstration
interface SensorReading {
  id: string;
  sensorId: string;
  type: 'temperature' | 'humidity' | 'light' | 'motion' | 'sound' | 'proximity' | 'accelerometer' | 'gps';
  value: number | string | boolean;
  unit?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

interface SensorDevice {
  id: string;
  name: string;
  type: string;
  location: string;
  isActive: boolean;
  lastSeen: Date;
  capabilities: string[];
}

// In-memory stores
const sensorReadings = new Map<string, SensorReading>();
const sensorDevices = new Map<string, SensorDevice>();

// Initialize sample data
const initializeSampleData = () => {
  const devices: SensorDevice[] = [
    {
      id: 'sensor-001',
      name: 'Environmental Sensor Hub',
      type: 'multi-sensor',
      location: 'office-main',
      isActive: true,
      lastSeen: new Date(),
      capabilities: ['temperature', 'humidity', 'light']
    },
    {
      id: 'sensor-002',
      name: 'Motion Detector',
      type: 'pir',
      location: 'hallway-01',
      isActive: true,
      lastSeen: new Date(Date.now() - 30000),
      capabilities: ['motion']
    }
  ];

  devices.forEach(device => sensorDevices.set(device.id, device));

  const readings: SensorReading[] = [
    {
      id: uuidv4(),
      sensorId: 'sensor-001',
      type: 'temperature',
      value: 22.5,
      unit: '°C',
      timestamp: new Date(),
      metadata: { location: 'office-main', accuracy: 0.1 }
    },
    {
      id: uuidv4(),
      sensorId: 'sensor-001',
      type: 'humidity',
      value: 45.2,
      unit: '%',
      timestamp: new Date(),
      metadata: { location: 'office-main', accuracy: 2 }
    },
    {
      id: uuidv4(),
      sensorId: 'sensor-002',
      type: 'motion',
      value: false,
      timestamp: new Date(Date.now() - 30000),
      metadata: { location: 'hallway-01', sensitivity: 'medium' }
    }
  ];

  readings.forEach(reading => sensorReadings.set(reading.id, reading));
};

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:4000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'sensing',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    metrics: {
      totalSensors: sensorDevices.size,
      activeSensors: Array.from(sensorDevices.values()).filter(s => s.isActive).length,
      totalReadings: sensorReadings.size,
      recentReadings: Array.from(sensorReadings.values())
        .filter(r => Date.now() - r.timestamp.getTime() < 300000).length
    }
  });
});

// Sensor device endpoints
app.get('/sensors', (req, res) => {
  const sensors = Array.from(sensorDevices.values());
  const { active, type, location } = req.query;

  let filtered = sensors;
  if (active === 'true') filtered = filtered.filter(s => s.isActive);
  if (type) filtered = filtered.filter(s => s.type === type);
  if (location) filtered = filtered.filter(s => s.location === location);

  res.json({
    sensors: filtered,
    total: filtered.length
  });
});

app.post('/sensors', (req, res) => {
  const { name, type, location, capabilities } = req.body;

  if (!name || !type || !location) {
    return res.status(400).json({ error: 'Missing required fields: name, type, location' });
  }

  const sensor: SensorDevice = {
    id: uuidv4(),
    name,
    type,
    location,
    isActive: true,
    lastSeen: new Date(),
    capabilities: capabilities || []
  };

  sensorDevices.set(sensor.id, sensor);
  res.status(201).json(sensor);
});

app.get('/sensors/:id', (req, res) => {
  const sensor = sensorDevices.get(req.params.id);
  if (!sensor) {
    return res.status(404).json({ error: 'Sensor not found' });
  }
  res.json(sensor);
});

app.put('/sensors/:id', (req, res) => {
  const sensor = sensorDevices.get(req.params.id);
  if (!sensor) {
    return res.status(404).json({ error: 'Sensor not found' });
  }

  const { name, isActive, location } = req.body;
  if (name !== undefined) sensor.name = name;
  if (isActive !== undefined) sensor.isActive = isActive;
  if (location !== undefined) sensor.location = location;

  sensor.lastSeen = new Date();
  sensorDevices.set(sensor.id, sensor);
  res.json(sensor);
});

// Sensor readings endpoints
app.get('/readings', (req, res) => {
  const readings = Array.from(sensorReadings.values());
  const { sensorId, type, since, limit } = req.query;

  let filtered = readings;
  if (sensorId) filtered = filtered.filter(r => r.sensorId === sensorId);
  if (type) filtered = filtered.filter(r => r.type === type);
  if (since) {
    const sinceDate = new Date(since as string);
    filtered = filtered.filter(r => r.timestamp >= sinceDate);
  }

  // Sort by timestamp (newest first)
  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  if (limit) {
    filtered = filtered.slice(0, parseInt(limit as string));
  }

  res.json({
    readings: filtered,
    total: filtered.length
  });
});

app.post('/readings', (req, res) => {
  const { sensorId, type, value, unit, metadata } = req.body;

  if (!sensorId || !type || value === undefined) {
    return res.status(400).json({ error: 'Missing required fields: sensorId, type, value' });
  }

  const reading: SensorReading = {
    id: uuidv4(),
    sensorId,
    type,
    value,
    unit,
    timestamp: new Date(),
    metadata: metadata || {}
  };

  sensorReadings.set(reading.id, reading);

  // Update sensor last seen
  const sensor = sensorDevices.get(sensorId);
  if (sensor) {
    sensor.lastSeen = new Date();
    sensorDevices.set(sensorId, sensor);
  }

  res.status(201).json(reading);
});

app.get('/readings/:id', (req, res) => {
  const reading = sensorReadings.get(req.params.id);
  if (!reading) {
    return res.status(404).json({ error: 'Reading not found' });
  }
  res.json(reading);
});

// Analytics endpoints
app.get('/analytics/summary', (req, res) => {
  const { timeframe = '1h' } = req.query;

  let timeMs = 3600000; // 1 hour default
  if (timeframe === '24h') timeMs = 86400000;
  else if (timeframe === '7d') timeMs = 604800000;

  const cutoff = new Date(Date.now() - timeMs);
  const recentReadings = Array.from(sensorReadings.values())
    .filter(r => r.timestamp >= cutoff);

  const summary = {
    timeframe,
    totalReadings: recentReadings.length,
    activeSensors: new Set(recentReadings.map(r => r.sensorId)).size,
    readingsByType: {} as Record<string, number>,
    averageValues: {} as Record<string, number>
  };

  // Group by type
  recentReadings.forEach(reading => {
    if (!summary.readingsByType[reading.type]) {
      summary.readingsByType[reading.type] = 0;
    }
    summary.readingsByType[reading.type]++;

    // Calculate averages for numeric values
    if (typeof reading.value === 'number') {
      if (!summary.averageValues[reading.type]) {
        summary.averageValues[reading.type] = 0;
      }
    }
  });

  // Calculate actual averages
  Object.keys(summary.readingsByType).forEach(type => {
    const numericReadings = recentReadings
      .filter(r => r.type === type && typeof r.value === 'number')
      .map(r => r.value as number);

    if (numericReadings.length > 0) {
      summary.averageValues[type] =
        numericReadings.reduce((sum, val) => sum + val, 0) / numericReadings.length;
    }
  });

  res.json(summary);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'North Star Sensing Service',
    version: '1.0.0',
    description: 'Multi-modal Sensing and IoT Device Management',
    endpoints: {
      health: '/health',
      sensors: '/sensors',
      readings: '/readings',
      analytics: '/analytics'
    },
    capabilities: [
      'sensor-device-management',
      'real-time-data-collection',
      'multi-modal-sensing',
      'analytics-and-aggregation',
      'iot-integration'
    ]
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Start server
async function startServer() {
  try {
    // Initialize sample data
    initializeSampleData();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`Sensing Service running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('Service endpoints available:');
      console.log(`  Health: http://localhost:${PORT}/health`);
      console.log(`  Sensors: http://localhost:${PORT}/sensors`);
      console.log(`  Readings: http://localhost:${PORT}/readings`);
      console.log(`  Analytics: http://localhost:${PORT}/analytics`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}. Starting graceful shutdown...`);
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });

      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start Sensing Service:', error);
    process.exit(1);
  }
}

// Auto-register with API Gateway
async function registerWithGateway() {
  if (!process.env.GATEWAY_URL) {
    console.log('No gateway URL configured, skipping registration');
    return;
  }

  try {
    const axios = require('axios');
    const registration = {
      id: process.env.SERVICE_ID || 'sensing',
      name: process.env.SERVICE_NAME || 'Sensing Service',
      url: `http://localhost:${PORT}`,
      healthCheck: `http://localhost:${PORT}/health`,
      version: '1.0.0',
      tags: ['sensing', 'iot', 'sensors', 'analytics']
    };

    await axios.post(`${process.env.GATEWAY_URL}/register`, registration);
    console.log(`Registered with API Gateway at ${process.env.GATEWAY_URL}`);

  } catch (error) {
    console.error('Failed to register with API Gateway:', error);
  }
}

// Start the service
startServer().then(() => {
  setTimeout(registerWithGateway, 5000);
});

export default app;