// src/background/index.ts

import browser from "webextension-polyfill";
import {
  Wallet,
  DEFAULT_NETWORK,
  getNetworkConfig,
  KaspaClient,
  KRC20TransferClient,
  parseTokenAmount,
  getKaspaPrice,
  getKaspaPriceHistory,
  getTokenPriceHistory,
  getKrc20Price,
  getTopKrc20Tokens,
  getTopKrc20TokensByGainers,
  batchFetchHistoricalPrices,
  DEFAULT_SECURITY_FEATURES,
  generateId,
  exceedsDelayThreshold,
  calculateExecutionTime,
  isTransactionReady,
  isValidKaspaAddress,
  buildTransaction,
  selectUtxos,
  serializeForBroadcast,
  calculateTransactionId,
  type SecurityFeaturesState,
  type WatchOnlyAddress,
  type DelayedTransaction,
  type AddressBook,
  type AddressBookEntry,
} from "@noxu/core";
import { initWebCrypto } from "../platform/crypto-provider";
import type { RpcMessage } from "../messages";

// Initialize web crypto provider before any encryption operations
initWebCrypto();

// Console security warning (shows in service worker console)
console.warn(
  "%c⚠️ SECURITY WARNING",
  "color: red; font-size: 20px; font-weight: bold;"
);
console.warn(
  "%cIf someone told you to paste something here, it is a SCAM. NoXu support will NEVER ask you to use the console.",
  "font-size: 14px; color: orange;"
);

const STORAGE_KEY = "kaspa_wallet_state";
const SETTINGS_KEY = "kaspa_wallet_settings";
const SECURITY_KEY = "kaspa_security_features";
const ADDRESS_BOOK_KEY = "kaspa_address_book";
const PNL_DATA_KEY = "kaspa_pnl_data";

// ==================== PENDING dApp CONNECT REQUESTS ====================
let pendingConnectOrigin: string | null = null;

// ==================== PASSWORD RATE LIMITING ====================
const MAX_UNLOCK_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000; // 1 minute lockout
let unlockAttempts = 0;
let lockoutUntil = 0;

// ==================== PNL TYPES ====================

type CostBasisLot = {
  id: string;
  txid: string;
  asset: string;
  amountRaw: number;
  remainingRaw: number;
  pricePerUnit: number;
  currency: string;
  timestamp: number;
};

type RealizedPnlEvent = {
  txid: string;
  asset: string;
  amountRaw: number;
  costBasis: number;
  proceeds: number;
  pnl: number;
  currency: string;
  timestamp: number;
};

type AssetPnlSummary = {
  asset: string;
  totalCostBasis: number;
  weightedAvgPrice: number;
  currentHolding: number;
  realizedPnl: number;
  realizedTxCount: number;
  totalBought: number;
  totalSold: number;
  avgBuyPrice: number;
  avgSellPrice: number;
};

type PnlData = {
  version: number;
  address: string;
  lots: CostBasisLot[];
  realizedEvents: RealizedPnlEvent[];
  summaries: Record<string, AssetPnlSummary>;
  lastProcessedTxid: string | null;
  backfillComplete: boolean;
  currency: string;
};

const DEFAULT_PNL_DATA: PnlData = {
  version: 1,
  address: "",
  lots: [],
  realizedEvents: [],
  summaries: {},
  lastProcessedTxid: null,
  backfillComplete: false,
  currency: "usd",
};

// Default auto-lock timeout in minutes (0 = disabled)
const DEFAULT_AUTO_LOCK_MINUTES = 2;

type WalletSettings = {
  autoLockMinutes: number;
  kasFyiApiKey: string;
  currency: string;
};

// Single wallet instance for this background context
const wallet = new Wallet(DEFAULT_NETWORK);

// Settings with defaults
let settings: WalletSettings = {
  autoLockMinutes: DEFAULT_AUTO_LOCK_MINUTES,
  kasFyiApiKey: "",
  currency: "usd",
};

// Security features state
let securityFeatures: SecurityFeaturesState = { ...DEFAULT_SECURITY_FEATURES };

// Address book state
let addressBook: AddressBook = { entries: [] };

// PnL tracking state
let pnlData: PnlData = { ...DEFAULT_PNL_DATA };

// Track if currently in duress mode (decoy wallet active)
let isDuressMode = false;

// Auto-lock timer
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

// Delayed transaction check timer
let delayedTxTimer: ReturnType<typeof setInterval> | null = null;

// Origins that have been approved to connect to the wallet
const approvedOrigins = new Set<string>();

/**
 * Reset the auto-lock timer. Call this on any user activity.
 */
function resetAutoLockTimer() {
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }

  if (settings.autoLockMinutes > 0) {
    autoLockTimer = setTimeout(() => {
      wallet.lock();
    }, settings.autoLockMinutes * 60 * 1000);
  }
}

/**
 * Load settings from browser.storage.local
 */
async function loadSettings(): Promise<void> {
  try {
    const res = await browser.storage.local.get([SETTINGS_KEY]);
    const raw = res?.[SETTINGS_KEY];

    if (raw && typeof raw === "object") {
      const r = raw as Record<string, unknown>;
      if (typeof r.autoLockMinutes === "number" && r.autoLockMinutes >= 0) {
        settings.autoLockMinutes = r.autoLockMinutes;
      }
      if (typeof r.kasFyiApiKey === "string") {
        settings.kasFyiApiKey = r.kasFyiApiKey;
      }
      if (typeof r.currency === "string" && r.currency.length > 0) {
        settings.currency = r.currency;
      }
    }
  } catch (err) {
    console.error("[wallet] Failed to load settings:", err);
  }
}

/**
 * Persist settings to browser.storage.local
 */
async function persistSettings(): Promise<void> {
  try {
    await browser.storage.local.set({ [SETTINGS_KEY]: settings });
  } catch (err) {
    console.error("[wallet] Failed to persist settings:", err);
  }
}

/**
 * Load security features from browser.storage.local
 */
async function loadSecurityFeatures(): Promise<void> {
  try {
    const res = await browser.storage.local.get([SECURITY_KEY]);
    const raw = res?.[SECURITY_KEY];

    if (raw && typeof raw === "object") {
      // Deep merge with defaults to handle missing fields
      securityFeatures = {
        ...DEFAULT_SECURITY_FEATURES,
        ...(raw as Partial<SecurityFeaturesState>),
        duressMode: {
          ...DEFAULT_SECURITY_FEATURES.duressMode,
          ...((raw as Partial<SecurityFeaturesState>).duressMode || {}),
        },
        timeDelay: {
          ...DEFAULT_SECURITY_FEATURES.timeDelay,
          ...((raw as Partial<SecurityFeaturesState>).timeDelay || {}),
        },
      };
    }
  } catch (err) {
    console.error("[wallet] Failed to load security features:", err);
  }
}

