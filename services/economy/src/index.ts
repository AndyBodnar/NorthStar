import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3009;

// In-memory storage for demonstration
interface Account {
  id: string;
  userId: string;
  type: 'user' | 'agent' | 'service' | 'system';
  balances: Map<string, number>; // currency -> amount
  status: 'active' | 'suspended' | 'closed';
  createdAt: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
}

interface Transaction {
  id: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency: string;
  type: 'transfer' | 'payment' | 'reward' | 'penalty' | 'fee' | 'incentive';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  description: string;
  metadata: Record<string, any>;
  initiatedAt: Date;
  completedAt?: Date;
  feeAmount?: number;
  exchangeRate?: number;
}

interface Currency {
  code: string;
  name: string;
  type: 'fiat' | 'crypto' | 'token' | 'credit';
  exchangeRates: Map<string, number>; // to other currencies
  totalSupply?: number;
  circulatingSupply?: number;
  decimals: number;
  isActive: boolean;
  metadata: Record<string, any>;
}

interface IncentiveProgram {
  id: string;
  name: string;
  description: string;
  type: 'task_completion' | 'quality_bonus' | 'referral' | 'staking' | 'governance';
  rewardCurrency: string;
  rewardAmount: number;
  conditions: Record<string, any>;
  isActive: boolean;
  totalBudget: number;
  remainingBudget: number;
  participants: string[];
  createdAt: Date;
  expiresAt?: Date;
}

interface MarketplaceListing {
  id: string;
  sellerId: string;
  type: 'service' | 'data' | 'compute' | 'storage' | 'ai_model';
  title: string;
  description: string;
  price: {
    amount: number;
    currency: string;
    model: 'fixed' | 'hourly' | 'per_use' | 'auction';
  };
  status: 'active' | 'sold' | 'expired' | 'suspended';
  metadata: Record<string, any>;
  createdAt: Date;
  expiresAt?: Date;
}

interface EconomicMetrics {
  totalTransactionVolume: number;
  totalAccounts: number;
  activeAccounts: number;
  currencyDistribution: Map<string, number>;
  transactionFees: number;
  incentivesPaid: number;
  marketplaceVolume: number;
  lastUpdated: Date;
}

// In-memory stores
const accounts = new Map<string, Account>();
const transactions = new Map<string, Transaction>();
const currencies = new Map<string, Currency>();
const incentivePrograms = new Map<string, IncentiveProgram>();
const marketplaceListings = new Map<string, MarketplaceListing>();

