// src/background/index.ts

import { Wallet } from "../../core/wallet";
import { DEFAULT_NETWORK } from "../../core/networks";
import type { RpcMessage } from "../messages";

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

// Default auto-lock timeout in minutes (0 = disabled)
const DEFAULT_AUTO_LOCK_MINUTES = 15;

type WalletSettings = {
  autoLockMinutes: number;
};

// Single wallet instance for this background context
const wallet = new Wallet(DEFAULT_NETWORK);

// Settings with defaults
let settings: WalletSettings = {
  autoLockMinutes: DEFAULT_AUTO_LOCK_MINUTES,
};

// Auto-lock timer
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

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
 * Load settings from chrome.storage.local
 */
async function loadSettings(): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([SETTINGS_KEY], (res) => {
        if (chrome.runtime.lastError) {
          resolve();
          return;
        }

        const raw =
          res && typeof res === "object"
            ? (res as Record<string, unknown>)[SETTINGS_KEY]
            : undefined;

        if (raw && typeof raw === "object") {
          const r = raw as Record<string, unknown>;
          if (typeof r.autoLockMinutes === "number" && r.autoLockMinutes >= 0) {
            settings.autoLockMinutes = r.autoLockMinutes;
          }
        }
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

/**
 * Persist settings to chrome.storage.local
 */
async function persistSettings(): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [SETTINGS_KEY]: settings }, () => {
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

/**
 * Load wallet state from chrome.storage.local, if present.
 * This is defensive against any weird/undefined values.
 */
async function loadPersistedWallet(): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([STORAGE_KEY], (res) => {
        // If the extension is shutting down / some low-level error
        if (chrome.runtime.lastError) {
          console.error(
            "[wallet] Failed to read from storage:",
            chrome.runtime.lastError
          );
          resolve();
          return;
        }

        // Make sure `res` is actually an object before indexing
        const raw =
          res && typeof res === "object"
            ? (res as Record<string, unknown>)[STORAGE_KEY]
            : undefined;

        if (!raw) {
          console.info("[wallet] No persisted wallet state found in storage.");
          resolve();
          return;
        }

        try {
          wallet.restoreFromStorage(raw);
        } catch (err) {
          console.error("[wallet] Failed to restore from storage:", err);
          // If restore fails, we just start with a fresh in-memory wallet
        }

        resolve();
      });
    } catch (err) {
      console.error("[wallet] Unexpected error while loading storage:", err);
      resolve();
    }
  });
}

/**
 * Persist current wallet state to chrome.storage.local.
 */
async function persistWallet(): Promise<void> {
  const state = wallet.getPersistentState();
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: state }, () => {
        if (chrome.runtime.lastError) {
          console.error(
            "[wallet] Failed to persist wallet state:",
            chrome.runtime.lastError
          );
        } else {
          console.info("[wallet] State persisted to storage.");
        }
        resolve();
      });
    } catch (err) {
      console.error("[wallet] Unexpected error while persisting state:", err);
      resolve();
    }
  });
}

// Ensure we only restore from storage once per service worker lifetime
const initPromise = Promise.all([loadPersistedWallet(), loadSettings()]);

/**
 * Main RPC handler for content scripts / UI.
 */
