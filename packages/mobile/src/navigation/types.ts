import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

// Root stack
export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Main: undefined;
};

// Onboarding stack
export type OnboardingStackParamList = {
  Welcome: undefined;
  CreateWallet: undefined;
  ImportWallet: undefined;
  SeedPhrase: { mnemonic: string; isBackup: boolean };
  ConfirmSeed: { mnemonic: string };
};

// Main tabs
export type MainTabParamList = {
  Home: undefined;
  Send: { token?: string; to?: string } | undefined;
  Receive: undefined;
  Activity: undefined;
  Settings: undefined;
};

// Main stack (wraps tabs + detail screens)
export type MainStackParamList = {
  Tabs: undefined;
  TokenDetail: { tick: string; isNative: boolean };
  TransactionDetail: { tx: any };
  SendStack: { token?: string; to?: string };
  ReceiveStack: undefined;
  PnL: undefined;
  WatchDetail: { address: string; label: string };
};

// Screen props helpers
export type RootScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type OnboardingScreenProps<T extends keyof OnboardingStackParamList> =
  NativeStackScreenProps<OnboardingStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  BottomTabScreenProps<MainTabParamList, T>;

export type MainStackScreenProps<T extends keyof MainStackParamList> =
  NativeStackScreenProps<MainStackParamList, T>;
