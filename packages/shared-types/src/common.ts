import { z } from 'zod';

export const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().positive(),
});

export type BaseEntity = z.infer<typeof BaseEntitySchema>;

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  orderBy: z.string().optional(),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    totalCount: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    currentPage: z.number().int().positive(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  });

export type PaginatedResponse<T> = {
  items: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export const APIErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.any()).optional(),
  timestamp: z.date(),
  requestId: z.string().uuid(),
});

export type APIError = z.infer<typeof APIErrorSchema>;

export enum EventType {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  STATE_CHANGED = 'state_changed',
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked',
}

export const EventSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(EventType),
  entityId: z.string().uuid(),
  entityType: z.string(),
  payload: z.record(z.any()),
  metadata: z.record(z.string()).optional(),
  timestamp: z.date(),
  actorId: z.string().uuid().optional(),
});

export type Event = z.infer<typeof EventSchema>;