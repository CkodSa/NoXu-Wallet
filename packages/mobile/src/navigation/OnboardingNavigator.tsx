import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "./types";
import WelcomeScreen from "../screens/onboarding/WelcomeScreen";
import CreateWalletScreen from "../screens/onboarding/CreateWalletScreen";
import ImportWalletScreen from "../screens/onboarding/ImportWalletScreen";
import SeedPhraseScreen from "../screens/onboarding/SeedPhraseScreen";
import ConfirmSeedScreen from "../screens/onboarding/ConfirmSeedScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="CreateWallet" component={CreateWalletScreen} />
      <Stack.Screen name="ImportWallet" component={ImportWalletScreen} />
      <Stack.Screen name="SeedPhrase" component={SeedPhraseScreen} />
      <Stack.Screen name="ConfirmSeed" component={ConfirmSeedScreen} />
    </Stack.Navigator>
  );
}
