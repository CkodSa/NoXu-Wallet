import React, { useEffect, useState, useRef, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet, Image, AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import { initMobileCrypto } from "./src/platform/crypto-provider";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useWalletService } from "./src/hooks/useWalletService";
import { useWalletStore } from "./src/store";
import { colors, fonts, spacing } from "./src/theme";

// Keep native splash visible while we load
SplashScreen.preventAutoHideAsync();

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

  const onLayoutRootView = useCallback(async () => {
    // Hide native splash as soon as our custom splash is visible
    await SplashScreen.hideAsync();
  }, []);

  if (!ready) {
    return (
      <View style={styles.splash} onLayout={onLayoutRootView}>
        <Image
          source={require("./assets/splash-icon.png")}
          style={styles.splashImage}
          resizeMode="contain"
        />
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
  },
  splashImage: {
    width: 280,
    height: 280,
  },
});