// Initialize sample data
const initializeSampleData = () => {
  // Sample currencies
  const sampleCurrencies: Currency[] = [
    {
      code: 'NST',
      name: 'North Star Token',
      type: 'token',
      exchangeRates: new Map([['USD', 1.5], ['EUR', 1.3], ['BTC', 0.000035]]),
      totalSupply: 1000000,
      circulatingSupply: 750000,
      decimals: 18,
      isActive: true,
      metadata: { blockchain: 'ethereum', contract: '0x123...', symbol: 'NST' }
    },
    {
      code: 'USD',
      name: 'US Dollar',
      type: 'fiat',
      exchangeRates: new Map([['NST', 0.67], ['EUR', 0.85], ['BTC', 0.000023]]),
      decimals: 2,
      isActive: true,
      metadata: { iso_code: 'USD', country: 'United States' }
    },
    {
      code: 'CRD',
      name: 'Compute Credits',
      type: 'credit',
      exchangeRates: new Map([['NST', 0.1], ['USD', 0.15]]),
      decimals: 0,
      isActive: true,
      metadata: { purpose: 'compute_resources', transferable: false }
    }
  ];

  sampleCurrencies.forEach(currency => currencies.set(currency.code, currency));

  // Sample accounts
  const sampleAccounts: Account[] = [
    {
      id: uuidv4(),
      userId: 'user-001',
      type: 'user',
      balances: new Map([['NST', 1000], ['USD', 500], ['CRD', 50]]),
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 30),
      lastActivity: new Date(),
      metadata: { tier: 'premium', referralCode: 'USER001' }
    },
    {
      id: uuidv4(),
      userId: 'agent-analytics-01',
      type: 'agent',
      balances: new Map([['NST', 2500], ['CRD', 100]]),
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 15),
      lastActivity: new Date(),
      metadata: { agentType: 'analytics', performanceRating: 4.8 }
    },
    {
      id: uuidv4(),
      userId: 'system',
      type: 'system',
      balances: new Map([['NST', 50000], ['USD', 25000], ['CRD', 10000]]),
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 60),
      lastActivity: new Date(),
      metadata: { purpose: 'system_operations', autoRecharge: true }
    }
  ];

  sampleAccounts.forEach(account => accounts.set(account.id, account));

  // Sample incentive programs
  const sampleIncentives: IncentiveProgram[] = [
    {
      id: uuidv4(),
      name: 'Quality Task Completion Bonus',
      description: 'Bonus rewards for completing tasks with high quality ratings',
      type: 'quality_bonus',
      rewardCurrency: 'NST',
      rewardAmount: 10,
      conditions: { minQualityRating: 4.5, taskType: 'any' },
      isActive: true,
      totalBudget: 10000,
      remainingBudget: 8500,
      participants: [],
      createdAt: new Date(Date.now() - 86400000 * 7)
    },
    {
      id: uuidv4(),
      name: 'New User Referral Program',
      description: 'Earn NST for referring new users to the platform',
      type: 'referral',
      rewardCurrency: 'NST',
      rewardAmount: 25,
      conditions: { newUserMustComplete: 'onboarding', minActivityDays: 7 },
      isActive: true,
      totalBudget: 5000,
      remainingBudget: 4750,
      participants: [],
      createdAt: new Date(Date.now() - 86400000 * 14)
    }
  ];

  sampleIncentives.forEach(incentive => incentivePrograms.set(incentive.id, incentive));

  // Sample marketplace listings
  const sampleListings: MarketplaceListing[] = [
    {
      id: uuidv4(),
      sellerId: 'agent-analytics-01',
      type: 'service',
      title: 'Advanced Data Analytics Service',
      description: 'Professional data analysis and insights generation',
      price: { amount: 50, currency: 'NST', model: 'per_use' },
      status: 'active',
      metadata: { category: 'analytics', rating: 4.8, completedOrders: 23 },
      createdAt: new Date(Date.now() - 86400000 * 3)
    },
    {
      id: uuidv4(),
      sellerId: 'user-001',
      type: 'data',
      title: 'Cleaned Customer Dataset (10K records)',
      description: 'High-quality customer behavior dataset with demographics',
      price: { amount: 200, currency: 'NST', model: 'fixed' },
      status: 'active',
      metadata: { category: 'datasets', dataType: 'customer_behavior', records: 10000 },
      createdAt: new Date(Date.now() - 86400000 * 1)
    }
  ];

  sampleListings.forEach(listing => marketplaceListings.set(listing.id, listing));
};

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:4000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const metrics = calculateEconomicMetrics();

  res.json({
    status: 'healthy',
    service: 'economy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    metrics: {
      totalAccounts: accounts.size,
      totalTransactions: transactions.size,
      supportedCurrencies: currencies.size,
      activeIncentives: Array.from(incentivePrograms.values()).filter(p => p.isActive).length,
      marketplaceListings: marketplaceListings.size,
      economicHealth: metrics
    }
  });
});

// Account management endpoints
app.get('/accounts', (req, res) => {
  const accountList = Array.from(accounts.values());
  const { type, status } = req.query;

  let filtered = accountList;
  if (type) filtered = filtered.filter(acc => acc.type === type);
  if (status) filtered = filtered.filter(acc => acc.status === status);

  // Convert Map to object for JSON serialization
  const accountsWithBalances = filtered.map(acc => ({
    ...acc,
    balances: Object.fromEntries(acc.balances)
  }));

  res.json({
    accounts: accountsWithBalances,
    total: accountsWithBalances.length,
    summary: {
      byType: getAccountSummaryByType(accountList),
      byStatus: getAccountSummaryByStatus(accountList)
    }
  });
});