/**
 * Persist security features to browser.storage.local
 */
async function persistSecurityFeatures(): Promise<void> {
  try {
    await browser.storage.local.set({ [SECURITY_KEY]: securityFeatures });
  } catch (err) {
    console.error("[wallet] Failed to persist security features:", err);
  }
}

/**
 * Load address book from browser.storage.local
 */
async function loadAddressBook(): Promise<void> {
  try {
    const res = await browser.storage.local.get([ADDRESS_BOOK_KEY]);
    const raw = res?.[ADDRESS_BOOK_KEY];

    if (raw && typeof raw === "object") {
      addressBook = {
        entries: Array.isArray((raw as AddressBook).entries) ? (raw as AddressBook).entries : [],
      };
    }
  } catch (err) {
    console.error("[wallet] Failed to load address book:", err);
  }
}

/**
 * Persist address book to browser.storage.local
 */
async function persistAddressBook(): Promise<void> {
  try {
    await browser.storage.local.set({ [ADDRESS_BOOK_KEY]: addressBook });
  } catch (err) {
    console.error("[wallet] Failed to persist address book:", err);
  }
}

/**
 * Load PnL data from browser.storage.local
 */
async function loadPnlData(): Promise<void> {
  try {
    const res = await browser.storage.local.get([PNL_DATA_KEY]);
    const raw = res?.[PNL_DATA_KEY];
    if (raw && typeof raw === "object" && (raw as PnlData).version === 1) {
      pnlData = raw as PnlData;
    }
  } catch (err) {
    console.error("[pnl] Failed to load PnL data:", err);
  }
}

/**
 * Persist PnL data to browser.storage.local
 */
async function persistPnlData(): Promise<void> {
  try {
    await browser.storage.local.set({ [PNL_DATA_KEY]: pnlData });
  } catch (err) {
    console.error("[pnl] Failed to persist PnL data:", err);
  }
}

/**
 * Check and execute ready delayed transactions
 */
async function checkDelayedTransactions(): Promise<void> {
  const pendingTxs = securityFeatures.pendingTransactions.filter(
    (tx) => tx.status === "pending"
  );

  for (const tx of pendingTxs) {
    if (isTransactionReady(tx)) {
      try {
        // Only execute if wallet is unlocked and not in duress mode
        if (wallet.getAccount() && !isDuressMode) {
          const txid = await wallet.sendTransaction(tx.to, BigInt(tx.amountSompi));
          tx.status = "executed";
          console.info(`[wallet] Delayed transaction ${tx.id} executed: ${txid}`);
        }
      } catch (err) {
        console.error(`[wallet] Failed to execute delayed transaction ${tx.id}:`, err);
        // Keep as pending for retry
      }
    }
  }

  await persistSecurityFeatures();
}

/**
 * Start the delayed transaction checker
 */
function startDelayedTxChecker(): void {
  if (delayedTxTimer) return;
  // Check every minute
  delayedTxTimer = setInterval(checkDelayedTransactions, 60 * 1000);
}

/**
 * Get balance for a watch-only address
 */
async function getWatchOnlyBalance(address: string): Promise<number> {
  const networkConfig = getNetworkConfig(wallet.getNetwork());
  const client = new KaspaClient(networkConfig);
  return client.getBalance(address);
}

/**
 * Load wallet state from browser.storage.local, if present.
 * This is defensive against any weird/undefined values.
 */
async function loadPersistedWallet(): Promise<void> {
  try {
    const res = await browser.storage.local.get([STORAGE_KEY]);
    const raw = res?.[STORAGE_KEY];

    if (!raw) {
      console.info("[wallet] No persisted wallet state found in storage.");
      return;
    }

    try {
      wallet.restoreFromStorage(raw);
    } catch (err) {
      console.error("[wallet] Failed to restore from storage:", err);
      // If restore fails, we just start with a fresh in-memory wallet
    }
  } catch (err) {
    console.error("[wallet] Unexpected error while loading storage:", err);
  }
}

/**
 * Persist current wallet state to browser.storage.local.
 */
async function persistWallet(): Promise<void> {
  const state = wallet.getPersistentState();
  try {
    await browser.storage.local.set({ [STORAGE_KEY]: state });
    console.info("[wallet] State persisted to storage.");
  } catch (err) {
    console.error("[wallet] Failed to persist wallet state:", err);
  }
}

// Ensure we only restore from storage once per service worker lifetime
const initPromise = Promise.all([
  loadPersistedWallet(),
  loadSettings(),
  loadSecurityFeatures(),
  loadAddressBook(),
  loadPnlData(),
]).then(() => {
  // Start delayed transaction checker after loading
  startDelayedTxChecker();
});

/**
 * Lock wallet when popup closes.
 *
 * Uses a keepalive ping system instead of port.onDisconnect because
 * Manifest V3 service workers on Windows can be suspended/terminated,
 * causing onDisconnect to never fire.
 *
 * The popup sends POPUP_PING every 2 seconds. If no ping is received
 * for 5 seconds, the wallet locks automatically.
 */
let lastPopupPing = 0;
let popupWatchdog: ReturnType<typeof setInterval> | null = null;

function startPopupWatchdog() {
  if (popupWatchdog) return; // Already running
  lastPopupPing = Date.now();
  popupWatchdog = setInterval(() => {
    if (Date.now() - lastPopupPing > 5000) {
      // No ping in 5 seconds — popup is closed
      wallet.lock();
      stopPopupWatchdog();
    }
  }, 2000);
}

function stopPopupWatchdog() {
  if (popupWatchdog) {
    clearInterval(popupWatchdog);
    popupWatchdog = null;
  }
}

// Also keep port-based detection as a secondary mechanism
browser.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    startPopupWatchdog();
    port.onDisconnect.addListener(() => {
      // On Mac/Linux this fires reliably, so lock immediately.
      // On Windows, the watchdog will handle it if this doesn't fire.
      wallet.lock();
      stopPopupWatchdog();
    });
  }
});

// ==================== PNL ENGINE ====================

