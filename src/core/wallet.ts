// src/core/wallet.ts

import {
  DEFAULT_NETWORK,
  getNetworkConfig,
  type CustomRpcUrls,
  type KaspaNetwork,
} from "./networks";
import {
  createMnemonic,
  deriveAccountFromSeed,
  mnemonicToSeed,
  type DerivedAccount,
} from "./crypto/mnemonic";
import {
  decryptSecret,
  encryptSecret,
  needsMigration,
  migrateEncryption,
  type EncryptedPayload,
} from "./crypto/encryption";
import { wipeBytes } from "./crypto/secure";
import { KaspaClient, type KaspaUTXO, type KaspaTx } from "./kaspa/client";

export type WalletState = {
  network: KaspaNetwork;
  account?: DerivedAccount;
  encryptedSeed?: EncryptedPayload;
  encryptedMnemonic?: EncryptedPayload;
  isUnlocked: boolean;
  mnemonicTransient?: string;
  customRpcUrls?: CustomRpcUrls;
};

const isKaspaNetwork = (v: unknown): v is KaspaNetwork =>
  v === "mainnet" || v === "testnet";

// Defensive check for persisted encryption payloads
const isEncryptedPayload = (p: unknown): p is EncryptedPayload => {
  if (!p || typeof p !== "object") return false;
  const anyP = p as Record<string, unknown>;
  return (
    typeof anyP.version === "number" &&
    typeof anyP.salt === "string" &&
    typeof anyP.iv === "string" &&
    typeof anyP.ciphertext === "string"
  );
};

export class Wallet {
  private state: WalletState;
  private client: KaspaClient;

  constructor(network: KaspaNetwork = DEFAULT_NETWORK) {
    this.state = { network, isUnlocked: false };
    this.client = new KaspaClient(getNetworkConfig(network));
  }

  private rebuildClient() {
    this.client = new KaspaClient(
      getNetworkConfig(this.state.network, this.state.customRpcUrls)
    );
  }

  getAccount(): DerivedAccount | undefined {
    return this.state.account;
  }

  getNetwork(): KaspaNetwork {
    return this.state.network;
  }

  hasWallet(): boolean {
    return !!this.state.encryptedSeed;
  }

  switchNetwork(network: KaspaNetwork) {
    this.state.network = network;
    this.rebuildClient();
  }

  getCustomRpcUrls(): CustomRpcUrls {
    return this.state.customRpcUrls || {};
  }

  setCustomRpcUrl(network: KaspaNetwork, rpcUrl: string | null) {
    const customRpcUrls = { ...this.state.customRpcUrls };
    if (rpcUrl) {
      customRpcUrls[network] = rpcUrl;
    } else {
      delete customRpcUrls[network];
    }
    this.state.customRpcUrls = customRpcUrls;
    this.rebuildClient();
  }

  /**
   * Restore only the parts we actually persist.
   * Accepts unknown input and validates shape.
   */
  restoreFromStorage(data: unknown) {
    const d =
      data && typeof data === "object"
        ? (data as Partial<WalletState>)
        : ({} as Partial<WalletState>);

    // Always use DEFAULT_NETWORK as fallback to ensure mainnet is used
    // when storage doesn't have a valid network value
    const network: KaspaNetwork = isKaspaNetwork(d.network)
      ? d.network
      : DEFAULT_NETWORK;

    // Validate customRpcUrls shape
    const customRpcUrls: CustomRpcUrls = {};
    if (d.customRpcUrls && typeof d.customRpcUrls === "object") {
      const raw = d.customRpcUrls as Record<string, unknown>;
      if (typeof raw.testnet === "string") customRpcUrls.testnet = raw.testnet;
      if (typeof raw.mainnet === "string") customRpcUrls.mainnet = raw.mainnet;
    }

    this.state = {
      network,
      encryptedSeed: isEncryptedPayload(d.encryptedSeed)
        ? d.encryptedSeed
        : undefined,
      encryptedMnemonic: isEncryptedPayload(d.encryptedMnemonic)
        ? d.encryptedMnemonic
        : undefined,
      isUnlocked: false,
      customRpcUrls: Object.keys(customRpcUrls).length > 0 ? customRpcUrls : undefined,
    };

    // Make sure client matches restored network and custom RPC URLs
    this.rebuildClient();
  }

  getPersistentState() {
    return {
      network: this.state.network,
      encryptedSeed: this.state.encryptedSeed,
      encryptedMnemonic: this.state.encryptedMnemonic,
      customRpcUrls: this.state.customRpcUrls,
    };
  }

