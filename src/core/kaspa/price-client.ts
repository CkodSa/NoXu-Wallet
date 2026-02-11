// src/core/kaspa/price-client.ts
// Multi-source, multi-currency price client:
//   - CoinGecko for KAS price/chart + KRC-20 tokens in Kaspa ecosystem category
//   - Kas.fyi as fallback for KRC-20 tokens (needs API key)

import { z } from "zod";

// --- Public types ---

export type KaspaPrice = {
  price: number;
  change_24h: number;
  currency: string;
};

export type PricePoint = {
  timestamp: number;
  price: number;
};

export type TokenPrice = {
  price: number;
  change_24h?: number;
  volume?: number;
  currency: string;
  source: string;
};

export type TrendingToken = {
  symbol: string;
  name: string;
  geckoId: string;
  price: number;
  change_24h: number;
  volume: number;
  currency: string;
};

// --- Zod schemas ---

const MarketChartSchema = z.object({
  prices: z.array(z.tuple([z.number(), z.number()])),
});

// CoinGecko /coins/markets response (partial)
const GeckoMarketCoinSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string().optional().default(""),
  current_price: z.number().nullable(),
  price_change_percentage_24h: z.number().nullable().optional(),
  total_volume: z.number().nullable().optional(),
});
const GeckoMarketsSchema = z.array(GeckoMarketCoinSchema);

// Kas.fyi token metadata schema (partial — we only care about market/price data)
const KasFyiTradingDataSchema = z.object({
  price: z.object({
    usd: z.number().optional(),
  }).optional(),
});

const KasFyiMarketSchema = z.object({
  tradingData: KasFyiTradingDataSchema.optional(),
});

const KasFyiTokenMetaSchema = z.object({
  markets: z.array(KasFyiMarketSchema).optional(),
  volume: z.object({
    usd: z.number().optional(),
  }).optional(),
});

// --- Cache ---

type CacheEntry<T> = { data: T; ts: number };

const PRICE_TTL = 60_000; // 60 seconds
const CHART_TTL = 300_000; // 5 minutes
const ECOSYSTEM_TTL = 600_000; // 10 minutes for ecosystem lookup

// All caches are keyed by currency to avoid cross-currency stale data
const priceCache = new Map<string, CacheEntry<KaspaPrice>>();
const chartCache = new Map<string, CacheEntry<PricePoint[]>>();
const tokenPriceCache = new Map<string, CacheEntry<TokenPrice | null>>();

// Ecosystem map: uppercase symbol → data. Keyed by currency.
type EcoCoin = {
  geckoId: string;
  name: string;
  price: number;
  change: number;
  volume: number;
};
const ecosystemCache = new Map<string, CacheEntry<Map<string, EcoCoin>>>();

function isFresh<T>(entry: CacheEntry<T> | null | undefined, ttl: number): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.ts < ttl;
}

// --- Fetch helpers ---

const BASE = "https://api.coingecko.com/api/v3";
const KAS_FYI_BASE = "https://api.kas.fyi/v1";
const RETRIES = 2;
const BACKOFF_MS = 500;

async function geckoGet(endpoint: string): Promise<any> {
  let attempt = 0;
  while (attempt <= RETRIES) {
    try {
      const res = await fetch(`${BASE}${endpoint}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`CoinGecko HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === RETRIES) throw err;
      await new Promise((r) => setTimeout(r, BACKOFF_MS * (attempt + 1)));
      attempt += 1;
    }
  }
  throw new Error("CoinGecko fetch failed");
}

// --- Downsample ---

function downsample(points: PricePoint[], maxPoints: number): PricePoint[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const result: PricePoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(points[Math.round(i * step)]);
  }
  return result;
}

// --- Kaspa Ecosystem lookup (CoinGecko) ---

/**
 * Fetch all tokens in CoinGecko's "kaspa-ecosystem" category.
 * Returns a map of UPPERCASE symbol → price data.
 * Cached for 10 minutes per currency.
 */
async function getEcosystemMap(currency = "usd"): Promise<Map<string, EcoCoin>> {
  const cached = ecosystemCache.get(currency);
  if (isFresh(cached, ECOSYSTEM_TTL)) return cached!.data;

  try {
    const data = await geckoGet(
      `/coins/markets?vs_currency=${currency}&category=kaspa-ecosystem&order=market_cap_desc&per_page=100&page=1`,
    );
    const parsed = GeckoMarketsSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(`Invalid ecosystem response: ${parsed.error.message}`);
    }

    const map = new Map<string, EcoCoin>();
    for (const c of parsed.data) {
      if (c.current_price != null) {
        map.set(c.symbol.toUpperCase(), {
          geckoId: c.id,
          name: c.name || c.symbol,
          price: c.current_price,
          change: c.price_change_percentage_24h ?? 0,
          volume: c.total_volume ?? 0,
        });
      }
    }

    ecosystemCache.set(currency, { data: map, ts: Date.now() });
    return map;
  } catch (err) {
    console.error("[price] Failed to fetch Kaspa ecosystem from CoinGecko:", err);
    return cached?.data ?? new Map();
  }
}

// --- Public API ---

export async function getKaspaPrice(currency = "usd"): Promise<KaspaPrice> {
  const cached = priceCache.get(currency);
  if (isFresh(cached, PRICE_TTL)) return cached!.data;

  const data = await geckoGet(
    `/simple/price?ids=kaspa&vs_currencies=${currency}&include_24hr_change=true`,
  );

  // CoinGecko returns { kaspa: { <currency>: number, <currency>_24h_change: number } }
  const kasData = data?.kaspa;
  if (!kasData || typeof kasData[currency] !== "number") {
    throw new Error(`No Kaspa price data for ${currency}`);
  }

  const price: KaspaPrice = {
    price: kasData[currency],
    change_24h: kasData[`${currency}_24h_change`] ?? 0,
    currency,
  };

  priceCache.set(currency, { data: price, ts: Date.now() });
  return price;
}

