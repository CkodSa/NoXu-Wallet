// src/background/index.ts

import browser from "webextension-polyfill";
import { Wallet } from "../../core/wallet";
import { DEFAULT_NETWORK, getNetworkConfig } from "../../core/networks";
import { KaspaClient } from "../../core/kaspa/client";
import {
  KRC20Client,
  KRC20TransferClient,
  parseTokenAmount,
  createTransferInscription,
  serializeInscription,
} from "../../core/kaspa/krc20-client";
import type { RpcMessage } from "../messages";
import {
  DEFAULT_SECURITY_FEATURES,
  generateId,
  exceedsDelayThreshold,
  calculateExecutionTime,
  isTransactionReady,
  isValidKaspaAddress,
  type SecurityFeaturesState,
  type WatchOnlyAddress,
  type DelayedTransaction,
  type AddressBook,
  type AddressBookEntry,
} from "../../core/securityFeatures";

// Console security warning (shows in service worker console)
console.log(
  "%c⚠️ SECURITY WARNING",
  "color: red; font-size: 20px; font-weight: bold;"
);
console.log(
  "%cIf someone told you to paste something here, it is a SCAM. NoXu support will NEVER ask you to use the console.",
  "font-size: 14px; color: orange;"
);

const STORAGE_KEY = "kaspa_wallet_state";
const SETTINGS_KEY = "kaspa_wallet_settings";
const SECURITY_KEY = "kaspa_security_features";
const ADDRESS_BOOK_KEY = "kaspa_address_book";

// Default auto-lock timeout in minutes (0 = disabled)
const DEFAULT_AUTO_LOCK_MINUTES = 2;

type WalletSettings = {
  autoLockMinutes: number;
};

// Single wallet instance for this background context
const wallet = new Wallet(DEFAULT_NETWORK);

// Settings with defaults
let settings: WalletSettings = {
  autoLockMinutes: DEFAULT_AUTO_LOCK_MINUTES,
};

// Security features state
let securityFeatures: SecurityFeaturesState = { ...DEFAULT_SECURITY_FEATURES };

// Address book state
let addressBook: AddressBook = { entries: [] };

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
]).then(() => {
  // Start delayed transaction checker after loading
  startDelayedTxChecker();
});

/**
 * Lock wallet when popup closes.
 * The popup establishes a port connection on load; when closed, the port disconnects.
 */
browser.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    port.onDisconnect.addListener(() => {
      wallet.lock();
    });
  }
});

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

            // Check if this is the duress PIN
            if (
              securityFeatures.duressMode.enabled &&
              securityFeatures.duressMode.duressPin &&
              password === securityFeatures.duressMode.duressPin
            ) {
              isDuressMode = true;
              // Return fake account for duress mode
              const fakeAccount = {
                address: securityFeatures.duressMode.decoyAddress ||
                  "kaspa:qr35ennsep3hxfe7lnz5ee7j5jgmkjswsn35ennsep3hxfe7ln000000",
                privateKey: new Uint8Array(32),
                publicKey: new Uint8Array(33),
              };
              resetAutoLockTimer();
              return { ok: true, account: fakeAccount, isDuressMode: true };
            }

            // Normal unlock
            isDuressMode = false;
            const { account, needsPersist } = await wallet.unlock(password);
            // Persist if encryption was migrated to newer version
            if (needsPersist) {
              await persistWallet();
            }
            // Start auto-lock timer
            resetAutoLockTimer();
            return { ok: true, account, isDuressMode: false };
          }

          case "LOCK": {
            wallet.lock();
            return { ok: true };
          }

          case "SWITCH_NETWORK": {
            wallet.switchNetwork(message.payload.network);
            await persistWallet();
            return { ok: true, network: wallet.getNetwork() };
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
            const amountSompi = BigInt(amount);

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

            const txid = await wallet.sendTransaction(to, amountSompi);
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
              // Not yet approved - require explicit user action
              // For now, reject and instruct user to approve via popup
              // TODO: Implement proper approval popup
              return {
                ok: false,
                error: "Connection not approved. Please approve this site in the NoXu wallet popup.",
                requiresApproval: true,
                origin,
              };
            }
          }

          case "APPROVE_ORIGIN": {
            // Called from popup UI when user explicitly approves a site
            const { origin: approveOrigin } = message.payload;
            if (approveOrigin && typeof approveOrigin === "string") {
              approvedOrigins.add(approveOrigin);
              return { ok: true, approved: true };
            } else {
              return { ok: false, error: "Invalid origin" };
            }
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
            // Placeholder: implement real signing when you have raw tx bytes, etc.
            return { ok: true, signature: "stub-signature" };
          }

          case "SIGN_AND_SEND": {
            const { to, amount } = message.payload;
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
              const krc20Client = new KRC20Client(wallet.getNetwork());
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
              const krc20Client = new KRC20Client(wallet.getNetwork());
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
              const krc20Client = new KRC20Client(wallet.getNetwork());
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
              const krc20Client = new KRC20Client(network);
              const balances = await krc20Client.getTokenBalances(account.address);
              const tokenBalance = balances.find(
                (b) => b.tick.toUpperCase() === tick.toUpperCase()
              );

              if (!tokenBalance || tokenBalance.balance < amountRaw) {
                return {
                  ok: false,
                  error: `Insufficient ${tick.toUpperCase()} balance`,
                };
              }

              // Create the transfer inscription
              const inscription = createTransferInscription(tick, amountRaw, to);
              const inscriptionJson = serializeInscription(inscription);

              // For now, return that the transfer requires full Kaspa transaction signing
              // Real KRC-20 transfers need:
              // 1. Commit TX: P2SH output with inscription script
              // 2. Reveal TX: Spend the P2SH with signature revealing the script
              // This requires kaspa-wasm or similar for proper Schnorr signatures

              // Log the prepared inscription for debugging
              console.log("[KRC20] Transfer prepared:", {
                from: account.address,
                to,
                tick: tick.toUpperCase(),
                amount: amountRaw.toString(),
                inscription: inscriptionJson,
              });

              return {
                ok: false,
                error:
                  "KRC-20 transfers are not yet fully supported. Full Kaspa transaction signing (Schnorr signatures) is required. This feature is coming soon.",
                prepared: {
                  inscription: inscriptionJson,
                  from: account.address,
                  to,
                  tick: tick.toUpperCase(),
                  amount: amountRaw.toString(),
                },
              };
            } catch (err: any) {
              console.error("[KRC20] Transfer error:", err);
              return {
                ok: false,
                error: err?.message || "Failed to prepare KRC-20 transfer",
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
