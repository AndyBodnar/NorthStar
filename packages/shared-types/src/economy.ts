import { z } from 'zod';
import { BaseEntitySchema } from './common';

export enum CurrencyType {
  FIAT = 'fiat',
  CRYPTO = 'crypto',
  TOKEN = 'token',
  CREDIT = 'credit',
  REPUTATION = 'reputation',
}

export enum TransactionType {
  PAYMENT = 'payment',
  REWARD = 'reward',
  STAKE = 'stake',
  BURN = 'burn',
  MINT = 'mint',
  TRANSFER = 'transfer',
  ESCROW = 'escrow',
  REFUND = 'refund',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
}

export const CurrencySchema = BaseEntitySchema.extend({
  code: z.string().length(3),
  name: z.string().max(255),
  type: z.nativeEnum(CurrencyType),
  decimals: z.number().int().min(0).max(18).default(8),
  symbol: z.string().max(10),
  totalSupply: z.number().nonnegative().optional(),
  maxSupply: z.number().nonnegative().optional(),
  issuerId: z.string().uuid().optional(),
  contractAddress: z.string().optional(),
  chainId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
});

export type Currency = z.infer<typeof CurrencySchema>;

export const WalletSchema = BaseEntitySchema.extend({
  ownerId: z.string().uuid(),
  address: z.string(),
  type: z.enum(['hot', 'cold', 'hardware', 'multisig']),
  balances: z.array(z.object({
    currencyCode: z.string(),
    amount: z.number().nonnegative(),
    lockedAmount: z.number().nonnegative().default(0),
    lastUpdated: z.date(),
  })).default([]),
  isActive: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});

export type Wallet = z.infer<typeof WalletSchema>;

export const TransactionSchema = BaseEntitySchema.extend({
  type: z.nativeEnum(TransactionType),
  status: z.nativeEnum(TransactionStatus),
  fromWalletId: z.string().uuid().optional(),
  toWalletId: z.string().uuid().optional(),
  currencyCode: z.string(),
  amount: z.number().positive(),
  fee: z.number().nonnegative().default(0),
  hash: z.string().optional(),
  blockNumber: z.number().int().nonnegative().optional(),
  confirmations: z.number().int().nonnegative().default(0),
  requiredConfirmations: z.number().int().positive().default(1),
  memo: z.string().optional(),
  reference: z.string().optional(),
  processedAt: z.date().optional(),
  failureReason: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

export const IncentiveSchema = BaseEntitySchema.extend({
  name: z.string().max(255),
  description: z.string().optional(),
  creatorId: z.string().uuid(),
  type: z.enum(['reward', 'penalty', 'bonus', 'multiplier']),
  condition: z.record(z.any()),
  action: z.record(z.any()),
  currencyCode: z.string(),
  amount: z.number(),
  maxClaims: z.number().int().positive().optional(),
  claimsUsed: z.number().int().nonnegative().default(0),
  startDate: z.date(),
  endDate: z.date().optional(),
  isActive: z.boolean().default(true),
  targetAudience: z.array(z.string()).default([]),
  eligibilityRules: z.array(z.record(z.any())).default([]),
});

export type Incentive = z.infer<typeof IncentiveSchema>;

export const MicroValueSchema = BaseEntitySchema.extend({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  action: z.string(),
  value: z.number(),
  currencyCode: z.string(),
  context: z.record(z.any()).optional(),
  timestamp: z.date(),
  batchId: z.string().uuid().optional(),
  isProcessed: z.boolean().default(false),
  processedAt: z.date().optional(),
});

export type MicroValue = z.infer<typeof MicroValueSchema>;

export const MarketplaceItemSchema = BaseEntitySchema.extend({
  title: z.string().max(255),
  description: z.string(),
  sellerId: z.string().uuid(),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  price: z.number().nonnegative(),
  currencyCode: z.string(),
  quantity: z.number().int().positive().default(1),
  availableQuantity: z.number().int().nonnegative(),
  isDigital: z.boolean().default(false),
  media: z.array(z.object({
    type: z.enum(['image', 'video', 'audio', 'document']),
    url: z.string().url(),
    thumbnail: z.string().url().optional(),
  })).default([]),
  attributes: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().nonnegative().default(0),
});

export type MarketplaceItem = z.infer<typeof MarketplaceItemSchema>;