  async createNewWallet(
    password: string,
    strength: 128 | 256 = 128
  ): Promise<WalletState> {
    const { mnemonic, seed } = createMnemonic(strength);

    const isTestnet = this.state.network === "testnet";
    const account = deriveAccountFromSeed(seed, isTestnet);
    const encryptedSeed = await encryptSecret(password, seed);
    const encryptedMnemonic = await encryptSecret(
      password,
      new TextEncoder().encode(mnemonic)
    );

    // Wipe sensitive seed from memory after encryption
    wipeBytes(seed);

    this.state = {
      ...this.state,
      encryptedSeed,
      encryptedMnemonic,
      account,
      isUnlocked: true,
    };

    // Only return mnemonic transiently; do not keep it in state permanently
    return { ...this.state, mnemonicTransient: mnemonic };
  }

  async importFromMnemonic(password: string, mnemonic: string): Promise<WalletState> {
    const { seed } = mnemonicToSeed(mnemonic);

    const account = deriveAccountFromSeed(seed, this.state.network === "testnet");
    const encryptedSeed = await encryptSecret(password, seed);
    const encryptedMnemonic = await encryptSecret(
      password,
      new TextEncoder().encode(mnemonic)
    );

    // Wipe sensitive seed from memory after encryption
    wipeBytes(seed);

    this.state = {
      ...this.state,
      encryptedSeed,
      encryptedMnemonic,
      account,
      isUnlocked: true,
    };

    return this.state;
  }

  /**
   * Unlock the wallet with password.
   * Returns { account, needsPersist } - caller should persist if needsPersist is true
   * (encryption was migrated to newer version)
   */
  async unlock(password: string): Promise<{ account: DerivedAccount; needsPersist: boolean }> {
    if (!this.state.encryptedSeed) throw new Error("Wallet not initialized");

    const seed = await decryptSecret(password, this.state.encryptedSeed);
    const account = deriveAccountFromSeed(seed, this.state.network === "testnet");

    // Wipe sensitive seed from memory after derivation
    wipeBytes(seed);

    // Check if encryption needs migration to Argon2id
    let needsPersist = false;
    if (needsMigration(this.state.encryptedSeed)) {
      this.state.encryptedSeed = await migrateEncryption(password, this.state.encryptedSeed);
      needsPersist = true;
    }
    if (this.state.encryptedMnemonic && needsMigration(this.state.encryptedMnemonic)) {
      this.state.encryptedMnemonic = await migrateEncryption(password, this.state.encryptedMnemonic);
      needsPersist = true;
    }

    this.state = { ...this.state, account, isUnlocked: true };
    return { account, needsPersist };
  }

  lock() {
    // Wipe private key from memory before clearing account
    if (this.state.account?.privateKey) {
      wipeBytes(this.state.account.privateKey);
    }
    if (this.state.account?.publicKey) {
      wipeBytes(this.state.account.publicKey);
    }

    this.state = {
      network: this.state.network,
      encryptedSeed: this.state.encryptedSeed,
      encryptedMnemonic: this.state.encryptedMnemonic,
      customRpcUrls: this.state.customRpcUrls,
      isUnlocked: false,
    };
  }

  async getBalance(): Promise<number> {
    const address = this.state.account?.address;
    if (!address) throw new Error("Wallet locked");
    return this.client.getBalance(address);
  }

  async getUTXOs(): Promise<KaspaUTXO[]> {
    const address = this.state.account?.address;
    if (!address) throw new Error("Wallet locked");
    return this.client.getUTXOs(address);
  }

  async getHistory(): Promise<KaspaTx[]> {
    const address = this.state.account?.address;
    if (!address) throw new Error("Wallet locked");
    return this.client.getTransactions(address);
  }

  async sendTransaction(to: string, amountSompi: bigint): Promise<string> {
    const account = this.state.account;
    if (!account) throw new Error("Wallet locked");
    return this.client.buildSignBroadcast(account, to, amountSompi);
  }

  async exportMnemonic(password: string): Promise<string> {
    if (!this.state.encryptedMnemonic) throw new Error("Seed not available");
    const raw = await decryptSecret(password, this.state.encryptedMnemonic);
    const mnemonic = new TextDecoder().decode(raw);
    // Wipe decrypted bytes from memory
    wipeBytes(raw);
    return mnemonic;
  }
}
