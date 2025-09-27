import { z } from 'zod';
import { BaseEntitySchema } from './common';

export enum MemoryType {
  SHORT_TERM = 'short_term',
  LONG_TERM = 'long_term',
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic',
  PROCEDURAL = 'procedural',
  WORKING = 'working',
}

export enum StateType {
  GLOBAL = 'global',
  USER = 'user',
  SESSION = 'session',
  TEMPORAL = 'temporal',
  CONTEXTUAL = 'contextual',
}

export const MemorySchema = BaseEntitySchema.extend({
  type: z.nativeEnum(MemoryType),
  ownerId: z.string().uuid(),
  content: z.record(z.any()),
  embedding: z.array(z.number()).optional(),
  tags: z.array(z.string()).default([]),
  importance: z.number().min(0).max(1).default(0.5),
  accessCount: z.number().int().nonnegative().default(0),
  lastAccessed: z.date().optional(),
  expiresAt: z.date().optional(),
  isEncrypted: z.boolean().default(false),
  sourceId: z.string().uuid().optional(),
  relatedMemories: z.array(z.string().uuid()).default([]),
});

export type Memory = z.infer<typeof MemorySchema>;

export const StateSchema = BaseEntitySchema.extend({
  type: z.nativeEnum(StateType),
  ownerId: z.string().uuid(),
  namespace: z.string(),
  key: z.string(),
  value: z.any(),
  previousValue: z.any().optional(),
  changeReason: z.string().optional(),
  ttl: z.number().int().positive().optional(),
  isLocked: z.boolean().default(false),
  lockOwnerId: z.string().uuid().optional(),
  checksum: z.string().optional(),
});

export type State = z.infer<typeof StateSchema>;

export const TimeForkSchema = BaseEntitySchema.extend({
  parentForkId: z.string().uuid().optional(),
  name: z.string().max(255),
  description: z.string().optional(),
  creatorId: z.string().uuid(),
  branchPoint: z.date(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
  childForks: z.array(z.string().uuid()).default([]),
});

export type TimeFork = z.infer<typeof TimeForkSchema>;