import { create } from "zustand";
import type { DerivedAccount } from "../core/crypto/mnemonic";

type WalletSlice = {
  account?: DerivedAccount;
  isUnlocked: boolean;
  balance?: number;
  history?: any[];
  setAccount: (acc?: DerivedAccount) => void;
  setUnlocked: (val: boolean) => void;
  setBalance: (val?: number) => void;
  setHistory: (val?: any[]) => void;
};

export const useWalletStore = create<WalletSlice>((set) => ({
  isUnlocked: false,
  balance: undefined,
  setAccount: (account) => set({ account }),
  setUnlocked: (isUnlocked) => set({ isUnlocked }),
  setBalance: (balance) => set({ balance }),
  setHistory: (history) => set({ history })
}));
