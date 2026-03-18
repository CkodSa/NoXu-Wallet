// src/core/tokens/index.ts

import type { KaspaNetwork } from "../networks";
import { KAS_LOGO_URL } from "../kaspa/price-client";

export type TokenKind = "native" | "krc20" | "l2";

export interface TokenMeta {
  /** Unique internal ID (for future KRC/L2 assets, contract ID, script hash, etc.) */
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  kind: TokenKind;

  /** True if this only exists on testnet (UI can hide on mainnet) */
  testnetOnly?: boolean;

  /** Whether to show by default in the wallet UI */
  visibleByDefault?: boolean;

  /** Optional logo URL – can be filled later from a CDN/tokenlist */
  logoURI?: string;
}

/**
 * Static, built-in list.
 * You can adjust/remove the fake ones whenever you’re ready.
 */
const STATIC_TOKENS: TokenMeta[] = [
  {
    id: "KAS_NATIVE",
    symbol: "KAS",
    name: "Kaspa",
    decimals: 8,
    kind: "native",
    visibleByDefault: true,
    logoURI: KAS_LOGO_URL,
  },
  // Placeholder / demo tokens – UI only for now
  {
    id: "USDK_DEMO",
    symbol: "USDK",
    name: "Kaspa Dollar (demo)",
    decimals: 8,
    kind: "krc20",
    testnetOnly: true,
    visibleByDefault: true
  },
  {
    id: "WBTC_DEMO",
    symbol: "wBTC",
    name: "Wrapped Bitcoin (demo)",
    decimals: 8,
    kind: "krc20",
    testnetOnly: true,
    visibleByDefault: true
  }
];

/**
 * For now just filters the static list by network.
 * Later you can merge static + remote tokenlist here.
 */
export function getStaticTokens(network: KaspaNetwork): TokenMeta[] {
  return STATIC_TOKENS.filter((t) => {
    if (network === "mainnet" && t.testnetOnly) return false;
    return true;
  });
}

