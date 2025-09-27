import { z } from 'zod';
import { BaseEntitySchema } from './common';

export enum ConsentType {
  EXPLICIT = 'explicit',
  IMPLIED = 'implied',
  OPT_IN = 'opt_in',
  OPT_OUT = 'opt_out',
  GRANULAR = 'granular',
}

export enum ConsentStatus {
  PENDING = 'pending',
  GRANTED = 'granted',
  DENIED = 'denied',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export enum ProposalType {
  RULE_CHANGE = 'rule_change',
  POLICY_UPDATE = 'policy_update',
  BUDGET_ALLOCATION = 'budget_allocation',
  MEMBER_ACTION = 'member_action',
  TECHNICAL_UPGRADE = 'technical_upgrade',
  GOVERNANCE_CHANGE = 'governance_change',
}

export enum VoteType {
  YES_NO = 'yes_no',
  MULTIPLE_CHOICE = 'multiple_choice',
  RANKED_CHOICE = 'ranked_choice',
  WEIGHTED = 'weighted',
  QUADRATIC = 'quadratic',
}

export const ConsentSchema = BaseEntitySchema.extend({
  grantorId: z.string().uuid(),
  granteeId: z.string().uuid(),
  type: z.nativeEnum(ConsentType),
  status: z.nativeEnum(ConsentStatus),
  purpose: z.string(),
  scope: z.array(z.string()),
  conditions: z.array(z.string()).default([]),
  grantedAt: z.date().optional(),
  expiresAt: z.date().optional(),
  revokedAt: z.date().optional(),
  renewalRequired: z.boolean().default(false),
  renewalNotification: z.number().int().positive().optional(), // days before expiry
  metadata: z.record(z.any()).optional(),
  auditTrail: z.array(z.object({
    action: z.string(),
    timestamp: z.date(),
    actorId: z.string().uuid(),
    reason: z.string().optional(),
  })).default([]),
});

export type Consent = z.infer<typeof ConsentSchema>;

export const CommunityRuleSchema = BaseEntitySchema.extend({
  communityId: z.string().uuid(),
  title: z.string().max(255),
  description: z.string(),
  category: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  enforcement: z.enum(['warning', 'temporary_restriction', 'permanent_ban', 'custom']),
  isActive: z.boolean().default(true),
  createdBy: z.string().uuid(),
  approvedBy: z.string().uuid().optional(),
  approvedAt: z.date().optional(),
  conditions: z.array(z.record(z.any())).default([]),
  exceptions: z.array(z.record(z.any())).default([]),
  tags: z.array(z.string()).default([]),
  violationCount: z.number().int().nonnegative().default(0),
  lastViolation: z.date().optional(),
});

export type CommunityRule = z.infer<typeof CommunityRuleSchema>;

export const ProposalSchema = BaseEntitySchema.extend({
  title: z.string().max(255),
  description: z.string(),
  type: z.nativeEnum(ProposalType),
  proposerId: z.string().uuid(),
  communityId: z.string().uuid(),
  content: z.record(z.any()),
  votingType: z.nativeEnum(VoteType),
  votingOptions: z.array(z.string()),
  startDate: z.date(),
  endDate: z.date(),
  quorum: z.number().min(0).max(1), // percentage of eligible voters
  passingThreshold: z.number().min(0).max(1), // percentage needed to pass
  status: z.enum(['draft', 'voting', 'passed', 'rejected', 'expired', 'cancelled']),
  eligibilityRules: z.array(z.record(z.any())).default([]),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    type: z.string(),
  })).default([]),
  tags: z.array(z.string()).default([]),
  discussionThreadId: z.string().uuid().optional(),
});

export type Proposal = z.infer<typeof ProposalSchema>;

export const VoteSchema = BaseEntitySchema.extend({
  proposalId: z.string().uuid(),
  voterId: z.string().uuid(),
  choice: z.union([z.string(), z.array(z.string()), z.record(z.number())]),
  weight: z.number().positive().default(1),
  timestamp: z.date(),
  reasoning: z.string().optional(),
  isPublic: z.boolean().default(false),
  delegatedFrom: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

export type Vote = z.infer<typeof VoteSchema>;

export const AuditLogSchema = BaseEntitySchema.extend({
  entityId: z.string().uuid(),
  entityType: z.string(),
  action: z.string(),
  actorId: z.string().uuid(),
  actorType: z.enum(['user', 'system', 'agent']),
  timestamp: z.date(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  sessionId: z.string().uuid().optional(),
  before: z.record(z.any()).optional(),
  after: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  isAutomated: z.boolean().default(false),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

export const ComplianceCheckSchema = BaseEntitySchema.extend({
  name: z.string().max(255),
  description: z.string().optional(),
  regulation: z.string(), // e.g., "GDPR", "CCPA", "SOX"
  category: z.string(),
  checkFunction: z.string(), // function name or identifier
  frequency: z.enum(['on_demand', 'daily', 'weekly', 'monthly', 'quarterly', 'annually']),
  lastRun: z.date().optional(),
  nextRun: z.date().optional(),
  status: z.enum(['passing', 'failing', 'warning', 'not_run']),
  result: z.object({
    score: z.number().min(0).max(100),
    issues: z.array(z.object({
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      message: z.string(),
      suggestion: z.string().optional(),
    })),
    evidence: z.array(z.record(z.any())).default([]),
  }).optional(),
  isActive: z.boolean().default(true),
  owner: z.string().uuid(),
  stakeholders: z.array(z.string().uuid()).default([]),
});

export type ComplianceCheck = z.infer<typeof ComplianceCheckSchema>;