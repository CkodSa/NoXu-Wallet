import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import {
  getKaspaPrice,
  getTokenPriceHistory,
  getKrc20Price,
  getTokenImage,
  KAS_LOGO_URL,
  KRC20TransferClient,
  getNetworkConfig,
  formatPrice,
  type PricePoint,
  type TokenPrice,
  type KRC20TokenInfo,
} from "@noxu/core";
import { useWalletStore, type TokenBalance } from "../../store";
import { colors, fonts, spacing, radii, shadows } from "../../theme";
import type { MainStackScreenProps } from "../../navigation/types";

type Props = MainStackScreenProps<"TokenDetail">;
type ChartRange = "D" | "W" | "M";

const RANGE_DAYS: Record<ChartRange, 1 | 7 | 30> = { D: 1, W: 7, M: 30 };

export default function TokenDetailScreen({ navigation, route }: Props) {
  const { tick, isNative } = route.params;
  const { balance, tokenBalances, kasPrice, kasChange24h, setKasPrice, network } = useWalletStore();

  const tokenData = isNative
    ? null
    : tokenBalances?.find((t: TokenBalance) => t.tick === tick);

  const displayBalance = isNative
    ? (balance ?? 0).toLocaleString("en-US", { maximumFractionDigits: 8 })
    : tokenData
      ? parseFloat(tokenData.balance).toLocaleString()
      : "0";

  const fiatValue =
    isNative && kasPrice
      ? ((balance ?? 0) * kasPrice).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        })
      : null;

  // Chart state
  const [chartRange, setChartRange] = useState<ChartRange>("W");
  const [chartData, setChartData] = useState<PricePoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  // KRC-20 token price
  const [tokenPrice, setTokenPrice] = useState<TokenPrice | null>(null);

  // KRC-20 token info (supply, holders, etc.)
  const [tokenInfo, setTokenInfo] = useState<KRC20TokenInfo | null>(null);
  const [tokenInfoLoading, setTokenInfoLoading] = useState(false);

  // Token image
  const [tokenImage, setTokenImage] = useState<string | null>(
    isNative ? KAS_LOGO_URL : null
  );
  const [imgFailed, setImgFailed] = useState(false);

  // Fetch chart data for any token (KAS or KRC-20)
  const fetchChart = useCallback(async (range: ChartRange) => {
    setChartLoading(true);
    try {
      const data = await getTokenPriceHistory(tick, RANGE_DAYS[range], "usd");
      setChartData(data);
    } catch (e) {
      console.error("[TokenDetail] chart fetch error:", e);
    } finally {
      setChartLoading(false);
    }
  }, [tick]);

  // Fetch KAS price if store doesn't have it
  useEffect(() => {
    if (!isNative || kasPrice != null) return;
    getKaspaPrice("usd")
      .then((data) => setKasPrice(data.price, data.change_24h))
      .catch((err) => console.error("[TokenDetail] KAS price fetch error:", err));
  }, [isNative, kasPrice]);

  // Fetch KRC-20 price + image + token info
  useEffect(() => {
    if (isNative) return;
    getKrc20Price(tick, "usd")
      .then((p) => setTokenPrice(p))
      .catch(() => {});
    getTokenImage(tick, "usd")
      .then((img) => { if (img) setTokenImage(img); })
      .catch(() => {});
    // Fetch token info (supply, holders, etc.)
    setTokenInfoLoading(true);
    const networkConfig = getNetworkConfig(network);
    const client = new KRC20TransferClient(network, networkConfig);
    client.getTokenInfo(tick.toLowerCase())
      .then((info) => setTokenInfo(info))
      .catch(() => {})
      .finally(() => setTokenInfoLoading(false));
  }, [tick, isNative, network]);

  // Fetch chart on mount and range change
  useEffect(() => {
    fetchChart(chartRange);
  }, [chartRange, fetchChart]);

  const handleRangeChange = (range: ChartRange) => {
    setChartRange(range);
  };

  // Compute change % from chart data
  const chartChange = chartData.length >= 2
    ? ((chartData[chartData.length - 1].price - chartData[0].price) / chartData[0].price) * 100
    : null;

  // Price for display
  const displayPrice = isNative
    ? kasPrice
    : tokenPrice?.price ?? null;

  // Change: prefer chart-derived change, fallback to API 24h change
  const apiChange = isNative ? (kasChange24h ?? 0) : (tokenPrice?.change_24h ?? null);
  const displayChange = chartRange === "D"
    ? (apiChange ?? chartChange)
    : (chartChange ?? apiChange);
  const isUp = (displayChange ?? 0) >= 0;

  // Build SVG chart path
  const renderChart = () => {
    if (chartData.length < 2) return null;

    const W = 320;
    const H = 120;
    const pad = 4;
    const prices = chartData.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const pathParts = prices.map((p, i) => {
      const x = pad + (i / (prices.length - 1)) * (W - pad * 2);
      const y = pad + (1 - (p - min) / range) * (H - pad * 2);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    const linePath = pathParts.join(" ");
    const areaPath = `${linePath} L ${W - pad} ${H} L ${pad} ${H} Z`;
    const strokeColor = isUp ? colors.success : colors.danger;

    return (
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <Defs>
          <SvgGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={strokeColor} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
          </SvgGradient>
        </Defs>
        <Path d={areaPath} fill="url(#chartArea)" />
        <Path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    );
  };

  const renderTokenIcon = () => {
    if (tokenImage && !imgFailed) {
      return (
        <Image
          source={{ uri: tokenImage }}
          style={styles.tokenIconImage}
          onError={() => setImgFailed(true)}
        />
      );
    }
    return (
      <LinearGradient
        colors={[colors.gradientAccentStart, colors.gradientAccentEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tokenIconFallback}
      >
        <Text style={styles.tokenIconLetter}>
          {tick.charAt(0).toUpperCase()}
        </Text>
      </LinearGradient>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backText}>{"< Back"}</Text>
          </TouchableOpacity>
        </View>

        {/* Token Identity */}
        <View style={styles.tokenIdentity}>
          {renderTokenIcon()}
          <View>
            <View style={styles.tokenNameRow}>
              <Text style={styles.tokenTick}>{tick}</Text>
              {!isNative && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>KRC-20</Text>
                </View>
              )}
            </View>
            <Text style={styles.tokenFullName}>
              {isNative ? "Kaspa" : tick}
            </Text>
          </View>
        </View>

        {/* Balance Card */}
        <View style={[styles.balanceCard, shadows.glow]}>
          <Text style={styles.balanceLabel}>Your Balance</Text>
          <Text style={styles.balanceAmount}>
            {displayBalance} {tick}
          </Text>
          {fiatValue && (
            <Text style={styles.fiatValue}>{fiatValue}</Text>
          )}
          {!isNative && tokenPrice && tokenData && (
            <Text style={styles.fiatValue}>
              {(parseFloat(tokenData.balance) * tokenPrice.price).toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </Text>
          )}
        </View>

        {/* Price + Chart Section */}
        <View style={styles.chartSection}>
          {/* Price header */}
          <View style={styles.priceHeader}>
            <View>
              {displayPrice != null ? (
                <>
                  <Text style={styles.priceDisplay}>
                    {formatPrice(displayPrice)}
                  </Text>
                  {displayChange != null && (
                    <Text
                      style={[
                        styles.priceChange,
                        { color: (displayChange >= 0) ? colors.success : colors.danger },
                      ]}
                    >
                      {displayChange >= 0 ? "+" : ""}
                      {displayChange.toFixed(2)}%
                      <Text style={styles.rangeLabel}>
                        {" "}{chartRange === "D" ? "24h" : chartRange === "W" ? "7d" : "30d"}
                      </Text>
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.priceDisplay}>--</Text>
              )}
            </View>
            {/* Chart range tabs */}
            <View style={styles.chartTabs}>
              {(["D", "W", "M"] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.chartTab,
                    chartRange === r && styles.chartTabActive,
                  ]}
                  onPress={() => handleRangeChange(r)}
                >
                  <Text
                    style={[
                      styles.chartTabText,
                      chartRange === r && styles.chartTabTextActive,
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Chart */}
          <View style={styles.chartContainer}>
            {chartLoading && chartData.length === 0 ? (
              <View style={styles.chartPlaceholder}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.chartLoadingText}>Loading chart...</Text>
              </View>
            ) : chartData.length > 0 ? (
              renderChart()
            ) : (
              <View style={styles.chartPlaceholder}>
                <Text style={styles.chartLoadingText}>No chart data available</Text>
              </View>
            )}
          </View>
        </View>

        {/* Token Info Card */}
        {isNative && kasPrice ? (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Price</Text>
              <Text style={styles.infoValue}>${kasPrice.toFixed(6)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>24h Change</Text>
              <Text
                style={[
                  styles.infoValue,
                  {
                    color:
                      (kasChange24h ?? 0) >= 0
                        ? colors.success
                        : colors.danger,
                  },
                ]}
              >
                {(kasChange24h ?? 0) >= 0 ? "+" : ""}
                {(kasChange24h ?? 0).toFixed(2)}%
              </Text>
            </View>
            {tokenPrice && tokenPrice.volume != null && tokenPrice.volume > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Volume (24h)</Text>
                <Text style={styles.infoValue}>
                  ${tokenPrice.volume.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Network</Text>
              <Text style={styles.infoValue}>{network === "mainnet" ? "Mainnet" : "Testnet"}</Text>
            </View>
          </View>
        ) : !isNative ? (
          <View style={styles.infoCard}>
            {tokenInfoLoading ? (
              <ActivityIndicator color={colors.accent} style={{ padding: 12 }} />
            ) : tokenInfo ? (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total Supply</Text>
                  <Text style={styles.infoValue}>
                    {(Number(tokenInfo.maxSupply) / Math.pow(10, tokenInfo.decimals)).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Minted</Text>
                  <Text style={styles.infoValue}>
                    {(Number(tokenInfo.minted) / Math.pow(10, tokenInfo.decimals)).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Holders</Text>
                  <Text style={styles.infoValue}>{tokenInfo.holderTotal.toLocaleString()}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Transfers</Text>
                  <Text style={styles.infoValue}>{tokenInfo.transferTotal.toLocaleString()}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>State</Text>
                  <Text style={styles.infoValue}>{tokenInfo.state}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Decimals</Text>
                  <Text style={styles.infoValue}>{tokenInfo.decimals}</Text>
                </View>
                {tokenPrice && tokenPrice.volume != null && tokenPrice.volume > 0 && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Volume (24h)</Text>
                    <Text style={styles.infoValue}>
                      ${tokenPrice.volume.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.infoValue}>Token info unavailable</Text>
            )}
          </View>
        ) : null}

        {/* Action Buttons: Send + Receive */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButtonWrapper}
            onPress={() =>
              navigation.navigate("SendStack", { token: tick })
            }
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.gradientAccentStart, colors.gradientAccentEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionButton}
            >
              <Text style={styles.actionArrow}>↑</Text>
              <Text style={styles.actionButtonText}>Send</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButtonWrapper}
            onPress={() =>
              navigation.navigate("ReceiveStack")
            }
            activeOpacity={0.8}
          >
            <View style={styles.actionButtonOutline}>
              <Text style={[styles.actionArrow, { color: colors.accent }]}>↓</Text>
              <Text style={[styles.actionButtonText, { color: colors.accent }]}>
                Receive
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  backButton: {},
  backText: {
    fontSize: fonts.sizes.sm,
    color: colors.accent,
    fontWeight: fonts.weights.semibold,
  },

  // Token identity
  tokenIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  tokenIconImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardInner,
  },
  tokenIconFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenIconLetter: {
    fontSize: 20,
    fontWeight: fonts.weights.extrabold,
    color: colors.accentDark,
  },
  tokenNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tokenTick: {
    fontSize: fonts.sizes.xxl,
    fontWeight: fonts.weights.bold,
    color: colors.text,
  },
  tokenFullName: {
    fontSize: fonts.sizes.sm,
    color: colors.muted,
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: fonts.sizes.xs,
    color: colors.accent,
    fontWeight: fonts.weights.semibold,
  },

  // Balance card
  balanceCard: {
    backgroundColor: colors.cardStrong,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  balanceLabel: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  balanceAmount: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
    color: colors.text,
  },
  fiatValue: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
  },

  // Price + Chart section
  chartSection: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  priceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  priceDisplay: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
    color: colors.text,
  },
  priceChange: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    marginTop: 2,
  },
  rangeLabel: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
    fontWeight: fonts.weights.medium,
  },
  chartTabs: {
    flexDirection: "row",
    backgroundColor: colors.cardInner,
    borderRadius: radii.full,
    padding: 2,
  },
  chartTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  chartTabActive: {
    backgroundColor: colors.accentSoft,
  },
  chartTabText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.medium,
    color: colors.muted,
  },
  chartTabTextActive: {
    color: colors.accent,
    fontWeight: fonts.weights.bold,
  },
  chartContainer: {
    height: 120,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  chartPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  chartLoadingText: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
  },

  // Info card
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoLabel: {
    fontSize: fonts.sizes.sm,
    color: colors.muted,
  },
  infoValue: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.medium,
    color: colors.text,
  },

  // Action buttons
  actions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionButtonWrapper: {
    flex: 1,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    paddingVertical: 14,
  },
  actionButtonOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: "rgba(110, 199, 187, 0.08)",
  },
  actionArrow: {
    fontSize: 18,
    fontWeight: fonts.weights.bold,
    color: colors.accentDark,
  },
  actionButtonText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.accentDark,
  },
});
