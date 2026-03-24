// src/core/kaspa/price-client.ts
// CryptoCompare-only price client (300 req/min free, no API key needed)
// Kas.fyi as optional fallback for obscure KRC-20 tokens

// Well-known CryptoCompare image base URL
const CC_IMAGE_BASE = "https://www.cryptocompare.com";

export const KAS_LOGO_URL = "https://www.cryptocompare.com/media/43957904/kas.png";

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
  image?: string;
  currency: string;
  source: string;
};

export type TrendingToken = {
  symbol: string;
  name: string;
  geckoId: string; // kept for backward compat, now holds CC internal name
  price: number;
  change_24h: number;
  volume: number;
  currency: string;
  image?: string;
};

// --- Known KRC-20 tokens (used for discover/trending) ---
// Ordered by approximate market cap. CryptoCompare resolves these by symbol.

const KNOWN_KRC20_TOKENS: { symbol: string; name: string }[] = [
  { symbol: "NACHO", name: "Nacho the Kat" },
  { symbol: "KASPY", name: "Kaspy" },
  { symbol: "KANGO", name: "Kango" },
  { symbol: "KASPER", name: "Kasper" },
  { symbol: "GHOAD", name: "Ghoad" },
  { symbol: "KPAW", name: "KPaw" },
  { symbol: "KDOGE", name: "Kaspa Doge" },
  { symbol: "KSPR", name: "Kasper AI" },
  { symbol: "KEKE", name: "Keke" },
  { symbol: "CRUMBS", name: "Crumbs" },
  { symbol: "KAT", name: "Kat" },
  { symbol: "KIRO", name: "Kiro" },
  { symbol: "BURT", name: "Burt" },
  { symbol: "KASP", name: "Kasp" },
  { symbol: "KBOT", name: "Kbot" },
];

// --- Cache ---

type CacheEntry<T> = { data: T; ts: number };

const PRICE_TTL = 60_000; // 60 seconds
const CHART_TTL = 300_000; // 5 minutes
const ECOSYSTEM_TTL = 300_000; // 5 minutes

const priceCache = new Map<string, CacheEntry<KaspaPrice>>();
const chartCache = new Map<string, CacheEntry<PricePoint[]>>();
const tokenPriceCache = new Map<string, CacheEntry<TokenPrice | null>>();

type EcoCoin = {
  geckoId: string; // reused field, holds CC internal name or symbol
  name: string;
  price: number;
  change: number;
  volume: number;
  image?: string;
};
const ecosystemCache = new Map<string, CacheEntry<Map<string, EcoCoin>>>();

function isFresh<T>(entry: CacheEntry<T> | null | undefined, ttl: number): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.ts < ttl;
}

// --- Fetch helpers ---

const CC_BASE = "https://min-api.cryptocompare.com";
const KAS_FYI_BASE = "https://api.kas.fyi/v1";
const FETCH_TIMEOUT_MS = 10000;

async function fetchJSON(url: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText} for ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// In-flight deduplication for any URL
const _inflight = new Map<string, Promise<any>>();

function deduped(url: string): Promise<any> {
  const existing = _inflight.get(url);
  if (existing) return existing;
  const promise = fetchJSON(url);
  _inflight.set(url, promise);
  promise.finally(() => _inflight.delete(url));
  return promise;
}