app.get('/accounts/:id', (req, res) => {
  const account = accounts.get(req.params.id);
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  res.json({
    ...account,
    balances: Object.fromEntries(account.balances)
  });
});

app.post('/accounts', (req, res) => {
  const { userId, type, initialBalances } = req.body;

  if (!userId || !type) {
    return res.status(400).json({ error: 'Missing required fields: userId, type' });
  }

  const account: Account = {
    id: uuidv4(),
    userId,
    type,
    balances: new Map(Object.entries(initialBalances || {})),
    status: 'active',
    createdAt: new Date(),
    lastActivity: new Date(),
    metadata: {}
  };

  accounts.set(account.id, account);

  res.status(201).json({
    ...account,
    balances: Object.fromEntries(account.balances)
  });
});

// Transaction endpoints
app.get('/transactions', (req, res) => {
  const transactionList = Array.from(transactions.values());
  const { status, type, currency, account } = req.query;

  let filtered = transactionList;
  if (status) filtered = filtered.filter(tx => tx.status === status);
  if (type) filtered = filtered.filter(tx => tx.type === type);
  if (currency) filtered = filtered.filter(tx => tx.currency === currency);
  if (account) {
    filtered = filtered.filter(tx => tx.fromAccount === account || tx.toAccount === account);
  }

  // Sort by most recent first
  filtered.sort((a, b) => b.initiatedAt.getTime() - a.initiatedAt.getTime());

  res.json({
    transactions: filtered,
    total: filtered.length,
    summary: getTransactionSummary(transactionList)
  });
});

