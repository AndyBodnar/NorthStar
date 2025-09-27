import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// In-memory storage for demonstration
interface Memory {
  id: string;
  content: string;
  type: 'short_term' | 'long_term' | 'episodic' | 'semantic' | 'procedural' | 'working';
  importance: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
  expiresAt?: Date;
  metadata: Record<string, any>;
}

interface State {
  id: string;
  name: string;
  data: any;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

// In-memory stores
const memories = new Map<string, Memory>();
const states = new Map<string, State>();

// Initialize sample data
const initializeSampleData = () => {
  const sampleMemories: Memory[] = [
    {
      id: uuidv4(),
      content: 'User preferences for dark mode theme',
      type: 'long_term',
      importance: 0.8,
      tags: ['preferences', 'ui', 'theme'],
      createdAt: new Date(Date.now() - 86400000 * 7),
      updatedAt: new Date(Date.now() - 86400000 * 2),
      accessCount: 15,
      metadata: { category: 'user_preference', source: 'settings_ui' }
    },
    {
      id: uuidv4(),
      content: 'Last performed action: file upload',
      type: 'short_term',
      importance: 0.6,
      tags: ['action', 'file', 'upload'],
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(Date.now() - 1800000),
      accessCount: 3,
      expiresAt: new Date(Date.now() + 86400000),
      metadata: { category: 'recent_action', fileSize: '2.3MB' }
    }
  ];

  sampleMemories.forEach(memory => memories.set(memory.id, memory));

  const sampleStates: State[] = [
    {
      id: uuidv4(),
      name: 'user_session',
      data: { userId: 'user-001', sessionId: 'sess-123', isAuthenticated: true },
      version: 1,
      createdAt: new Date(Date.now() - 1800000),
      updatedAt: new Date(),
      isActive: true
    },
    {
      id: uuidv4(),
      name: 'application_config',
      data: { apiVersion: '1.0.0', features: ['ai_chat', 'file_upload', 'analytics'] },
      version: 3,
      createdAt: new Date(Date.now() - 86400000 * 30),
      updatedAt: new Date(Date.now() - 86400000 * 5),
      isActive: true
    }
  ];

  sampleStates.forEach(state => states.set(state.id, state));
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
    service: 'memory',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    metrics: {
      totalMemories: memories.size,
      totalStates: states.size,
      memoryTypes: {
        short_term: Array.from(memories.values()).filter(m => m.type === 'short_term').length,
        long_term: Array.from(memories.values()).filter(m => m.type === 'long_term').length,
        episodic: Array.from(memories.values()).filter(m => m.type === 'episodic').length,
        semantic: Array.from(memories.values()).filter(m => m.type === 'semantic').length,
        procedural: Array.from(memories.values()).filter(m => m.type === 'procedural').length,
        working: Array.from(memories.values()).filter(m => m.type === 'working').length
      }
    }
  });
});

// Memory endpoints
app.get('/memories', (req, res) => {
  const memoryList = Array.from(memories.values());
  const { type, tag, minImportance } = req.query;

  let filtered = memoryList;
  if (type) filtered = filtered.filter(m => m.type === type);
  if (tag) filtered = filtered.filter(m => m.tags.includes(tag as string));
  if (minImportance) {
    const threshold = parseFloat(minImportance as string);
    filtered = filtered.filter(m => m.importance >= threshold);
  }

  // Sort by importance and recency
  filtered.sort((a, b) => {
    const importanceScore = b.importance - a.importance;
    if (Math.abs(importanceScore) < 0.1) {
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    }
    return importanceScore;
  });

  res.json({
    memories: filtered,
    total: filtered.length,
    summary: {
      byType: {
        short_term: memoryList.filter(m => m.type === 'short_term').length,
        long_term: memoryList.filter(m => m.type === 'long_term').length,
        episodic: memoryList.filter(m => m.type === 'episodic').length,
        semantic: memoryList.filter(m => m.type === 'semantic').length,
        procedural: memoryList.filter(m => m.type === 'procedural').length,
        working: memoryList.filter(m => m.type === 'working').length
      },
      averageImportance: memoryList.reduce((sum, m) => sum + m.importance, 0) / memoryList.length || 0
    }
  });
});

app.post('/memories', (req, res) => {
  const { content, type, importance, tags, expiresIn, metadata } = req.body;

  if (!content || !type) {
    return res.status(400).json({ error: 'Missing required fields: content, type' });
  }

  const memory: Memory = {
    id: uuidv4(),
    content,
    type,
    importance: importance || 0.5,
    tags: tags || [],
    createdAt: new Date(),
    updatedAt: new Date(),
    accessCount: 0,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
    metadata: metadata || {}
  };

  memories.set(memory.id, memory);
  res.status(201).json(memory);
});

