// src/core/securityFeatures.ts
// Security features: Duress Mode, Watch-Only Addresses, Time-Delayed Transactions

export type DuressWalletConfig = {
  enabled: boolean;
  duressPin: string; // PIN that opens decoy wallet
  decoyBalance: number; // Fake balance to show in sompi
  decoyAddress?: string; // Optional custom decoy address
};

export type WatchOnlyAddress = {
  id: string;
  address: string;
  label: string;
  addedAt: number;
};

export type DelayedTransaction = {
  id: string;
  to: string;
  amountSompi: string; // Store as string for bigint serialization
  createdAt: number;
  executeAt: number;
  status: 'pending' | 'executed' | 'cancelled';
};

export type TimeDelayConfig = {
  enabled: boolean;
  thresholdKas: number; // Threshold in KAS (e.g., 1000)
  delayHours: number; // Delay in hours (e.g., 24)
};

export type SecurityFeaturesState = {
  duressMode: DuressWalletConfig;
  watchOnlyAddresses: WatchOnlyAddress[];
  timeDelay: TimeDelayConfig;
  pendingTransactions: DelayedTransaction[];
};

export const DEFAULT_SECURITY_FEATURES: SecurityFeaturesState = {
  duressMode: {
    enabled: false,
    duressPin: '',
    decoyBalance: 5000000000, // 50 KAS in sompi
    decoyAddress: undefined,
  },
  watchOnlyAddresses: [],
  timeDelay: {
    enabled: false,
    thresholdKas: 1000,
    delayHours: 24,
  },
  pendingTransactions: [],
};

// Generate a unique ID for transactions and watch addresses
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Check if a transaction amount exceeds the delay threshold
export function exceedsDelayThreshold(
  amountSompi: bigint,
  config: TimeDelayConfig
): boolean {
  if (!config.enabled) return false;
  const thresholdSompi = BigInt(Math.round(config.thresholdKas * 1e8));
  return amountSompi >= thresholdSompi;
}

// Calculate execution time for delayed transaction
export function calculateExecutionTime(delayHours: number): number {
  return Date.now() + delayHours * 60 * 60 * 1000;
}

// Check if a delayed transaction is ready to execute
export function isTransactionReady(tx: DelayedTransaction): boolean {
  return tx.status === 'pending' && Date.now() >= tx.executeAt;
}

// Format time remaining for a delayed transaction
export function formatTimeRemaining(executeAt: number): string {
  const remaining = executeAt - Date.now();
  if (remaining <= 0) return 'Ready';

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Validate Kaspa address format (basic check)
export function isValidKaspaAddress(address: string): boolean {
  // Kaspa addresses start with 'kaspa:' or 'kaspatest:'
  return (
    (address.startsWith('kaspa:') || address.startsWith('kaspatest:')) &&
    address.length >= 63
  );
}
