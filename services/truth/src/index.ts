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
const PORT = process.env.PORT || 3008;

// In-memory storage for demonstration
interface FactCheck {
  id: string;
  claim: string;
  source: string;
  result: 'true' | 'false' | 'partial' | 'unverified' | 'misleading';
  confidence: number; // 0-1
  evidence: Evidence[];
  biasDetection: BiasAnalysis;
  checkedAt: Date;
  checkedBy: string; // agent or human ID
  version: number;
}

interface Evidence {
  id: string;
  type: 'document' | 'data' | 'expert_opinion' | 'cross_reference';
  source: string;
  reliability: number; // 0-1
  relevance: number; // 0-1
  content: string;
  timestamp: Date;
}

interface BiasAnalysis {
  detectedBiases: string[];
  politicalLean: 'left' | 'center' | 'right' | 'neutral' | 'unknown';
  emotionalTone: 'positive' | 'negative' | 'neutral';
  confidence: number;
  indicators: string[];
}

interface DataIntegrityCheck {
  id: string;
  dataId: string;
  dataType: string;
  checksPerformed: string[];
  results: {
    completeness: number;
    accuracy: number;
    consistency: number;
    validity: number;
    timeliness: number;
  };
  issues: IntegrityIssue[];
  overallScore: number;
  checkedAt: Date;
  recommendation: string;
}

interface IntegrityIssue {
  type: 'missing_data' | 'inconsistency' | 'outlier' | 'format_error' | 'staleness';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedFields: string[];
  suggestedFix: string;
}

interface TruthScore {
  entityId: string;
  entityType: 'claim' | 'source' | 'agent' | 'data';
  score: number; // 0-1
  factors: {
    verificationHistory: number;
    sourceCredibility: number;
    consensusLevel: number;
    evidenceQuality: number;
  };
  lastUpdated: Date;
  version: number;
}

// In-memory stores
const factChecks = new Map<string, FactCheck>();
const dataIntegrityChecks = new Map<string, DataIntegrityCheck>();
const truthScores = new Map<string, TruthScore>();
const knownSources = new Map<string, { name: string; credibility: number; biasProfile: BiasAnalysis }>();

// Initialize sample data
const initializeSampleData = () => {
  // Sample sources
  const sampleSources: Array<{ id: string; name: string; credibility: number; biasProfile: BiasAnalysis }> = [
    {
      id: 'reuters',
      name: 'Reuters',
      credibility: 0.92,
      biasProfile: {
        detectedBiases: [],
        politicalLean: 'center',
        emotionalTone: 'neutral',
        confidence: 0.85,
        indicators: ['fact-based reporting']
      } as BiasAnalysis
    },
    {
      id: 'academic-journal',
      name: 'Academic Journal Database',
      credibility: 0.95,
      biasProfile: {
        detectedBiases: [],
        politicalLean: 'neutral',
        emotionalTone: 'neutral',
        confidence: 0.9,
        indicators: ['peer-reviewed']
      } as BiasAnalysis
    },
    {
      id: 'blog-source',
      name: 'Opinion Blog',
      credibility: 0.45,
      biasProfile: {
        detectedBiases: ['confirmation bias'],
        politicalLean: 'left',
        emotionalTone: 'positive',
        confidence: 0.7,
        indicators: ['opinion-based', 'emotional language']
      } as BiasAnalysis
    }
  ];

  sampleSources.forEach(source => {
    knownSources.set(source.id, {
      name: source.name,
      credibility: source.credibility,
      biasProfile: source.biasProfile as BiasAnalysis
    });
  });

  // Sample fact checks
  const sampleFactChecks: FactCheck[] = [
    {
      id: uuidv4(),
      claim: 'Global temperature has increased by 1.1°C since pre-industrial times',
      source: 'climate-report',
      result: 'true',
      confidence: 0.95,
      evidence: [
        {
          id: uuidv4(),
          type: 'data',
          source: 'NOAA Temperature Records',
          reliability: 0.98,
          relevance: 0.95,
          content: 'Temperature anomaly data shows 1.1°C increase from 1880-2023',
          timestamp: new Date(Date.now() - 86400000)
        }
      ],
      biasDetection: {
        detectedBiases: [],
        politicalLean: 'neutral',
        emotionalTone: 'neutral',
        confidence: 0.9,
        indicators: ['scientific data']
      },
      checkedAt: new Date(),
      checkedBy: 'truth-agent-01',
      version: 1
    }
  ];

  sampleFactChecks.forEach(fc => factChecks.set(fc.id, fc));

  // Sample data integrity checks
  const sampleIntegrityCheck: DataIntegrityCheck = {
    id: uuidv4(),
    dataId: 'user-dataset-001',
    dataType: 'user-profile',
    checksPerformed: ['completeness', 'consistency', 'format-validation'],
    results: {
      completeness: 0.89,
      accuracy: 0.92,
      consistency: 0.87,
      validity: 0.94,
      timeliness: 0.76
    },
    issues: [
      {
        type: 'missing_data',
        severity: 'medium',
        description: 'Email field missing in 11% of records',
        affectedFields: ['email'],
        suggestedFix: 'Implement required field validation'
      }
    ],
    overallScore: 0.876,
    checkedAt: new Date(),
    recommendation: 'Data quality is good but requires attention to missing email fields'
  };

  dataIntegrityChecks.set(sampleIntegrityCheck.id, sampleIntegrityCheck);
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
    service: 'truth',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    metrics: {
      totalFactChecks: factChecks.size,
      totalIntegrityChecks: dataIntegrityChecks.size,
      totalTruthScores: truthScores.size,
      knownSources: knownSources.size
    }
  });
});

