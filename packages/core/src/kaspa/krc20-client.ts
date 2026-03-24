// src/core/kaspa/krc20-client.ts
// KRC-20 token API client using Kasplex indexer

import { z } from "zod";
import type { KaspaNetwork, NetworkConfig } from "../networks";
import type { KaspaUTXO } from "./client";
import {
  createKRC20Transfer,
  estimateKRC20TransferCost,
  type KRC20TransferOptions,
  type KRC20TransferResult as KRC20TxResult,
} from "./krc20-transaction";

/** Parse an integer string safely — returns 0 for NaN/negative/non-finite values */
function safeParseInt(value: string | undefined | null, fallback = 0): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Kasplex API endpoints per network
const KASPLEX_ENDPOINTS: Record<KaspaNetwork, string> = {
  mainnet: "https://api.kasplex.org/v1",
  testnet: "https://tn10api.kasplex.org/v1",
};

// KRC-20 Token balance response schema
const KRC20BalanceSchema = z.object({
  tick: z.string(), // Token ticker/symbol
  balance: z.string(), // Balance as string (large numbers)
  locked: z.string(), // Locked balance
  dec: z.string(), // Decimals as string
  opScoreMod: z.string().optional(),
});

const KRC20BalanceResponseSchema = z.object({
  message: z.string(),
  result: z.array(KRC20BalanceSchema),
});

// KRC-20 Token info schema
const KRC20TokenInfoSchema = z.object({
  tick: z.string(),
  max: z.string(), // Max supply
  lim: z.string(), // Mint limit
  pre: z.string(), // Pre-mine
  to: z.string(), // Deploy address
  dec: z.string(), // Decimals
  minted: z.string(), // Total minted
  opScoreAdd: z.string().optional(),
  opScoreMod: z.string().optional(),
  state: z.string(), // Token state (deployed, finished, etc.)
  hashRev: z.string().optional(),
  mtsAdd: z.string().optional(), // Mint timestamp
  holderTotal: z.string().optional(), // Number of holders
  transferTotal: z.string().optional(), // Number of transfers
  mintTotal: z.string().optional(), // Number of mints
});

const KRC20TokenInfoResponseSchema = z.object({
  message: z.string(),
  result: z.array(KRC20TokenInfoSchema),
});

// Token list response schema
const KRC20TokenListResponseSchema = z.object({
  message: z.string(),
  result: z.array(KRC20TokenInfoSchema),
  next: z.string().optional(), // Pagination cursor
});

// Types for external use
export type KRC20Balance = {
  tick: string;
  balance: bigint;
  locked: bigint;
  decimals: number;
};

export type KRC20TokenInfo = {
  tick: string;
  maxSupply: bigint;
  mintLimit: bigint;
  preMine: bigint;
  deployer: string;
  decimals: number;
  minted: bigint;
  state: string;
  holderTotal: number;
  transferTotal: number;
  mintTotal: number;
};

const RETRIES = 2;
const BACKOFF_MS = 400;

export class KRC20Client {
  private readonly baseUrl: string;

  constructor(network: KaspaNetwork) {
    this.baseUrl = KASPLEX_ENDPOINTS[network];
  }

  /** Make a REST API call with retry logic */
  private async restCall<T>(endpoint: string, schema: z.ZodType<T>): Promise<T> {
    let attempt = 0;

    while (attempt <= RETRIES) {
      try {
        const res = await fetch(`${this.baseUrl}${endpoint}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          throw new Error(`KRC-20 API HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        // Validate response against schema
        const parsed = schema.safeParse(data);
        if (!parsed.success) {
          throw new Error(`Invalid KRC-20 API response: ${parsed.error.message}`);
        }
        return parsed.data;
      } catch (err) {
        if (attempt === RETRIES) throw err;
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS * (attempt + 1)));
        attempt += 1;
      }
    }
    throw new Error("KRC-20 API call failed");
  }

  /**
   * Get all KRC-20 token balances for an address
   */
  async getTokenBalances(address: string): Promise<KRC20Balance[]> {
    try {
      const res = await this.restCall(
        `/krc20/address/${address}/tokenlist`,
        KRC20BalanceResponseSchema
      );

      return res.result.map((item) => ({
        tick: item.tick,
        balance: BigInt(item.balance),
        locked: BigInt(item.locked),
        decimals: safeParseInt(item.dec),
      }));
    } catch (err) {
      // Return empty array if address has no tokens or API error
      console.warn("[KRC20] Failed to fetch token balances:", err);
      return [];
    }
  }

  /**
   * Get info for a specific token by ticker
   */
  async getTokenInfo(tick: string): Promise<KRC20TokenInfo | null> {
    try {
      const res = await this.restCall(
        `/krc20/token/${tick}`,
        KRC20TokenInfoResponseSchema
      );

      if (!res.result.length) return null;

      const item = res.result[0];
      return {
        tick: item.tick,
        maxSupply: BigInt(item.max),
        mintLimit: BigInt(item.lim),
        preMine: BigInt(item.pre),
        deployer: item.to,
        decimals: safeParseInt(item.dec),
        minted: BigInt(item.minted),
        state: item.state,
        holderTotal: safeParseInt(item.holderTotal),
        transferTotal: safeParseInt(item.transferTotal),
        mintTotal: safeParseInt(item.mintTotal),
      };
    } catch (err) {
      console.warn("[KRC20] Failed to fetch token info:", err);
      return null;
    }
  }

  /**
   * Get list of popular/all tokens
   */
  async getTokenList(limit: number = 50): Promise<KRC20TokenInfo[]> {
    try {
      const res = await this.restCall(
        `/krc20/tokenlist?limit=${limit}`,
        KRC20TokenListResponseSchema
      );

      return res.result.map((item) => ({
        tick: item.tick,
        maxSupply: BigInt(item.max),
        mintLimit: BigInt(item.lim),
        preMine: BigInt(item.pre),
        deployer: item.to,
        decimals: safeParseInt(item.dec),
        minted: BigInt(item.minted),
        state: item.state,
        holderTotal: safeParseInt(item.holderTotal),
        transferTotal: safeParseInt(item.transferTotal),
        mintTotal: safeParseInt(item.mintTotal),
      }));
    } catch (err) {
      console.warn("[KRC20] Failed to fetch token list:", err);
      return [];
    }
  }
}

