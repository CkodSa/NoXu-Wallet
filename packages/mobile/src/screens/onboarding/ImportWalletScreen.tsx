import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { OnboardingScreenProps } from "../../navigation/types";
import { useWalletService } from "../../hooks/useWalletService";
import { colors, fonts, spacing, radii, shadows } from "../../theme";

export default function ImportWalletScreen({
  navigation,
}: OnboardingScreenProps<"ImportWallet">) {
  const [mnemonic, setMnemonic] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { importWallet } = useWalletService();

  const wordCount = mnemonic
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  const handleImport = async () => {
    const trimmed = mnemonic.trim().toLowerCase();
    const words = trimmed.split(/\s+/).filter((w) => w.length > 0);

    if (words.length !== 12 && words.length !== 24) {
      Alert.alert(
        "Invalid Seed Phrase",
        "Enter a valid 12 or 24-word seed phrase."
      );
      return;
    }
    if (password.length < 8) {
      Alert.alert("Weak Password", "Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await importWallet(password, words.join(" "));
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to import wallet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.scroll}
        >
          <Text style={styles.title}>Import Wallet</Text>
          <Text style={styles.subtitle}>
            Enter your 12 or 24-word seed phrase to restore your wallet.
          </Text>

          <Text style={styles.label}>
            SEED PHRASE ({wordCount} WORD{wordCount !== 1 ? "S" : ""})
          </Text>
          <TextInput
            style={styles.mnemonicInput}
            multiline
            numberOfLines={4}
            placeholder="Enter your seed phrase, words separated by spaces..."
            placeholderTextColor={colors.muted}
            value={mnemonic}
            onChangeText={setMnemonic}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textAlignVertical="top"
          />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Enter password (min 8 characters)"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />

          <Text style={styles.label}>CONFIRM PASSWORD</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Confirm password"
            placeholderTextColor={colors.muted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
          />
        </ScrollView>

        <TouchableOpacity
          onPress={handleImport}
          disabled={loading}
          activeOpacity={0.8}
          style={[styles.importOuter, shadows.buttonGlow]}
        >
          <LinearGradient
            colors={
              loading
                ? ["rgba(110,199,187,0.4)", "rgba(143,228,217,0.4)"]
                : [colors.gradientAccentStart, colors.gradientAccentEnd]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.importButton}
          >
            {loading ? (
              <ActivityIndicator color={colors.accentDark} />
            ) : (
              <Text style={styles.importButtonText}>Import Wallet</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  flex: {
    flex: 1,
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
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: fonts.sizes.xxs,
    fontWeight: fonts.weights.bold,
    color: colors.muted,
    letterSpacing: 1.2,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  mnemonicInput: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fonts.sizes.md,
    color: colors.text,
    minHeight: 120,
    lineHeight: 24,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
    fontSize: fonts.sizes.md,
    color: colors.text,
  },
  importOuter: {
    borderRadius: radii.full,
    marginTop: spacing.lg,
  },
  importButton: {
    borderRadius: radii.full,
    paddingVertical: 18,
    alignItems: "center",
  },
  importButtonText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.accentDark,
  },
});
