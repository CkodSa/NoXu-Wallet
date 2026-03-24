import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { useWalletStore } from "../../store";
import { colors, fonts, spacing, radii, shadows } from "../../theme";
import QRCode from "../../components/QRCode";

export default function ReceiveScreen() {
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
  const { account, network } = useWalletStore();
  const [copied, setCopied] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const qrSize = Math.min(screenWidth * 0.5, 220);
  const address = account?.address || "";

  const handleCopy = async () => {
    if (address) {
      await Clipboard.setStringAsync(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {canGoBack && (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{"< Back"}</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.title}>Receive</Text>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Network badge */}
        <View style={styles.networkBadge}>
          <View style={styles.networkDot} />
          <Text style={styles.networkText}>
            {network === "mainnet" ? "Mainnet" : "Testnet"}
          </Text>
        </View>

        {/* QR card with glow */}
        <View style={[styles.qrCard, shadows.glow]}>
          <LinearGradient
            colors={[
              "rgba(110, 199, 187, 0.08)",
              "rgba(7, 10, 12, 0.96)",
            ]}
            style={styles.qrCardGradient}
          >
            <View style={styles.qrWhiteBg}>
              <QRCode data={address} size={qrSize} />
            </View>

            <Text style={styles.addressLabel}>YOUR KASPA ADDRESS</Text>
            <Text style={styles.address} selectable>
              {address}
            </Text>
          </LinearGradient>
        </View>

        {/* Copy button — gradient pill */}
        <TouchableOpacity
          onPress={handleCopy}
          activeOpacity={0.8}
          style={[styles.copyButtonOuter, shadows.buttonGlow]}
        >
          <LinearGradient
            colors={[colors.gradientAccentStart, colors.gradientAccentEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.copyButton}
          >
            <Text style={styles.copyButtonText}>
              {copied ? "Copied!" : "Copy Address"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Share hint */}
        <View style={styles.hintCard}>
          <Text style={styles.hintTitle}>Only send KAS or KRC-20 tokens</Text>
          <Text style={styles.hintText}>
            Sending other assets to this address may result in permanent loss.
          </Text>
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
  backButton: {
    marginTop: spacing.sm,
  },
  backText: {
    fontSize: fonts.sizes.sm,
    color: colors.accent,
    fontWeight: fonts.weights.semibold,
  },
  title: {
    fontSize: fonts.sizes.xxl,
    fontWeight: fonts.weights.bold,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  scrollContent: {
    alignItems: "center",
    paddingBottom: 120,
  },
  networkBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: spacing.lg,
  },
  networkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  networkText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  qrCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    width: "100%",
    marginBottom: spacing.lg,
  },
  qrCardGradient: {
    alignItems: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  qrWhiteBg: {
    backgroundColor: "#ffffff",
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  addressLabel: {
    fontSize: fonts.sizes.xxs,
    fontWeight: fonts.weights.bold,
    color: colors.muted,
    letterSpacing: 1.5,
    marginTop: spacing.xs,
  },
  address: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    fontFamily: "monospace",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
  },
  copyButtonOuter: {
    borderRadius: radii.full,
    marginBottom: spacing.lg,
    width: "100%",
  },
  copyButton: {
    borderRadius: radii.full,
    paddingVertical: 16,
    alignItems: "center",
  },
  copyButtonText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
    color: colors.accentDark,
    letterSpacing: 0.3,
  },
  hintCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    padding: spacing.md,
    width: "100%",
    gap: spacing.xs,
  },
  hintTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.warning,
  },
  hintText: {
    fontSize: fonts.sizes.xs,
    color: colors.warning,
    lineHeight: 18,
    opacity: 0.8,
  },
});