export async function getKaspaPriceHistory(
  days: 1 | 7 | 30,
  currency = "usd",
): Promise<PricePoint[]> {
  const cacheKey = `${currency}_${days}`;
  const cached = chartCache.get(cacheKey);
  if (isFresh(cached, CHART_TTL)) return cached!.data;

  const data = await geckoGet(
    `/coins/kaspa/market_chart?vs_currency=${currency}&days=${days}`,
  );
  const parsed = MarketChartSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid chart response: ${parsed.error.message}`);
  }

  const raw: PricePoint[] = parsed.data.prices.map(([ts, price]) => ({
    timestamp: ts,
    price,
  }));

  // Downsample to max 60 points for smooth SVG rendering
  const points = downsample(raw, 60);

  chartCache.set(cacheKey, { data: points, ts: Date.now() });
  return points;
}

/**
 * Fetch KRC-20 token price. Tries multiple sources in order:
 *   1. CoinGecko Kaspa ecosystem category (free, no key)
 *   2. Kas.fyi token metadata (requires API key — USD only)
 *
 * Returns null if no source has price data for this token.
 */
export async function getKrc20Price(
  tick: string,
  currency = "usd",
  kasFyiApiKey?: string,
): Promise<TokenPrice | null> {
  const cacheKey = `${tick.toLowerCase()}_${currency}`;
  const cached = tokenPriceCache.get(cacheKey);
  if (isFresh(cached, PRICE_TTL)) return cached!.data;

  // --- Source 1: CoinGecko Kaspa ecosystem ---
  try {
    const eco = await getEcosystemMap(currency);
    const coin = eco.get(tick.toUpperCase());
    if (coin && coin.price > 0) {
      const tp: TokenPrice = {
        price: coin.price,
        change_24h: coin.change,
        volume: coin.volume,
        currency,
        source: "coingecko",
      };
      tokenPriceCache.set(cacheKey, { data: tp, ts: Date.now() });
      return tp;
    }
  } catch (err) {
    console.warn(`[price] CoinGecko ecosystem lookup failed for ${tick}:`, err);
  }

  // --- Source 2: Kas.fyi (fallback, needs API key — always USD) ---
  if (kasFyiApiKey) {
    let attempt = 0;
    while (attempt <= RETRIES) {
      try {
        const res = await fetch(
          `${KAS_FYI_BASE}/tokens/krc20/${encodeURIComponent(tick.toLowerCase())}/metadata`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              "x-api-key": kasFyiApiKey,
            },
          },
        );

        if (res.status === 404) break;
        if (!res.ok) throw new Error(`Kas.fyi HTTP ${res.status}: ${res.statusText}`);

        const data = await res.json();
        const parsed = KasFyiTokenMetaSchema.safeParse(data);
        if (!parsed.success) {
          console.warn(`[price] Invalid Kas.fyi response for ${tick}:`, parsed.error.message);
          break;
        }

        let usdPrice: number | undefined;
        const markets = parsed.data.markets ?? [];
        for (const market of markets) {
          const p = market.tradingData?.price?.usd;
          if (p != null && p > 0) { usdPrice = p; break; }
        }

        if (usdPrice != null) {
          // Kas.fyi only gives USD — for other currencies we'd need conversion,
          // but this is a fallback so USD is acceptable
          const tp: TokenPrice = {
            price: usdPrice,
            volume: parsed.data.volume?.usd,
            currency: "usd",
            source: "kas.fyi",
          };
          tokenPriceCache.set(cacheKey, { data: tp, ts: Date.now() });
          return tp;
        }
        break;
      } catch (err) {
        if (attempt === RETRIES) {
          console.error(`[price] Kas.fyi fetch failed for ${tick}:`, err);
          break;
        }
        await new Promise((r) => setTimeout(r, BACKOFF_MS * (attempt + 1)));
        attempt += 1;
      }
    }
  }

  tokenPriceCache.set(cacheKey, { data: null, ts: Date.now() });
  return null;
}

/**
 * Get top KRC-20 tokens from CoinGecko ecosystem data (excluding KAS).
 * Sorted by market cap (CoinGecko default order). No extra API call needed.
 */
export async function getTopKrc20Tokens(
  limit = 5,
  currency = "usd",
): Promise<TrendingToken[]> {
  const eco = await getEcosystemMap(currency);
  const results: TrendingToken[] = [];

  for (const [symbol, coin] of eco) {
    // Skip KAS — it's the native token, not a KRC-20
    if (symbol === "KAS") continue;
    results.push({
      symbol,
      name: coin.name,
      geckoId: coin.geckoId,
      price: coin.price,
      change_24h: coin.change,
      volume: coin.volume,
      currency,
    });
    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Get top KRC-20 tokens sorted by biggest 24h price gain ("trending").
 * Reuses the same cached ecosystem data.
 */
export async function getTopKrc20TokensByGainers(
  limit = 5,
  currency = "usd",
): Promise<TrendingToken[]> {
  const eco = await getEcosystemMap(currency);
  const all: TrendingToken[] = [];

  for (const [symbol, coin] of eco) {
    if (symbol === "KAS") continue;
    all.push({
      symbol,
      name: coin.name,
      geckoId: coin.geckoId,
      price: coin.price,
      change_24h: coin.change,
      volume: coin.volume,
      currency,
    });
  }

  // Sort by 24h change descending (biggest gainers first)
  all.sort((a, b) => b.change_24h - a.change_24h);
  return all.slice(0, limit);
}