// CryptoCompare — 300 req/min free, no key needed
async function ccGet(endpoint: string): Promise<any> {
  return deduped(`${CC_BASE}${endpoint}`);
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

// --- CryptoCompare helpers ---

/**
 * Fetch current price from CryptoCompare.
 * Uses /data/pricemultifull for price + 24h change + volume + image.
 */
async function ccGetPriceFull(
  symbol: string,
  currency = "USD",
): Promise<{ price: number; change24h: number; volume: number; image?: string } | null> {
  try {
    const data = await ccGet(
      `/data/pricemultifull?fsyms=${symbol}&tsyms=${currency}`,
    );
    const raw = data?.RAW?.[symbol]?.[currency];
    if (!raw || typeof raw.PRICE !== "number") return null;
    const imageUrl = raw.IMAGEURL ? `${CC_IMAGE_BASE}${raw.IMAGEURL}` : undefined;
    return {
      price: raw.PRICE,
      change24h: raw.CHANGEPCT24HOUR ?? 0,
      volume: raw.TOTALVOLUME24HTO ?? 0,
      image: imageUrl,
    };
  } catch (err) {
    console.warn(`[price] CryptoCompare price fetch failed for ${symbol}:`, err);
    return null;
  }
}

/**
 * Batch fetch prices for multiple symbols from CryptoCompare.
 * Returns a Map of symbol → price data.
 */
async function ccGetBatchPrices(
  symbols: string[],
  currency = "USD",
): Promise<Map<string, { price: number; change24h: number; volume: number; image?: string }>> {
  const result = new Map<string, { price: number; change24h: number; volume: number; image?: string }>();
  if (!symbols.length) return result;

  try {
    const fsyms = symbols.join(",");
    const data = await ccGet(
      `/data/pricemultifull?fsyms=${fsyms}&tsyms=${currency}`,
    );
    const raw = data?.RAW;
    if (!raw) return result;

    for (const sym of symbols) {
      const info = raw[sym]?.[currency];
      if (info && typeof info.PRICE === "number" && info.PRICE > 0) {
        const imageUrl = info.IMAGEURL ? `${CC_IMAGE_BASE}${info.IMAGEURL}` : undefined;
        result.set(sym, {
          price: info.PRICE,
          change24h: info.CHANGEPCT24HOUR ?? 0,
          volume: info.TOTALVOLUME24HTO ?? 0,
          image: imageUrl,
        });
      }
    }
  } catch (err) {
    console.warn("[price] CryptoCompare batch price fetch failed:", err);
  }

  return result;
}

/**
 * Fetch price history from CryptoCompare.
 * Uses histominute for 1d, histohour for 7d, histoday for 30d.
 */
async function ccGetChart(
  symbol: string,
  days: 1 | 7 | 30,
  currency = "USD",
): Promise<PricePoint[]> {
  let endpoint: string;
  if (days === 1) {
    endpoint = `/data/v2/histominute?fsym=${symbol}&tsym=${currency}&limit=1440`;
  } else if (days === 7) {
    endpoint = `/data/v2/histohour?fsym=${symbol}&tsym=${currency}&limit=168`;
  } else {
    endpoint = `/data/v2/histoday?fsym=${symbol}&tsym=${currency}&limit=30`;
  }

  const data = await ccGet(endpoint);
  if (data?.Response !== "Success" || !data?.Data?.Data) {
    return [];
  }

  const raw: PricePoint[] = data.Data.Data
    .filter((d: any) => d.close > 0)
    .map((d: any) => ({
      timestamp: d.time * 1000, // convert to ms
      price: d.close,
    }));

  return downsample(raw, 60);
}

// --- Kaspa Ecosystem (CryptoCompare batch — 1 API call, cached 5 min) ---

async function getEcosystemMap(currency = "usd"): Promise<Map<string, EcoCoin>> {
  const cached = ecosystemCache.get(currency);
  const staleData = cached?.data;
  if (isFresh(cached, ECOSYSTEM_TTL)) return cached!.data;

  try {
    const symbols = KNOWN_KRC20_TOKENS.map((t) => t.symbol);
    const nameMap = new Map(KNOWN_KRC20_TOKENS.map((t) => [t.symbol, t.name]));
    const prices = await ccGetBatchPrices(symbols, currency.toUpperCase());

    const map = new Map<string, EcoCoin>();
    for (const [sym, info] of prices) {
      map.set(sym, {
        geckoId: sym.toLowerCase(), // backward compat
        name: nameMap.get(sym) || sym,
        price: info.price,
        change: info.change24h,
        volume: info.volume,
        image: info.image,
      });
    }

    ecosystemCache.set(currency, { data: map, ts: Date.now() });
    return map;
  } catch (err) {
    console.error("[price] Failed to fetch KRC-20 ecosystem from CryptoCompare:", err);
    return staleData ?? new Map<string, EcoCoin>();
  }
}

/**
 * Get token image URL from CryptoCompare.
 */
export async function getTokenImage(
  symbol: string,
  _currency = "usd",
): Promise<string | undefined> {
  if (symbol.toUpperCase() === "KAS") return KAS_LOGO_URL;
  const eco = await getEcosystemMap(_currency);
  return eco.get(symbol.toUpperCase())?.image;
}

// --- Public API ---

/**
 * Get current KAS price from CryptoCompare.
 */
export async function getKaspaPrice(currency = "usd"): Promise<KaspaPrice> {
  const cached = priceCache.get(currency);
  if (isFresh(cached, PRICE_TTL)) return cached!.data;

  const ccPrice = await ccGetPriceFull("KAS", currency.toUpperCase());
  if (ccPrice) {
    const price: KaspaPrice = {
      price: ccPrice.price,
      change_24h: ccPrice.change24h,
      currency,
    };
    priceCache.set(currency, { data: price, ts: Date.now() });
    return price;
  }

  throw new Error(`No Kaspa price data for ${currency}`);
}

/**
 * Get KAS price chart history from CryptoCompare.
 */
export async function getKaspaPriceHistory(
  days: 1 | 7 | 30,
  currency = "usd",
): Promise<PricePoint[]> {
  const cacheKey = `kas_${currency}_${days}`;
  const cached = chartCache.get(cacheKey);
  if (isFresh(cached, CHART_TTL)) return cached!.data;

  try {
    const points = await ccGetChart("KAS", days, currency.toUpperCase());
    if (points.length > 0) {
      chartCache.set(cacheKey, { data: points, ts: Date.now() });
    }
    return points;
  } catch (err) {
    console.warn("[price] CryptoCompare KAS chart fetch failed:", err);
    return [];
  }
}

/**
 * Fetch KRC-20 token price from CryptoCompare.
 * Falls back to Kas.fyi if API key is provided.
 */
export async function getKrc20Price(
  tick: string,
  currency = "usd",
  kasFyiApiKey?: string,
): Promise<TokenPrice | null> {
  const cacheKey = `${tick.toLowerCase()}_${currency}`;
  const cached = tokenPriceCache.get(cacheKey);
  if (isFresh(cached, PRICE_TTL)) return cached!.data;

  // Source 1: CryptoCompare
  try {
    const info = await ccGetPriceFull(tick.toUpperCase(), currency.toUpperCase());
    if (info && info.price > 0) {
      const tp: TokenPrice = {
        price: info.price,
        change_24h: info.change24h,
        volume: info.volume,
        image: info.image,
        currency,
        source: "cryptocompare",
      };
      tokenPriceCache.set(cacheKey, { data: tp, ts: Date.now() });
      return tp;
    }
  } catch (err) {
    console.warn(`[price] CryptoCompare price fetch failed for ${tick}:`, err);
  }

  // Source 2: Kas.fyi (fallback, needs API key)
  if (kasFyiApiKey) {
    try {
      const res = await fetch(
        `${KAS_FYI_BASE}/tokens/krc20/${encodeURIComponent(tick.toLowerCase())}/metadata`,
        {
          method: "GET",
          headers: { Accept: "application/json", "x-api-key": kasFyiApiKey },
        },
      );
      if (res.ok) {
        const data: any = await res.json();
        let usdPrice: number | undefined;
        let usdVol: number | undefined;
        if (data?.markets) {
          for (const market of data.markets) {
            const p = market?.tradingData?.price?.usd;
            if (p != null && p > 0) { usdPrice = p; break; }
          }
        }
        usdVol = data?.volume?.usd;
        if (usdPrice != null) {
          const tp: TokenPrice = {
            price: usdPrice,
            volume: usdVol,
            currency: "usd",
            source: "kas.fyi",
          };
          tokenPriceCache.set(cacheKey, { data: tp, ts: Date.now() });
          return tp;
        }
      }
    } catch (err) {
      console.warn(`[price] Kas.fyi fetch failed for ${tick}:`, err);
    }
  }

  tokenPriceCache.set(cacheKey, { data: null, ts: Date.now() });
  return null;
}

/**
 * Get top KRC-20 tokens by market cap (using CryptoCompare batch prices).
 */
export async function getTopKrc20Tokens(
  limit = 5,
  currency = "usd",
): Promise<TrendingToken[]> {
  const eco = await getEcosystemMap(currency);
  const results: TrendingToken[] = [];

  // Return in order of KNOWN_KRC20_TOKENS (approximate market cap order)
  for (const { symbol, name } of KNOWN_KRC20_TOKENS) {
    const coin = eco.get(symbol);
    if (!coin) continue;
    results.push({
      symbol,
      name: coin.name || name,
      geckoId: coin.geckoId,
      price: coin.price,
      change_24h: coin.change,
      volume: coin.volume,
      currency,
      image: coin.image,
    });
    if (results.length >= limit) break;
  }
  return results;
}

/**
 * Get top KRC-20 tokens sorted by biggest 24h price gain.
 */
export async function getTopKrc20TokensByGainers(
  limit = 5,
  currency = "usd",
): Promise<TrendingToken[]> {
  const eco = await getEcosystemMap(currency);
  const all: TrendingToken[] = [];
  for (const { symbol, name } of KNOWN_KRC20_TOKENS) {
    const coin = eco.get(symbol);
    if (!coin) continue;
    all.push({
      symbol,
      name: coin.name || name,
      geckoId: coin.geckoId,
      price: coin.price,
      change_24h: coin.change,
      volume: coin.volume,
      currency,
      image: coin.image,
    });
  }
  all.sort((a, b) => b.change_24h - a.change_24h);
  return all.slice(0, limit);
}

/**
 * Fetch price history for any token using CryptoCompare.
 */
export async function getTokenPriceHistory(
  symbol: string,
  days: 1 | 7 | 30,
  currency = "usd",
): Promise<PricePoint[]> {
  if (symbol.toUpperCase() === "KAS") {
    return getKaspaPriceHistory(days, currency);
  }

  const cacheKey = `${symbol.toLowerCase()}_${currency}_${days}`;
  const cached = chartCache.get(cacheKey);
  if (isFresh(cached, CHART_TTL)) return cached!.data;

  try {
    const points = await ccGetChart(symbol.toUpperCase(), days, currency.toUpperCase());
    if (points.length > 0) {
      chartCache.set(cacheKey, { data: points, ts: Date.now() });
    }
    return points;
  } catch (err) {
    console.warn(`[price] Chart fetch failed for ${symbol}:`, err);
    return [];
  }
}

// --- Historical price for PnL ---

const historicalPriceCache = new Map<string, number>();

/**
 * Batch-fetch historical KAS prices using CryptoCompare histoday.
 * Returns a Map of "YYYY-MM-DD" → price.
 */
export async function batchFetchHistoricalPrices(
  timestamps: number[],
  currency = "usd",
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!timestamps.length) return result;

  // Deduplicate to unique days
  const daySet = new Set<string>();
  for (const ts of timestamps) {
    const day = new Date(ts * 1000).toISOString().split("T")[0];
    daySet.add(day);
  }

  // Check cache first
  const uncachedDays: string[] = [];
  for (const day of daySet) {
    const cacheKey = `${day}_${currency}`;
    const cached = historicalPriceCache.get(cacheKey);
    if (cached != null) {
      result.set(day, cached);
    } else {
      uncachedDays.push(day);
    }
  }

  if (!uncachedDays.length) return result;
  uncachedDays.sort();

  // CryptoCompare histoday supports up to 2000 days in one call
  const totalDays = Math.ceil(
    (Date.now() / 1000 - new Date(uncachedDays[0]).getTime() / 1000) / 86400,
  );
  const limit = Math.min(totalDays + 1, 2000);

  try {
    const data = await ccGet(
      `/data/v2/histoday?fsym=KAS&tsym=${currency.toUpperCase()}&limit=${limit}`,
    );
    if (data?.Response === "Success" && data?.Data?.Data) {
      const dayPriceMap = new Map<string, number>();
      for (const d of data.Data.Data) {
        if (d.close > 0) {
          const day = new Date(d.time * 1000).toISOString().split("T")[0];
          dayPriceMap.set(day, d.close);
        }
      }

      for (const day of uncachedDays) {
        const price = dayPriceMap.get(day);
        if (price != null) {
          result.set(day, price);
          historicalPriceCache.set(`${day}_${currency}`, price);
        }
      }
    }
  } catch (err) {
    console.warn("[price] CryptoCompare historical fetch failed:", err);
  }

  return result;
}
