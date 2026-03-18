// @noxu/core - Shared business logic for NoXu Wallet

// Platform abstraction
export {
  type CryptoProvider,
  type StorageProvider,
  setCryptoProvider,
  getCryptoProvider,
} from "./platform";

// Wallet
export { Wallet, type WalletState } from "./wallet";

// Networks
export {
  type KaspaNetwork,
  type NetworkConfig,
  type CustomRpcUrls,
  getEffectiveRpcUrl,
  getNetworkConfig,
  NETWORKS,
  DEFAULT_NETWORK,
} from "./networks";

// Crypto
export {
  createMnemonic,
  mnemonicToSeed,
  deriveAccountFromSeed,
  DERIVATION_PATH,
  type DerivedAccount,
  type WalletSeed,
} from "./crypto/mnemonic";
export {
  encryptSecret,
  decryptSecret,
  needsMigration,
  migrateEncryption,
  type EncryptedPayload,
} from "./crypto/encryption";
export { wipeBytes } from "./crypto/secure";

// Kaspa client
export {
  KaspaClient,
  type KaspaUTXO,
  type KaspaTx,
} from "./kaspa/client";

// Transaction building
export {
  createSignedTransaction,
  buildTransaction,
  signTransaction,
  selectUtxos,
  calculateFee,
  calculateTransactionId,
  addressToScriptPublicKey,
  decodeKaspaAddress,
  createP2PKScript,
  serializeForBroadcast,
  type Transaction,
  type TransactionInput,
  type TransactionOutput,
  type ScriptPublicKey,
  type TransactionBuilderOptions,
} from "./kaspa/transaction";

// KRC-20
export {
  KRC20Client,
  KRC20TransferClient,
  formatTokenBalance,
  parseTokenAmount,
  createTransferInscription,
  serializeInscription as serializeKRC20Inscription,
  type KRC20Balance,
  type KRC20TokenInfo,
  type KRC20TransferResult,
} from "./kaspa/krc20-client";
export {
  createKRC20Transfer,
  estimateKRC20TransferCost,
  type KRC20TransferOptions,
  type KRC20TransferResult as KRC20TxResult,
} from "./kaspa/krc20-transaction";

// Price client
export {
  getKaspaPrice,
  getKaspaPriceHistory,
  getTokenPriceHistory,
  getKrc20Price,
  getTopKrc20Tokens,
  getTopKrc20TokensByGainers,
  getTokenImage,
  batchFetchHistoricalPrices,
  KAS_LOGO_URL,
  type KaspaPrice,
  type PricePoint,
  type TokenPrice,
  type TrendingToken,
} from "./kaspa/price-client";

// Tokens
export {
  getStaticTokens,
  type TokenMeta,
  type TokenKind,
} from "./tokens";

// Security features
export {
  DEFAULT_SECURITY_FEATURES,
  generateId,
  exceedsDelayThreshold,
  calculateExecutionTime,
  isTransactionReady,
  formatTimeRemaining,
  isValidKaspaAddress,
  type SecurityFeaturesState,
  type DuressWalletConfig,
  type WatchOnlyAddress,
  type AddressBookEntry,
  type AddressBook,
  type DelayedTransaction,
  type TimeDelayConfig,
} from "./securityFeatures";