// Fact checking endpoints
app.get('/fact-checks', (req, res) => {
  const checks = Array.from(factChecks.values());
  const { result, confidence } = req.query;

  let filtered = checks;
  if (result) filtered = filtered.filter(fc => fc.result === result);
  if (confidence) {
    const minConfidence = parseFloat(confidence.toString());
    filtered = filtered.filter(fc => fc.confidence >= minConfidence);
  }

  res.json({
    factChecks: filtered,
    total: filtered.length,
    summary: {
      true: checks.filter(fc => fc.result === 'true').length,
      false: checks.filter(fc => fc.result === 'false').length,
      partial: checks.filter(fc => fc.result === 'partial').length,
      unverified: checks.filter(fc => fc.result === 'unverified').length,
      misleading: checks.filter(fc => fc.result === 'misleading').length
    }
  });
});

app.post('/fact-checks', (req, res) => {
  const { claim, source } = req.body;

  if (!claim || !source) {
    return res.status(400).json({ error: 'Missing required fields: claim, source' });
  }

  // Simulate fact checking process
  const result = simulateFactCheck(claim, source);

  const factCheck: FactCheck = {
    id: uuidv4(),
    claim,
    source,
    result: result.result,
    confidence: result.confidence,
    evidence: result.evidence,
    biasDetection: result.biasDetection,
    checkedAt: new Date(),
    checkedBy: 'truth-agent-auto',
    version: 1
  };

  factChecks.set(factCheck.id, factCheck);
  res.status(201).json(factCheck);
});

app.get('/fact-checks/:id', (req, res) => {
  const factCheck = factChecks.get(req.params.id);
  if (!factCheck) {
    return res.status(404).json({ error: 'Fact check not found' });
  }
  res.json(factCheck);
});

// Data integrity endpoints
app.get('/integrity-checks', (req, res) => {
  const checks = Array.from(dataIntegrityChecks.values());
  const { dataType, minScore } = req.query;

  let filtered = checks;
  if (dataType) filtered = filtered.filter(ic => ic.dataType === dataType);
  if (minScore) {
    const threshold = parseFloat(minScore.toString());
    filtered = filtered.filter(ic => ic.overallScore >= threshold);
  }

  res.json({
    integrityChecks: filtered,
    total: filtered.length,
    averageScore: filtered.reduce((sum, ic) => sum + ic.overallScore, 0) / filtered.length || 0
  });
});

app.post('/integrity-checks', (req, res) => {
  const { dataId, dataType, data } = req.body;

  if (!dataId || !dataType || !data) {
    return res.status(400).json({ error: 'Missing required fields: dataId, dataType, data' });
  }

  // Simulate data integrity checking
  const integrityResult = simulateDataIntegrityCheck(dataId, dataType, data);

  dataIntegrityChecks.set(integrityResult.id, integrityResult);
  res.status(201).json(integrityResult);
});

// Bias detection endpoints
app.post('/bias-analysis', (req, res) => {
  const { text, source } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Missing required field: text' });
  }

  const biasAnalysis = simulateBiasDetection(text, source);

  res.json({
    analysis: biasAnalysis,
    text: text.substring(0, 100) + '...',
    analyzedAt: new Date().toISOString()
  });
});

// Truth scoring endpoints
app.get('/truth-scores/:entityId', (req, res) => {
  const score = truthScores.get(req.params.entityId);
  if (!score) {
    return res.status(404).json({ error: 'Truth score not found' });
  }
  res.json(score);
});