function processIncomingTx(
  data: PnlData,
  tx: { txid: string; amountSompi: number; time?: number },
  priceAtTime: number,
  currency: string,
): void {
  data.lots.push({
    id: generateId(),
    txid: tx.txid,
    asset: "KAS",
    amountRaw: tx.amountSompi,
    remainingRaw: tx.amountSompi,
    pricePerUnit: priceAtTime,
    currency,
    timestamp: tx.time || Math.floor(Date.now() / 1000),
  });
}

function processOutgoingTx(
  data: PnlData,
  tx: { txid: string; amountSompi: number; time?: number },
  priceAtTime: number,
  currency: string,
): void {
  let remainingToSell = tx.amountSompi;
  let totalCostBasis = 0;

  // FIFO: consume oldest lots first (lots are in chronological order)
  for (const lot of data.lots) {
    if (lot.asset !== "KAS" || lot.remainingRaw <= 0) continue;
    if (remainingToSell <= 0) break;

    const consumed = Math.min(lot.remainingRaw, remainingToSell);
    totalCostBasis += (consumed / 1e8) * lot.pricePerUnit;
    lot.remainingRaw -= consumed;
    remainingToSell -= consumed;
  }

  const proceeds = (tx.amountSompi / 1e8) * priceAtTime;

  data.realizedEvents.push({
    txid: tx.txid,
    asset: "KAS",
    amountRaw: tx.amountSompi,
    costBasis: totalCostBasis,
    proceeds,
    pnl: proceeds - totalCostBasis,
    currency,
    timestamp: tx.time || Math.floor(Date.now() / 1000),
  });

  // Cap realized events at 500
  if (data.realizedEvents.length > 500) {
    data.realizedEvents = data.realizedEvents.slice(-500);
  }

  // Clean up fully consumed lots
  data.lots = data.lots.filter((l) => l.remainingRaw > 0);
}

function recomputeSummaries(data: PnlData): void {
  const map: Record<string, AssetPnlSummary> = {};

  const ensure = (asset: string) => {
    if (!map[asset]) {
      map[asset] = {
        asset,
        totalCostBasis: 0,
        weightedAvgPrice: 0,
        currentHolding: 0,
        realizedPnl: 0,
        realizedTxCount: 0,
        totalBought: 0,
        totalSold: 0,
        avgBuyPrice: 0,
        avgSellPrice: 0,
      };
    }
    return map[asset];
  };

  // Accumulate from lots (both remaining and consumed portions tracked via amountRaw)
  let totalBoughtCost = 0;
  let totalBoughtRaw = 0;
  for (const lot of data.lots) {
    const s = ensure(lot.asset);
    s.totalCostBasis += (lot.remainingRaw / 1e8) * lot.pricePerUnit;
    s.currentHolding += lot.remainingRaw;
    totalBoughtCost += (lot.amountRaw / 1e8) * lot.pricePerUnit;
    totalBoughtRaw += lot.amountRaw;
  }

  // Accumulate from realized events
  let totalSoldProceeds = 0;
  let totalSoldRaw = 0;
  for (const evt of data.realizedEvents) {
    const s = ensure(evt.asset);
    s.realizedPnl += evt.pnl;
    s.realizedTxCount += 1;
    totalSoldProceeds += evt.proceeds;
    totalSoldRaw += evt.amountRaw;
    // Add the cost of sold lots back to total bought tracking
    totalBoughtCost += evt.costBasis;
    totalBoughtRaw += evt.amountRaw;
  }

  // Compute derived fields
  for (const s of Object.values(map)) {
    s.totalBought = totalBoughtRaw;
    s.totalSold = totalSoldRaw;
    if (s.currentHolding > 0) {
      s.weightedAvgPrice = s.totalCostBasis / (s.currentHolding / 1e8);
    }
    if (totalBoughtRaw > 0) {
      s.avgBuyPrice = totalBoughtCost / (totalBoughtRaw / 1e8);
    }
    if (totalSoldRaw > 0) {
      s.avgSellPrice = totalSoldProceeds / (totalSoldRaw / 1e8);
    }
  }

  data.summaries = map;
}

async function backfillPnlData(
  address: string,
  currency: string,
): Promise<PnlData> {
  const data: PnlData = { ...DEFAULT_PNL_DATA, address, currency, lots: [], realizedEvents: [], summaries: {} };

  const networkConfig = getNetworkConfig(wallet.getNetwork());
  const client = new KaspaClient(networkConfig);
  const txs = await client.getTransactions(address, 200);

  if (!txs.length) {
    data.backfillComplete = true;
    return data;
  }

  // Sort oldest first for FIFO
  const sorted = [...txs].sort((a, b) => (a.time || 0) - (b.time || 0));

  // Batch-fetch historical prices for all transaction dates
  const timestamps = sorted
    .map((tx) => tx.time)
    .filter((t): t is number => t != null && t > 0);

  const priceMap = await batchFetchHistoricalPrices(timestamps, currency);

  // Process each transaction
  for (const tx of sorted) {
    const dayKey = tx.time
      ? new Date(tx.time * 1000).toISOString().split("T")[0]
      : null;
    const price = dayKey ? priceMap.get(dayKey) ?? null : null;

    if (price == null) continue; // Skip if no price data

    if (tx.isOutgoing) {
      processOutgoingTx(data, tx, price, currency);
    } else {
      processIncomingTx(data, tx, price, currency);
    }

    data.lastProcessedTxid = tx.txid;
  }

  recomputeSummaries(data);
  data.backfillComplete = true;
  return data;
}

async function incrementalPnlUpdate(
  data: PnlData,
  address: string,
  currency: string,
): Promise<boolean> {
  const networkConfig = getNetworkConfig(wallet.getNetwork());
  const client = new KaspaClient(networkConfig);
  const txs = await client.getTransactions(address, 50);

  // Find transactions not yet processed
  const processedTxids = new Set([
    ...data.lots.map((l) => l.txid),
    ...data.realizedEvents.map((e) => e.txid),
  ]);

  const newTxs = txs
    .filter((tx) => !processedTxids.has(tx.txid) && tx.status === "confirmed")
    .sort((a, b) => (a.time || 0) - (b.time || 0));

  if (!newTxs.length) return false;

  // For recent txs use current price, for older use historical
  const currentPrice = await getKaspaPrice(currency);

  for (const tx of newTxs) {
    const isRecent = tx.time && Date.now() / 1000 - tx.time < 86400;
    let price: number;

    if (isRecent) {
      price = currentPrice.price;
    } else {
      // Fetch historical for this specific day
      const dayPrices = await batchFetchHistoricalPrices(
        [tx.time!],
        currency,
      );
      const dayKey = new Date(tx.time! * 1000).toISOString().split("T")[0];
      price = dayPrices.get(dayKey) ?? currentPrice.price;
    }

    if (tx.isOutgoing) {
      processOutgoingTx(data, tx, price, currency);
    } else {
      processIncomingTx(data, tx, price, currency);
    }

    data.lastProcessedTxid = tx.txid;
  }

  recomputeSummaries(data);
  return true;
}