chrome.runtime.onMessage.addListener(
  (message: RpcMessage, sender, sendResponse) => {
    const handler = async () => {
      try {
        // Make sure wallet state has been restored before we touch it
        await initPromise;

        switch (message.type) {
          case "CREATE_WALLET": {
            const { password, wordCount } = message.payload;
            const strength = wordCount === 24 ? 256 : 128;
            const state = await wallet.createNewWallet(password, strength);

            await persistWallet();

            sendResponse({
              ok: true,
              state,
              mnemonic: state.mnemonicTransient,
            });
            break;
          }

          case "IMPORT_WALLET": {
            const { password, mnemonic } = message.payload;
            const state = await wallet.importFromMnemonic(password, mnemonic);

            await persistWallet();

            sendResponse({ ok: true, state });
            break;
          }

          case "UNLOCK": {
            const { password } = message.payload;
            const { account, needsPersist } = await wallet.unlock(password);
            // Persist if encryption was migrated to newer version
            if (needsPersist) {
              await persistWallet();
            }
            // Start auto-lock timer
            resetAutoLockTimer();
            sendResponse({ ok: true, account });
            break;
          }

          case "LOCK": {
            wallet.lock();
            sendResponse({ ok: true });
            break;
          }

          case "SWITCH_NETWORK": {
            wallet.switchNetwork(message.payload.network);
            await persistWallet();
            sendResponse({ ok: true, network: wallet.getNetwork() });
            break;
          }

          case "SET_CUSTOM_RPC": {
            const { network, rpcUrl } = message.payload;
            // Enforce HTTPS for security
            if (rpcUrl && !rpcUrl.startsWith("https://")) {
              sendResponse({
                ok: false,
                error: "Custom RPC URL must use HTTPS for security",
              });
              break;
            }
            wallet.setCustomRpcUrl(network, rpcUrl || null);
            await persistWallet();
            sendResponse({ ok: true, customRpcUrls: wallet.getCustomRpcUrls() });
            break;
          }

          case "GET_CUSTOM_RPC": {
            sendResponse({ ok: true, customRpcUrls: wallet.getCustomRpcUrls() });
            break;
          }

          case "GET_STATE": {
            sendResponse({
              ok: true,
              account: wallet.getAccount(),
              network: wallet.getNetwork(),
              hasWallet: wallet.hasWallet(),
            });
            break;
          }

          case "GET_BALANCE": {
            const balance = await wallet.getBalance();
            sendResponse({ ok: true, balance });
            break;
          }

          case "GET_HISTORY": {
            const history = await wallet.getHistory();
            sendResponse({ ok: true, history });
            break;
          }

          case "EXPORT_SEED": {
            const { password } = message.payload;
            const mnemonic = await wallet.exportMnemonic(password);
            sendResponse({ ok: true, mnemonic });
            break;
          }

          case "SEND_TX": {
            const { to, amount } = message.payload;
            const txid = await wallet.sendTransaction(to, BigInt(amount));
            sendResponse({ ok: true, txid });
            break;
          }

          case "CONNECT_REQUEST": {
            const origin = sender.origin || sender.url || "";
            const account = wallet.getAccount();

            // Wallet must be unlocked for connections
            if (!account) {
              sendResponse({
                ok: false,
                error: "Wallet is locked. Please unlock your wallet first.",
              });
              break;
            }

            if (approvedOrigins.has(origin)) {
              // Already approved - return account (address only, no private key)
              sendResponse({
                ok: true,
                approved: true,
                address: account.address,
              });
            } else {
              // Not yet approved - require explicit user action
              // For now, reject and instruct user to approve via popup
              // TODO: Implement proper approval popup
              sendResponse({
                ok: false,
                error: "Connection not approved. Please approve this site in the NoXu wallet popup.",
                requiresApproval: true,
                origin,
              });
            }
            break;
          }

          case "APPROVE_ORIGIN": {
            // Called from popup UI when user explicitly approves a site
            const { origin: approveOrigin } = message.payload;
            if (approveOrigin && typeof approveOrigin === "string") {
              approvedOrigins.add(approveOrigin);
              sendResponse({ ok: true, approved: true });
            } else {
              sendResponse({ ok: false, error: "Invalid origin" });
            }
            break;
          }

          case "REVOKE_ORIGIN": {
            // Called from popup UI when user revokes a site
            const { origin: revokeOrigin } = message.payload;
            if (revokeOrigin && typeof revokeOrigin === "string") {
              approvedOrigins.delete(revokeOrigin);
              sendResponse({ ok: true });
            } else {
              sendResponse({ ok: false, error: "Invalid origin" });
            }
            break;
          }

          case "GET_APPROVED_ORIGINS": {
            sendResponse({ ok: true, origins: Array.from(approvedOrigins) });
            break;
          }

          case "DISCONNECT_REQUEST": {
            const origin = sender.origin || sender.url || "";
            approvedOrigins.delete(origin);
            sendResponse({ ok: true });
            break;
          }

          case "SIGN_TX": {
            // Placeholder: implement real signing when you have raw tx bytes, etc.
            sendResponse({ ok: true, signature: "stub-signature" });
            break;
          }

          case "SIGN_AND_SEND": {
            const { to, amount } = message.payload;
            const txid = await wallet.sendTransaction(to, BigInt(amount));
            sendResponse({ ok: true, txid });
            break;
          }

          case "GET_AUTO_LOCK": {
            sendResponse({ ok: true, autoLockMinutes: settings.autoLockMinutes });
            break;
          }

          case "SET_AUTO_LOCK": {
            const { minutes } = message.payload;
            if (typeof minutes === "number" && minutes >= 0) {
              settings.autoLockMinutes = minutes;
              await persistSettings();
              resetAutoLockTimer();
            }
            sendResponse({ ok: true, autoLockMinutes: settings.autoLockMinutes });
            break;
          }

          default: {
            console.warn("[wallet] Unknown RPC message:", message);
            sendResponse({ ok: false, error: "Unknown message" });
            break;
          }
        }
      } catch (err: any) {
        console.error("[wallet] RPC error:", err);
        sendResponse({
          ok: false,
          error: err?.message || String(err),
        });
      }
    };

    // Fire and forget, but keep the message channel open for async response
    handler();
    return true;
  }
);

// Auto-lock on idle/locked like Phantom for safety.
chrome.idle.onStateChanged.addListener((state) => {
  if (state === "idle" || state === "locked") {
    wallet.lock();
  }
});