app.post('/transactions', (req, res) => {
  const { fromAccount, toAccount, amount, currency, type, description, metadata } = req.body;

  if (!fromAccount || !toAccount || !amount || !currency || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate accounts exist
  const fromAcc = accounts.get(fromAccount);
  const toAcc = accounts.get(toAccount);

  if (!fromAcc || !toAcc) {
    return res.status(404).json({ error: 'One or more accounts not found' });
  }

  // Check sufficient balance
  const currentBalance = fromAcc.balances.get(currency) || 0;
  if (currentBalance < amount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  const transaction: Transaction = {
    id: uuidv4(),
    fromAccount,
    toAccount,
    amount,
    currency,
    type,
    status: 'pending',
    description: description || '',
    metadata: metadata || {},
    initiatedAt: new Date()
  };

  // Process transaction
  const result = processTransaction(transaction);

  transactions.set(transaction.id, transaction);
  res.status(201).json(result);
});

app.get('/transactions/:id', (req, res) => {
  const transaction = transactions.get(req.params.id);
  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.json(transaction);
});

// Currency endpoints
app.get('/currencies', (req, res) => {
  const currencyList = Array.from(currencies.values()).map(currency => ({
    ...currency,
    exchangeRates: Object.fromEntries(currency.exchangeRates)
  }));

  res.json({
    currencies: currencyList,
    total: currencyList.length
  });
});

app.get('/currencies/:code/exchange', (req, res) => {
  const { code } = req.params;
  const { to, amount } = req.query;

  const currency = currencies.get(code);
  if (!currency) {
    return res.status(404).json({ error: 'Currency not found' });
  }

  if (!to || !amount) {
    return res.status(400).json({ error: 'Missing required parameters: to, amount' });
  }

  const exchangeRate = currency.exchangeRates.get(to.toString());
  if (!exchangeRate) {
    return res.status(400).json({ error: `Exchange rate not available for ${code} to ${to}` });
  }

  const convertedAmount = parseFloat(amount.toString()) * exchangeRate;

  res.json({
    from: code,
    to: to.toString(),
    amount: parseFloat(amount.toString()),
    exchangeRate,
    convertedAmount,
    timestamp: new Date().toISOString()
  });
});

// Incentive program endpoints
app.get('/incentives', (req, res) => {
  const incentiveList = Array.from(incentivePrograms.values());
  const { type, active } = req.query;

  let filtered = incentiveList;
  if (type) filtered = filtered.filter(inc => inc.type === type);
  if (active === 'true') filtered = filtered.filter(inc => inc.isActive);

  res.json({
    incentives: filtered,
    total: filtered.length
  });
});

app.post('/incentives/claim', (req, res) => {
  const { incentiveId, accountId, evidence } = req.body;

  if (!incentiveId || !accountId) {
    return res.status(400).json({ error: 'Missing required fields: incentiveId, accountId' });
  }

  const incentive = incentivePrograms.get(incentiveId);
  const account = accounts.get(accountId);

  if (!incentive || !account) {
    return res.status(404).json({ error: 'Incentive program or account not found' });
  }

  if (!incentive.isActive) {
    return res.status(400).json({ error: 'Incentive program is not active' });
  }

  if (incentive.remainingBudget < incentive.rewardAmount) {
    return res.status(400).json({ error: 'Insufficient incentive budget' });
  }

  // Validate conditions (simplified)
  const conditionsMet = validateIncentiveConditions(incentive, account, evidence);
  if (!conditionsMet) {
    return res.status(400).json({ error: 'Incentive conditions not met' });
  }

  // Award incentive
  const currentBalance = account.balances.get(incentive.rewardCurrency) || 0;
  account.balances.set(incentive.rewardCurrency, currentBalance + incentive.rewardAmount);

  incentive.remainingBudget -= incentive.rewardAmount;
  incentive.participants.push(accountId);

  accounts.set(accountId, account);
  incentivePrograms.set(incentiveId, incentive);

  // Create transaction record
  const systemAccount = Array.from(accounts.values()).find(acc => acc.type === 'system');
  if (systemAccount) {
    const rewardTransaction: Transaction = {
      id: uuidv4(),
      fromAccount: systemAccount.id,
      toAccount: accountId,
      amount: incentive.rewardAmount,
      currency: incentive.rewardCurrency,
      type: 'incentive',
      status: 'completed',
      description: `Incentive reward: ${incentive.name}`,
      metadata: { incentiveId, evidence },
      initiatedAt: new Date(),
      completedAt: new Date()
    };

    transactions.set(rewardTransaction.id, rewardTransaction);
  }

  res.json({
    success: true,
    rewardAmount: incentive.rewardAmount,
    currency: incentive.rewardCurrency,
    newBalance: account.balances.get(incentive.rewardCurrency)
  });
});

// Marketplace endpoints
app.get('/marketplace', (req, res) => {
  const listings = Array.from(marketplaceListings.values());
  const { type, status, currency } = req.query;

  let filtered = listings;
  if (type) filtered = filtered.filter(listing => listing.type === type);
  if (status) filtered = filtered.filter(listing => listing.status === status);
  if (currency) filtered = filtered.filter(listing => listing.price.currency === currency);

  res.json({
    listings: filtered,
    total: filtered.length,
    summary: getMarketplaceSummary(listings)
  });
});

app.post('/marketplace', (req, res) => {
  const { sellerId, type, title, description, price } = req.body;

  if (!sellerId || !type || !title || !price) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const listing: MarketplaceListing = {
    id: uuidv4(),
    sellerId,
    type,
    title,
    description: description || '',
    price,
    status: 'active',
    metadata: {},
    createdAt: new Date()
  };

  marketplaceListings.set(listing.id, listing);
  res.status(201).json(listing);
});

app.post('/marketplace/:id/purchase', (req, res) => {
  const { buyerAccountId } = req.body;
  const listing = marketplaceListings.get(req.params.id);

  if (!listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  if (listing.status !== 'active') {
    return res.status(400).json({ error: 'Listing is not available for purchase' });
  }

  const buyerAccount = accounts.get(buyerAccountId);
  if (!buyerAccount) {
    return res.status(404).json({ error: 'Buyer account not found' });
  }

  const sellerAccount = Array.from(accounts.values()).find(acc => acc.userId === listing.sellerId);
  if (!sellerAccount) {
    return res.status(404).json({ error: 'Seller account not found' });
  }

  // Check buyer balance
  const buyerBalance = buyerAccount.balances.get(listing.price.currency) || 0;
  if (buyerBalance < listing.price.amount) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  // Process purchase transaction
  const purchaseTransaction: Transaction = {
    id: uuidv4(),
    fromAccount: buyerAccount.id,
    toAccount: sellerAccount.id,
    amount: listing.price.amount,
    currency: listing.price.currency,
    type: 'payment',
    status: 'completed',
    description: `Purchase: ${listing.title}`,
    metadata: { listingId: listing.id, marketplacePurchase: true },
    initiatedAt: new Date(),
    completedAt: new Date()
  };

  // Update balances
  buyerAccount.balances.set(listing.price.currency, buyerBalance - listing.price.amount);
  const sellerBalance = sellerAccount.balances.get(listing.price.currency) || 0;
  sellerAccount.balances.set(listing.price.currency, sellerBalance + listing.price.amount);

  // Update listing status
  listing.status = 'sold';

  // Save changes
  accounts.set(buyerAccount.id, buyerAccount);
  accounts.set(sellerAccount.id, sellerAccount);
  transactions.set(purchaseTransaction.id, purchaseTransaction);
  marketplaceListings.set(listing.id, listing);

  res.json({
    success: true,
    transaction: purchaseTransaction,
    listing
  });
});

// Analytics endpoints
app.get('/analytics/economic-metrics', (req, res) => {
  const metrics = calculateEconomicMetrics();
  res.json(metrics);
});

// Utility functions
function processTransaction(transaction: Transaction): Transaction {
  try {
    const fromAccount = accounts.get(transaction.fromAccount)!;
    const toAccount = accounts.get(transaction.toAccount)!;

    // Update balances
    const fromBalance = fromAccount.balances.get(transaction.currency) || 0;
    const toBalance = toAccount.balances.get(transaction.currency) || 0;

    fromAccount.balances.set(transaction.currency, fromBalance - transaction.amount);
    toAccount.balances.set(transaction.currency, toBalance + transaction.amount);

    // Update last activity
    fromAccount.lastActivity = new Date();
    toAccount.lastActivity = new Date();

    // Save accounts
    accounts.set(fromAccount.id, fromAccount);
    accounts.set(toAccount.id, toAccount);

    // Update transaction status
    transaction.status = 'completed';
    transaction.completedAt = new Date();

    return transaction;
  } catch (error) {
    transaction.status = 'failed';
    return transaction;
  }
}

function validateIncentiveConditions(incentive: IncentiveProgram, account: Account, evidence: any): boolean {
  // Simplified validation - in real implementation this would be more sophisticated
  return true;
}

function calculateEconomicMetrics(): EconomicMetrics {
  const accountList = Array.from(accounts.values());
  const transactionList = Array.from(transactions.values());

  const totalVolume = transactionList
    .filter(tx => tx.status === 'completed')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const activeAccounts = accountList.filter(acc =>
    acc.lastActivity.getTime() > Date.now() - 86400000 * 30 // Active in last 30 days
  ).length;

  const currencyDistribution = new Map<string, number>();
  accountList.forEach(account => {
    account.balances.forEach((amount, currency) => {
      currencyDistribution.set(currency, (currencyDistribution.get(currency) || 0) + amount);
    });
  });

  return {
    totalTransactionVolume: totalVolume,
    totalAccounts: accountList.length,
    activeAccounts,
    currencyDistribution,
    transactionFees: transactionList.reduce((sum, tx) => sum + (tx.feeAmount || 0), 0),
    incentivesPaid: transactionList
      .filter(tx => tx.type === 'incentive' && tx.status === 'completed')
      .reduce((sum, tx) => sum + tx.amount, 0),
    marketplaceVolume: transactionList
      .filter(tx => tx.metadata?.marketplacePurchase && tx.status === 'completed')
      .reduce((sum, tx) => sum + tx.amount, 0),
    lastUpdated: new Date()
  };
}

function getAccountSummaryByType(accounts: Account[]) {
  return {
    user: accounts.filter(acc => acc.type === 'user').length,
    agent: accounts.filter(acc => acc.type === 'agent').length,
    service: accounts.filter(acc => acc.type === 'service').length,
    system: accounts.filter(acc => acc.type === 'system').length
  };
}

function getAccountSummaryByStatus(accounts: Account[]) {
  return {
    active: accounts.filter(acc => acc.status === 'active').length,
    suspended: accounts.filter(acc => acc.status === 'suspended').length,
    closed: accounts.filter(acc => acc.status === 'closed').length
  };
}

function getTransactionSummary(transactions: Transaction[]) {
  return {
    byStatus: {
      pending: transactions.filter(tx => tx.status === 'pending').length,
      processing: transactions.filter(tx => tx.status === 'processing').length,
      completed: transactions.filter(tx => tx.status === 'completed').length,
      failed: transactions.filter(tx => tx.status === 'failed').length,
      cancelled: transactions.filter(tx => tx.status === 'cancelled').length
    },
    byType: {
      transfer: transactions.filter(tx => tx.type === 'transfer').length,
      payment: transactions.filter(tx => tx.type === 'payment').length,
      reward: transactions.filter(tx => tx.type === 'reward').length,
      penalty: transactions.filter(tx => tx.type === 'penalty').length,
      fee: transactions.filter(tx => tx.type === 'fee').length,
      incentive: transactions.filter(tx => tx.type === 'incentive').length
    }
  };
}

function getMarketplaceSummary(listings: MarketplaceListing[]) {
  return {
    byType: {
      service: listings.filter(l => l.type === 'service').length,
      data: listings.filter(l => l.type === 'data').length,
      compute: listings.filter(l => l.type === 'compute').length,
      storage: listings.filter(l => l.type === 'storage').length,
      ai_model: listings.filter(l => l.type === 'ai_model').length
    },
    byStatus: {
      active: listings.filter(l => l.status === 'active').length,
      sold: listings.filter(l => l.status === 'sold').length,
      expired: listings.filter(l => l.status === 'expired').length,
      suspended: listings.filter(l => l.status === 'suspended').length
    }
  };
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'North Star Economy Service',
    version: '1.0.0',
    description: 'Multi-Currency Transactions, Incentives, and Marketplace Service',
    endpoints: {
      health: '/health',
      accounts: '/accounts',
      transactions: '/transactions',
      currencies: '/currencies',
      incentives: '/incentives',
      marketplace: '/marketplace',
      analytics: '/analytics/economic-metrics'
    },
    capabilities: [
      'multi-currency-support',
      'transaction-processing',
      'incentive-management',
      'marketplace-operations',
      'economic-analytics',
      'currency-exchange'
    ]
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Start server
async function startServer() {
  try {
    // Initialize sample data
    initializeSampleData();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`Economy Service running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('Service endpoints available:');
      console.log(`  Health: http://localhost:${PORT}/health`);
      console.log(`  Accounts: http://localhost:${PORT}/accounts`);
      console.log(`  Transactions: http://localhost:${PORT}/transactions`);
      console.log(`  Marketplace: http://localhost:${PORT}/marketplace`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}. Starting graceful shutdown...`);
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });

      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start Economy Service:', error);
    process.exit(1);
  }
}

// Auto-register with API Gateway
async function registerWithGateway() {
  if (!process.env.GATEWAY_URL) {
    console.log('No gateway URL configured, skipping registration');
    return;
  }

  try {
    const axios = require('axios');
    const registration = {
      id: process.env.SERVICE_ID || 'economy',
      name: process.env.SERVICE_NAME || 'Economy Service',
      url: `http://localhost:${PORT}`,
      healthCheck: `http://localhost:${PORT}/health`,
      version: '1.0.0',
      tags: ['economy', 'transactions', 'currency', 'marketplace', 'incentives']
    };

    await axios.post(`${process.env.GATEWAY_URL}/register`, registration);
    console.log(`Registered with API Gateway at ${process.env.GATEWAY_URL}`);

  } catch (error) {
    console.error('Failed to register with API Gateway:', error);
  }
}

// Start the service
startServer().then(() => {
  setTimeout(registerWithGateway, 5000);
});

export default app;