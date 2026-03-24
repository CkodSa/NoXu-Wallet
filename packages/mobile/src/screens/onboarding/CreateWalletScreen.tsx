import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { OnboardingScreenProps } from "../../navigation/types";
import { useWalletService } from "../../hooks/useWalletService";
import { colors, fonts, spacing, radii, shadows } from "../../theme";

export default function CreateWalletScreen({
  navigation,
}: OnboardingScreenProps<"CreateWallet">) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [wordCount, setWordCount] = useState<12 | 24>(12);
  const [loading, setLoading] = useState(false);
  const { createWallet } = useWalletService();

  const handleCreate = async () => {
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
      const mnemonic = await createWallet(password, wordCount);
      if (mnemonic) {
        navigation.navigate("SeedPhrase", { mnemonic, isBackup: true });
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to create wallet");
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
          style={styles.flex}
        >
          <Text style={styles.title}>Create New Wallet</Text>
          <Text style={styles.subtitle}>
            Set a strong password to encrypt your wallet.
          </Text>

          <View style={styles.form}>
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

            <Text style={styles.label}>SEED PHRASE LENGTH</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggle, wordCount === 12 && styles.toggleActive]}
                onPress={() => setWordCount(12)}
              >
                <Text
                  style={[
                    styles.toggleText,
                    wordCount === 12 && styles.toggleTextActive,
                  ]}
                >
                  12 Words
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggle, wordCount === 24 && styles.toggleActive]}
                onPress={() => setWordCount(24)}
              >
                <Text
                  style={[
                    styles.toggleText,
                    wordCount === 24 && styles.toggleTextActive,
                  ]}
                >
                  24 Words
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <TouchableOpacity
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.8}
          style={[styles.createOuter, shadows.buttonGlow]}
        >
          <LinearGradient
            colors={
              loading
                ? ["rgba(110,199,187,0.4)", "rgba(143,228,217,0.4)"]
                : [colors.gradientAccentStart, colors.gradientAccentEnd]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.createButton}
          >
            {loading ? (
              <ActivityIndicator color={colors.accentDark} />
            ) : (
              <Text style={styles.createButtonText}>Create Wallet</Text>
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
  form: {
    flex: 1,
    gap: spacing.sm,
  },
  label: {
    fontSize: fonts.sizes.xxs,
    fontWeight: fonts.weights.bold,
    color: colors.muted,
    letterSpacing: 1.2,
    marginTop: spacing.md,
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
  toggleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  toggle: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  toggleActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  toggleText: {
    fontSize: fonts.sizes.md,
    color: colors.muted,
    fontWeight: fonts.weights.medium,
  },
  toggleTextActive: {
    color: colors.accent,
    fontWeight: fonts.weights.bold,
  },
  createOuter: {
    borderRadius: radii.full,
    marginTop: spacing.lg,
  },
  createButton: {
    borderRadius: radii.full,
    paddingVertical: 18,
    alignItems: "center",
  },
  createButtonText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.accentDark,
  },
});
