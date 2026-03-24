import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useWalletStore } from "../store";
import type { RootStackParamList } from "./types";
import { OnboardingNavigator } from "./OnboardingNavigator";
import { MainNavigator } from "./MainNavigator";
import LoginScreen from "../screens/auth/LoginScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { hasWallet, isUnlocked } = useWalletStore();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: "fade",
      }}
    >
      {!hasWallet ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : !isUnlocked ? (
        <Stack.Screen name="Auth" component={LoginScreen} />
      ) : (
        <Stack.Screen name="Main" component={MainNavigator} />
      )}
    </Stack.Navigator>
  );
}
