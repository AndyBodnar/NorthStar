import { z } from 'zod';
import { BaseEntitySchema } from './common';

export enum GenerationType {
  WORLD = 'world',
  MEDIA = 'media',
  TIMELINE = 'timeline',
  CAUSAL_MAP = 'causal_map',
  NARRATIVE = 'narrative',
  SIMULATION = 'simulation',
}

export enum MediaType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  MODEL_3D = 'model_3d',
  ANIMATION = 'animation',
  INTERACTIVE = 'interactive',
}

export const GenerationRequestSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(GenerationType),
  requesterId: z.string().uuid(),
  prompt: z.string(),
  parameters: z.record(z.any()).optional(),
  constraints: z.record(z.any()).optional(),
  contextIds: z.array(z.string().uuid()).default([]),
  priority: z.number().min(0).max(10).default(5),
  estimatedDuration: z.number().positive().optional(),
  createdAt: z.date(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
});

export type GenerationRequest = z.infer<typeof GenerationRequestSchema>;

export const GeneratedContentSchema = BaseEntitySchema.extend({
  requestId: z.string().uuid(),
  type: z.nativeEnum(GenerationType),
  mediaType: z.nativeEnum(MediaType).optional(),
  content: z.record(z.any()),
  metadata: z.record(z.any()).optional(),
  quality: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  processingTime: z.number().positive(),
  cost: z.number().nonnegative().optional(),
  attribution: z.array(z.string()).default([]),
  contentUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
});

export type GeneratedContent = z.infer<typeof GeneratedContentSchema>;

export const WorldSchema = BaseEntitySchema.extend({
  name: z.string().max(255),
  description: z.string().optional(),
  creatorId: z.string().uuid(),
  physics: z.record(z.any()).optional(),
  environment: z.record(z.any()).optional(),
  entities: z.array(z.string().uuid()).default([]),
  rules: z.array(z.record(z.any())).default([]),
  state: z.record(z.any()).optional(),
  isPublic: z.boolean().default(false),
  collaborators: z.array(z.string().uuid()).default([]),
});

export type World = z.infer<typeof WorldSchema>;

export const CausalMapSchema = BaseEntitySchema.extend({
  name: z.string().max(255),
  nodes: z.array(z.object({
    id: z.string().uuid(),
    label: z.string(),
    type: z.string(),
    properties: z.record(z.any()).optional(),
  })),
  edges: z.array(z.object({
    id: z.string().uuid(),
    source: z.string().uuid(),
    target: z.string().uuid(),
    type: z.string(),
    weight: z.number().optional(),
    properties: z.record(z.any()).optional(),
  })),
  metadata: z.record(z.any()).optional(),
});

export type CausalMap = z.infer<typeof CausalMapSchema>;