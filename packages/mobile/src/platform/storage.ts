// Storage adapters for React Native
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StorageProvider } from "@noxu/core";

/** Secure storage for sensitive data (encrypted seed, mnemonic) */
export const secureStorage: StorageProvider = {
  async get(key: string): Promise<unknown> {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },

  async set(key: string, value: unknown): Promise<void> {
    await SecureStore.setItemAsync(key, JSON.stringify(value), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};

/** General storage for non-sensitive data (settings, PnL, address book) */
export const generalStorage: StorageProvider = {
  async get(key: string): Promise<unknown> {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },

  async set(key: string, value: unknown): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },

  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

/**
 * Composite storage that routes sensitive keys to SecureStore
 * and everything else to AsyncStorage.
 */
const SENSITIVE_KEYS = new Set(["kaspa_wallet_state"]);

export const mobileStorage: StorageProvider = {
  async get(key: string): Promise<unknown> {
    if (SENSITIVE_KEYS.has(key)) {
      return secureStorage.get(key);
    }
    return generalStorage.get(key);
  },

  async set(key: string, value: unknown): Promise<void> {
    if (SENSITIVE_KEYS.has(key)) {
      return secureStorage.set(key, value);
    }
    return generalStorage.set(key, value);
  },

  async remove(key: string): Promise<void> {
    if (SENSITIVE_KEYS.has(key)) {
      return secureStorage.remove(key);
    }
    return generalStorage.remove(key);
  },
};
