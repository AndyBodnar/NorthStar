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
const PORT = process.env.PORT || 3010;

// In-memory storage for demonstration
interface ConsentRecord {
  id: string;
  userId: string;
  consentType: 'data_processing' | 'data_sharing' | 'marketing' | 'analytics' | 'research';
  status: 'granted' | 'denied' | 'revoked' | 'expired';
  grantedAt: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  scope: string[];
  metadata: Record<string, any>;
  version: string;
}

interface Proposal {
  id: string;
  title: string;
  description: string;
  type: 'policy_change' | 'system_upgrade' | 'resource_allocation' | 'governance_rule' | 'feature_request';
  proposedBy: string;
  status: 'draft' | 'active' | 'passed' | 'rejected' | 'withdrawn';
  votingThreshold: {
    type: 'simple_majority' | 'supermajority' | 'unanimous' | 'quorum';
    value: number; // percentage or absolute number
  };
  voting: {
    startDate: Date;
    endDate: Date;
    eligibleVoters: string[];
    votes: Vote[];
  };
  content: {
    currentState?: string;
    proposedChanges: string;
    impact: string;
    implementation: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface Vote {
  id: string;
  proposalId: string;
  voterId: string;
  choice: 'for' | 'against' | 'abstain';
  weight: number; // voting power
  castAt: Date;
  reasoning?: string;
}

interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: 'data_protection' | 'security' | 'financial' | 'operational' | 'ethical';
  jurisdiction: string;
  requirements: string[];
  checkpoints: ComplianceCheckpoint[];
  isActive: boolean;
  createdAt: Date;
  lastUpdated: Date;
  version: string;
}

interface ComplianceCheckpoint {
  id: string;
  ruleId: string;
  name: string;
  description: string;
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  lastCheck: Date;
  nextCheck: Date;
  status: 'compliant' | 'non_compliant' | 'warning' | 'pending';
  findings: string[];
  autoCheck: boolean;
}

interface GovernanceMetrics {
  totalProposals: number;
  activeVotes: number;
  participationRate: number;
  complianceScore: number;
  consentCoverage: number;
  lastUpdated: Date;
}

interface User {
  id: string;
  type: 'human' | 'agent' | 'system';
  votingPower: number;
  reputation: number;
  joinedAt: Date;
  eligibleToVote: boolean;
}

// In-memory stores
const consentRecords = new Map<string, ConsentRecord>();
const proposals = new Map<string, Proposal>();
const votes = new Map<string, Vote>();
const complianceRules = new Map<string, ComplianceRule>();
const users = new Map<string, User>();

// Initialize sample data
const initializeSampleData = () => {
  // Sample users
  const sampleUsers: User[] = [
    {
      id: 'user-001',
      type: 'human',
      votingPower: 100,
      reputation: 85,
      joinedAt: new Date(Date.now() - 86400000 * 60),
      eligibleToVote: true
    },
    {
      id: 'agent-analytics-01',
      type: 'agent',
      votingPower: 50,
      reputation: 92,
      joinedAt: new Date(Date.now() - 86400000 * 30),
      eligibleToVote: true
    },
    {
      id: 'system-admin',
      type: 'system',
      votingPower: 200,
      reputation: 100,
      joinedAt: new Date(Date.now() - 86400000 * 90),
      eligibleToVote: true
    }
  ];

  sampleUsers.forEach(user => users.set(user.id, user));

  // Sample consent records
  const sampleConsents: ConsentRecord[] = [
    {
      id: uuidv4(),
      userId: 'user-001',
      consentType: 'data_processing',
      status: 'granted',
      grantedAt: new Date(Date.now() - 86400000 * 10),
      expiresAt: new Date(Date.now() + 86400000 * 365),
      scope: ['profile', 'usage_analytics', 'performance_metrics'],
      metadata: { channel: 'web_ui', ip: '192.168.1.100' },
      version: '1.0'
    },
    {
      id: uuidv4(),
      userId: 'user-001',
      consentType: 'marketing',
      status: 'denied',
      grantedAt: new Date(Date.now() - 86400000 * 10),
      scope: ['email_marketing', 'promotional_content'],
      metadata: { channel: 'web_ui', ip: '192.168.1.100' },
      version: '1.0'
    }
  ];

  sampleConsents.forEach(consent => consentRecords.set(consent.id, consent));

  // Sample proposals
  const sampleProposals: Proposal[] = [
    {
      id: uuidv4(),
      title: 'Implement Privacy-First Data Analytics',
      description: 'Proposal to enhance user privacy by implementing differential privacy techniques in our analytics pipeline',
      type: 'policy_change',
      proposedBy: 'user-001',
      status: 'active',
      votingThreshold: { type: 'simple_majority', value: 51 },
      voting: {
        startDate: new Date(Date.now() - 86400000 * 2),
        endDate: new Date(Date.now() + 86400000 * 5),
        eligibleVoters: Array.from(users.keys()),
        votes: []
      },
      content: {
        currentState: 'Basic analytics with minimal privacy protection',
        proposedChanges: 'Implement differential privacy, data anonymization, and consent-based analytics',
        impact: 'Enhanced user privacy, potential slight reduction in analytics precision',
        implementation: 'Phase 1: Audit current analytics, Phase 2: Implement DP algorithms, Phase 3: Update consent flows'
      },
      createdAt: new Date(Date.now() - 86400000 * 3),
      updatedAt: new Date(Date.now() - 86400000 * 2)
    }
  ];

  sampleProposals.forEach(proposal => proposals.set(proposal.id, proposal));

  // Sample compliance rules
  const sampleRules: ComplianceRule[] = [
    {
      id: uuidv4(),
      name: 'GDPR Data Protection Compliance',
      description: 'Ensure compliance with EU General Data Protection Regulation',
      category: 'data_protection',
      jurisdiction: 'EU',
      requirements: [
        'Obtain explicit consent for data processing',
        'Provide data portability mechanisms',
        'Implement right to be forgotten',
        'Conduct privacy impact assessments',
        'Maintain data processing records'
      ],
      checkpoints: [],
      isActive: true,
      createdAt: new Date(Date.now() - 86400000 * 30),
      lastUpdated: new Date(Date.now() - 86400000 * 7),
      version: '1.2'
    },
    {
      id: uuidv4(),
      name: 'SOC 2 Security Controls',
      description: 'Maintain SOC 2 Type II compliance for security controls',
      category: 'security',
      jurisdiction: 'US',
      requirements: [
        'Access control management',
        'System monitoring and logging',
        'Change management procedures',
        'Incident response plan',
        'Regular security assessments'
      ],
      checkpoints: [],
      isActive: true,
      createdAt: new Date(Date.now() - 86400000 * 45),
      lastUpdated: new Date(Date.now() - 86400000 * 14),
      version: '2.1'
    }
  ];

  sampleRules.forEach(rule => {
    const checkpoints: ComplianceCheckpoint[] = rule.requirements.map((req, index) => ({
      id: uuidv4(),
      ruleId: rule.id,
      name: `${rule.name} - Checkpoint ${index + 1}`,
      description: req,
      frequency: index % 2 === 0 ? 'monthly' : 'quarterly',
      lastCheck: new Date(Date.now() - 86400000 * 7),
      nextCheck: new Date(Date.now() + 86400000 * (index % 2 === 0 ? 23 : 83)),
      status: Math.random() > 0.8 ? 'warning' : 'compliant',
      findings: Math.random() > 0.8 ? ['Minor documentation gaps'] : [],
      autoCheck: index % 3 === 0
    }));

    rule.checkpoints = checkpoints;
    complianceRules.set(rule.id, rule);
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
  const metrics = calculateGovernanceMetrics();

  res.json({
    status: 'healthy',
    service: 'governance',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    metrics: {
      totalConsents: consentRecords.size,
      totalProposals: proposals.size,
      totalVotes: votes.size,
      complianceRules: complianceRules.size,
      registeredUsers: users.size,
      governanceHealth: metrics
    }
  });
});

// Consent management endpoints
app.get('/consent', (req, res) => {
  const consents = Array.from(consentRecords.values());
  const { userId, consentType, status } = req.query;

  let filtered = consents;
  if (userId) filtered = filtered.filter(c => c.userId === userId);
  if (consentType) filtered = filtered.filter(c => c.consentType === consentType);
  if (status) filtered = filtered.filter(c => c.status === status);

  res.json({
    consents: filtered,
    total: filtered.length,
    summary: getConsentSummary(consents)
  });
});

app.post('/consent', (req, res) => {
  const { userId, consentType, scope, expiresIn, metadata } = req.body;

  if (!userId || !consentType || !scope) {
    return res.status(400).json({ error: 'Missing required fields: userId, consentType, scope' });
  }

  const consent: ConsentRecord = {
    id: uuidv4(),
    userId,
    consentType,
    status: 'granted',
    grantedAt: new Date(),
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
    scope: Array.isArray(scope) ? scope : [scope],
    metadata: metadata || {},
    version: '1.0'
  };

  consentRecords.set(consent.id, consent);
  res.status(201).json(consent);
});

app.patch('/consent/:id/revoke', (req, res) => {
  const consent = consentRecords.get(req.params.id);
  if (!consent) {
    return res.status(404).json({ error: 'Consent record not found' });
  }

  if (consent.status !== 'granted') {
    return res.status(400).json({ error: 'Consent is not in granted status' });
  }

  consent.status = 'revoked';
  consent.revokedAt = new Date();
  consentRecords.set(consent.id, consent);

  res.json(consent);
});

app.get('/consent/user/:userId', (req, res) => {
  const userConsents = Array.from(consentRecords.values())
    .filter(c => c.userId === req.params.userId);

  res.json({
    userId: req.params.userId,
    consents: userConsents,
    summary: {
      granted: userConsents.filter(c => c.status === 'granted').length,
      denied: userConsents.filter(c => c.status === 'denied').length,
      revoked: userConsents.filter(c => c.status === 'revoked').length,
      expired: userConsents.filter(c => c.status === 'expired').length
    }
  });
});

// Voting and proposals endpoints
app.get('/proposals', (req, res) => {
  const proposalList = Array.from(proposals.values());
  const { status, type, proposedBy } = req.query;

  let filtered = proposalList;
  if (status) filtered = filtered.filter(p => p.status === status);
  if (type) filtered = filtered.filter(p => p.type === type);
  if (proposedBy) filtered = filtered.filter(p => p.proposedBy === proposedBy);

  // Sort by most recent first
  filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json({
    proposals: filtered,
    total: filtered.length,
    summary: getProposalSummary(proposalList)
  });
});

app.post('/proposals', (req, res) => {
  const { title, description, type, proposedBy, content, votingThreshold, votingDuration } = req.body;

  if (!title || !description || !type || !proposedBy || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const proposal: Proposal = {
    id: uuidv4(),
    title,
    description,
    type,
    proposedBy,
    status: 'draft',
    votingThreshold: votingThreshold || { type: 'simple_majority', value: 51 },
    voting: {
      startDate: new Date(),
      endDate: new Date(Date.now() + (votingDuration || 7) * 86400000),
      eligibleVoters: Array.from(users.values()).filter(u => u.eligibleToVote).map(u => u.id),
      votes: []
    },
    content,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  proposals.set(proposal.id, proposal);
  res.status(201).json(proposal);
});

app.patch('/proposals/:id/activate', (req, res) => {
  const proposal = proposals.get(req.params.id);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  if (proposal.status !== 'draft') {
    return res.status(400).json({ error: 'Only draft proposals can be activated' });
  }

  proposal.status = 'active';
  proposal.voting.startDate = new Date();
  proposal.updatedAt = new Date();

  proposals.set(proposal.id, proposal);
  res.json(proposal);
});

app.post('/proposals/:id/vote', (req, res) => {
  const { voterId, choice, reasoning } = req.body;
  const proposal = proposals.get(req.params.id);

  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  if (proposal.status !== 'active') {
    return res.status(400).json({ error: 'Proposal is not active for voting' });
  }

  if (new Date() > proposal.voting.endDate) {
    return res.status(400).json({ error: 'Voting period has ended' });
  }

  const voter = users.get(voterId);
  if (!voter || !voter.eligibleToVote) {
    return res.status(403).json({ error: 'User is not eligible to vote' });
  }

  if (!proposal.voting.eligibleVoters.includes(voterId)) {
    return res.status(403).json({ error: 'User is not eligible for this proposal' });
  }

  // Check if user already voted
  const existingVote = proposal.voting.votes.find(v => v.voterId === voterId);
  if (existingVote) {
    return res.status(400).json({ error: 'User has already voted on this proposal' });
  }

  const vote: Vote = {
    id: uuidv4(),
    proposalId: proposal.id,
    voterId,
    choice,
    weight: voter.votingPower,
    castAt: new Date(),
    reasoning
  };

  proposal.voting.votes.push(vote);
  votes.set(vote.id, vote);
  proposals.set(proposal.id, proposal);

  // Check if voting threshold is met
  const result = calculateVotingResult(proposal);
  if (result.concluded) {
    proposal.status = result.passed ? 'passed' : 'rejected';
    proposal.updatedAt = new Date();
    proposals.set(proposal.id, proposal);
  }

  res.status(201).json({
    vote,
    proposal: {
      id: proposal.id,
      status: proposal.status,
      currentResults: result
    }
  });
});

app.get('/proposals/:id/results', (req, res) => {
  const proposal = proposals.get(req.params.id);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  const results = calculateVotingResult(proposal);
  res.json({
    proposalId: proposal.id,
    status: proposal.status,
    ...results
  });
});

// Compliance endpoints
app.get('/compliance/rules', (req, res) => {
  const rules = Array.from(complianceRules.values());
  const { category, jurisdiction, active } = req.query;

  let filtered = rules;
  if (category) filtered = filtered.filter(r => r.category === category);
  if (jurisdiction) filtered = filtered.filter(r => r.jurisdiction === jurisdiction);
  if (active === 'true') filtered = filtered.filter(r => r.isActive);

  res.json({
    rules: filtered,
    total: filtered.length
  });
});

app.get('/compliance/status', (req, res) => {
  const rules = Array.from(complianceRules.values()).filter(r => r.isActive);
  const allCheckpoints = rules.flatMap(r => r.checkpoints);

  const complianceStatus = {
    overall: {
      totalRules: rules.length,
      compliantRules: rules.filter(r =>
        r.checkpoints.every(cp => cp.status === 'compliant')
      ).length,
      complianceScore: calculateOverallComplianceScore(rules)
    },
    byCategory: getComplianceByCategory(rules),
    recentFindings: allCheckpoints
      .filter(cp => cp.findings.length > 0)
      .sort((a, b) => b.lastCheck.getTime() - a.lastCheck.getTime())
      .slice(0, 10)
  };

  res.json(complianceStatus);
});

app.post('/compliance/rules/:id/check', (req, res) => {
  const rule = complianceRules.get(req.params.id);
  if (!rule) {
    return res.status(404).json({ error: 'Compliance rule not found' });
  }

  const { checkpointId, findings, status } = req.body;

  if (!checkpointId) {
    return res.status(400).json({ error: 'Missing checkpointId' });
  }

  const checkpoint = rule.checkpoints.find(cp => cp.id === checkpointId);
  if (!checkpoint) {
    return res.status(404).json({ error: 'Checkpoint not found' });
  }

  // Update checkpoint
  checkpoint.lastCheck = new Date();
  checkpoint.status = status || 'compliant';
  checkpoint.findings = findings || [];

  // Calculate next check date
  const frequencyDays = {
    continuous: 1,
    daily: 1,
    weekly: 7,
    monthly: 30,
    quarterly: 90,
    annual: 365
  };

  checkpoint.nextCheck = new Date(
    Date.now() + frequencyDays[checkpoint.frequency] * 86400000
  );

  complianceRules.set(rule.id, rule);

  res.json({
    checkpoint,
    ruleCompliance: calculateRuleComplianceScore(rule)
  });
});

// Analytics endpoints
app.get('/analytics/governance-metrics', (req, res) => {
  const metrics = calculateGovernanceMetrics();
  res.json(metrics);
});

app.get('/analytics/participation', (req, res) => {
  const proposalList = Array.from(proposals.values());
  const userList = Array.from(users.values());

  const participation = {
    overall: {
      eligibleVoters: userList.filter(u => u.eligibleToVote).length,
      averageParticipation: calculateAverageParticipation(proposalList),
      totalVotes: votes.size
    },
    byProposal: proposalList.map(p => ({
      id: p.id,
      title: p.title,
      participationRate: (p.voting.votes.length / p.voting.eligibleVoters.length) * 100,
      totalVotes: p.voting.votes.length
    })),
    byUser: userList
      .filter(u => u.eligibleToVote)
      .map(u => ({
        id: u.id,
        type: u.type,
        votingPower: u.votingPower,
        votescast: Array.from(votes.values()).filter(v => v.voterId === u.id).length
      }))
      .sort((a, b) => b.votescast - a.votescast)
  };

  res.json(participation);
});

// Utility functions
function calculateVotingResult(proposal: Proposal): {
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  totalWeight: number;
  participationRate: number;
  concluded: boolean;
  passed: boolean;
} {
  const votes = proposal.voting.votes;
  const forVotes = votes.filter(v => v.choice === 'for').reduce((sum, v) => sum + v.weight, 0);
  const againstVotes = votes.filter(v => v.choice === 'against').reduce((sum, v) => sum + v.weight, 0);
  const abstainVotes = votes.filter(v => v.choice === 'abstain').reduce((sum, v) => sum + v.weight, 0);

  const totalWeight = forVotes + againstVotes + abstainVotes;
  const eligibleWeight = proposal.voting.eligibleVoters.reduce((sum, voterId) => {
    const user = users.get(voterId);
    return sum + (user?.votingPower || 0);
  }, 0);

  const participationRate = (totalWeight / eligibleWeight) * 100;

  let concluded = false;
  let passed = false;

  // Check if voting period ended
  if (new Date() > proposal.voting.endDate) {
    concluded = true;
  }

  // Check threshold
  const threshold = proposal.votingThreshold;
  if (threshold.type === 'simple_majority') {
    const requiredVotes = (forVotes + againstVotes) * (threshold.value / 100);
    passed = forVotes > requiredVotes;
    if (forVotes > requiredVotes || againstVotes > requiredVotes) {
      concluded = true;
    }
  }

  return {
    forVotes,
    againstVotes,
    abstainVotes,
    totalWeight,
    participationRate,
    concluded,
    passed
  };
}

function calculateGovernanceMetrics(): GovernanceMetrics {
  const proposalList = Array.from(proposals.values());
  const consentList = Array.from(consentRecords.values());
  const rules = Array.from(complianceRules.values()).filter(r => r.isActive);

  return {
    totalProposals: proposalList.length,
    activeVotes: proposalList.filter(p => p.status === 'active').length,
    participationRate: calculateAverageParticipation(proposalList),
    complianceScore: calculateOverallComplianceScore(rules),
    consentCoverage: (consentList.filter(c => c.status === 'granted').length / consentList.length) * 100 || 0,
    lastUpdated: new Date()
  };
}

function calculateAverageParticipation(proposals: Proposal[]): number {
  const completedProposals = proposals.filter(p => ['passed', 'rejected'].includes(p.status));
  if (completedProposals.length === 0) return 0;

  const totalParticipation = completedProposals.reduce((sum, p) => {
    const result = calculateVotingResult(p);
    return sum + result.participationRate;
  }, 0);

  return totalParticipation / completedProposals.length;
}

function calculateOverallComplianceScore(rules: ComplianceRule[]): number {
  if (rules.length === 0) return 100;

  const totalScore = rules.reduce((sum, rule) => {
    return sum + calculateRuleComplianceScore(rule);
  }, 0);

  return totalScore / rules.length;
}

function calculateRuleComplianceScore(rule: ComplianceRule): number {
  const checkpoints = rule.checkpoints;
  if (checkpoints.length === 0) return 100;

  const scores: number[] = checkpoints.map(cp => {
    switch (cp.status) {
      case 'compliant': return 100;
      case 'warning': return 75;
      case 'non_compliant': return 0;
      case 'pending': return 50;
      default: return 50;
    }
  });

  return scores.reduce<number>((sum, score) => sum + score, 0) / scores.length;
}

function getConsentSummary(consents: ConsentRecord[]) {
  return {
    byStatus: {
      granted: consents.filter(c => c.status === 'granted').length,
      denied: consents.filter(c => c.status === 'denied').length,
      revoked: consents.filter(c => c.status === 'revoked').length,
      expired: consents.filter(c => c.status === 'expired').length
    },
    byType: {
      data_processing: consents.filter(c => c.consentType === 'data_processing').length,
      data_sharing: consents.filter(c => c.consentType === 'data_sharing').length,
      marketing: consents.filter(c => c.consentType === 'marketing').length,
      analytics: consents.filter(c => c.consentType === 'analytics').length,
      research: consents.filter(c => c.consentType === 'research').length
    }
  };
}

function getProposalSummary(proposals: Proposal[]) {
  return {
    byStatus: {
      draft: proposals.filter(p => p.status === 'draft').length,
      active: proposals.filter(p => p.status === 'active').length,
      passed: proposals.filter(p => p.status === 'passed').length,
      rejected: proposals.filter(p => p.status === 'rejected').length,
      withdrawn: proposals.filter(p => p.status === 'withdrawn').length
    },
    byType: {
      policy_change: proposals.filter(p => p.type === 'policy_change').length,
      system_upgrade: proposals.filter(p => p.type === 'system_upgrade').length,
      resource_allocation: proposals.filter(p => p.type === 'resource_allocation').length,
      governance_rule: proposals.filter(p => p.type === 'governance_rule').length,
      feature_request: proposals.filter(p => p.type === 'feature_request').length
    }
  };
}

function getComplianceByCategory(rules: ComplianceRule[]) {
  const categories = ['data_protection', 'security', 'financial', 'operational', 'ethical'];

  return categories.reduce((acc, category) => {
    const categoryRules = rules.filter(r => r.category === category);
    acc[category] = {
      total: categoryRules.length,
      score: categoryRules.length > 0 ? calculateOverallComplianceScore(categoryRules) : 0
    };
    return acc;
  }, {} as Record<string, { total: number; score: number }>);
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'North Star Governance Service',
    version: '1.0.0',
    description: 'Consent Management, Voting, and Compliance Service',
    endpoints: {
      health: '/health',
      consent: '/consent',
      proposals: '/proposals',
      compliance: '/compliance',
      analytics: '/analytics/governance-metrics'
    },
    capabilities: [
      'consent-management',
      'proposal-voting',
      'compliance-monitoring',
      'governance-analytics',
      'regulatory-compliance'
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
      console.log(`Governance Service running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('Service endpoints available:');
      console.log(`  Health: http://localhost:${PORT}/health`);
      console.log(`  Consent: http://localhost:${PORT}/consent`);
      console.log(`  Proposals: http://localhost:${PORT}/proposals`);
      console.log(`  Compliance: http://localhost:${PORT}/compliance`);
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
    console.error('Failed to start Governance Service:', error);
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
      id: process.env.SERVICE_ID || 'governance',
      name: process.env.SERVICE_NAME || 'Governance Service',
      url: `http://localhost:${PORT}`,
      healthCheck: `http://localhost:${PORT}/health`,
      version: '1.0.0',
      tags: ['governance', 'consent', 'voting', 'compliance']
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