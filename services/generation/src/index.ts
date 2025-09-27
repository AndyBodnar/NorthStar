import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:4000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // Lower limit for generation service due to resource intensity
  message: 'Too many generation requests from this IP, please try again later.'
});
app.use(limiter);

app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// In-memory generation store
const generationJobs = new Map();
const generatedContent = new Map();

// Mock generation functions
function generateText(prompt: string, options: any = {}) {
  const templates = [
    `Based on "${prompt}", here's an AI-generated response: This is a sophisticated analysis that considers multiple perspectives and provides actionable insights.`,
    `Regarding "${prompt}": In the context of modern AI systems, this topic represents a convergence of technological innovation and practical application.`,
    `Analysis of "${prompt}": This subject matter intersects with current trends in artificial intelligence, machine learning, and human-computer interaction.`
  ];

  return {
    content: templates[Math.floor(Math.random() * templates.length)],
    wordCount: Math.floor(Math.random() * 500) + 100,
    quality: Math.random() * 0.3 + 0.7,
    metadata: {
      model: 'north-star-text-v1',
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 500
    }
  };
}

function generateImage(prompt: string, options: any = {}) {
  return {
    content: `data:image/svg+xml;base64,${Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
        <rect width="512" height="512" fill="#${Math.floor(Math.random()*16777215).toString(16)}"/>
        <text x="256" y="256" text-anchor="middle" fill="white" font-size="24">
          Generated: ${prompt.substring(0, 20)}...
        </text>
      </svg>
    `).toString('base64')}`,
    dimensions: { width: 512, height: 512 },
    format: 'svg',
    quality: Math.random() * 0.3 + 0.7,
    metadata: {
      model: 'north-star-image-v1',
      style: options.style || 'realistic',
      steps: options.steps || 20
    }
  };
}

function generateWorld(prompt: string, options: any = {}) {
  const terrainTypes = ['mountains', 'plains', 'forests', 'deserts', 'oceans', 'cities'];
  const climates = ['tropical', 'temperate', 'arctic', 'arid', 'continental'];

  return {
    content: {
      name: `World of ${prompt}`,
      terrain: terrainTypes[Math.floor(Math.random() * terrainTypes.length)],
      climate: climates[Math.floor(Math.random() * climates.length)],
      size: { width: 1000, height: 1000, depth: 100 },
      population: Math.floor(Math.random() * 1000000),
      physics: {
        gravity: 9.8 + (Math.random() - 0.5) * 2,
        timeScale: 1.0,
        weatherEnabled: true
      },
      regions: Array.from({ length: 5 }, (_, i) => ({
        id: `region_${i}`,
        name: `Region ${i + 1}`,
        coordinates: {
          x: Math.random() * 1000,
          y: Math.random() * 1000
        }
      }))
    },
    quality: Math.random() * 0.3 + 0.7,
    metadata: {
      generator: 'north-star-world-v1',
      complexity: options.complexity || 'medium',
      genre: options.genre || 'fantasy'
    }
  };
}

function generateCausalMap(prompt: string, options: any = {}) {
  const nodes = Array.from({ length: 10 }, (_, i) => ({
    id: `node_${i}`,
    label: `Factor ${i + 1}`,
    type: ['cause', 'effect', 'mediator'][Math.floor(Math.random() * 3)],
    weight: Math.random(),
    position: { x: Math.random() * 500, y: Math.random() * 500 }
  }));

  const edges = [];
  for (let i = 0; i < 15; i++) {
    const from = nodes[Math.floor(Math.random() * nodes.length)];
    const to = nodes[Math.floor(Math.random() * nodes.length)];
    if (from !== to) {
      edges.push({
        id: `edge_${i}`,
        from: from.id,
        to: to.id,
        strength: Math.random(),
        type: ['causation', 'correlation', 'influence'][Math.floor(Math.random() * 3)]
      });
    }
  }

  return {
    content: { nodes, edges },
    quality: Math.random() * 0.3 + 0.7,
    metadata: {
      algorithm: 'north-star-causal-v1',
      complexity: nodes.length,
      relationships: edges.length
    }
  };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'generation',
    timestamp: new Date().toISOString(),
    activeJobs: generationJobs.size,
    totalGenerated: generatedContent.size
  });
});

// Start generation request
app.post('/generate', (req, res) => {
  try {
    const {
      type = 'text',
      prompt,
      options = {},
      priority = 'normal'
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const jobId = uuidv4();
    const job = {
      id: jobId,
      type,
      prompt,
      options,
      priority,
      status: 'queued',
      createdAt: new Date().toISOString(),
      estimatedDuration: Math.floor(Math.random() * 30) + 10 // 10-40 seconds
    };

    generationJobs.set(jobId, job);

    // Simulate async generation
    setTimeout(() => {
      const updatedJob = generationJobs.get(jobId);
      if (updatedJob) {
        updatedJob.status = 'processing';
        generationJobs.set(jobId, updatedJob);

        // Simulate generation completion
        setTimeout(() => {
          let content;

          switch (type) {
            case 'image':
              content = generateImage(prompt, options);
              break;
            case 'world':
              content = generateWorld(prompt, options);
              break;
            case 'causal_map':
              content = generateCausalMap(prompt, options);
              break;
            case 'text':
            default:
              content = generateText(prompt, options);
              break;
          }

          const finalJob = {
            ...updatedJob,
            status: 'completed',
            completedAt: new Date().toISOString(),
            result: content
          };

          generationJobs.set(jobId, finalJob);
          generatedContent.set(jobId, finalJob);

        }, Math.random() * 5000 + 2000); // 2-7 seconds processing
      }
    }, 1000); // 1 second queue time

    res.status(202).json({
      jobId,
      status: 'queued',
      estimatedDuration: job.estimatedDuration,
      statusUrl: `/generate/${jobId}`
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to start generation' });
  }
});

// Get generation status
app.get('/generate/:jobId', (req, res) => {
  const job = generationJobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: 'Generation job not found' });
  }

  res.json(job);
});

// Get all generation jobs
app.get('/jobs', (req, res) => {
  const status = req.query.status as string;
  const type = req.query.type as string;

  let jobs = Array.from(generationJobs.values());

  if (status) {
    jobs = jobs.filter(job => job.status === status);
  }

  if (type) {
    jobs = jobs.filter(job => job.type === type);
  }

  res.json({
    jobs: jobs.slice(-100), // Last 100 jobs
    total: jobs.length
  });
});

// Get generation capabilities
app.get('/capabilities', (req, res) => {
  res.json({
    supportedTypes: [
      {
        type: 'text',
        description: 'Generate textual content',
        options: ['temperature', 'maxTokens', 'style']
      },
      {
        type: 'image',
        description: 'Generate images',
        options: ['style', 'resolution', 'format', 'steps']
      },
      {
        type: 'world',
        description: 'Generate virtual worlds',
        options: ['complexity', 'genre', 'size', 'physics']
      },
      {
        type: 'causal_map',
        description: 'Generate causal relationship maps',
        options: ['complexity', 'domain', 'nodeCount']
      },
      {
        type: 'timeline',
        description: 'Generate event timelines',
        options: ['timespan', 'granularity', 'domain']
      },
      {
        type: 'simulation',
        description: 'Generate simulation scenarios',
        options: ['duration', 'complexity', 'variables']
      }
    ],
    models: {
      text: 'north-star-text-v1',
      image: 'north-star-image-v1',
      world: 'north-star-world-v1',
      causal: 'north-star-causal-v1'
    }
  });
});

// Delete generation job
app.delete('/generate/:jobId', (req, res) => {
  const deleted = generationJobs.delete(req.params.jobId);

  if (!deleted) {
    return res.status(404).json({ error: 'Generation job not found' });
  }

  res.status(204).send();
});

// Get generated content library
app.get('/content', (req, res) => {
  const type = req.query.type as string;
  const limit = parseInt(req.query.limit as string) || 50;

  let content = Array.from(generatedContent.values());

  if (type) {
    content = content.filter(item => item.type === type);
  }

  res.json({
    content: content
      .filter(item => item.status === 'completed')
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, limit),
    total: content.length
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'North Star Generation Service',
    version: '1.0.0',
    description: 'AI-powered content generation service',
    endpoints: {
      health: '/health',
      generate: 'POST /generate',
      status: '/generate/:jobId',
      jobs: '/jobs',
      capabilities: '/capabilities',
      content: '/content'
    },
    activeJobs: generationJobs.size,
    totalGenerated: generatedContent.size
  });
});

// Error handling
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
app.listen(PORT, () => {
  console.log(`Generation Service running on port ${PORT}`);
  console.log('Available generation types: text, image, world, causal_map, timeline, simulation');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

export default app;