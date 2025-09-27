import { z } from 'zod';
import { BaseEntitySchema } from './common';

export enum ActorType {
  HUMAN = 'human',
  PERSONA = 'persona',
  AGENT = 'agent',
  GROUP = 'group',
  SYSTEM = 'system',
}

export const IdentitySchema = BaseEntitySchema.extend({
  type: z.nativeEnum(ActorType),
  name: z.string().min(1).max(255),
  displayName: z.string().max(255).optional(),
  email: z.string().email().optional(),
  avatar: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
  parentId: z.string().uuid().optional(), // For nested groups or persona hierarchies
  capabilities: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
});

export type Identity = z.infer<typeof IdentitySchema>;

export const AuthTokenSchema = z.object({
  token: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.date(),
  scope: z.array(z.string()).default([]),
  identityId: z.string().uuid(),
});

export type AuthToken = z.infer<typeof AuthTokenSchema>;

export const SessionSchema = z.object({
  id: z.string().uuid(),
  identityId: z.string().uuid(),
  deviceId: z.string().optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  createdAt: z.date(),
  lastAccessedAt: z.date(),
  expiresAt: z.date(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});

export type Session = z.infer<typeof SessionSchema>;