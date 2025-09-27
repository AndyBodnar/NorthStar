import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3007;

// In-memory storage for demonstration
interface Agent {
  id: string;
  name: string;
  type: 'worker' | 'supervisor' | 'specialist';
  status: 'active' | 'idle' | 'busy' | 'offline';
  capabilities: string[];
  currentTask?: string;
  performance: {
    tasksCompleted: number;
    successRate: number;
    averageResponseTime: number;
  };
  createdAt: Date;
  lastActive: Date;
}

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'analysis' | 'generation' | 'orchestration' | 'monitoring';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  assignedAgent?: string;
  requiredCapabilities: string[];
  payload: any;
  result?: any;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration: number;
}

interface MarketplaceListing {
  id: string;
  agentId: string;
  serviceName: string;
  description: string;
  capabilities: string[];
  pricing: {
    model: 'fixed' | 'hourly' | 'per_task';
    amount: number;
    currency: string;
  };
  availability: boolean;
  rating: number;
  completedTasks: number;
  createdAt: Date;
}

// In-memory stores
const agents = new Map<string, Agent>();
const tasks = new Map<string, Task>();
const marketplaceListings = new Map<string, MarketplaceListing>();

// Initialize some sample data
const initializeSampleData = () => {
  // Sample agents
  const sampleAgents: Agent[] = [
    {
      id: uuidv4(),
      name: 'DataAnalyzer-01',
      type: 'specialist',
      status: 'active',
      capabilities: ['data-analysis', 'pattern-recognition', 'reporting'],
      performance: { tasksCompleted: 156, successRate: 0.94, averageResponseTime: 2.3 },
      createdAt: new Date(Date.now() - 86400000 * 30),
      lastActive: new Date()
    },
    {
      id: uuidv4(),
      name: 'TaskOrchestrator-Alpha',
      type: 'supervisor',
      status: 'active',
      capabilities: ['task-orchestration', 'workflow-management', 'resource-allocation'],
      performance: { tasksCompleted: 89, successRate: 0.97, averageResponseTime: 1.8 },
      createdAt: new Date(Date.now() - 86400000 * 45),
      lastActive: new Date()
    },
    {
      id: uuidv4(),
      name: 'GeneralWorker-Beta',
      type: 'worker',
      status: 'idle',
      capabilities: ['general-processing', 'data-validation', 'basic-analysis'],
      performance: { tasksCompleted: 234, successRate: 0.89, averageResponseTime: 3.1 },
      createdAt: new Date(Date.now() - 86400000 * 20),
      lastActive: new Date(Date.now() - 300000)
    }
  ];

  sampleAgents.forEach(agent => agents.set(agent.id, agent));

  // Sample marketplace listings
  agents.forEach(agent => {
    const listing: MarketplaceListing = {
      id: uuidv4(),
      agentId: agent.id,
      serviceName: `${agent.name} Services`,
      description: `Professional ${agent.type} agent offering ${agent.capabilities.join(', ')} capabilities`,
      capabilities: agent.capabilities,
      pricing: {
        model: agent.type === 'supervisor' ? 'hourly' : 'per_task',
        amount: agent.type === 'supervisor' ? 50 : agent.type === 'specialist' ? 25 : 10,
        currency: 'USD'
      },
      availability: agent.status !== 'offline',
      rating: 4.2 + Math.random() * 0.8,
      completedTasks: agent.performance.tasksCompleted,
      createdAt: agent.createdAt
    };
    marketplaceListings.set(listing.id, listing);
  });
};

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:4000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
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
    service: 'autonomy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    metrics: {
      totalAgents: agents.size,
      activeAgents: Array.from(agents.values()).filter(a => a.status === 'active').length,
      totalTasks: tasks.size,
      activeTasks: Array.from(tasks.values()).filter(t => t.status === 'in_progress').length,
      marketplaceListings: marketplaceListings.size
    }
  });
});

// Agent management endpoints
app.get('/agents', (req, res) => {
  const agentList = Array.from(agents.values());
  res.json({
    agents: agentList,
    total: agentList.length,
    byStatus: {
      active: agentList.filter(a => a.status === 'active').length,
      idle: agentList.filter(a => a.status === 'idle').length,
      busy: agentList.filter(a => a.status === 'busy').length,
      offline: agentList.filter(a => a.status === 'offline').length
    }
  });
});

app.get('/agents/:id', (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json(agent);
});

