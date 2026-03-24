import { create } from "zustand";
import {
  DEFAULT_SECURITY_FEATURES,
  type DerivedAccount,
  type KaspaNetwork,
  type SecurityFeaturesState,
  type AddressBook,
  type KaspaTx,
} from "@noxu/core";

export type TokenBalance = {
  tick: string;
  balance: string;
  locked: string;
  decimals: number;
};

type WalletState = {
  // Wallet state
  hasWallet: boolean;
  isUnlocked: boolean;
  account?: DerivedAccount;
  network: KaspaNetwork;

  // Balances
  balance?: number;
  tokenBalances?: TokenBalance[];
  tokenBalancesLoading: boolean;

  // Activity
  history?: KaspaTx[];

  // Price
  kasPrice?: number;
  kasChange24h?: number;
  currency: string;

  // Security
  securityFeatures?: SecurityFeaturesState;
  isDuressMode: boolean;

  // Address book
  addressBook?: AddressBook;

  // Settings
  autoLockMinutes: number;
  biometricEnabled: boolean;

  // Sync status
  syncError?: string;

  // Actions
  setHasWallet: (val: boolean) => void;
  setUnlocked: (val: boolean) => void;
  setAccount: (acc?: DerivedAccount) => void;
  setNetwork: (network: KaspaNetwork) => void;
  setBalance: (val?: number) => void;
  setTokenBalances: (val?: TokenBalance[]) => void;
  setTokenBalancesLoading: (val: boolean) => void;
  setHistory: (val?: KaspaTx[]) => void;
  setKasPrice: (price: number, change24h: number) => void;
  setCurrency: (currency: string) => void;
  setSecurityFeatures: (sf: SecurityFeaturesState) => void;
  setIsDuressMode: (val: boolean) => void;
  setAddressBook: (ab: AddressBook) => void;
  setAutoLockMinutes: (min: number) => void;
  setBiometricEnabled: (val: boolean) => void;
  setSyncError: (err?: string) => void;
  reset: () => void;
};

const initialState = {
  hasWallet: false,
  isUnlocked: false,
  account: undefined,
  network: "mainnet" as KaspaNetwork,
  balance: undefined,
  tokenBalances: undefined,
  tokenBalancesLoading: false,
  history: undefined,
  kasPrice: undefined,
  kasChange24h: undefined,
  currency: "usd",
  securityFeatures: DEFAULT_SECURITY_FEATURES,
  isDuressMode: false,
  addressBook: undefined,
  autoLockMinutes: 5,
  biometricEnabled: false,
  syncError: undefined,
};

export const useWalletStore = create<WalletState>((set) => ({
  ...initialState,

  setHasWallet: (hasWallet) => set({ hasWallet }),
  setUnlocked: (isUnlocked) => set({ isUnlocked }),
  setAccount: (account) => set({ account }),
  setNetwork: (network) => set({ network }),
  setBalance: (balance) => set({ balance }),
  setTokenBalances: (tokenBalances) => set({ tokenBalances }),
  setTokenBalancesLoading: (tokenBalancesLoading) => set({ tokenBalancesLoading }),
  setHistory: (history) => set({ history }),
  setKasPrice: (kasPrice, kasChange24h) => set({ kasPrice, kasChange24h }),
  setCurrency: (currency) => set({ currency }),
  setSecurityFeatures: (securityFeatures) => set({ securityFeatures }),
  setIsDuressMode: (isDuressMode) => set({ isDuressMode }),
  setAddressBook: (addressBook) => set({ addressBook }),
  setAutoLockMinutes: (autoLockMinutes) => set({ autoLockMinutes }),
  setBiometricEnabled: (biometricEnabled) => set({ biometricEnabled }),
  setSyncError: (syncError) => set({ syncError }),
  reset: () => set(initialState),
}));
