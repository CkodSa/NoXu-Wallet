import { create } from "zustand";
import type { DerivedAccount } from "../core/crypto/mnemonic";

// KRC-20 token balance (serialized for JSON)
export type TokenBalance = {
  tick: string;
  balance: string; // BigInt as string
  locked: string;
  decimals: number;
};

type WalletSlice = {
  account?: DerivedAccount;
  isUnlocked: boolean;
  balance?: number;
  history?: any[];
  tokenBalances?: TokenBalance[];
  tokenBalancesLoading: boolean;
  setAccount: (acc?: DerivedAccount) => void;
  setUnlocked: (val: boolean) => void;
  setBalance: (val?: number) => void;
  setHistory: (val?: any[]) => void;
  setTokenBalances: (val?: TokenBalance[]) => void;
  setTokenBalancesLoading: (val: boolean) => void;
};

export const useWalletStore = create<WalletSlice>((set) => ({
  isUnlocked: false,
  balance: undefined,
  tokenBalances: undefined,
  tokenBalancesLoading: false,
  setAccount: (account) => set({ account }),
  setUnlocked: (isUnlocked) => set({ isUnlocked }),
  setBalance: (balance) => set({ balance }),
  setHistory: (history) => set({ history }),
  setTokenBalances: (tokenBalances) => set({ tokenBalances }),
  setTokenBalancesLoading: (tokenBalancesLoading) => set({ tokenBalancesLoading }),
}));
