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
