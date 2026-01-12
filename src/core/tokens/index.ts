// src/core/tokens/index.ts

export type KaspaNetwork = "mainnet" | "testnet";

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
    visibleByDefault: true
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

/**
 * Convenience: get a map by symbol (e.g. "KAS" → TokenMeta).
 */
export function getTokenMapBySymbol(
  network: KaspaNetwork
): Record<string, TokenMeta> {
  const map: Record<string, TokenMeta> = {};
  for (const t of getStaticTokens(network)) {
    map[t.symbol] = t;
  }
  return map;
}

/**
 * Resolve a token by symbol. Returns undefined if not found.
 */
export function resolveTokenBySymbol(
  network: KaspaNetwork,
  symbol: string
): TokenMeta | undefined {
  const map = getTokenMapBySymbol(network);
  return map[symbol];
}

/**
 * Stub for future remote tokenlist.
 * When you have an API, implement it here and then call it from a wrapper.
 */
export async function fetchRemoteTokenlist(
  _network: KaspaNetwork
): Promise<TokenMeta[] | null> {
  // Example later:
  // const res = await fetch("https://your-api/kaspa/tokenlist.json");
  // const json = await res.json();
  // return json.tokens as TokenMeta[];
  return null;
}

/**
 * High-level helper:
 * - tries remote tokenlist (when you implement it),
 * - falls back to static tokens.
 */
export async function getEffectiveTokenlist(
  network: KaspaNetwork
): Promise<TokenMeta[]> {
  const remote = await fetchRemoteTokenlist(network).catch(() => null);
  if (remote && remote.length) return remote;
  return getStaticTokens(network);
}
