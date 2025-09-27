import { z } from 'zod';
import { BaseEntitySchema } from './common';

export enum SensorType {
  BIOMETRIC = 'biometric',
  EMOTIONAL = 'emotional',
  SPATIAL_3D = 'spatial_3d',
  ENVIRONMENTAL = 'environmental',
  AUDIO = 'audio',
  VISUAL = 'visual',
  HAPTIC = 'haptic',
  MOTION = 'motion',
}

export enum BiometricType {
  HEART_RATE = 'heart_rate',
  BLOOD_PRESSURE = 'blood_pressure',
  SKIN_CONDUCTANCE = 'skin_conductance',
  TEMPERATURE = 'temperature',
  EEG = 'eeg',
  EOG = 'eog',
  EMG = 'emg',
}

export const SensorDataSchema = BaseEntitySchema.extend({
  sensorType: z.nativeEnum(SensorType),
  sourceId: z.string().uuid(),
  ownerId: z.string().uuid(),
  data: z.record(z.any()),
  timestamp: z.date(),
  location: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number().optional(),
  }).optional(),
  confidence: z.number().min(0).max(1).optional(),
  calibrationData: z.record(z.any()).optional(),
  processingFlags: z.array(z.string()).default([]),
  sessionId: z.string().uuid().optional(),
});

export type SensorData = z.infer<typeof SensorDataSchema>;

export const EmotionalStateSchema = z.object({
  valence: z.number().min(-1).max(1), // pleasure/displeasure
  arousal: z.number().min(0).max(1),  // activation level
  dominance: z.number().min(0).max(1), // control
  emotions: z.record(z.number().min(0).max(1)), // emotion -> intensity map
  confidence: z.number().min(0).max(1),
  timestamp: z.date(),
  sourceIds: z.array(z.string().uuid()),
});

export type EmotionalState = z.infer<typeof EmotionalStateSchema>;

export const Spatial3DSchema = z.object({
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
  }).optional(),
  velocity: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }).optional(),
  acceleration: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }).optional(),
});

export type Spatial3D = z.infer<typeof Spatial3DSchema>;