import { create } from "zustand";
import type { DerivedAccount } from "@noxu/core";

// KRC-20 token balance (serialized for JSON)
export type TokenBalance = {
  tick: string;
  balance: string; // BigInt as string
  locked: string;
  decimals: number;
};

type WalletSlice = {
  account?: DerivedAccount;
  balance?: number;
  tokenBalances?: TokenBalance[];
  tokenBalancesLoading: boolean;
  setAccount: (acc?: DerivedAccount) => void;
  setBalance: (val?: number) => void;
  setTokenBalances: (val?: TokenBalance[]) => void;
  setTokenBalancesLoading: (val: boolean) => void;
};

export const useWalletStore = create<WalletSlice>((set) => ({
  balance: undefined,
  tokenBalances: undefined,
  tokenBalancesLoading: false,
  setAccount: (account) => set({ account }),
  setBalance: (balance) => set({ balance }),
  setTokenBalances: (tokenBalances) => set({ tokenBalances }),
  setTokenBalancesLoading: (tokenBalancesLoading) => set({ tokenBalancesLoading }),
}));
