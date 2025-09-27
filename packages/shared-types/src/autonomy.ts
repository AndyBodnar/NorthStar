import { z } from 'zod';
import { BaseEntitySchema } from './common';

export enum AgentType {
  WORKER = 'worker',
  SUPERVISOR = 'supervisor',
  COORDINATOR = 'coordinator',
  SPECIALIST = 'specialist',
  MONITOR = 'monitor',
}

export enum AgentStatus {
  SPAWNING = 'spawning',
  IDLE = 'idle',
  WORKING = 'working',
  WAITING = 'waiting',
  ERROR = 'error',
  TERMINATED = 'terminated',
}

export enum PermissionType {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  ADMIN = 'admin',
  SPAWN = 'spawn',
  DELEGATE = 'delegate',
}

export const AgentSchema = BaseEntitySchema.extend({
  name: z.string().max(255),
  type: z.nativeEnum(AgentType),
  status: z.nativeEnum(AgentStatus),
  ownerId: z.string().uuid(),
  parentAgentId: z.string().uuid().optional(),
  capabilities: z.array(z.string()),
  constraints: z.record(z.any()).optional(),
  config: z.record(z.any()).optional(),
  resources: z.object({
    cpu: z.number().min(0).max(1).optional(),
    memory: z.number().positive().optional(),
    storage: z.number().positive().optional(),
    network: z.number().positive().optional(),
  }).optional(),
  permissions: z.array(z.nativeEnum(PermissionType)),
  spawnedAgents: z.array(z.string().uuid()).default([]),
  lastHeartbeat: z.date().optional(),
  executionLog: z.array(z.string()).default([]),
  metrics: z.record(z.number()).optional(),
});

export type Agent = z.infer<typeof AgentSchema>;

export const TaskSchema = BaseEntitySchema.extend({
  title: z.string().max(255),
  description: z.string().optional(),
  type: z.string(),
  priority: z.number().min(0).max(10).default(5),
  status: z.enum(['pending', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled']),
  assignedAgentId: z.string().uuid().optional(),
  creatorId: z.string().uuid(),
  parentTaskId: z.string().uuid().optional(),
  dependencies: z.array(z.string().uuid()).default([]),
  estimatedDuration: z.number().positive().optional(),
  actualDuration: z.number().positive().optional(),
  deadline: z.date().optional(),
  input: z.record(z.any()).optional(),
  output: z.record(z.any()).optional(),
  progress: z.number().min(0).max(1).default(0),
  retryCount: z.number().int().nonnegative().default(0),
  maxRetries: z.number().int().nonnegative().default(3),
  metadata: z.record(z.any()).optional(),
});

export type Task = z.infer<typeof TaskSchema>;

export const MarketListingSchema = BaseEntitySchema.extend({
  title: z.string().max(255),
  description: z.string(),
  listerId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  serviceType: z.string(),
  price: z.number().nonnegative(),
  currency: z.string().length(3),
  availability: z.object({
    from: z.date(),
    to: z.date().optional(),
    timezone: z.string(),
  }),
  requirements: z.array(z.string()).default([]),
  guarantees: z.array(z.string()).default([]),
  rating: z.number().min(0).max(5).optional(),
  reviews: z.array(z.string().uuid()).default([]),
  isActive: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});

export type MarketListing = z.infer<typeof MarketListingSchema>;

export const ContractSchema = BaseEntitySchema.extend({
  listingId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  terms: z.record(z.any()),
  price: z.number().nonnegative(),
  currency: z.string().length(3),
  status: z.enum(['draft', 'active', 'completed', 'disputed', 'cancelled']),
  startDate: z.date(),
  endDate: z.date(),
  deliverables: z.array(z.record(z.any())).default([]),
  milestones: z.array(z.object({
    id: z.string().uuid(),
    description: z.string(),
    dueDate: z.date(),
    completed: z.boolean().default(false),
    payment: z.number().nonnegative().optional(),
  })).default([]),
  escrowAmount: z.number().nonnegative().optional(),
  disputeResolution: z.record(z.any()).optional(),
});

export type Contract = z.infer<typeof ContractSchema>;