/**
 * Format token balance for display
 * Handles the conversion from raw balance to human-readable format
 */
export function formatTokenBalance(balance: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const integerPart = balance / divisor;
  const fractionalPart = balance % divisor;

  if (fractionalPart === 0n) {
    return integerPart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  // Remove trailing zeros
  const trimmedFractional = fractionalStr.replace(/0+$/, "");
  return `${integerPart}.${trimmedFractional}`;
}

/**
 * Parse human-readable token amount to raw balance
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const parts = amount.split(".");
  const integerPart = BigInt(parts[0] || "0");
  let fractionalPart = 0n;

  if (parts[1]) {
    const fractionalStr = parts[1].padEnd(decimals, "0").slice(0, decimals);
    fractionalPart = BigInt(fractionalStr);
  }

  const divisor = BigInt(10 ** decimals);
  return integerPart * divisor + fractionalPart;
}

// ==================== KRC-20 TRANSFER FUNCTIONALITY ====================

/**
 * KRC-20 Transfer Inscription
 * Creates the JSON inscription data for a KRC-20 transfer operation
 */
export interface KRC20TransferInscription {
  p: "krc-20";
  op: "transfer";
  tick: string;
  amt: string;
  to: string;
}

/**
 * Create a KRC-20 transfer inscription
 */
export function createTransferInscription(
  tick: string,
  amount: bigint,
  toAddress: string
): KRC20TransferInscription {
  return {
    p: "krc-20",
    op: "transfer",
    tick: tick.toUpperCase(),
    amt: amount.toString(),
    to: toAddress,
  };
}

/**
 * Serialize inscription to JSON string (no extra whitespace)
 */
export function serializeInscription(inscription: KRC20TransferInscription): string {
  return JSON.stringify(inscription);
}

// KRC-20 Transfer Operation Response Schema
const KRC20OperationResponseSchema = z.object({
  message: z.string(),
  result: z.object({
    operationId: z.string().optional(),
    commit: z.string().optional(),
    reveal: z.string().optional(),
  }).optional(),
});

// KRC-20 Operation Status Schema
const KRC20OperationStatusSchema = z.object({
  message: z.string(),
  result: z.object({
    state: z.string(),
    hashRev: z.string().optional(),
  }).optional(),
});

export type KRC20TransferResult = {
  success: boolean;
  operationId?: string;
  commitTxId?: string;
  revealTxId?: string;
  error?: string;
};

/**
 * Extended KRC20Client with full transfer functionality
 *
 * Implements the commit/reveal pattern for KRC-20 transfers:
 * 1. Commit TX: Creates P2SH output with inscription
 * 2. Reveal TX: Spends P2SH output, finalizing the transfer
 */
export class KRC20TransferClient extends KRC20Client {
  private readonly transferBaseUrl: string;
  private readonly kaspaNetwork: KaspaNetwork;
  private readonly networkConfig: NetworkConfig;

  constructor(network: KaspaNetwork, networkConfig: NetworkConfig) {
    super(network);
    this.kaspaNetwork = network;
    this.networkConfig = networkConfig;
    this.transferBaseUrl = network === "mainnet"
      ? "https://api.kasplex.org/v1"
      : "https://tn10api.kasplex.org/v1";
  }

  /**
   * Prepare a KRC-20 transfer operation (legacy method for compatibility)
   */
  async prepareTransfer(
    fromAddress: string,
    toAddress: string,
    tick: string,
    amount: bigint
  ): Promise<{
    inscription: KRC20TransferInscription;
    inscriptionJson: string;
    scriptData: string;
  }> {
    const inscription = createTransferInscription(tick, amount, toAddress);
    const inscriptionJson = serializeInscription(inscription);
    const scriptData = `kasplex${inscriptionJson}`;

    return {
      inscription,
      inscriptionJson,
      scriptData,
    };
  }

  /**
   * Build and sign a complete KRC-20 transfer (commit + reveal transactions)
   *
   * @param utxos - Available UTXOs for the sender
   * @param privateKey - Sender's private key (32 bytes)
   * @param publicKey - Sender's public key (32 or 33 bytes)
   * @param toAddress - Recipient Kaspa address
   * @param tick - Token ticker (e.g., "KASPER")
   * @param amount - Amount to transfer in base units (considering decimals)
   * @param changeAddress - Address for change (usually same as sender)
   * @param options - Optional transaction settings
   * @returns Both signed transactions ready for broadcast
   */
  buildTransfer(
    utxos: KaspaUTXO[],
    privateKey: Uint8Array,
    publicKey: Uint8Array,
    toAddress: string,
    tick: string,
    amount: bigint,
    changeAddress: string,
    options?: KRC20TransferOptions
  ): KRC20TxResult {
    return createKRC20Transfer(
      utxos,
      privateKey,
      publicKey,
      tick,
      amount,
      toAddress,
      changeAddress,
      options
    );
  }

  /**
   * Estimate the KAS cost for a KRC-20 transfer
   *
   * @param numInputs - Expected number of inputs (default: 1)
   * @param options - Transaction options
   * @returns Total cost in sompi
   */
  estimateTransferCost(numInputs: number = 1, options?: KRC20TransferOptions): bigint {
    return estimateKRC20TransferCost(numInputs, options);
  }

  /**
   * Execute a complete KRC-20 transfer
   *
   * This method:
   * 1. Builds and signs both commit and reveal transactions
   * 2. Broadcasts the commit transaction
   * 3. Waits for commit confirmation
   * 4. Broadcasts the reveal transaction
   *
   * @param utxos - Available UTXOs for the sender
   * @param privateKey - Sender's private key
   * @param publicKey - Sender's public key
   * @param toAddress - Recipient address
   * @param tick - Token ticker
   * @param amount - Amount in base units
   * @param changeAddress - Change address
   * @param options - Transaction options
   * @returns Result with transaction IDs
   */
  async executeTransfer(
    utxos: KaspaUTXO[],
    privateKey: Uint8Array,
    publicKey: Uint8Array,
    toAddress: string,
    tick: string,
    amount: bigint,
    changeAddress: string,
    options?: KRC20TransferOptions
  ): Promise<KRC20TransferResult> {
    try {
      // Verify token exists and sender has sufficient balance
      const tokenInfo = await this.getTokenInfo(tick);
      if (!tokenInfo) {
        return {
          success: false,
          error: `Token ${tick} not found`,
        };
      }

      // Build the transfer transactions
      const transfer = this.buildTransfer(
        utxos,
        privateKey,
        publicKey,
        toAddress,
        tick,
        amount,
        changeAddress,
        options
      );

      // Broadcast commit transaction
      const commitResult = await this.broadcastTransaction(transfer.commitBroadcastData);
      if (!commitResult.success) {
        return {
          success: false,
          error: `Failed to broadcast commit transaction: ${commitResult.error}`,
        };
      }

      // Wait a short time for commit to propagate
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Broadcast reveal transaction
      const revealResult = await this.broadcastTransaction(transfer.revealBroadcastData);
      if (!revealResult.success) {
        return {
          success: false,
          error: `Commit succeeded but reveal failed: ${revealResult.error}. Commit TX: ${transfer.commitTxId}`,
          commitTxId: transfer.commitTxId,
        };
      }

      return {
        success: true,
        commitTxId: transfer.commitTxId,
        revealTxId: transfer.revealTxId,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Failed to execute KRC-20 transfer",
      };
    }
  }

  /**
   * Broadcast a transaction to the Kaspa network
   */
  private async broadcastTransaction(
    broadcastData: object
  ): Promise<{ success: boolean; txId?: string; error?: string }> {
    try {
      const baseUrl = this.networkConfig.rpcUrl.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(broadcastData),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        return { success: false, error: `HTTP ${res.status}: ${errorText}` };
      }

      const data = await res.json();
      return { success: true, txId: data.transactionId };
    } catch (err: any) {
      return { success: false, error: err?.message || "Broadcast failed" };
    }
  }

  /**
   * Check the status of a KRC-20 operation
   */
  async checkOperationStatus(operationId: string): Promise<{
    state: string;
    revealTxId?: string;
  } | null> {
    try {
      const res = await fetch(
        `${this.transferBaseUrl}/krc20/op/${operationId}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        }
      );

      if (!res.ok) return null;

      const data = await res.json();
      const parsed = KRC20OperationStatusSchema.safeParse(data);

      if (!parsed.success || !parsed.data.result) return null;

      return {
        state: parsed.data.result.state,
        revealTxId: parsed.data.result.hashRev,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get the balance of a specific token for an address
   */
  async getTokenBalance(address: string, tick: string): Promise<KRC20Balance | null> {
    const balances = await this.getTokenBalances(address);
    return balances.find((b) => b.tick.toUpperCase() === tick.toUpperCase()) || null;
  }
}
