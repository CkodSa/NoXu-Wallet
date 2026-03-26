import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useWalletStore } from "../../store";
import { useWalletService } from "../../hooks/useWalletService";
import { colors, fonts, spacing, radii, shadows } from "../../theme";
import { ActivityIcon } from "../../components/TabIcons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../navigation/types";
import { shortenAddress } from "@noxu/core";

export default function ActivityScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { history, account, addressBook } = useWalletStore();
  const { refreshHistory } = useWalletService();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "sent" | "received">("all");

  const contacts = addressBook?.entries || [];

  // Filter transactions based on search and type filter
  const filteredHistory = useMemo(() => {
    let txs = history || [];

    // Filter by type
    if (filterType === "sent") {
      txs = txs.filter((tx: any) => tx.isOutgoing === true);
    } else if (filterType === "received") {
      txs = txs.filter((tx: any) => !tx.isOutgoing);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      txs = txs.filter((tx: any) => {
        const counterparty = tx.isOutgoing ? tx.to : tx.from;
        const contact = counterparty ? getContactLabel(counterparty) : null;
        const amount = ((tx.amountSompi ?? 0) / 1e8).toFixed(8);
        return (
          (counterparty && counterparty.toLowerCase().includes(q)) ||
          (contact && contact.toLowerCase().includes(q)) ||
          amount.includes(q) ||
          (tx.txid && tx.txid.toLowerCase().includes(q))
        );
      });
    }

    return txs;
  }, [history, searchQuery, filterType]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshHistory();
    setRefreshing(false);
  }, []);

  const getContactLabel = (addr: string): string | null => {
    const contact = contacts.find((c: any) => c.address === addr);
    return contact?.label || null;
  };

  const renderTx = ({ item: tx }: { item: any }) => {
    const isOutgoing = tx.isOutgoing ?? false;
    const counterparty = isOutgoing ? tx.to : tx.from;
    const amount = (tx.amountSompi ?? 0) / 1e8;
    const contactLabel = counterparty ? getContactLabel(counterparty) : null;
    const displayAddr = contactLabel || shortenAddress(counterparty || "");
    const isConfirmed = tx.status === "confirmed";

    return (
      <TouchableOpacity
        style={[styles.txCard, shadows.card]}
        activeOpacity={0.7}
        onPress={() => navigation.getParent()?.navigate("TransactionDetail", { tx })}
      >
        {/* Direction icon */}
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
            style={[
              styles.txIconText,
              { color: isOutgoing ? colors.danger : colors.success },
            ]}
          >
            {isOutgoing ? "↑" : "↓"}
          </Text>
        </View>

        {/* Details */}
        <View style={styles.txDetails}>
          <Text style={styles.txType}>
            {isOutgoing ? "Sent" : "Received"}
          </Text>
          <Text style={styles.txCounterparty} numberOfLines={1}>
            {isOutgoing ? "To: " : "From: "}
            {displayAddr}
          </Text>
          <Text style={styles.txDate}>
            {tx.time
              ? new Date(tx.time).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Pending"}
          </Text>
        </View>

        {/* Amount + status */}
        <View style={styles.txRight}>
          <Text
            style={[
              styles.txAmount,
              { color: isOutgoing ? colors.dangerStrong : colors.successLight },
            ]}
          >
            {isOutgoing ? "-" : "+"}
            {amount.toFixed(4)}
          </Text>
          <Text style={styles.txAmountUnit}>KAS</Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isConfirmed
                  ? colors.successSoft
                  : colors.warningSoft,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isConfirmed
                    ? colors.success
                    : colors.warning,
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                {
                  color: isConfirmed ? colors.success : colors.warning,
                },
              ]}
            >
              {isConfirmed ? "Confirmed" : "Pending"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <TouchableOpacity
          onPress={onRefresh}
          style={styles.refreshButton}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={[colors.gradientAccentStart, colors.gradientAccentEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.refreshGradient}
          >
            <Text style={styles.refreshText}>Refresh</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Search + Filter */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search by address, amount, or tx ID..."
        placeholderTextColor={colors.muted}
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.filterRow}>
        {(["all", "sent", "received"] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.filterChip, filterType === type && styles.filterChipActive]}
            onPress={() => setFilterType(type)}
          >
            <Text style={[styles.filterChipText, filterType === type && styles.filterChipTextActive]}>
              {type === "all" ? "All" : type === "sent" ? "Sent" : "Received"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredHistory}
        keyExtractor={(item, index) => item.txid || String(index)}
        renderItem={renderTx}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, shadows.glow]}>
              <LinearGradient
                colors={[colors.gradientAccentStart, colors.gradientAccentEnd]}
                style={styles.emptyIconGradient}
              >
                <ActivityIcon color={colors.accentDark} size={28} />
              </LinearGradient>
            </View>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>
              Send or receive KAS to see activity here.
            </Text>
          </View>
        }
        contentContainerStyle={
          !(history && history.length > 0)
            ? { flex: 1 }
            : { paddingBottom: 120, gap: spacing.sm }
        }
        showsVerticalScrollIndicator={false}
      />
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fonts.sizes.xxl,
    fontWeight: fonts.weights.bold,
    color: colors.text,
  },
  refreshButton: {
    borderRadius: radii.full,
    overflow: "hidden",
  },
  refreshGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  refreshText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: colors.accentDark,
  },
  searchInput: {
    backgroundColor: colors.card,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: fonts.sizes.sm,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: "rgba(110, 199, 187, 0.15)",
    borderColor: colors.accent,
  },
  filterChipText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.medium,
    color: colors.muted,
  },
  filterChipTextActive: {
    color: colors.accent,
    fontWeight: fonts.weights.bold,
  },
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  txIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  txIconText: {
    fontSize: 18,
    fontWeight: fonts.weights.bold,
  },
  txDetails: {
    flex: 1,
    gap: 2,
  },
  txType: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.text,
  },
  txCounterparty: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
  },
  txDate: {
    fontSize: fonts.sizes.xxs,
    color: colors.muted,
    marginTop: 2,
  },
  txRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  txAmount: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.bold,
  },
  txAmountUnit: {
    fontSize: fonts.sizes.xxs,
    color: colors.muted,
    fontWeight: fonts.weights.medium,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: fonts.sizes.xxs,
    fontWeight: fonts.weights.semibold,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  emptyIcon: {
    borderRadius: 30,
    marginBottom: spacing.sm,
  },
  emptyIconGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: fonts.sizes.lg,
    color: colors.text,
    fontWeight: fonts.weights.semibold,
  },
  emptySubtext: {
    fontSize: fonts.sizes.sm,
    color: colors.muted,
    textAlign: "center",
  },
});