app.post('/truth-scores', (req, res) => {
  const { entityId, entityType, verificationData } = req.body;

  if (!entityId || !entityType) {
    return res.status(400).json({ error: 'Missing required fields: entityId, entityType' });
  }

  const validEntityTypes = ['claim', 'source', 'agent', 'data'];
  if (!validEntityTypes.includes(entityType)) {
    return res.status(400).json({ error: 'Invalid entityType. Must be one of: claim, source, agent, data' });
  }

  const score = calculateTruthScore(entityId, entityType as 'claim' | 'source' | 'agent' | 'data', verificationData);
  truthScores.set(entityId, score);

  res.status(201).json(score);
});

// Source credibility endpoints
app.get('/sources', (req, res) => {
  const sources = Array.from(knownSources.entries()).map(([id, data]) => ({
    id,
    ...data
  }));

  res.json({
    sources,
    total: sources.length
  });
});

app.get('/sources/:id/credibility', (req, res) => {
  const source = knownSources.get(req.params.id);
  if (!source) {
    return res.status(404).json({ error: 'Source not found' });
  }

  res.json({
    sourceId: req.params.id,
    credibility: source.credibility,
    biasProfile: source.biasProfile,
    recommendations: generateSourceRecommendations(source)
  });
});

// Utility functions for simulation
function simulateFactCheck(claim: string, source: string): {
  result: 'true' | 'false' | 'partial' | 'unverified' | 'misleading';
  confidence: number;
  evidence: Evidence[];
  biasDetection: BiasAnalysis;
} {
  // Simple simulation based on keywords and patterns
  const lowerClaim = claim.toLowerCase();

  let result: 'true' | 'false' | 'partial' | 'unverified' | 'misleading' = 'unverified';
  let confidence = 0.5;

  if (lowerClaim.includes('temperature') || lowerClaim.includes('climate')) {
    result = 'true';
    confidence = 0.9;
  } else if (lowerClaim.includes('fake') || lowerClaim.includes('hoax')) {
    result = 'false';
    confidence = 0.8;
  } else if (lowerClaim.includes('opinion') || lowerClaim.includes('believe')) {
    result = 'partial';
    confidence = 0.6;
  }

  const evidence: Evidence[] = [{
    id: uuidv4(),
    type: 'cross_reference',
    source: 'automated-verification-system',
    reliability: 0.85,
    relevance: 0.9,
    content: `Automated analysis of claim: "${claim.substring(0, 50)}..."`,
    timestamp: new Date()
  }];

  const biasDetection = simulateBiasDetection(claim, source);

  return { result, confidence, evidence, biasDetection };
}

function simulateDataIntegrityCheck(dataId: string, dataType: string, data: any): DataIntegrityCheck {
  // Simulate various data quality checks
  const results = {
    completeness: 0.8 + Math.random() * 0.2,
    accuracy: 0.85 + Math.random() * 0.15,
    consistency: 0.75 + Math.random() * 0.25,
    validity: 0.9 + Math.random() * 0.1,
    timeliness: 0.7 + Math.random() * 0.3
  };

  const overallScore = Object.values(results).reduce((sum, val) => sum + val, 0) / Object.values(results).length;

  const issues: IntegrityIssue[] = [];
  if (results.completeness < 0.9) {
    issues.push({
      type: 'missing_data',
      severity: results.completeness < 0.7 ? 'high' : 'medium',
      description: `Data completeness is ${(results.completeness * 100).toFixed(1)}%`,
      affectedFields: ['various fields'],
      suggestedFix: 'Review data collection processes'
    });
  }

  return {
    id: uuidv4(),
    dataId,
    dataType,
    checksPerformed: ['completeness', 'accuracy', 'consistency', 'validity', 'timeliness'],
    results,
    issues,
    overallScore,
    checkedAt: new Date(),
    recommendation: overallScore > 0.8 ? 'Data quality is acceptable' : 'Data quality needs improvement'
  };
}

function simulateBiasDetection(text: string, source?: string): BiasAnalysis {
  const lowerText = text.toLowerCase();
  const detectedBiases: string[] = [];
  let politicalLean: 'left' | 'center' | 'right' | 'neutral' | 'unknown' = 'neutral';
  let emotionalTone: 'positive' | 'negative' | 'neutral' = 'neutral';
  const indicators: string[] = [];

  // Simple bias detection simulation
  if (lowerText.includes('amazing') || lowerText.includes('incredible')) {
    emotionalTone = 'positive';
    detectedBiases.push('positive bias');
    indicators.push('emotional language');
  }

  if (lowerText.includes('terrible') || lowerText.includes('awful')) {
    emotionalTone = 'negative';
    detectedBiases.push('negative bias');
    indicators.push('emotional language');
  }

  if (lowerText.includes('liberal') || lowerText.includes('progressive')) {
    politicalLean = 'left';
    indicators.push('political terminology');
  }

  if (lowerText.includes('conservative') || lowerText.includes('traditional')) {
    politicalLean = 'right';
    indicators.push('political terminology');
  }

  return {
    detectedBiases,
    politicalLean,
    emotionalTone,
    confidence: 0.7 + Math.random() * 0.3,
    indicators
  };
}

