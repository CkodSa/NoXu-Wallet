import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWalletStore } from "../../store";
import { useWalletService } from "../../hooks/useWalletService";
import { colors, fonts, spacing, radii, shadows } from "../../theme";
import type { MainStackScreenProps } from "../../navigation/types";

type Props = MainStackScreenProps<"PnL">;

export default function PnLScreen({ navigation }: Props) {
  const { balance, kasPrice } = useWalletStore();
  const [loading, setLoading] = useState(false);

  // PnL data would come from a dedicated PnL tracking service
  // For now, show portfolio value with placeholder structure
  const holdingsValue =
    balance !== undefined && kasPrice ? balance * kasPrice : 0;

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Profit & Loss</Text>
          <TouchableOpacity
            onPress={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1000);
            }}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={styles.refreshLink}>Refresh</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Portfolio Summary */}
        <View style={[styles.summaryCard, shadows.card]}>
          <Text style={styles.summaryLabel}>Holdings Value</Text>
          <Text style={styles.summaryValue}>
            {holdingsValue.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
          </Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Cost Basis</Text>
              <Text style={styles.summaryItemValue}>—</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Unrealised PnL</Text>
              <Text style={styles.summaryItemValue}>—</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Realised PnL</Text>
              <Text style={styles.summaryItemValue}>—</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Total PnL</Text>
              <Text style={styles.summaryItemValue}>—</Text>
            </View>
          </View>
        </View>

        {/* Analysis */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Analysis</Text>
          <View style={styles.analysisGrid}>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Avg Buy Price</Text>
              <Text style={styles.analysisValue}>—</Text>
            </View>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Avg Sell Price</Text>
              <Text style={styles.analysisValue}>—</Text>
            </View>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Total Bought</Text>
              <Text style={styles.analysisValue}>—</Text>
            </View>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Total Sold</Text>
              <Text style={styles.analysisValue}>—</Text>
            </View>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Trades</Text>
              <Text style={styles.analysisValue}>—</Text>
            </View>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Win Rate</Text>
              <Text style={styles.analysisValue}>—</Text>
            </View>
          </View>
        </View>

        {/* Recent Trades */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Trades</Text>
          <Text style={styles.emptyText}>
            PnL tracking will populate as you transact. Sync your history to
            begin analysis.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={() =>
            Alert.alert("Reset Data", "Clear all PnL analysis data?", [
              { text: "Cancel", style: "cancel" },
              { text: "Reset", style: "destructive" },
            ])
          }
        >
          <Text style={styles.resetText}>Reset PnL Data</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  backButton: {
    color: colors.accent,
    fontSize: fonts.sizes.md,
    marginBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fonts.sizes.xxl,
    fontWeight: fonts.weights.bold,
    color: colors.text,
  },
  refreshLink: {
    fontSize: fonts.sizes.sm,
    color: colors.accent,
    fontWeight: fonts.weights.medium,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryLabel: {
    fontSize: fonts.sizes.sm,
    color: colors.muted,
  },
  summaryValue: {
    fontSize: fonts.sizes.xxl,
    fontWeight: fonts.weights.bold,
    color: colors.text,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryItem: {
    flexBasis: "46%",
    flexGrow: 1,
    gap: 2,
  },
  summaryItemLabel: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
  },
  summaryItemValue: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  analysisGrid: {
    gap: spacing.sm,
  },
  analysisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  analysisLabel: {
    fontSize: fonts.sizes.sm,
    color: colors.muted,
  },
  analysisValue: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.medium,
    color: colors.text,
  },
  emptyText: {
    fontSize: fonts.sizes.sm,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: spacing.md,
    lineHeight: 20,
  },
  resetButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  resetText: {
    fontSize: fonts.sizes.sm,
    color: colors.danger,
    fontWeight: fonts.weights.medium,
  },
});
