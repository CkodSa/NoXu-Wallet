// src/background/index.ts

import browser from "webextension-polyfill";
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
const initPromise = Promise.all([loadPersistedWallet(), loadSettings()]);

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
            const { account, needsPersist } = await wallet.unlock(password);
            // Persist if encryption was migrated to newer version
            if (needsPersist) {
              await persistWallet();
            }
            // Start auto-lock timer
            resetAutoLockTimer();
            return { ok: true, account };
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
            const balance = await wallet.getBalance();
            return { ok: true, balance };
          }

          case "GET_HISTORY": {
            const history = await wallet.getHistory();
            return { ok: true, history };
          }

          case "EXPORT_SEED": {
            const { password } = message.payload;
            const mnemonic = await wallet.exportMnemonic(password);
            return { ok: true, mnemonic };
          }

          case "SEND_TX": {
            const { to, amount } = message.payload;
            const txid = await wallet.sendTransaction(to, BigInt(amount));
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
