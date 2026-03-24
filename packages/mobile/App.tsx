import React, { useEffect, useState, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { View, Text, StyleSheet, ActivityIndicator, AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { initMobileCrypto } from "./src/platform/crypto-provider";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useWalletService } from "./src/hooks/useWalletService";
import { useWalletStore } from "./src/store";
import { colors, fonts, spacing } from "./src/theme";

// Initialize crypto provider before anything else
initMobileCrypto();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

function AppInner() {
  const [ready, setReady] = useState(false);
  const { initialize, lock } = useWalletService();
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initialize();
      } catch (err) {
        console.error("[App] Failed to initialize wallet:", err);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Auto-lock: lock wallet after configured idle time in background
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const { isUnlocked, autoLockMinutes } = useWalletStore.getState();
      if (nextState === "background" || nextState === "inactive") {
        backgroundedAt.current = Date.now();
      } else if (nextState === "active" && backgroundedAt.current && isUnlocked) {
        const elapsed = Date.now() - backgroundedAt.current;
        if (elapsed >= autoLockMinutes * 60 * 1000) {
          lock();
        }
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>NoXu</Text>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return <RootNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <AppInner />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.lg,
  },
  splashLogo: {
    fontSize: 48,
    fontWeight: fonts.weights.bold,
    color: colors.accent,
    letterSpacing: 2,
  },
});