app.get('/memories/:id', (req, res) => {
  const memory = memories.get(req.params.id);
  if (!memory) {
    return res.status(404).json({ error: 'Memory not found' });
  }

  // Update access count
  memory.accessCount++;
  memory.updatedAt = new Date();
  memories.set(memory.id, memory);

  res.json(memory);
});

app.put('/memories/:id', (req, res) => {
  const memory = memories.get(req.params.id);
  if (!memory) {
    return res.status(404).json({ error: 'Memory not found' });
  }

  const { content, importance, tags, metadata } = req.body;

  if (content !== undefined) memory.content = content;
  if (importance !== undefined) memory.importance = importance;
  if (tags !== undefined) memory.tags = tags;
  if (metadata !== undefined) memory.metadata = { ...memory.metadata, ...metadata };

  memory.updatedAt = new Date();
  memories.set(memory.id, memory);

  res.json(memory);
});

app.delete('/memories/:id', (req, res) => {
  const deleted = memories.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Memory not found' });
  }
  res.status(204).send();
});

// State management endpoints
app.get('/states', (req, res) => {
  const stateList = Array.from(states.values());
  const { active } = req.query;

  let filtered = stateList;
  if (active === 'true') filtered = filtered.filter(s => s.isActive);

  res.json({
    states: filtered,
    total: filtered.length
  });
});

app.post('/states', (req, res) => {
  const { name, data } = req.body;

  if (!name || !data) {
    return res.status(400).json({ error: 'Missing required fields: name, data' });
  }

  const state: State = {
    id: uuidv4(),
    name,
    data,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  };

  states.set(state.id, state);
  res.status(201).json(state);
});

app.get('/states/:id', (req, res) => {
  const state = states.get(req.params.id);
  if (!state) {
    return res.status(404).json({ error: 'State not found' });
  }
  res.json(state);
});

app.put('/states/:id', (req, res) => {
  const state = states.get(req.params.id);
  if (!state) {
    return res.status(404).json({ error: 'State not found' });
  }

  const { data, isActive } = req.body;

  if (data !== undefined) {
    state.data = data;
    state.version++;
  }
  if (isActive !== undefined) state.isActive = isActive;

  state.updatedAt = new Date();
  states.set(state.id, state);

  res.json(state);
});

app.delete('/states/:id', (req, res) => {
  const deleted = states.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'State not found' });
  }
  res.status(204).send();
});

// Memory consolidation endpoint
app.post('/memories/consolidate', (req, res) => {
  const { fromType, toType, threshold } = req.body;

  if (!fromType || !toType) {
    return res.status(400).json({ error: 'Missing required fields: fromType, toType' });
  }

  const consolidationThreshold = threshold || 0.8;
  const candidateMemories = Array.from(memories.values())
    .filter(m => m.type === fromType && m.importance >= consolidationThreshold);

  let consolidatedCount = 0;
  candidateMemories.forEach(memory => {
    memory.type = toType;
    memory.updatedAt = new Date();
    memories.set(memory.id, memory);
    consolidatedCount++;
  });

  res.json({
    success: true,
    consolidatedCount,
    fromType,
    toType,
    threshold: consolidationThreshold
  });
});

// Search memories
app.get('/memories/search', (req, res) => {
  const { q, type, limit } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const query = (q as string).toLowerCase();
  const searchLimit = limit ? parseInt(limit as string) : 50;

  let results = Array.from(memories.values()).filter(memory => {
    const contentMatch = memory.content.toLowerCase().includes(query);
    const tagMatch = memory.tags.some(tag => tag.toLowerCase().includes(query));
    const typeMatch = !type || memory.type === type;

    return (contentMatch || tagMatch) && typeMatch;
  });

  // Sort by relevance (importance + recency)
  results.sort((a, b) => {
    const aScore = a.importance + (a.accessCount / 100);
    const bScore = b.importance + (b.accessCount / 100);
    return bScore - aScore;
  });

  results = results.slice(0, searchLimit);

  res.json({
    query,
    results,
    total: results.length
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'North Star Memory Service',
    version: '1.0.0',
    description: 'Memory and State Management Service',
    endpoints: {
      health: '/health',
      memories: '/memories',
      states: '/states',
      search: '/memories/search',
      consolidate: '/memories/consolidate'
    },
    capabilities: [
      'multi-type-memory-storage',
      'state-management',
      'memory-consolidation',
      'search-and-retrieval',
      'importance-scoring'
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
      console.log(`Memory Service running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('Service endpoints available:');
      console.log(`  Health: http://localhost:${PORT}/health`);
      console.log(`  Memories: http://localhost:${PORT}/memories`);
      console.log(`  States: http://localhost:${PORT}/states`);
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
    console.error('Failed to start Memory Service:', error);
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
      id: process.env.SERVICE_ID || 'memory',
      name: process.env.SERVICE_NAME || 'Memory Service',
      url: `http://localhost:${PORT}`,
      healthCheck: `http://localhost:${PORT}/health`,
      version: '1.0.0',
      tags: ['memory', 'state', 'storage']
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