app.post('/agents', (req, res) => {
  const { name, type, capabilities } = req.body;

  if (!name || !type || !capabilities || !Array.isArray(capabilities)) {
    return res.status(400).json({ error: 'Missing required fields: name, type, capabilities' });
  }

  const agent: Agent = {
    id: uuidv4(),
    name,
    type,
    status: 'idle',
    capabilities,
    performance: { tasksCompleted: 0, successRate: 1.0, averageResponseTime: 0 },
    createdAt: new Date(),
    lastActive: new Date()
  };

  agents.set(agent.id, agent);
  res.status(201).json(agent);
});

app.patch('/agents/:id/status', (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const { status } = req.body;
  if (!['active', 'idle', 'busy', 'offline'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  agent.status = status;
  agent.lastActive = new Date();
  agents.set(agent.id, agent);

  res.json(agent);
});

// Task orchestration endpoints
app.get('/tasks', (req, res) => {
  const taskList = Array.from(tasks.values());
  const { status, priority, type } = req.query;

  let filteredTasks = taskList;
  if (status) filteredTasks = filteredTasks.filter(t => t.status === status);
  if (priority) filteredTasks = filteredTasks.filter(t => t.priority === priority);
  if (type) filteredTasks = filteredTasks.filter(t => t.type === type);

  res.json({
    tasks: filteredTasks,
    total: filteredTasks.length,
    byStatus: {
      pending: taskList.filter(t => t.status === 'pending').length,
      assigned: taskList.filter(t => t.status === 'assigned').length,
      in_progress: taskList.filter(t => t.status === 'in_progress').length,
      completed: taskList.filter(t => t.status === 'completed').length,
      failed: taskList.filter(t => t.status === 'failed').length
    }
  });
});

app.post('/tasks', (req, res) => {
  const { title, description, type, priority, requiredCapabilities, payload, estimatedDuration } = req.body;

  if (!title || !description || !type || !requiredCapabilities) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const task: Task = {
    id: uuidv4(),
    title,
    description,
    type,
    priority: priority || 'medium',
    status: 'pending',
    requiredCapabilities,
    payload: payload || {},
    estimatedDuration: estimatedDuration || 60,
    createdAt: new Date()
  };

  tasks.set(task.id, task);

  // Attempt auto-assignment
  const suitableAgent = findSuitableAgent(task);
  if (suitableAgent) {
    task.assignedAgent = suitableAgent.id;
    task.status = 'assigned';
    suitableAgent.status = 'busy';
    suitableAgent.currentTask = task.id;
    agents.set(suitableAgent.id, suitableAgent);
  }

  tasks.set(task.id, task);
  res.status(201).json(task);
});

app.patch('/tasks/:id/assign/:agentId', (req, res) => {
  const task = tasks.get(req.params.id);
  const agent = agents.get(req.params.agentId);

  if (!task || !agent) {
    return res.status(404).json({ error: 'Task or agent not found' });
  }

  if (agent.status === 'busy') {
    return res.status(400).json({ error: 'Agent is currently busy' });
  }

  task.assignedAgent = agent.id;
  task.status = 'assigned';
  agent.status = 'busy';
  agent.currentTask = task.id;

  tasks.set(task.id, task);
  agents.set(agent.id, agent);

  res.json({ task, agent });
});

app.patch('/tasks/:id/complete', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const { result, success } = req.body;

  task.status = success ? 'completed' : 'failed';
  task.result = result;
  task.completedAt = new Date();

  if (task.assignedAgent) {
    const agent = agents.get(task.assignedAgent);
    if (agent) {
      agent.status = 'idle';
      agent.currentTask = undefined;
      agent.performance.tasksCompleted++;
      if (success) {
        agent.performance.successRate = (agent.performance.successRate * (agent.performance.tasksCompleted - 1) + 1) / agent.performance.tasksCompleted;
      }
      agents.set(agent.id, agent);
    }
  }

  tasks.set(task.id, task);
  res.json(task);
});

// Marketplace endpoints
app.get('/marketplace', (req, res) => {
  const listings = Array.from(marketplaceListings.values());
  const { capability, type, available } = req.query;

  let filteredListings = listings;
  if (capability) {
    filteredListings = filteredListings.filter(l =>
      l.capabilities.some(c => c.toLowerCase().includes(capability.toString().toLowerCase()))
    );
  }
  if (available === 'true') {
    filteredListings = filteredListings.filter(l => l.availability);
  }

  res.json({
    listings: filteredListings,
    total: filteredListings.length
  });
});

app.post('/marketplace', (req, res) => {
  const { agentId, serviceName, description, capabilities, pricing } = req.body;

  const agent = agents.get(agentId);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const listing: MarketplaceListing = {
    id: uuidv4(),
    agentId,
    serviceName,
    description,
    capabilities: capabilities || agent.capabilities,
    pricing,
    availability: agent.status !== 'offline',
    rating: 5.0,
    completedTasks: agent.performance.tasksCompleted,
    createdAt: new Date()
  };

  marketplaceListings.set(listing.id, listing);
  res.status(201).json(listing);
});

// Orchestration utilities
function findSuitableAgent(task: Task): Agent | null {
  const availableAgents = Array.from(agents.values()).filter(a =>
    a.status === 'idle' || a.status === 'active'
  );

  // Find agents with matching capabilities
  const suitableAgents = availableAgents.filter(agent =>
    task.requiredCapabilities.every(reqCap =>
      agent.capabilities.some(agentCap =>
        agentCap.toLowerCase().includes(reqCap.toLowerCase()) ||
        reqCap.toLowerCase().includes(agentCap.toLowerCase())
      )
    )
  );

  if (suitableAgents.length === 0) return null;

  // Prioritize by performance and availability
  return suitableAgents.sort((a, b) => {
    const scoreA = a.performance.successRate * 0.6 + (1 - a.performance.averageResponseTime / 10) * 0.4;
    const scoreB = b.performance.successRate * 0.6 + (1 - b.performance.averageResponseTime / 10) * 0.4;
    return scoreB - scoreA;
  })[0];
}

// Analytics endpoints
app.get('/analytics/performance', (req, res) => {
  const agentList = Array.from(agents.values());
  const taskList = Array.from(tasks.values());

  const analytics = {
    agents: {
      total: agentList.length,
      averageSuccessRate: agentList.reduce((sum, a) => sum + a.performance.successRate, 0) / agentList.length,
      averageResponseTime: agentList.reduce((sum, a) => sum + a.performance.averageResponseTime, 0) / agentList.length,
      totalTasksCompleted: agentList.reduce((sum, a) => sum + a.performance.tasksCompleted, 0)
    },
    tasks: {
      total: taskList.length,
      completionRate: taskList.filter(t => t.status === 'completed').length / taskList.length,
      averageCompletionTime: taskList
        .filter(t => t.completedAt && t.startedAt)
        .reduce((sum, t) => sum + (t.completedAt!.getTime() - t.startedAt!.getTime()), 0) /
        taskList.filter(t => t.completedAt && t.startedAt).length || 0
    },
    marketplace: {
      totalListings: marketplaceListings.size,
      averageRating: Array.from(marketplaceListings.values()).reduce((sum, l) => sum + l.rating, 0) / marketplaceListings.size
    }
  };

  res.json(analytics);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'North Star Autonomy Service',
    version: '1.0.0',
    description: 'Agent Management, Task Orchestration, and Marketplace Service',
    endpoints: {
      health: '/health',
      agents: '/agents',
      tasks: '/tasks',
      marketplace: '/marketplace',
      analytics: '/analytics/performance'
    },
    capabilities: [
      'agent-management',
      'task-orchestration',
      'marketplace',
      'performance-analytics',
      'auto-assignment'
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
      console.log(`Autonomy Service running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('Service endpoints available:');
      console.log(`  Health: http://localhost:${PORT}/health`);
      console.log(`  Agents: http://localhost:${PORT}/agents`);
      console.log(`  Tasks: http://localhost:${PORT}/tasks`);
      console.log(`  Marketplace: http://localhost:${PORT}/marketplace`);
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
    console.error('Failed to start Autonomy Service:', error);
    process.exit(1);
  }
}

// Auto-register with API Gateway (if available)
async function registerWithGateway() {
  if (!process.env.GATEWAY_URL) {
    console.log('No gateway URL configured, skipping registration');
    return;
  }

  try {
    const axios = require('axios');
    const registration = {
      id: process.env.SERVICE_ID || 'autonomy',
      name: process.env.SERVICE_NAME || 'Autonomy Service',
      url: `http://localhost:${PORT}`,
      healthCheck: `http://localhost:${PORT}/health`,
      version: '1.0.0',
      tags: ['autonomy', 'agents', 'orchestration', 'marketplace']
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