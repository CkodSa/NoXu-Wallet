import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import type { OnboardingScreenProps } from "../../navigation/types";
import { colors, fonts, spacing, radii, shadows } from "../../theme";

export default function SeedPhraseScreen({
  navigation,
  route,
}: OnboardingScreenProps<"SeedPhrase">) {
  const { mnemonic, isBackup } = route.params;
  const words = mnemonic.split(" ");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleContinue = () => {
    if (isBackup) {
      navigation.navigate("ConfirmSeed", { mnemonic });
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.title}>Your Seed Phrase</Text>
        <Text style={styles.subtitle}>
          Write down these {words.length} words in order. This is the only way
          to recover your wallet.
        </Text>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>IMPORTANT</Text>
          <Text style={styles.warningText}>
            Never share your seed phrase. Anyone with these words can access your
            funds.
          </Text>
        </View>

        {!revealed ? (
          <TouchableOpacity
            style={[styles.revealButton, shadows.card]}
            onPress={() => setRevealed(true)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["rgba(110,199,187,0.1)", "rgba(7,10,12,0.96)"]}
              style={styles.revealGradient}
            >
              <Text style={styles.revealButtonText}>Tap to Reveal</Text>
              <Text style={styles.revealSubtext}>
                Make sure no one is watching
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.wordGrid}>
            {words.map((word, index) => (
              <View key={index} style={styles.wordCard}>
                <Text style={styles.wordIndex}>{index + 1}</Text>
                <Text style={styles.wordText}>{word}</Text>
              </View>
            ))}
          </View>
        )}

        {revealed && (
          <TouchableOpacity
            style={styles.copyButton}
            onPress={handleCopy}
            activeOpacity={0.7}
          >
            <Text style={styles.copyButtonText}>
              {copied ? "Copied!" : "Copy Seed Phrase"}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {revealed && (
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.8}
          style={[styles.continueOuter, shadows.buttonGlow]}
        >
          <LinearGradient
            colors={[colors.gradientAccentStart, colors.gradientAccentEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.continueButton}
          >
            <Text style={styles.continueButtonText}>
              {isBackup ? "I've Written It Down" : "Done"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  scroll: {
    flex: 1,
  },
  backButton: {
    color: colors.accent,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fonts.sizes.xxl,
    fontWeight: fonts.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fonts.sizes.md,
    color: colors.muted,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  warningCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(249, 115, 115, 0.3)",
    gap: spacing.xs,
  },
  warningTitle: {
    fontSize: fonts.sizes.xxs,
    fontWeight: fonts.weights.bold,
    color: colors.danger,
    letterSpacing: 1.2,
  },
  warningText: {
    fontSize: fonts.sizes.sm,
    color: colors.danger,
    lineHeight: 20,
  },
  revealButton: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  revealGradient: {
    paddingVertical: 48,
    alignItems: "center",
    gap: spacing.xs,
  },
  revealButtonText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.accent,
  },
  revealSubtext: {
    fontSize: fonts.sizes.sm,
    color: colors.muted,
  },
  wordGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  wordCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexBasis: "46%",
    flexGrow: 1,
    gap: spacing.sm,
  },
  wordIndex: {
    fontSize: fonts.sizes.xxs,
    fontWeight: fonts.weights.bold,
    color: colors.muted,
    width: 20,
  },
  wordText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.text,
  },
  copyButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.full,
  },
  copyButtonText: {
    fontSize: fonts.sizes.sm,
    color: colors.accent,
    fontWeight: fonts.weights.bold,
  },
  continueOuter: {
    borderRadius: radii.full,
    marginTop: spacing.lg,
  },
  continueButton: {
    borderRadius: radii.full,
    paddingVertical: 18,
    alignItems: "center",
  },
  continueButtonText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.accentDark,
  },
});