/**
 * Main RPC handler for content scripts / UI.
 */
browser.runtime.onMessage.addListener(
  (message: RpcMessage, sender): Promise<unknown> => {
    return (async () => {
      try {
        // Make sure wallet state has been restored before we touch it
        await initPromise;

        switch (message.type) {
          case "CREATE_WALLET": {
            const { password, wordCount } = message.payload;
            const strength = wordCount === 24 ? 256 : 128;
            const state = await wallet.createNewWallet(password, strength);

            await persistWallet();

            return {
              ok: true,
              state,
              mnemonic: state.mnemonicTransient,
            };
          }

          case "IMPORT_WALLET": {
            const { password, mnemonic } = message.payload;
            const state = await wallet.importFromMnemonic(password, mnemonic);

            await persistWallet();

            return { ok: true, state };
          }

          case "UNLOCK": {
            const { password } = message.payload;

            // Rate limiting — lock out after too many failed attempts
            if (Date.now() < lockoutUntil) {
              const secsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
              return { ok: false, error: `Too many attempts. Try again in ${secsLeft}s` };
            }

            // Check if this is the duress PIN
            if (
              securityFeatures.duressMode.enabled &&
              securityFeatures.duressMode.duressPin &&
              password === securityFeatures.duressMode.duressPin
            ) {
              isDuressMode = true;
              // Return fake account for duress mode
              // Require a configured decoy address — never fall back to a
              // hardcoded address that could fingerprint duress mode in source
              if (!securityFeatures.duressMode.decoyAddress) {
                return { ok: false, error: "Incorrect password" };
              }
              const fakeAccount = {
                address: securityFeatures.duressMode.decoyAddress,
                privateKey: new Uint8Array(32),
                publicKey: new Uint8Array(33),
              };
              unlockAttempts = 0; // Reset on successful duress unlock
              resetAutoLockTimer();
              return { ok: true, account: fakeAccount, isDuressMode: true };
            }

            // Normal unlock
            isDuressMode = false;
            try {
              const { account, needsPersist } = await wallet.unlock(password);
              unlockAttempts = 0; // Reset on successful unlock
              // Persist if encryption was migrated to newer version
              if (needsPersist) {
                await persistWallet();
              }
              // Start auto-lock timer
              resetAutoLockTimer();
              // Background PnL sync (non-blocking)
              setTimeout(async () => {
                try {
                  if (!pnlData.backfillComplete || pnlData.address !== account.address) {
                    pnlData = await backfillPnlData(account.address, settings.currency);
                  } else {
                    await incrementalPnlUpdate(pnlData, account.address, settings.currency);
                  }
                  await persistPnlData();
                } catch (err) {
                  console.error("[pnl] Background sync failed:", err);
                }
              }, 3000);
              startDelayedTxChecker(); // Restart timer after unlock
              return { ok: true, account, isDuressMode: false };
            } catch (unlockErr) {
              unlockAttempts++;
              if (unlockAttempts >= MAX_UNLOCK_ATTEMPTS) {
                lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
                unlockAttempts = 0;
                return { ok: false, error: "Too many failed attempts. Locked for 60 seconds." };
              }
              return { ok: false, error: "Incorrect password" };
            }
          }

          case "LOCK": {
            wallet.lock();
            // Stop delayed transaction checker while locked
            if (delayedTxTimer) {
              clearInterval(delayedTxTimer);
              delayedTxTimer = null;
            }
            return { ok: true };
          }

          case "SWITCH_NETWORK": {
            wallet.switchNetwork(message.payload.network);
            await persistWallet();
            // Signal UI to clear stale balance/history from previous network
            return {
              ok: true,
              network: wallet.getNetwork(),
              clearState: true,
            };
          }

          case "SET_CUSTOM_RPC": {
            const { network, rpcUrl } = message.payload;
            // Enforce HTTPS for security
            if (rpcUrl && !rpcUrl.startsWith("https://")) {
              return {
                ok: false,
                error: "Custom RPC URL must use HTTPS for security",
              };
            }
            wallet.setCustomRpcUrl(network, rpcUrl || null);
            await persistWallet();
            return { ok: true, customRpcUrls: wallet.getCustomRpcUrls() };
          }

          case "GET_CUSTOM_RPC": {
            return { ok: true, customRpcUrls: wallet.getCustomRpcUrls() };
          }

          case "GET_STATE": {
            return {
              ok: true,
              account: wallet.getAccount(),
              network: wallet.getNetwork(),
              hasWallet: wallet.hasWallet(),
              walletType: wallet.getWalletType(),
            };
          }

          case "GET_BALANCE": {
            // Return fake balance in duress mode
            if (isDuressMode) {
              return { ok: true, balance: securityFeatures.duressMode.decoyBalance };
            }
            // Check if wallet is unlocked
            if (!wallet.getAccount()) {
              return { ok: false, error: "Wallet is locked", locked: true };
            }
            const balance = await wallet.getBalance();
            return { ok: true, balance };
          }

          case "GET_HISTORY": {
            // Return minimal fake history in duress mode
            if (isDuressMode) {
              return { ok: true, history: [] };
            }
            // Check if wallet is unlocked
            if (!wallet.getAccount()) {
              return { ok: false, error: "Wallet is locked", locked: true };
            }
            const history = await wallet.getHistory();
            return { ok: true, history };
          }

          case "EXPORT_SEED": {
            const { password } = message.payload;
            const mnemonic = await wallet.exportMnemonic(password);
            return { ok: true, mnemonic };
          }

          case "SEND_TX": {
            const { to, amount, forceImmediate } = message.payload;

            // Validate recipient address
            if (!to || !isValidKaspaAddress(to)) {
              return { ok: false, error: "Invalid recipient address" };
            }

            const amountSompi = BigInt(amount);
            if (amountSompi <= 0n) {
              return { ok: false, error: "Amount must be greater than zero" };
            }

            // In duress mode, pretend to send but do nothing
            if (isDuressMode) {
              return {
                ok: true,
                txid: "decoy-" + generateId(),
                isDecoy: true,
              };
            }

            // Check if wallet is unlocked
            if (!wallet.getAccount()) {
              return { ok: false, error: "Wallet is locked", locked: true };
            }

            // Check if transaction should be delayed (unless forced immediate)
            if (
              !forceImmediate &&
              exceedsDelayThreshold(amountSompi, securityFeatures.timeDelay)
            ) {
              // Queue the transaction for delay
              const delayedTx: DelayedTransaction = {
                id: generateId(),
                to,
                amountSompi: amountSompi.toString(),
                createdAt: Date.now(),
                executeAt: calculateExecutionTime(securityFeatures.timeDelay.delayHours),
                status: "pending",
              };
              securityFeatures.pendingTransactions.push(delayedTx);
              await persistSecurityFeatures();
              return {
                ok: true,
                delayed: true,
                transaction: delayedTx,
                message: `Transaction queued. Will execute in ${securityFeatures.timeDelay.delayHours} hours.`,
              };
            }

            // For hardware wallets, return unsigned tx for popup-side signing
            if (wallet.isHardwareWallet()) {
              const account = wallet.getAccount()!;
              const utxos = await wallet.getUTXOs();
              if (!utxos.length) return { ok: false, error: "No funds available" };
              const { tx, selectedUtxos } = buildTransaction(utxos, to, amountSompi, account.address);
              return {
                ok: true,
                needsLedgerSign: true,
                unsignedTx: tx,
                selectedUtxos,
                to,
                amountSompi: amountSompi.toString(),
              };
            }

            const txid = await wallet.sendTransaction(to, amountSompi);
            // Update PnL with this outgoing transaction
            if (pnlData.backfillComplete && pnlData.address === wallet.getAccount()?.address) {
              try {
                const currentPrice = await getKaspaPrice(settings.currency);
                processOutgoingTx(pnlData, {
                  txid,
                  amountSompi: Number(amountSompi),
                  time: Math.floor(Date.now() / 1000),
                }, currentPrice.price, settings.currency);
                recomputeSummaries(pnlData);
                await persistPnlData();
              } catch (err) {
                console.error("[pnl] Failed to update PnL after send:", err);
              }
            }
            return { ok: true, txid };
          }

          case "CONNECT_REQUEST": {
            const origin = sender.origin || sender.url || "";
            const account = wallet.getAccount();

            // Wallet must be unlocked for connections
            if (!account) {
              return {
                ok: false,
                error: "Wallet is locked. Please unlock your wallet first.",
              };
            }

            if (approvedOrigins.has(origin)) {
              // Already approved - return account (address only, no private key)
              return {
                ok: true,
                approved: true,
                address: account.address,
              };
            } else {
              // Store pending request and open the popup for user approval
              pendingConnectOrigin = origin;
              try {
                await browser.action.openPopup();
              } catch {
                // openPopup may not be available in all contexts
              }
              return {
                ok: false,
                error: "Connection request sent. Please approve in the NoXu wallet popup.",
                requiresApproval: true,
                origin,
              };
            }
          }

          case "GET_PENDING_CONNECT": {
            return { ok: true, origin: pendingConnectOrigin };
          }

          case "APPROVE_ORIGIN": {
            // Called from popup UI when user explicitly approves a site
            const { origin: approveOrigin } = message.payload;
            if (approveOrigin && typeof approveOrigin === "string") {
              approvedOrigins.add(approveOrigin);
              if (pendingConnectOrigin === approveOrigin) pendingConnectOrigin = null;
              return { ok: true, approved: true };
            } else {
              return { ok: false, error: "Invalid origin" };
            }
          }

          case "REJECT_ORIGIN": {
            // Called from popup UI when user rejects a pending connect
            if (pendingConnectOrigin) pendingConnectOrigin = null;
            return { ok: true };
          }

          case "REVOKE_ORIGIN": {
            // Called from popup UI when user revokes a site
            const { origin: revokeOrigin } = message.payload;
            if (revokeOrigin && typeof revokeOrigin === "string") {
              approvedOrigins.delete(revokeOrigin);
              return { ok: true };
            } else {
              return { ok: false, error: "Invalid origin" };
            }
          }

          case "GET_APPROVED_ORIGINS": {
            return { ok: true, origins: Array.from(approvedOrigins) };
          }

          case "DISCONNECT_REQUEST": {
            const origin = sender.origin || sender.url || "";
            approvedOrigins.delete(origin);
            return { ok: true };
          }

          case "SIGN_TX": {
            return { ok: false, error: "Transaction signing via dApps is not yet supported. Use the wallet UI to send transactions." };
          }

          case "SIGN_AND_SEND": {
            const { to, amount } = message.payload;
            if (!to || !isValidKaspaAddress(to)) {
              return { ok: false, error: "Invalid recipient address" };
            }
            if (!amount || BigInt(amount) <= 0n) {
              return { ok: false, error: "Amount must be greater than zero" };
            }
            const txid = await wallet.sendTransaction(to, BigInt(amount));
            return { ok: true, txid };
          }

          case "GET_AUTO_LOCK": {
            return { ok: true, autoLockMinutes: settings.autoLockMinutes };
          }

          case "SET_AUTO_LOCK": {
            const { minutes } = message.payload;
            if (typeof minutes === "number" && minutes >= 0) {
              settings.autoLockMinutes = minutes;
              await persistSettings();
              resetAutoLockTimer();
            }
            return { ok: true, autoLockMinutes: settings.autoLockMinutes };
          }

          // ==================== SECURITY FEATURES ====================

          case "GET_SECURITY_FEATURES": {
            return {
              ok: true,
              securityFeatures: {
                ...securityFeatures,
                // Don't expose the actual duress PIN in responses
                duressMode: {
                  ...securityFeatures.duressMode,
                  duressPin: securityFeatures.duressMode.duressPin ? "****" : "",
                },
              },
              isDuressMode,
            };
          }

          case "SET_DURESS_MODE": {
            const { enabled, duressPin, decoyBalance } = message.payload;
            securityFeatures.duressMode = {
              ...securityFeatures.duressMode,
              enabled: enabled ?? securityFeatures.duressMode.enabled,
              duressPin: duressPin ?? securityFeatures.duressMode.duressPin,
              decoyBalance: decoyBalance ?? securityFeatures.duressMode.decoyBalance,
            };
            await persistSecurityFeatures();
            return {
              ok: true,
              duressMode: {
                ...securityFeatures.duressMode,
                duressPin: securityFeatures.duressMode.duressPin ? "****" : "",
              },
            };
          }

          case "CHECK_DURESS_PIN": {
            // This is called during unlock to check if the entered password is the duress PIN
            const { pin } = message.payload;
            if (
              securityFeatures.duressMode.enabled &&
              securityFeatures.duressMode.duressPin &&
              pin === securityFeatures.duressMode.duressPin
            ) {
              isDuressMode = true;
              return { ok: true, isDuress: true };
            }
            isDuressMode = false;
            return { ok: true, isDuress: false };
          }

          case "ADD_WATCH_ONLY": {
            const { address, label } = message.payload;
            if (!isValidKaspaAddress(address)) {
              return { ok: false, error: "Invalid Kaspa address" };
            }
            // Check for duplicates
            if (securityFeatures.watchOnlyAddresses.some((w) => w.address === address)) {
              return { ok: false, error: "Address already being watched" };
            }
            const watchOnly: WatchOnlyAddress = {
              id: generateId(),
              address,
              label: label || "Unnamed",
              addedAt: Date.now(),
            };
            securityFeatures.watchOnlyAddresses.push(watchOnly);
            await persistSecurityFeatures();
            return { ok: true, watchOnly };
          }

          case "REMOVE_WATCH_ONLY": {
            const { id } = message.payload;
            securityFeatures.watchOnlyAddresses = securityFeatures.watchOnlyAddresses.filter(
              (w) => w.id !== id
            );
            await persistSecurityFeatures();
            return { ok: true };
          }

          case "GET_WATCH_ONLY_BALANCE": {
            const { address } = message.payload;
            try {
              const balance = await getWatchOnlyBalance(address);
              return { ok: true, balance };
            } catch (err: any) {
              return { ok: false, error: err?.message || "Failed to fetch balance" };
            }
          }

          case "GET_WATCH_ONLY_HISTORY": {
            const { address } = message.payload;
            try {
              const networkConfig = getNetworkConfig(wallet.getNetwork());
              const client = new KaspaClient(networkConfig);
              const history = await client.getTransactions(address);
              return { ok: true, history };
            } catch (err: any) {
              return { ok: false, error: err?.message || "Failed to fetch history" };
            }
          }

          case "SET_TIME_DELAY": {
            const { enabled, thresholdKas, delayHours } = message.payload;
            securityFeatures.timeDelay = {
              enabled: enabled ?? securityFeatures.timeDelay.enabled,
              thresholdKas: thresholdKas ?? securityFeatures.timeDelay.thresholdKas,
              delayHours: delayHours ?? securityFeatures.timeDelay.delayHours,
            };
            await persistSecurityFeatures();
            return { ok: true, timeDelay: securityFeatures.timeDelay };
          }

          case "QUEUE_DELAYED_TX": {
            const { to, amount } = message.payload;
            const amountSompi = BigInt(amount);

            // Check if this should be delayed
            if (!exceedsDelayThreshold(amountSompi, securityFeatures.timeDelay)) {
              return { ok: false, error: "Amount below delay threshold", shouldDelay: false };
            }

            const delayedTx: DelayedTransaction = {
              id: generateId(),
              to,
              amountSompi: amountSompi.toString(),
              createdAt: Date.now(),
              executeAt: calculateExecutionTime(securityFeatures.timeDelay.delayHours),
              status: "pending",
            };

            securityFeatures.pendingTransactions.push(delayedTx);
            await persistSecurityFeatures();
            return { ok: true, transaction: delayedTx };
          }

          case "CANCEL_DELAYED_TX": {
            const { id } = message.payload;
            const tx = securityFeatures.pendingTransactions.find((t) => t.id === id);
            if (!tx) {
              return { ok: false, error: "Transaction not found" };
            }
            if (tx.status !== "pending") {
              return { ok: false, error: "Transaction already processed" };
            }
            tx.status = "cancelled";
            await persistSecurityFeatures();
            return { ok: true };
          }

          case "EXECUTE_DELAYED_TX": {
            // Force immediate execution of a delayed transaction
            const { id } = message.payload;
            const tx = securityFeatures.pendingTransactions.find((t) => t.id === id);
            if (!tx) {
              return { ok: false, error: "Transaction not found" };
            }
            if (tx.status !== "pending") {
              return { ok: false, error: "Transaction already processed" };
            }
            if (isDuressMode) {
              return { ok: false, error: "Cannot execute in duress mode" };
            }
            try {
              const txid = await wallet.sendTransaction(tx.to, BigInt(tx.amountSompi));
              tx.status = "executed";
              await persistSecurityFeatures();
              return { ok: true, txid };
            } catch (err: any) {
              return { ok: false, error: err?.message || "Transaction failed" };
            }
          }

          case "GET_PENDING_TXS": {
            return {
              ok: true,
              transactions: securityFeatures.pendingTransactions.filter(
                (tx) => tx.status === "pending"
              ),
            };
          }

          // ==================== KRC-20 TOKEN FEATURES ====================

          case "GET_TOKEN_BALANCES": {
            const address = message.payload?.address || wallet.getAccount()?.address;
            if (!address) {
              return { ok: false, error: "No address provided and wallet is locked" };
            }
            try {
              const krc20Client = new KRC20TransferClient(wallet.getNetwork());
              const balances = await krc20Client.getTokenBalances(address);
              // Convert BigInt to string for JSON serialization
              const serializedBalances = balances.map((b) => ({
                tick: b.tick,
                balance: b.balance.toString(),
                locked: b.locked.toString(),
                decimals: b.decimals,
              }));
              return { ok: true, balances: serializedBalances };
            } catch (err: any) {
              return { ok: false, error: err?.message || "Failed to fetch token balances" };
            }
          }

          case "GET_TOKEN_INFO": {
            const { tick } = message.payload;
            if (!tick) {
              return { ok: false, error: "Token ticker is required" };
            }
            try {
              const krc20Client = new KRC20TransferClient(wallet.getNetwork());
              const info = await krc20Client.getTokenInfo(tick);
              if (!info) {
                return { ok: false, error: "Token not found" };
              }
              // Convert BigInt to string for JSON serialization
              return {
                ok: true,
                info: {
                  tick: info.tick,
                  maxSupply: info.maxSupply.toString(),
                  mintLimit: info.mintLimit.toString(),
                  preMine: info.preMine.toString(),
                  deployer: info.deployer,
                  decimals: info.decimals,
                  minted: info.minted.toString(),
                  state: info.state,
                  holderTotal: info.holderTotal,
                  transferTotal: info.transferTotal,
                  mintTotal: info.mintTotal,
                },
              };
            } catch (err: any) {
              return { ok: false, error: err?.message || "Failed to fetch token info" };
            }
          }

          case "GET_TOKEN_LIST": {
            const limit = message.payload?.limit || 50;
            try {
              const krc20Client = new KRC20TransferClient(wallet.getNetwork());
              const tokens = await krc20Client.getTokenList(limit);
              // Convert BigInt to string for JSON serialization
              const serializedTokens = tokens.map((t) => ({
                tick: t.tick,
                maxSupply: t.maxSupply.toString(),
                mintLimit: t.mintLimit.toString(),
                preMine: t.preMine.toString(),
                deployer: t.deployer,
                decimals: t.decimals,
                minted: t.minted.toString(),
                state: t.state,
                holderTotal: t.holderTotal,
                transferTotal: t.transferTotal,
                mintTotal: t.mintTotal,
              }));
              return { ok: true, tokens: serializedTokens };
            } catch (err: any) {
              return { ok: false, error: err?.message || "Failed to fetch token list" };
            }
          }

          case "SEND_KRC20_TX": {
            const { tick, to, amount, decimals } = message.payload;

            // Check if wallet is unlocked
            if (!wallet.getAccount()) {
              return { ok: false, error: "Wallet is locked", locked: true };
            }

            // Validate recipient address
            if (!isValidKaspaAddress(to)) {
              return { ok: false, error: "Invalid recipient address" };
            }

            try {
              const account = wallet.getAccount()!;
              const network = wallet.getNetwork();

              // Parse amount to raw token units
              const amountRaw = parseTokenAmount(amount, decimals);

              if (amountRaw <= 0n) {
                return { ok: false, error: "Amount must be greater than 0" };
              }

              // Check token balance
              const transferClient = new KRC20TransferClient(network);
              const balances = await transferClient.getTokenBalances(account.address);
              const tokenBalance = balances.find(
                (b) => b.tick.toUpperCase() === tick.toUpperCase()
              );

              if (!tokenBalance || tokenBalance.balance < amountRaw) {
                return {
                  ok: false,
                  error: `Insufficient ${tick.toUpperCase()} balance`,
                };
              }

              // Get UTXOs for the transaction
              const utxos = await wallet.getUTXOs();

              if (utxos.length === 0) {
                return {
                  ok: false,
                  error: "No UTXOs available. You need KAS to pay for transaction fees.",
                };
              }

              // For hardware wallets, return unsigned data for popup-side signing
              if (wallet.isHardwareWallet()) {
                return {
                  ok: true,
                  needsLedgerSign: true,
                  tick,
                  to,
                  amountRaw: amountRaw.toString(),
                  utxos,
                };
              }

              // Execute the full KRC-20 transfer (commit + reveal)
              const result = await transferClient.executeTransfer(
                utxos,
                (account as any).privateKey,
                account.publicKey,
                to,
                tick,
                amountRaw,
                account.address,
              );

              if (result.success) {
                console.info("[KRC20] Transfer successful:", {
                  commitTxId: result.commitTxId,
                  revealTxId: result.revealTxId,
                });
                return {
                  ok: true,
                  commitTxId: result.commitTxId,
                  revealTxId: result.revealTxId,
                };
              } else {
                return {
                  ok: false,
                  error: result.error || "KRC-20 transfer failed",
                  commitTxId: result.commitTxId, // May have partial success
                };
              }
            } catch (err: any) {
              console.error("[KRC20] Transfer error:", err);
              return {
                ok: false,
                error: err?.message || "Failed to execute KRC-20 transfer",
              };
            }
          }

          // ==================== ADDRESS BOOK FEATURES ====================

          case "GET_ADDRESS_BOOK": {
            return { ok: true, addressBook };
          }

          case "ADD_ADDRESS_BOOK_ENTRY": {
            const { address, label, notes } = message.payload;
            if (!isValidKaspaAddress(address)) {
              return { ok: false, error: "Invalid Kaspa address" };
            }
            // Check for duplicates
            if (addressBook.entries.some((e) => e.address === address)) {
              return { ok: false, error: "Address already in address book" };
            }
            const now = Date.now();
            const entry: AddressBookEntry = {
              id: generateId(),
              address,
              label: label || "Unnamed",
              notes: notes || "",
              createdAt: now,
              updatedAt: now,
            };
            addressBook.entries.push(entry);
            await persistAddressBook();
            return { ok: true, entry };
          }

          case "UPDATE_ADDRESS_BOOK_ENTRY": {
            const { id, label, notes } = message.payload;
            const entry = addressBook.entries.find((e) => e.id === id);
            if (!entry) {
              return { ok: false, error: "Entry not found" };
            }
            if (label !== undefined) entry.label = label;
            if (notes !== undefined) entry.notes = notes;
            entry.updatedAt = Date.now();
            await persistAddressBook();
            return { ok: true, entry };
          }

          case "REMOVE_ADDRESS_BOOK_ENTRY": {
            const { id } = message.payload;
            addressBook.entries = addressBook.entries.filter((e) => e.id !== id);
            await persistAddressBook();
            return { ok: true };
          }

          case "RESOLVE_ADDRESS_LABEL": {
            const { address } = message.payload;
            const entry = addressBook.entries.find((e) => e.address === address);
            return { ok: true, label: entry?.label || null, entry: entry || null };
          }

          // ==================== PRICE DATA ====================

          case "GET_KAS_PRICE": {
            try {
              const price = await getKaspaPrice(settings.currency);
              return { ok: true, price };
            } catch (err: any) {
              return { ok: false, error: err?.message || "Failed to fetch price" };
            }
          }

          case "GET_KAS_PRICE_HISTORY": {
            const { days } = message.payload || {};
            const validDays = [1, 7, 30].includes(days) ? days : 7;
            try {
              const history = await getKaspaPriceHistory(validDays, settings.currency);
              return { ok: true, history };
            } catch (err: any) {
              return { ok: false, error: err?.message || "Failed to fetch price history" };
            }
          }

          case "GET_TOKEN_PRICE_HISTORY": {
            const { symbol, days } = message.payload || {};
            if (!symbol) {
              return { ok: false, error: "Token symbol is required" };
            }
            const validDays = [1, 7, 30].includes(days) ? days : 7;
            try {
              const history = await getTokenPriceHistory(symbol, validDays, settings.currency);
              return { ok: true, history };
            } catch (err: any) {
              return { ok: false, error: err?.message || "Failed to fetch token price history" };
            }
          }

          case "GET_TOKEN_PRICE": {
            const { tick } = message.payload || {};
            if (!tick) {
              return { ok: false, error: "Token ticker is required" };
            }
            try {
              // CoinGecko is tried first (free, no key), then Kas.fyi as fallback
              const price = await getKrc20Price(
                tick,
                settings.currency,
                settings.kasFyiApiKey || undefined,
              );
              return { ok: true, price };
            } catch (err: any) {
              return { ok: false, error: err?.message || "Failed to fetch token price" };
            }
          }

          case "GET_TRENDING_TOKENS": {
            const limit = message.payload?.limit || 5;
            try {
              const tokens = await getTopKrc20Tokens(limit, settings.currency);
              return { ok: true, tokens };
            } catch (err: any) {
              return { ok: false, error: err?.message || "Failed to fetch trending tokens" };
            }
          }

          case "GET_TRENDING_GAINERS": {
            const limit = message.payload?.limit || 5;
            try {
              const tokens = await getTopKrc20TokensByGainers(limit, settings.currency);
              return { ok: true, tokens };
            } catch (err: any) {
              return { ok: false, error: err?.message || "Failed to fetch trending gainers" };
            }
          }

          case "GET_CURRENCY": {
            return { ok: true, currency: settings.currency };
          }

          case "SET_CURRENCY": {
            const { currency } = message.payload || {};
            const valid = ["usd", "eur", "gbp", "jpy", "cad", "aud", "chf", "krw"];
            if (typeof currency === "string" && valid.includes(currency)) {
              const oldCurrency = settings.currency;
              settings.currency = currency;
              await persistSettings();
              // Invalidate PnL data when currency changes
              if (oldCurrency !== currency && pnlData.backfillComplete) {
                pnlData.backfillComplete = false;
                await persistPnlData();
              }
              return { ok: true, currency: settings.currency };
            }
            return { ok: false, error: "Invalid currency" };
          }

          case "GET_KAS_FYI_API_KEY": {
            return { ok: true, apiKey: settings.kasFyiApiKey || "" };
          }

          case "SET_KAS_FYI_API_KEY": {
            const { apiKey } = message.payload || {};
            settings.kasFyiApiKey = typeof apiKey === "string" ? apiKey.trim() : "";
            await persistSettings();
            return { ok: true };
          }

          // ==================== PNL TRACKING ====================

          case "GET_PNL_SUMMARY": {
            const account = wallet.getAccount();
            if (!account) return { ok: false, error: "Wallet is locked", locked: true };

            // If PnL data belongs to a different address, it's stale
            if (pnlData.address && pnlData.address !== account.address) {
              return { ok: true, summary: null, backfillComplete: false, currency: pnlData.currency };
            }

            return {
              ok: true,
              summary: pnlData.summaries["KAS"] || null,
              backfillComplete: pnlData.backfillComplete,
              totalRealizedPnl: pnlData.realizedEvents.reduce((sum, e) => sum + e.pnl, 0),
              currency: pnlData.currency,
            };
          }

          case "GET_PNL_DATA": {
            const account = wallet.getAccount();
            if (!account) return { ok: false, error: "Wallet is locked", locked: true };

            return {
              ok: true,
              pnlData: {
                summaries: pnlData.summaries,
                realizedEvents: pnlData.realizedEvents.slice(-20),
                backfillComplete: pnlData.backfillComplete,
                currency: pnlData.currency,
              },
            };
          }

          case "SYNC_PNL": {
            const account = wallet.getAccount();
            if (!account) return { ok: false, error: "Wallet is locked", locked: true };

            try {
              if (!pnlData.backfillComplete || pnlData.address !== account.address) {
                pnlData = await backfillPnlData(account.address, settings.currency);
                await persistPnlData();
                return { ok: true, backfilled: true };
              } else {
                const changed = await incrementalPnlUpdate(pnlData, account.address, settings.currency);
                if (changed) await persistPnlData();
                return { ok: true, updated: changed };
              }
            } catch (err: any) {
              return { ok: false, error: err?.message || "PnL sync failed" };
            }
          }

          case "RESET_PNL": {
            pnlData = { ...DEFAULT_PNL_DATA, lots: [], realizedEvents: [], summaries: {} };
            await persistPnlData();
            return { ok: true };
          }

          case "POPUP_PING": {
            // Keepalive ping from popup — reset watchdog timer
            lastPopupPing = Date.now();
            if (!popupWatchdog) startPopupWatchdog();
            resetAutoLockTimer();
            return { ok: true };
          }

          // ==================== LEDGER HARDWARE WALLET ====================

          case "LEDGER_CONNECT": {
            const { publicKey, address, derivationPath } = message.payload;
            // publicKey comes as array from JSON — convert to Uint8Array
            const pubKeyBytes = new Uint8Array(publicKey);
            wallet.connectHardwareWallet(pubKeyBytes, address, derivationPath);
            await browser.storage.local.set({
              walletState: wallet.getPersistentState(),
            });
            return { ok: true, address };
          }

          case "LEDGER_DISCONNECT": {
            // Reset wallet to empty state
            wallet.lock();
            await browser.storage.local.remove("walletState");
            return { ok: true };
          }

          case "LEDGER_GET_STATUS": {
            return {
              ok: true,
              walletType: wallet.getWalletType(),
              isHardwareWallet: wallet.isHardwareWallet(),
              address: wallet.getAccount()?.address,
            };
          }

          case "BROADCAST_SIGNED_TX": {
            // Broadcast a pre-signed transaction (signed by Ledger in popup)
            const { broadcastData, txId } = message.payload;
            try {
              const network = wallet.getNetwork();
              const client = new KaspaClient(getNetworkConfig(network));
              const resultTxId = await client.broadcastTransaction(broadcastData);
              return { ok: true, txid: resultTxId || txId };
            } catch (err: any) {
              return { ok: false, error: err?.message || "Broadcast failed" };
            }
          }

          default: {
            console.warn("[wallet] Unknown RPC message:", message);
            return { ok: false, error: "Unknown message" };
          }
        }
      } catch (err: any) {
        console.error("[wallet] RPC error:", err);
        return {
          ok: false,
          error: err?.message || String(err),
        };
      }
    })();
  }
);

// Auto-lock on idle/locked like Phantom for safety.
browser.idle.onStateChanged.addListener((state) => {
  if (state === "idle" || state === "locked") {
    wallet.lock();
  }
});
