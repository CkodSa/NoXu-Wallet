import { useRef, useCallback } from "react";
import {
  Wallet,
  DEFAULT_NETWORK,
  DEFAULT_SECURITY_FEATURES,
  KRC20TransferClient,
  getNetworkConfig,
  parseTokenAmount,
  type SecurityFeaturesState,
  type AddressBook,
  type KaspaNetwork,
  type KRC20TransferResult,
} from "@noxu/core";
import { mobileStorage, generalStorage } from "../platform/storage";
import { useWalletStore } from "../store";

// Singleton wallet instance
let walletInstance: Wallet | null = null;

function getWallet(): Wallet {
  if (!walletInstance) {
    walletInstance = new Wallet(DEFAULT_NETWORK);
  }
  return walletInstance;
}

const STORAGE_KEYS = {
  walletState: "kaspa_wallet_state",
  settings: "noxu_settings",
  securityFeatures: "noxu_security_features",
  addressBook: "noxu_address_book",
};

export function useWalletService() {
  const store = useWalletStore();

  const initialize = useCallback(async () => {
    const wallet = getWallet();

    // Restore wallet state from storage
    const savedState = await mobileStorage.get(STORAGE_KEYS.walletState);
    if (savedState) {
      wallet.restoreFromStorage(savedState);
      store.setHasWallet(wallet.hasWallet());
      store.setNetwork(wallet.getNetwork());
    }

    // Load settings
    const settings = (await generalStorage.get(STORAGE_KEYS.settings)) as any;
    if (settings) {
      if (settings.currency) store.setCurrency(settings.currency);
      if (settings.autoLockMinutes) store.setAutoLockMinutes(settings.autoLockMinutes);
      if (settings.biometricEnabled) store.setBiometricEnabled(settings.biometricEnabled);
    }

    // Load security features
    const sf = (await generalStorage.get(STORAGE_KEYS.securityFeatures)) as SecurityFeaturesState | null;
    store.setSecurityFeatures(sf || DEFAULT_SECURITY_FEATURES);

    // Load address book
    const ab = (await generalStorage.get(STORAGE_KEYS.addressBook)) as AddressBook | null;
    if (ab) store.setAddressBook(ab);
  }, []);

  const createWallet = useCallback(async (password: string, wordCount: 12 | 24) => {
    const wallet = getWallet();
    const strength = wordCount === 24 ? 256 : 128;
    const state = await wallet.createNewWallet(password, strength as 128 | 256);

    // Persist encrypted state
    await mobileStorage.set(STORAGE_KEYS.walletState, wallet.getPersistentState());

    store.setHasWallet(true);
    store.setUnlocked(true);
    store.setAccount(state.account);

    return state.mnemonicTransient;
  }, []);

  const importWallet = useCallback(async (password: string, mnemonic: string) => {
    const wallet = getWallet();
    const state = await wallet.importFromMnemonic(password, mnemonic);

    await mobileStorage.set(STORAGE_KEYS.walletState, wallet.getPersistentState());

    store.setHasWallet(true);
    store.setUnlocked(true);
    store.setAccount(state.account);
  }, []);

  const unlock = useCallback(async (password: string) => {
    const wallet = getWallet();
    const { account, needsPersist } = await wallet.unlock(password);

    if (needsPersist) {
      await mobileStorage.set(STORAGE_KEYS.walletState, wallet.getPersistentState());
    }

    store.setUnlocked(true);
    store.setAccount(account);
  }, []);

  const lock = useCallback(() => {
    const wallet = getWallet();
    wallet.lock();
    store.setUnlocked(false);
    store.setAccount(undefined);
    store.setBalance(undefined);
    store.setHistory(undefined);
    store.setTokenBalances(undefined);
  }, []);

  const refreshBalance = useCallback(async () => {
    const wallet = getWallet();
    try {
      const balance = await wallet.getBalance();
      store.setBalance(balance);
      store.setSyncError(undefined);
    } catch (err: any) {
      console.warn("[wallet] Failed to refresh balance:", err);
      store.setSyncError("Failed to sync balance. Pull to retry.");
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    const wallet = getWallet();
    try {
      const history = await wallet.getHistory();
      store.setHistory(history);
    } catch (err: any) {
      console.warn("[wallet] Failed to refresh history:", err);
      store.setSyncError("Failed to sync history. Pull to retry.");
    }
  }, []);

  const sendTransaction = useCallback(async (to: string, amountSompi: bigint) => {
    const wallet = getWallet();
    return wallet.sendTransaction(to, amountSompi);
  }, []);

  const sendKRC20Transfer = useCallback(async (
    to: string,
    tick: string,
    amount: string,
    decimals: number,
  ): Promise<KRC20TransferResult> => {
    const wallet = getWallet();
    const account = wallet.getAccount();
    if (!account || !("privateKey" in account) || !account.privateKey || !account.publicKey) {
      throw new Error("Your wallet is locked. Please unlock it to continue.");
    }

    const networkConfig = getNetworkConfig(wallet.getNetwork());
    const transferClient = new KRC20TransferClient(wallet.getNetwork(), networkConfig);
    const utxos = await wallet.getUTXOs();
    const parsedAmount = parseTokenAmount(amount, decimals);

    return transferClient.executeTransfer(
      utxos,
      account.privateKey,
      account.publicKey,
      to,
      tick,
      parsedAmount,
      account.address,
    );
  }, []);

  const exportMnemonic = useCallback(async (password: string) => {
    const wallet = getWallet();
    return wallet.exportMnemonic(password);
  }, []);

  const deleteWallet = useCallback(async () => {
    const wallet = getWallet();
    wallet.lock();
    await mobileStorage.remove(STORAGE_KEYS.walletState);
    await generalStorage.remove(STORAGE_KEYS.settings);
    await generalStorage.remove(STORAGE_KEYS.securityFeatures);
    await generalStorage.remove(STORAGE_KEYS.addressBook);
    walletInstance = null;
    store.reset();
  }, []);

  const persistSettings = useCallback(async (settings: Record<string, any>) => {
    const current = ((await generalStorage.get(STORAGE_KEYS.settings)) as any) || {};
    await generalStorage.set(STORAGE_KEYS.settings, { ...current, ...settings });
  }, []);

  const persistSecurityFeatures = useCallback(async (sf: SecurityFeaturesState) => {
    store.setSecurityFeatures(sf);
    await generalStorage.set(STORAGE_KEYS.securityFeatures, sf);
  }, []);

  const persistAddressBook = useCallback(async (ab: AddressBook) => {
    store.setAddressBook(ab);
    await generalStorage.set(STORAGE_KEYS.addressBook, ab);
  }, []);

  return {
    initialize,
    createWallet,
    importWallet,
    unlock,
    lock,
    refreshBalance,
    refreshHistory,
    sendTransaction,
    sendKRC20Transfer,
    exportMnemonic,
    deleteWallet,
    persistSettings,
    persistSecurityFeatures,
    persistAddressBook,
    getWallet,
  };
}
