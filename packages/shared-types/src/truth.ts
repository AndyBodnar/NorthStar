import { z } from 'zod';
import { BaseEntitySchema } from './common';

export enum ProvenanceType {
  CREATION = 'creation',
  MODIFICATION = 'modification',
  VERIFICATION = 'verification',
  ATTESTATION = 'attestation',
  CITATION = 'citation',
}

export enum VerificationStatus {
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
  VERIFIED = 'verified',
  DISPUTED = 'disputed',
  REJECTED = 'rejected',
}

export enum BiasType {
  SELECTION = 'selection',
  CONFIRMATION = 'confirmation',
  ANCHORING = 'anchoring',
  AVAILABILITY = 'availability',
  REPRESENTATIVENESS = 'representativeness',
  CULTURAL = 'cultural',
  TEMPORAL = 'temporal',
}

export const ProvenanceRecordSchema = BaseEntitySchema.extend({
  entityId: z.string().uuid(),
  entityType: z.string(),
  type: z.nativeEnum(ProvenanceType),
  actorId: z.string().uuid(),
  action: z.string(),
  previousHash: z.string().optional(),
  currentHash: z.string(),
  signature: z.string().optional(),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional(),
  evidence: z.array(z.object({
    type: z.string(),
    source: z.string(),
    content: z.record(z.any()),
    confidence: z.number().min(0).max(1),
  })).default([]),
  chainId: z.string().optional(),
  blockNumber: z.number().int().nonnegative().optional(),
  transactionHash: z.string().optional(),
});

export type ProvenanceRecord = z.infer<typeof ProvenanceRecordSchema>;

export const VerificationSchema = BaseEntitySchema.extend({
  targetId: z.string().uuid(),
  targetType: z.string(),
  verifierId: z.string().uuid(),
  method: z.string(),
  status: z.nativeEnum(VerificationStatus),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.record(z.any())).default([]),
  criteria: z.array(z.string()).default([]),
  notes: z.string().optional(),
  expiresAt: z.date().optional(),
  chainOfTrust: z.array(z.string().uuid()).default([]),
  attestations: z.array(z.string().uuid()).default([]),
});

export type Verification = z.infer<typeof VerificationSchema>;

export const BiasFilterSchema = BaseEntitySchema.extend({
  name: z.string().max(255),
  description: z.string().optional(),
  type: z.nativeEnum(BiasType),
  creatorId: z.string().uuid(),
  algorithm: z.string(),
  parameters: z.record(z.any()).optional(),
  effectiveness: z.number().min(0).max(1).optional(),
  applicableDomains: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  usage: z.object({
    totalApplications: z.number().int().nonnegative().default(0),
    successRate: z.number().min(0).max(1).optional(),
    avgConfidenceImprovement: z.number().optional(),
  }).optional(),
});

export type BiasFilter = z.infer<typeof BiasFilterSchema>;

export const TruthClaimSchema = BaseEntitySchema.extend({
  statement: z.string(),
  claimerId: z.string().uuid(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.object({
    type: z.string(),
    source: z.string(),
    reliability: z.number().min(0).max(1),
    content: z.record(z.any()),
  })).default([]),
  contradictions: z.array(z.string().uuid()).default([]),
  supports: z.array(z.string().uuid()).default([]),
  verifications: z.array(z.string().uuid()).default([]),
  domain: z.string(),
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
  consensus: z.object({
    agreementScore: z.number().min(0).max(1).optional(),
    totalVotes: z.number().int().nonnegative().default(0),
    expertVotes: z.number().int().nonnegative().default(0),
  }).optional(),
});

export type TruthClaim = z.infer<typeof TruthClaimSchema>;

export const FactCheckSchema = BaseEntitySchema.extend({
  claimId: z.string().uuid(),
  checkerId: z.string().uuid(),
  method: z.string(),
  result: z.enum(['true', 'false', 'partially_true', 'misleading', 'unverifiable']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  sources: z.array(z.object({
    url: z.string().url(),
    title: z.string(),
    reliability: z.number().min(0).max(1),
    relevance: z.number().min(0).max(1),
  })).default([]),
  flags: z.array(z.string()).default([]),
  reviewedAt: z.date(),
  isAutomated: z.boolean().default(false),
});

export type FactCheck = z.infer<typeof FactCheckSchema>;