// src/core/kaspa/krc20-client.ts
// KRC-20 token API client using Kasplex indexer

import { z } from "zod";
import type { KaspaNetwork } from "../networks";

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
        decimals: parseInt(item.dec, 10),
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
        decimals: parseInt(item.dec, 10),
        minted: BigInt(item.minted),
        state: item.state,
        holderTotal: parseInt(item.holderTotal || "0", 10),
        transferTotal: parseInt(item.transferTotal || "0", 10),
        mintTotal: parseInt(item.mintTotal || "0", 10),
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
        decimals: parseInt(item.dec, 10),
        minted: BigInt(item.minted),
        state: item.state,
        holderTotal: parseInt(item.holderTotal || "0", 10),
        transferTotal: parseInt(item.transferTotal || "0", 10),
        mintTotal: parseInt(item.mintTotal || "0", 10),
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
 * Extended KRC20Client with transfer functionality
 */
export class KRC20TransferClient extends KRC20Client {
  private readonly transferBaseUrl: string;
  private readonly network: KaspaNetwork;

  constructor(network: KaspaNetwork) {
    super(network);
    this.network = network;
    // Use the same endpoint base for transfers
    this.transferBaseUrl = network === "mainnet"
      ? "https://api.kasplex.org/v1"
      : "https://tn10api.kasplex.org/v1";
  }

  /**
   * Prepare a KRC-20 transfer operation
   * This creates the commit transaction data that needs to be signed
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

    // The script data includes the protocol identifier and inscription
    // Format: "kasplex" marker + inscription JSON
    const scriptData = `kasplex${inscriptionJson}`;

    return {
      inscription,
      inscriptionJson,
      scriptData,
    };
  }

  /**
   * Submit a signed KRC-20 transfer to the network
   *
   * Note: This is a simplified implementation. Full KRC-20 transfers require:
   * 1. Creating a commit transaction with the inscription in a P2SH output
   * 2. Creating a reveal transaction that spends the P2SH output
   * 3. Both transactions need proper Kaspa signatures (Schnorr)
   *
   * For now, we'll use the Kasplex API if available, or return an error
   * indicating that full transaction signing is needed.
   */
  async submitTransfer(
    fromAddress: string,
    toAddress: string,
    tick: string,
    amount: bigint,
    signedCommitTx?: string,
    signedRevealTx?: string
  ): Promise<KRC20TransferResult> {
    try {
      // Check if the API supports direct transfer submission
      // This depends on whether Kasplex has a transfer API endpoint

      const inscription = createTransferInscription(tick, amount, toAddress);
      const inscriptionJson = serializeInscription(inscription);

      // Try to submit via API if endpoints exist
      // For now, return that the transfer is prepared but requires wallet signing

      // Note: Real implementation would need:
      // 1. Build commit TX with P2SH containing the inscription
      // 2. Broadcast commit TX
      // 3. Build reveal TX that spends the commit P2SH
      // 4. Broadcast reveal TX

      return {
        success: false,
        error: "KRC-20 transfers require full Kaspa transaction signing (Schnorr signatures). This feature requires integration with kaspa-wasm or a similar library for proper transaction construction.",
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Failed to submit KRC-20 transfer",
      };
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
}