function calculateTruthScore(entityId: string, entityType: 'claim' | 'source' | 'agent' | 'data', verificationData?: any): TruthScore {
  // Simulate truth score calculation
  const factors = {
    verificationHistory: 0.7 + Math.random() * 0.3,
    sourceCredibility: 0.8 + Math.random() * 0.2,
    consensusLevel: 0.6 + Math.random() * 0.4,
    evidenceQuality: 0.75 + Math.random() * 0.25
  };

  const score = Object.values(factors).reduce((sum, val) => sum + val, 0) / Object.values(factors).length;

  return {
    entityId,
    entityType,
    score,
    factors,
    lastUpdated: new Date(),
    version: 1
  } as TruthScore;
}

function generateSourceRecommendations(source: any): string[] {
  const recommendations: string[] = [];

  if (source.credibility < 0.7) {
    recommendations.push('Consider cross-referencing with more credible sources');
  }

  if (source.biasProfile.detectedBiases.length > 0) {
    recommendations.push('Be aware of potential bias in this source');
  }

  if (source.biasProfile.politicalLean !== 'neutral') {
    recommendations.push('Consider sources with different political perspectives');
  }

  return recommendations;
}

// Analytics endpoints
app.get('/analytics/truth-metrics', (req, res) => {
  const checks = Array.from(factChecks.values());
  const integrityChecks = Array.from(dataIntegrityChecks.values());

  const analytics = {
    factChecking: {
      total: checks.length,
      averageConfidence: checks.reduce((sum, fc) => sum + fc.confidence, 0) / checks.length || 0,
      resultDistribution: {
        true: checks.filter(fc => fc.result === 'true').length,
        false: checks.filter(fc => fc.result === 'false').length,
        partial: checks.filter(fc => fc.result === 'partial').length,
        unverified: checks.filter(fc => fc.result === 'unverified').length,
        misleading: checks.filter(fc => fc.result === 'misleading').length
      }
    },
    dataIntegrity: {
      total: integrityChecks.length,
      averageScore: integrityChecks.reduce((sum, ic) => sum + ic.overallScore, 0) / integrityChecks.length || 0,
      commonIssues: getCommonIntegrityIssues(integrityChecks)
    },
    sources: {
      total: knownSources.size,
      averageCredibility: Array.from(knownSources.values()).reduce((sum, s) => sum + s.credibility, 0) / knownSources.size || 0
    }
  };

  res.json(analytics);
});

function getCommonIntegrityIssues(checks: DataIntegrityCheck[]): { type: string; count: number }[] {
  const issueCounts = new Map<string, number>();

  checks.forEach(check => {
    check.issues.forEach(issue => {
      issueCounts.set(issue.type, (issueCounts.get(issue.type) || 0) + 1);
    });
  });

  return Array.from(issueCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'North Star Truth Service',
    version: '1.0.0',
    description: 'Data Integrity, Fact Checking, and Bias Detection Service',
    endpoints: {
      health: '/health',
      factChecks: '/fact-checks',
      integrityChecks: '/integrity-checks',
      biasAnalysis: '/bias-analysis',
      truthScores: '/truth-scores',
      sources: '/sources',
      analytics: '/analytics/truth-metrics'
    },
    capabilities: [
      'fact-checking',
      'data-integrity-validation',
      'bias-detection',
      'source-credibility-assessment',
      'truth-scoring'
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
      console.log(`Truth Service running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('Service endpoints available:');
      console.log(`  Health: http://localhost:${PORT}/health`);
      console.log(`  Fact Checks: http://localhost:${PORT}/fact-checks`);
      console.log(`  Integrity: http://localhost:${PORT}/integrity-checks`);
      console.log(`  Bias Analysis: http://localhost:${PORT}/bias-analysis`);
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
    console.error('Failed to start Truth Service:', error);
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
      id: process.env.SERVICE_ID || 'truth',
      name: process.env.SERVICE_NAME || 'Truth Service',
      url: `http://localhost:${PORT}`,
      healthCheck: `http://localhost:${PORT}/health`,
      version: '1.0.0',
      tags: ['truth', 'integrity', 'fact-checking', 'bias-detection']
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