import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { colors, fonts, spacing, radii, shadows } from "../../theme";
import type { MainStackScreenProps } from "../../navigation/types";
import { useWalletStore } from "../../store";
import { shortenAddress } from "@noxu/core";

type Props = MainStackScreenProps<"TransactionDetail">;

export default function TransactionDetailScreen({ route, navigation }: Props) {
  const { tx } = route.params;
  const { addressBook } = useWalletStore();
  const contacts = addressBook?.entries || [];

  const isOutgoing = tx.isOutgoing ?? false;
  const counterparty = isOutgoing ? tx.to : tx.from;
  const amount = (tx.amountSompi ?? 0) / 1e8;
  const isConfirmed = tx.status === "confirmed";

  const contact = contacts.find((c: any) => c.address === counterparty);
  const contactLabel = contact?.label;

  const handleCopy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copied", `${label} copied to clipboard.`);
  };

  const dateStr = tx.time
    ? new Date(tx.time).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Pending";

  const timeStr = tx.time
    ? new Date(tx.time).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Back button */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>{"< Back"}</Text>
        </TouchableOpacity>

        {/* Direction + Amount Hero */}
        <View style={[styles.heroCard, shadows.glow]}>
          <View
            style={[
              styles.directionCircle,
              {
                backgroundColor: isOutgoing
                  ? colors.dangerSoft
                  : colors.successSoft,
              },
            ]}
          >
            <Text
              style={[
                styles.directionArrow,
                { color: isOutgoing ? colors.danger : colors.success },
              ]}
            >
              {isOutgoing ? "↑" : "↓"}
            </Text>
          </View>
          <Text style={styles.heroLabel}>
            {isOutgoing ? "Sent" : "Received"}
          </Text>
          <Text
            style={[
              styles.heroAmount,
              { color: isOutgoing ? colors.dangerStrong : colors.successLight },
            ]}
          >
            {isOutgoing ? "-" : "+"}
            {amount.toFixed(8)} KAS
          </Text>
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
                { color: isConfirmed ? colors.success : colors.warning },
              ]}
            >
              {isConfirmed ? "Confirmed" : "Pending"}
            </Text>
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.detailCard}>
          {/* Date */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <View style={styles.detailValueCol}>
              <Text style={styles.detailValue}>{dateStr}</Text>
              {timeStr ? (
                <Text style={styles.detailValueSub}>{timeStr}</Text>
              ) : null}
            </View>
          </View>

          {/* Counterparty */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {isOutgoing ? "To" : "From"}
            </Text>
            <TouchableOpacity
              style={styles.detailValueCol}
              onPress={() =>
                counterparty && handleCopy(counterparty, "Address")
              }
            >
              {contactLabel ? (
                <Text style={styles.detailValue}>{contactLabel}</Text>
              ) : null}
              <Text
                style={[styles.detailValueMono, !contactLabel && styles.detailValue]}
                numberOfLines={2}
              >
                {counterparty
                  ? shortenAddress(counterparty)
                  : "Unknown"}
              </Text>
              <Text style={styles.tapHint}>Tap to copy</Text>
            </TouchableOpacity>
          </View>

          {/* Transaction ID */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>TX ID</Text>
            <TouchableOpacity
              style={styles.detailValueCol}
              onPress={() =>
                tx.txid && handleCopy(tx.txid, "Transaction ID")
              }
            >
              <Text style={styles.detailValueMono} numberOfLines={2}>
                {tx.txid
                  ? tx.txid.slice(0, 20) + "..." + tx.txid.slice(-12)
                  : "N/A"}
              </Text>
              <Text style={styles.tapHint}>Tap to copy</Text>
            </TouchableOpacity>
          </View>

          {/* Amount in sompi */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount (sompi)</Text>
            <Text style={styles.detailValue}>
              {(tx.amountSompi ?? 0).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Full TX ID for copying */}
        <TouchableOpacity
          onPress={() => tx.txid && handleCopy(tx.txid, "Full TX ID")}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[colors.gradientAccentStart, colors.gradientAccentEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.copyButton}
          >
            <Text style={styles.copyButtonText}>Copy Full TX ID</Text>
          </LinearGradient>
        </TouchableOpacity>
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
  backButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  backText: {
    fontSize: fonts.sizes.sm,
    color: colors.accent,
    fontWeight: fonts.weights.semibold,
  },
  heroCard: {
    backgroundColor: colors.cardStrong,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  directionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  directionArrow: {
    fontSize: 26,
    fontWeight: fonts.weights.bold,
  },
  heroLabel: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.text,
  },
  heroAmount: {
    fontSize: fonts.sizes.xxl,
    fontWeight: fonts.weights.bold,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
  },
  detailCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  detailLabel: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
    fontWeight: fonts.weights.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    minWidth: 80,
    paddingTop: 2,
  },
  detailValue: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.text,
    textAlign: "right",
  },
  detailValueCol: {
    flex: 1,
    alignItems: "flex-end",
  },
  detailValueSub: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
    marginTop: 2,
  },
  detailValueMono: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    fontFamily: "monospace",
    textAlign: "right",
  },
  tapHint: {
    fontSize: fonts.sizes.xxs,
    color: colors.accent,
    marginTop: 2,
  },
  copyButton: {
    borderRadius: radii.full,
    paddingVertical: 12,
    alignItems: "center",
  },
  copyButtonText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.accentDark,
  },
});
