import React, { useEffect, useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import {
  getKaspaPrice,
  getTopKrc20Tokens,
  getTopKrc20TokensByGainers,
  getTokenImage,
  getKaspaPriceHistory,
  KAS_LOGO_URL,
  type TrendingToken,
  type PricePoint,
} from "@noxu/core";
import Svg, { Polyline, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { useWalletStore, type TokenBalance } from "../../store";
import { useWalletService } from "../../hooks/useWalletService";
import { colors, fonts, spacing, radii, shadows } from "../../theme";
import type { MainTabScreenProps } from "../../navigation/types";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../navigation/types";
import { PnLIcon } from "../../components/TabIcons";

type Props = CompositeScreenProps<
  MainTabScreenProps<"Home">,
  NativeStackScreenProps<MainStackParamList>
>;

const APP_VERSION = "1.1.0";
const DISMISSED_VERSION_KEY = "noxu_dismissed_version";
const VERSION_CHECK_URL = "https://raw.githubusercontent.com/CkodSa/NoXu-Wallet/main/version.json";

function shortenAddress(addr: string): string {
  if (addr.length <= 24) return addr;
  return addr.slice(0, 14) + "..." + addr.slice(-8);
}

function formatKas(sompiOrKas: number | undefined): string {
  if (sompiOrKas === undefined) return "0.00";
  return sompiOrKas.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

function formatFiat(kas: number | undefined, price: number | undefined): string {
  if (kas === undefined || price === undefined) return "$0.00";
  return (kas * price).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPrice(price: number): string {
  if (price >= 1) return "$" + price.toFixed(2);
  if (price >= 0.01) return "$" + price.toFixed(4);
  return "$" + price.toFixed(6);
}

export default function HomeScreen({ navigation }: Props) {
  const {
    account,
    balance,
    tokenBalances,
    tokenBalancesLoading,
    history,
    kasPrice,
    kasChange24h,
    network,
    syncError,
    setKasPrice,
  } = useWalletStore();

  const { refreshBalance, refreshHistory } = useWalletService();
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Discover section state
  const [discoverTab, setDiscoverTab] = useState<"popular" | "trending">("popular");
  const [popularTokens, setPopularTokens] = useState<TrendingToken[]>([]);
  const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  // Token image cache: symbol → image URL (KAS pre-populated)
  const [tokenImages, setTokenImages] = useState<Record<string, string>>({ KAS: KAS_LOGO_URL });
  // Track failed image loads to show fallback letter instead
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  // Token price map: SYMBOL → USD price (from discover data)
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});
  // 7-day sparkline data for KAS
  const [sparklineData, setSparklineData] = useState<PricePoint[]>([]);

  // Update banner — fetches remote version.json, only shows if remote > local
  const [updateInfo, setUpdateInfo] = useState<{ version: string; message: string; url: string } | null>(null);
  useEffect(() => {
    fetch(VERSION_CHECK_URL, { cache: "no-cache" })
      .then((r) => r.json())
      .then(async (data) => {
        if (data.version && data.version !== APP_VERSION) {
          const dismissed = await AsyncStorage.getItem(DISMISSED_VERSION_KEY).catch(() => null);
          if (dismissed === data.version) return;
          setUpdateInfo(data);
        }
      })
      .catch(() => {});
  }, []);
  const dismissUpdateBanner = () => {
    if (updateInfo) {
      AsyncStorage.setItem(DISMISSED_VERSION_KEY, updateInfo.version).catch(() => {});
    }
    setUpdateInfo(null);
  };

  useEffect(() => {
    refreshBalance();
    refreshHistory();
  }, []);

  // Fetch KAS price + discover tokens on mainnet
  useEffect(() => {
    if (network !== "mainnet" || !account) return;
    let cancelled = false;

    const fetchDiscover = async () => {
      setDiscoverLoading(true);
      try {
        // Fetch discover tokens first — this loads the ecosystem cache which
        // includes KAS price data. Requests are serialized by the queue in
        // price-client to avoid CoinGecko 429 rate limits.
        const [popular, trending] = await Promise.all([
          getTopKrc20Tokens(5, "usd"),
          getTopKrc20TokensByGainers(5, "usd"),
        ]);

        // Now get KAS price (uses cached ecosystem data, no extra API call)
        // and sparkline + image in parallel
        const [kasPriceData, priceHistory, kasImg] = await Promise.all([
          getKaspaPrice("usd").catch(() => null),
          getKaspaPriceHistory(7, "usd").catch(() => [] as PricePoint[]),
          getTokenImage("KAS", "usd"),
        ]);

        if (!cancelled) {
          // Set KAS price in global store
          if (kasPriceData) {
            setKasPrice(kasPriceData.price, kasPriceData.change_24h);
          }

          setPopularTokens(popular);
          setTrendingTokens(trending);

          // Build image + price maps from discover results + KAS
          const imgs: Record<string, string> = {};
          const prices: Record<string, number> = {};
          if (kasImg) imgs["KAS"] = kasImg;
          for (const t of [...popular, ...trending]) {
            if (t.image) imgs[t.symbol] = t.image;
            if (t.price > 0) prices[t.symbol] = t.price;
          }
          setTokenImages((prev) => ({ ...prev, ...imgs }));
          setTokenPrices((prev) => ({ ...prev, ...prices }));
          if (priceHistory.length > 0) setSparklineData(priceHistory);
        }
      } catch (err) {
        console.error("[Discover] fetch error:", err);
      } finally {
        if (!cancelled) setDiscoverLoading(false);
      }
    };

    fetchDiscover();
    return () => { cancelled = true; };
  }, [network, account?.address]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const promises: Promise<any>[] = [refreshBalance(), refreshHistory()];
    if (network === "mainnet") {
      promises.push(
        getKaspaPrice("usd").then((data) => {
          setKasPrice(data.price, data.change_24h);
        }).catch(() => {}),
        getTopKrc20Tokens(5, "usd").then((tokens) => {
          setPopularTokens(tokens);
          const imgs: Record<string, string> = {};
          const prices: Record<string, number> = {};
          for (const t of tokens) {
            if (t.image) imgs[t.symbol] = t.image;
            if (t.price > 0) prices[t.symbol] = t.price;
          }
          setTokenImages((prev) => ({ ...prev, ...imgs }));
          setTokenPrices((prev) => ({ ...prev, ...prices }));
        }).catch(() => {}),
        getTopKrc20TokensByGainers(5, "usd").then((tokens) => {
          setTrendingTokens(tokens);
          const imgs: Record<string, string> = {};
          const prices: Record<string, number> = {};
          for (const t of tokens) {
            if (t.image) imgs[t.symbol] = t.image;
            if (t.price > 0) prices[t.symbol] = t.price;
          }
          setTokenImages((prev) => ({ ...prev, ...imgs }));
          setTokenPrices((prev) => ({ ...prev, ...prices }));
        }).catch(() => {}),
      );
    }
    await Promise.all(promises);
    setRefreshing(false);
  }, [network]);

  const address = account?.address || "";

  const handleCopyAddress = async () => {
    if (address) {
      await Clipboard.setStringAsync(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const recentTxs = (history || []).slice(0, 5) as any[];
  const changeUp = (kasChange24h ?? 0) >= 0;
  const activeDiscoverList = discoverTab === "popular" ? popularTokens : trendingTokens;

  // Mini sparkline for KAS 7-day price
  const renderSparkline = () => {
    if (sparklineData.length < 2) return null;
    const prices = sparklineData.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const W = 120;
    const H = 32;
    const pad = 2;
    const points = prices
      .map((p, i) => {
        const x = pad + (i / (prices.length - 1)) * (W - pad * 2);
        const y = pad + (1 - (p - min) / range) * (H - pad * 2);
        return `${x},${y}`;
      })
      .join(" ");
    const isUp = prices[prices.length - 1] >= prices[0];
    return (
      <Svg width={W} height={H} style={{ marginTop: spacing.xs }}>
        <Polyline
          points={points}
          fill="none"
          stroke={isUp ? colors.success : colors.danger}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  };

  // Reusable token icon: shows image if available, fallback to gradient letter
  const renderTokenIcon = (symbol: string, imageUrl?: string) => {
    const imgSrc = imageUrl || tokenImages[symbol];
    if (imgSrc && !failedImages.has(symbol)) {
      return (
        <Image
          source={{ uri: imgSrc }}
          style={styles.tokenIconImage}
          onError={() => setFailedImages((prev) => new Set(prev).add(symbol))}
        />
      );
    }
    return (
      <LinearGradient
        colors={[colors.gradientAccentStart, colors.gradientAccentEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tokenIcon}
      >
        <Text style={styles.tokenIconText}>
          {symbol.charAt(0).toUpperCase()}
        </Text>
      </LinearGradient>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Sync Error Banner */}
        {syncError && (
          <View style={styles.syncErrorBanner}>
            <Text style={styles.syncErrorText}>{syncError}</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>NoXu</Text>
          <View style={styles.networkBadge}>
            <Text style={styles.networkText}>
              {network === "mainnet" ? "Mainnet" : "Testnet"}
            </Text>
          </View>
        </View>

        {/* Update Banner */}
        {updateInfo && (
          <TouchableOpacity
            style={styles.updateBanner}
            onPress={() => Linking.openURL(updateInfo.url)}
            activeOpacity={0.7}
          >
            <Text style={styles.updateBannerText}>
              {updateInfo.message}
            </Text>
            <TouchableOpacity onPress={dismissUpdateBanner} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.updateBannerDismiss}>{"\u00D7"}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* Balance Card */}
        <View style={[styles.balanceCard, shadows.glow]}>
          <TouchableOpacity
            style={styles.addressRow}
            onPress={handleCopyAddress}
            activeOpacity={0.7}
          >
            <Text style={styles.addressText}>{shortenAddress(address)}</Text>
            <View style={[styles.copyBadge, copied && styles.copyBadgeActive]}>
              <Text style={[styles.copyBadgeText, copied && styles.copyBadgeTextActive]}>
                {copied ? "Copied!" : "Copy"}
              </Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.fiatBalance}>
            {formatFiat(balance, kasPrice)}
          </Text>
          <Text style={styles.kasBalance}>{formatKas(balance)} KAS</Text>

          {renderSparkline()}

          {kasChange24h !== undefined && (
            <View style={styles.pnlRow}>
              <Text style={styles.pnlLabel}>24h</Text>
              <View
                style={[
                  styles.pnlBadge,
                  { backgroundColor: changeUp ? colors.successSoft : colors.dangerSoft },
                ]}
              >
                <Text
                  style={[
                    styles.pnlBadgeText,
                    { color: changeUp ? colors.success : colors.danger },
                  ]}
                >
                  {changeUp ? "+" : ""}
                  {kasChange24h.toFixed(2)}%
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {[
            { label: "Send", icon: "↑" as string | null, svgIcon: null as React.ReactNode, onPress: () => navigation.navigate("Send") },
            { label: "Receive", icon: "↓" as string | null, svgIcon: null as React.ReactNode, onPress: () => navigation.navigate("Receive") },
            { label: "PnL", icon: null, svgIcon: <PnLIcon color={colors.accentDark} size={22} />, onPress: () => navigation.getParent()?.navigate("PnL") },
          ].map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickAction}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[colors.gradientAccentStart, colors.gradientAccentEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.quickActionIcon}
              >
                {action.icon ? (
                  <Text style={styles.quickActionEmoji}>{action.icon}</Text>
                ) : (
                  action.svgIcon
                )}
              </LinearGradient>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tokens Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tokens</Text>

          {/* Native KAS */}
          <TouchableOpacity
            style={styles.tokenRow}
            onPress={() =>
              navigation
                .getParent()
                ?.navigate("TokenDetail", { tick: "KAS", isNative: true })
            }
            activeOpacity={0.7}
          >
            <View style={styles.tokenLeft}>
              {renderTokenIcon("KAS")}
              <View>
                <Text style={styles.tokenTick}>KAS</Text>
                <Text style={styles.tokenName}>Kaspa</Text>
              </View>
            </View>
            <View style={styles.tokenRight}>
              <Text style={styles.tokenBalance}>{formatKas(balance)}</Text>
              <Text style={styles.tokenFiat}>{formatFiat(balance, kasPrice)}</Text>
            </View>
          </TouchableOpacity>

          {/* KRC-20 tokens */}
          {tokenBalancesLoading ? (
            <ActivityIndicator color={colors.accent} style={{ padding: 20 }} />
          ) : tokenBalances && tokenBalances.filter((t: TokenBalance) => BigInt(t.balance) > 0n).length > 0 ? (
            tokenBalances.filter((t: TokenBalance) => BigInt(t.balance) > 0n).map((t: TokenBalance) => (
              <TouchableOpacity
                key={t.tick}
                style={styles.tokenRow}
                onPress={() =>
                  navigation
                    .getParent()
                    ?.navigate("TokenDetail", { tick: t.tick, isNative: false })
                }
                activeOpacity={0.7}
              >
                <View style={styles.tokenLeft}>
                  {renderTokenIcon(t.tick)}
                  <View>
                    <Text style={styles.tokenTick}>{t.tick}</Text>
                    <View style={styles.krc20Badge}>
                      <Text style={styles.krc20BadgeText}>KRC-20</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.tokenRight}>
                  <Text style={styles.tokenBalance}>
                    {parseFloat(t.balance).toLocaleString()}
                  </Text>
                  {tokenPrices[t.tick] ? (
                    <Text style={styles.tokenFiat}>
                      {(parseFloat(t.balance) * tokenPrices[t.tick]).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>No tokens yet</Text>
          )}
        </View>

        {/* Discover — Popular & Trending */}
        {network === "mainnet" && (
          <View style={styles.section}>
            <View style={styles.discoverHeader}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Discover</Text>
              <View style={styles.discoverTabs}>
                <TouchableOpacity
                  style={[
                    styles.discoverTab,
                    discoverTab === "popular" && styles.discoverTabActive,
                  ]}
                  onPress={() => setDiscoverTab("popular")}
                >
                  <Text
                    style={[
                      styles.discoverTabText,
                      discoverTab === "popular" && styles.discoverTabTextActive,
                    ]}
                  >
                    Popular
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.discoverTab,
                    discoverTab === "trending" && styles.discoverTabActive,
                  ]}
                  onPress={() => setDiscoverTab("trending")}
                >
                  <Text
                    style={[
                      styles.discoverTabText,
                      discoverTab === "trending" && styles.discoverTabTextActive,
                    ]}
                  >
                    Trending
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ marginTop: spacing.sm }}>
              {discoverLoading ? (
                <ActivityIndicator color={colors.accent} style={{ padding: 20 }} />
              ) : activeDiscoverList.length > 0 ? (
                activeDiscoverList.map((t) => (
                  <TouchableOpacity
                    key={t.geckoId || t.symbol}
                    style={styles.tokenRow}
                    onPress={() =>
                      navigation
                        .getParent()
                        ?.navigate("TokenDetail", { tick: t.symbol, isNative: false })
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.tokenLeft}>
                      {renderTokenIcon(t.symbol, t.image)}
                      <View>
                        <View style={styles.discoverTokenHeader}>
                          <Text style={styles.tokenTick}>{t.symbol}</Text>
                          <View style={styles.krc20Badge}>
                            <Text style={styles.krc20BadgeText}>KRC-20</Text>
                          </View>
                        </View>
                        <Text style={styles.tokenName}>{t.name}</Text>
                      </View>
                    </View>
                    <View style={styles.tokenRight}>
                      <Text style={styles.tokenBalance}>{formatPrice(t.price)}</Text>
                      <Text
                        style={[
                          styles.discoverChange,
                          {
                            color: t.change_24h >= 0 ? colors.success : colors.danger,
                          },
                        ]}
                      >
                        {t.change_24h >= 0 ? "+" : ""}
                        {t.change_24h.toFixed(1)}%
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.discoverEmpty}>
                  <Text style={styles.emptyText}>
                    No {discoverTab} tokens available right now
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Activity")}
            >
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {recentTxs.length > 0 ? (
            recentTxs.map((tx, i) => {
              const isOutgoing = tx.isOutgoing ?? false;
              const amount = (tx.amountSompi ?? 0) / 1e8;
              const confirmed = tx.status === "confirmed";

              return (
                <View key={tx.txid || i} style={styles.txRow}>
                  <View
                    style={[
                      styles.txIconCircle,
                      {
                        backgroundColor: isOutgoing
                          ? colors.dangerSoft
                          : colors.successSoft,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: fonts.weights.bold,
                        color: isOutgoing ? colors.danger : colors.success,
                      }}
                    >
                      {isOutgoing ? "↑" : "↓"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.txAmount,
                        {
                          color: isOutgoing ? colors.dangerStrong : colors.successLight,
                        },
                      ]}
                    >
                      {isOutgoing ? "-" : "+"}
                      {amount.toFixed(4)} KAS
                    </Text>
                    <Text style={styles.txDate}>
                      {tx.time
                        ? new Date(tx.time).toLocaleDateString()
                        : "Pending"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.txStatusBadge,
                      {
                        backgroundColor: confirmed
                          ? colors.successSoft
                          : colors.warningSoft,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.txStatusText,
                        {
                          color: confirmed ? colors.success : colors.warning,
                        },
                      ]}
                    >
                      {confirmed ? "Confirmed" : "Pending"}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No transactions yet</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  appName: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.extrabold,
    color: colors.accent,
    letterSpacing: 2,
  },
  networkBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(110, 199, 187, 0.3)",
  },
  networkText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    color: colors.accent,
  },

  // Balance Card
  balanceCard: {
    marginHorizontal: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.cardStrong,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  addressText: {
    fontSize: fonts.sizes.sm,
    color: colors.muted,
    fontFamily: "monospace",
  },
  copyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.cardInner,
  },
  copyBadgeActive: {
    backgroundColor: "rgba(73, 170, 159, 0.3)",
    borderColor: colors.accentSecondary,
  },
  copyBadgeText: {
    fontSize: fonts.sizes.xxs,
    fontWeight: fonts.weights.semibold,
    color: colors.muted,
  },
  copyBadgeTextActive: {
    color: colors.accentSecondary,
  },
  fiatBalance: {
    fontSize: fonts.sizes.balance,
    fontWeight: fonts.weights.bold,
    color: colors.text,
  },
  kasBalance: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  pnlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  pnlLabel: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
  },
  pnlBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  pnlBadgeText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
  },

  // Quick Actions
  quickActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  quickAction: {
    alignItems: "center",
    gap: spacing.xs,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionEmoji: {
    fontSize: 22,
    color: colors.accentDark,
  },
  quickActionLabel: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    fontWeight: fonts.weights.medium,
  },

  // Sections
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: fonts.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  seeAll: {
    fontSize: fonts.sizes.sm,
    color: colors.accent,
    marginBottom: spacing.sm,
  },

  // Token rows
  tokenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(7, 10, 12, 0.95)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.sm + 2,
    paddingHorizontal: spacing.md - 2,
    marginBottom: spacing.sm,
  },
  tokenLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  tokenIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenIconImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardInner,
  },
  tokenIconText: {
    fontSize: 15,
    fontWeight: fonts.weights.extrabold,
    color: colors.accentDark,
  },
  tokenTick: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.text,
  },
  tokenName: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
    marginTop: 1,
  },
  krc20Badge: {
    backgroundColor: "rgba(110, 199, 187, 0.2)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 2,
    alignSelf: "flex-start",
  },
  krc20BadgeText: {
    fontSize: fonts.sizes.xxs,
    fontWeight: fonts.weights.semibold,
    color: colors.accent,
  },
  tokenRight: {
    alignItems: "flex-end",
  },
  tokenBalance: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.text,
  },
  tokenFiat: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
    marginTop: 1,
  },

  // Discover section
  discoverHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  discoverTabs: {
    flexDirection: "row",
    backgroundColor: colors.cardInner,
    borderRadius: radii.full,
    padding: 2,
  },
  discoverTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  discoverTabActive: {
    backgroundColor: colors.accentSoft,
  },
  discoverTabText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.medium,
    color: colors.muted,
  },
  discoverTabTextActive: {
    color: colors.accent,
    fontWeight: fonts.weights.bold,
  },
  discoverTokenHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  discoverChange: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    marginTop: 1,
  },
  discoverEmpty: {
    backgroundColor: colors.cardInner,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    alignItems: "center",
  },

  // Transaction rows
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.cardInner,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    padding: spacing.sm,
    paddingHorizontal: spacing.md - 2,
    marginBottom: spacing.sm,
  },
  txIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  txAmount: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
  },
  txDate: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
    marginTop: 2,
  },
  txStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  txStatusText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
  },

  emptyText: {
    fontSize: fonts.sizes.sm,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  updateBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(110, 199, 187, 0.35)",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  updateBannerText: {
    flex: 1,
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    color: colors.accent,
  },
  updateBannerDismiss: {
    fontSize: 20,
    color: colors.accent,
    opacity: 0.7,
    lineHeight: 20,
  },
  syncErrorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(249, 115, 115, 0.3)",
  },
  syncErrorText: {
    fontSize: fonts.sizes.xs,
    color: colors.danger,
    textAlign: "center",
  },
});
