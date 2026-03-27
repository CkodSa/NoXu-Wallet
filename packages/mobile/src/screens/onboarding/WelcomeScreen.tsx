import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { OnboardingScreenProps } from "../../navigation/types";
import { colors, fonts, spacing, radii, shadows } from "../../theme";

export default function WelcomeScreen({
  navigation,
}: OnboardingScreenProps<"Welcome">) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <Image
          source={require("../../../assets/splash-icon.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />

        <Text style={styles.logoText}>NoXu</Text>
        <Text style={styles.logoSubtext}>Wallet</Text>

        <Text style={styles.tagline}>
          Your keys, your crypto. Always.
        </Text>

        <Text style={styles.description}>
          A security-first, non-custodial wallet for the Kaspa blockchain.
        </Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          onPress={() => navigation.navigate("CreateWallet")}
          activeOpacity={0.8}
          style={[styles.primaryOuter, shadows.buttonGlow]}
        >
          <LinearGradient
            colors={[colors.gradientAccentStart, colors.gradientAccentEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Create New Wallet</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("ImportWallet")}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Import Existing Wallet</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoImage: {
    width: 200,
    height: 200,
    marginBottom: spacing.lg,
  },
  logoText: {
    fontSize: 48,
    fontWeight: fonts.weights.bold,
    color: colors.accent,
    letterSpacing: 2,
  },
  logoSubtext: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.medium,
    color: colors.text,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  tagline: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  description: {
    fontSize: fonts.sizes.md,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: spacing.xl,
  },
  buttons: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  primaryOuter: {
    borderRadius: radii.full,
  },
  primaryButton: {
    borderRadius: radii.full,
    paddingVertical: 18,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.accentDark,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.full,
    paddingVertical: 18,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.medium,
    color: colors.text,
  },
});
