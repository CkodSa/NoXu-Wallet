import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useWalletService } from "../../hooks/useWalletService";
import { useWalletStore } from "../../store";
import { colors, fonts, radii, shadows } from "../../theme";

/* ── Animated Logo ─────────────────────────────────────── */
// GIF loop=1: plays once and stops on last frame.
// Tap replays by cache-busting the source URI (key-remount).
// The last frame of the GIF is identical to the static appearance,
// so there's no visible flash between replays.

const ANIMATION_DURATION = 3200; // slightly over 3s (75 frames × 40ms)
const logoGif = require("../../../assets/noxu-logo-animation.gif");

function AnimatedLogo({ size }: { size: number }) {
  const [gifKey, setGifKey] = useState(0);
  const canReplay = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // After the initial animation finishes, allow replay
    timerRef.current = setTimeout(() => {
      canReplay.current = true;
    }, ANIMATION_DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const replay = useCallback(() => {
    if (!canReplay.current) return;
    canReplay.current = false;
    // Key change triggers remount → GIF replays from frame 1
    setGifKey((k) => k + 1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      canReplay.current = true;
    }, ANIMATION_DURATION);
  }, []);

  return (
    <TouchableOpacity
      onPress={replay}
      activeOpacity={1}
      style={[
        {
          borderRadius: size / 2,
          width: size,
          height: size,
          overflow: "hidden",
        },
        shadows.glow,
      ]}
    >
      <Image
        key={gifKey}
        source={logoGif}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
}

/* ── Login Screen ──────────────────────────────────────── */

export default function LoginScreen() {
  const { width, height } = useWindowDimensions();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { unlock, deleteWallet } = useWalletService();
  const biometricEnabled = useWalletStore((s) => s.biometricEnabled);

  // Responsive sizes
  const logoSize = Math.min(width * 0.48, 200);
  const isCompact = height < 700; // iPhone SE / small screens
  const sectionGap = isCompact ? 16 : 28;
  const horizontalPad = Math.max(width * 0.06, 20);

  const handleUnlock = async () => {
    if (!password) return;
    setError("");
    setLoading(true);
    try {
      await unlock(password);
      setPassword("");
    } catch (err: any) {
      setError(err?.message || "Wrong password.");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    try {
      const LocalAuthentication = await import("expo-local-authentication");
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock NoXu Wallet",
        fallbackLabel: "Use Password",
      });
      if (result.success) {
        const SecureStore = await import("expo-secure-store");
        const cachedPw = await SecureStore.getItemAsync("noxu_bio_pw");
        if (cachedPw) {
          setLoading(true);
          await unlock(cachedPw);
        } else {
          Alert.alert(
            "Setup Required",
            "Enter your password once to enable biometric unlock."
          );
        }
      }
    } catch {
      Alert.alert(
        "Biometric Unavailable",
        "Could not authenticate with biometrics. Please use your password."
      );
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = (action: string) => {
    Alert.alert(
      action,
      "This will remove your current wallet. Make sure you have your seed phrase backed up.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => deleteWallet(),
        },
      ]
    );
  };

  useEffect(() => {
    if (biometricEnabled) {
      handleBiometric();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [biometricEnabled]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header title row */}
      <View style={[styles.titleRow, { paddingHorizontal: horizontalPad }]}>
        <Text style={styles.screenTitle}>NoXu Wallet</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: horizontalPad, gap: sectionGap },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Spacer — pushes content toward center */}
          <View style={{ flex: 1, minHeight: isCompact ? 12 : 24 }} />

          {/* Animated Logo */}
          <View style={styles.logoFrame}>
            <AnimatedLogo size={logoSize} />
          </View>

          {/* Main login card */}
          <View style={[styles.loginCard, shadows.card]}>
            <LinearGradient
              colors={["rgba(110, 199, 187, 0.08)", "rgba(0, 0, 0, 0.9)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.loginCardInner, { padding: isCompact ? 12 : 16, paddingBottom: isCompact ? 14 : 20 }]}
            >
              <Text style={styles.title}>ENTER YOUR PASSWORD</Text>

              {/* Inner card with input + button */}
              <LinearGradient
                colors={["rgba(8, 47, 51, 0.92)", "rgba(3, 7, 10, 0.96)"]}
                start={{ x: 0.3, y: 0 }}
                end={{ x: 0.7, y: 1 }}
                style={styles.innerCard}
              >
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  placeholder="Password"
                  placeholderTextColor="rgba(148, 163, 184, 0.7)"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError("");
                  }}
                  autoCapitalize="none"
                  onSubmitEditing={handleUnlock}
                  returnKeyType="go"
                />

                <TouchableOpacity
                  onPress={handleUnlock}
                  disabled={loading || !password}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      loading
                        ? ["rgba(110,199,187,0.4)", "rgba(143,228,217,0.4)"]
                        : [colors.gradientAccentStart, colors.gradientAccentEnd]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.unlockButton,
                      (!password || loading) && { opacity: 0.5 },
                    ]}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.accentDark} />
                    ) : (
                      <Text style={styles.unlockText}>Unlock wallet</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {biometricEnabled && (
                <TouchableOpacity
                  style={styles.biometricButton}
                  onPress={handleBiometric}
                  activeOpacity={0.7}
                >
                  <Text style={styles.biometricText}>Use Biometrics</Text>
                </TouchableOpacity>
              )}
            </LinearGradient>
          </View>

          {/* Footer buttons */}
          <View style={styles.footerButtons}>
            <TouchableOpacity
              onPress={() => confirmReset("Create New Wallet")}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.gradientAccentStart, colors.gradientAccentEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.footerPrimaryBtn}
              >
                <Text style={styles.footerPrimaryText}>Create new wallet</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => confirmReset("Import Wallet")}
              activeOpacity={0.8}
              style={styles.footerSecondaryBtn}
            >
              <Text style={styles.footerSecondaryText}>
                Import existing wallet
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bottom spacer */}
          <View style={{ flex: 1, minHeight: isCompact ? 12 : 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ── Styles ─────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  titleRow: {
    paddingTop: 4,
    marginBottom: 2,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: fonts.weights.bold,
    letterSpacing: 0.4,
    color: colors.text,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },

  /* Logo */
  logoFrame: {
    alignItems: "center",
  },

  /* Main card */
  loginCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
  },
  loginCardInner: {
    gap: 14,
  },

  /* Title */
  title: {
    fontSize: 16,
    fontWeight: fonts.weights.extrabold,
    letterSpacing: 3,
    textAlign: "center",
    color: colors.accent,
    marginBottom: 2,
  },

  /* Inner card */
  innerCard: {
    borderRadius: 22,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
  },

  /* Input */
  input: {
    backgroundColor: "rgba(7, 10, 12, 0.9)",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },

  /* Unlock button */
  unlockButton: {
    borderRadius: radii.full,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.75,
    shadowRadius: 24,
  },
  unlockText: {
    fontSize: 15,
    fontWeight: fonts.weights.semibold,
    color: colors.accentDark,
  },

  /* Error */
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
    marginTop: 2,
  },

  /* Biometric */
  biometricButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  biometricText: {
    fontSize: 15,
    color: colors.accent,
    fontWeight: fonts.weights.semibold,
  },

  /* Footer buttons */
  footerButtons: {
    gap: 10,
  },
  footerPrimaryBtn: {
    borderRadius: radii.full,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.75,
    shadowRadius: 24,
  },
  footerPrimaryText: {
    fontSize: 15,
    fontWeight: fonts.weights.semibold,
    color: colors.accentDark,
  },
  footerSecondaryBtn: {
    borderRadius: radii.full,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 26,
  },
  footerSecondaryText: {
    fontSize: 15,
    fontWeight: fonts.weights.semibold,
    color: colors.text,
  },
});
