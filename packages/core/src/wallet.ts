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
  type HardwareAccount,
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

export type WalletType = "software" | "hardware";

export type WalletState = {
  network: KaspaNetwork;
  walletType: WalletType;
  account?: DerivedAccount;
  hardwareAccount?: HardwareAccount;
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
    this.state = { network, walletType: "software", isUnlocked: false };
    this.client = new KaspaClient(getNetworkConfig(network));
  }

  private rebuildClient() {
    this.client = new KaspaClient(
      getNetworkConfig(this.state.network, this.state.customRpcUrls)
    );
  }

  getAccount(): DerivedAccount | HardwareAccount | undefined {
    if (this.state.walletType === "hardware") return this.state.hardwareAccount;
    return this.state.account;
  }

  getNetwork(): KaspaNetwork {
    return this.state.network;
  }

  getWalletType(): WalletType {
    return this.state.walletType;
  }

  isHardwareWallet(): boolean {
    return this.state.walletType === "hardware";
  }

  hasWallet(): boolean {
    return !!this.state.encryptedSeed || !!this.state.hardwareAccount;
  }

  /**
   * Connect a hardware wallet (Ledger).
   * No seed or private key is stored — only the public key and address.
   */
  connectHardwareWallet(publicKey: Uint8Array, address: string, derivationPath: string) {
    const hardwareAccount: HardwareAccount = {
      publicKey,
      address,
      derivationPath,
      type: "ledger",
    };

    this.state = {
      ...this.state,
      walletType: "hardware",
      hardwareAccount,
      account: undefined,
      encryptedSeed: undefined,
      encryptedMnemonic: undefined,
      isUnlocked: true,
    };
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

    // Restore hardware account if present
    let hardwareAccount: HardwareAccount | undefined;
    const hw = d.hardwareAccount as Record<string, unknown> | undefined;
    if (hw && hw.type === "ledger" && typeof hw.address === "string" && typeof hw.derivationPath === "string") {
      hardwareAccount = {
        publicKey: hw.publicKey instanceof Uint8Array
          ? hw.publicKey
          : new Uint8Array(Object.values(hw.publicKey as Record<string, number>)),
        address: hw.address as string,
        derivationPath: hw.derivationPath as string,
        type: "ledger",
      };
    }

    const walletType: WalletType = hardwareAccount ? "hardware" : "software";

    this.state = {
      network,
      walletType,
      hardwareAccount,
      encryptedSeed: isEncryptedPayload(d.encryptedSeed)
        ? d.encryptedSeed
        : undefined,
      encryptedMnemonic: isEncryptedPayload(d.encryptedMnemonic)
        ? d.encryptedMnemonic
        : undefined,
      isUnlocked: walletType === "hardware", // Hardware wallets are always "unlocked" (no password)
      customRpcUrls: Object.keys(customRpcUrls).length > 0 ? customRpcUrls : undefined,
    };

    // Make sure client matches restored network and custom RPC URLs
    this.rebuildClient();
  }

  getPersistentState() {
    return {
      network: this.state.network,
      walletType: this.state.walletType,
      hardwareAccount: this.state.hardwareAccount,
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
    if (!this.state.encryptedSeed) throw new Error("No wallet found. Please create or import a wallet first.");

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
    // Wipe private key from memory before clearing account (software wallets only)
    if (this.state.account?.privateKey) {
      wipeBytes(this.state.account.privateKey);
    }
    if (this.state.account?.publicKey) {
      wipeBytes(this.state.account.publicKey);
    }

    this.state = {
      network: this.state.network,
      walletType: this.state.walletType,
      hardwareAccount: this.state.hardwareAccount,
      encryptedSeed: this.state.encryptedSeed,
      encryptedMnemonic: this.state.encryptedMnemonic,
      customRpcUrls: this.state.customRpcUrls,
      isUnlocked: this.state.walletType === "hardware", // Hardware wallets stay "unlocked"
    };
  }

  async getBalance(): Promise<number> {
    const address = this.state.account?.address;
    if (!address) throw new Error("Your wallet is locked. Please unlock it to continue.");
    return this.client.getBalance(address);
  }

  async getUTXOs(): Promise<KaspaUTXO[]> {
    const address = this.state.account?.address;
    if (!address) throw new Error("Your wallet is locked. Please unlock it to continue.");
    return this.client.getUTXOs(address);
  }

  async getHistory(): Promise<KaspaTx[]> {
    const address = this.state.account?.address;
    if (!address) throw new Error("Your wallet is locked. Please unlock it to continue.");
    return this.client.getTransactions(address);
  }

  async sendTransaction(to: string, amountSompi: bigint): Promise<string> {
    const account = this.state.account;
    if (!account) throw new Error("Your wallet is locked. Please unlock it to continue.");
    return this.client.buildSignBroadcast(account, to, amountSompi);
  }

  async exportMnemonic(password: string): Promise<string> {
    if (!this.state.encryptedMnemonic) throw new Error("Recovery phrase is not available. This may be a hardware wallet.");
    const raw = await decryptSecret(password, this.state.encryptedMnemonic);
    const mnemonic = new TextDecoder().decode(raw);
    // Wipe decrypted bytes from memory
    wipeBytes(raw);
    return mnemonic;
  }
}
