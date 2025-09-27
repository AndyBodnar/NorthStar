import { z } from 'zod';
import { BaseEntitySchema } from './common';

export enum InteractionType {
  VOICE = 'voice',
  TEXT = 'text',
  GESTURE = 'gesture',
  HAPTIC = 'haptic',
  VISUAL = 'visual',
  HOLOGRAPHIC = 'holographic',
  NEURAL = 'neural',
}

export enum PresenceType {
  AVATAR = 'avatar',
  HOLOGRAM = 'hologram',
  VOICE_ONLY = 'voice_only',
  TEXT_ONLY = 'text_only',
  MIXED_REALITY = 'mixed_reality',
}

export const InteractionSessionSchema = BaseEntitySchema.extend({
  name: z.string().max(255).optional(),
  type: z.nativeEnum(InteractionType),
  participants: z.array(z.string().uuid()),
  hostId: z.string().uuid(),
  maxParticipants: z.number().int().positive().optional(),
  isPrivate: z.boolean().default(true),
  requiresInvite: z.boolean().default(false),
  settings: z.record(z.any()).optional(),
  startedAt: z.date(),
  endedAt: z.date().optional(),
  isActive: z.boolean().default(true),
  recordingEnabled: z.boolean().default(false),
  encryptionEnabled: z.boolean().default(true),
});

export type InteractionSession = z.infer<typeof InteractionSessionSchema>;

export const MessageSchema = BaseEntitySchema.extend({
  sessionId: z.string().uuid(),
  senderId: z.string().uuid(),
  content: z.record(z.any()),
  type: z.nativeEnum(InteractionType),
  timestamp: z.date(),
  threadId: z.string().uuid().optional(),
  replyToId: z.string().uuid().optional(),
  mentions: z.array(z.string().uuid()).default([]),
  reactions: z.array(z.object({
    userId: z.string().uuid(),
    emoji: z.string(),
    timestamp: z.date(),
  })).default([]),
  isEdited: z.boolean().default(false),
  isDeleted: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
});

export type Message = z.infer<typeof MessageSchema>;

export const PresenceSchema = BaseEntitySchema.extend({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.nativeEnum(PresenceType),
  status: z.enum(['online', 'away', 'busy', 'offline']),
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number().optional(),
  }).optional(),
  orientation: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
    w: z.number(),
  }).optional(),
  avatar: z.record(z.any()).optional(),
  capabilities: z.array(z.string()).default([]),
  lastSeen: z.date(),
  metadata: z.record(z.any()).optional(),
});

export type Presence = z.infer<typeof PresenceSchema>;

export const HolographicObjectSchema = BaseEntitySchema.extend({
  sessionId: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string().max(255),
  modelUrl: z.string().url(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
  rotation: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
    w: z.number(),
  }),
  scale: z.object({
    x: z.number().positive(),
    y: z.number().positive(),
    z: z.number().positive(),
  }),
  isVisible: z.boolean().default(true),
  isInteractable: z.boolean().default(true),
  permissions: z.array(z.string()).default([]),
  animations: z.array(z.string()).default([]),
  properties: z.record(z.any()).optional(),
});

export type HolographicObject = z.infer<typeof HolographicObjectSchema>;