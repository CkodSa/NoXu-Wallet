import { create } from "zustand";
import type { DerivedAccount, HardwareAccount, WalletType } from "@noxu/core";

// KRC-20 token balance (serialized for JSON)
export type TokenBalance = {
  tick: string;
  balance: string; // BigInt as string
  locked: string;
  decimals: number;
};

type WalletSlice = {
  account?: DerivedAccount | HardwareAccount;
  walletType: WalletType;
  balance?: number;
  tokenBalances?: TokenBalance[];
  tokenBalancesLoading: boolean;
  ledgerConnected: boolean;
  setAccount: (acc?: DerivedAccount | HardwareAccount) => void;
  setWalletType: (val: WalletType) => void;
  setBalance: (val?: number) => void;
  setTokenBalances: (val?: TokenBalance[]) => void;
  setTokenBalancesLoading: (val: boolean) => void;
  setLedgerConnected: (val: boolean) => void;
};

export const useWalletStore = create<WalletSlice>((set) => ({
  walletType: "software",
  balance: undefined,
  tokenBalances: undefined,
  tokenBalancesLoading: false,
  ledgerConnected: false,
  setAccount: (account) => set({ account }),
  setWalletType: (walletType) => set({ walletType }),
  setBalance: (balance) => set({ balance }),
  setTokenBalances: (tokenBalances) => set({ tokenBalances }),
  setTokenBalancesLoading: (tokenBalancesLoading) => set({ tokenBalancesLoading }),
  setLedgerConnected: (ledgerConnected) => set({ ledgerConnected }),
}));
