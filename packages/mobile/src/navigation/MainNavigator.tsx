import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { MainStackParamList, MainStackScreenProps, MainTabParamList } from "./types";
import HomeScreen from "../screens/main/HomeScreen";
import SendScreen from "../screens/main/SendScreen";
import ReceiveScreen from "../screens/main/ReceiveScreen";
import ActivityScreen from "../screens/main/ActivityScreen";
import SettingsScreen from "../screens/main/SettingsScreen";
import TokenDetailScreen from "../screens/details/TokenDetailScreen";
import TransactionDetailScreen from "../screens/details/TransactionDetailScreen";
import PnLScreen from "../screens/details/PnLScreen";

// Stack-level wrappers that pass route params through to the tab-screen components
function SendStackScreen({ route, navigation }: MainStackScreenProps<"SendStack">) {
  return <SendScreen route={{ ...route, params: route.params } as any} navigation={navigation as any} />;
}
function ReceiveStackScreen() {
  return <ReceiveScreen />;
}
import {
  HomeIcon,
  SendIcon,
  ReceiveIcon,
  ActivityIcon,
  SettingsIcon,
} from "../components/TabIcons";
import { colors, fonts, radii } from "../theme";

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

const TAB_ICON_MAP: Record<
  string,
  React.FC<{ color: string; size?: number }>
> = {
  Home: HomeIcon,
  Send: SendIcon,
  Receive: ReceiveIcon,
  Activity: ActivityIcon,
  Settings: SettingsIcon,
};

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, tabStyles.tabBarBg]}>
            <LinearGradient
              colors={[
                "rgba(110, 199, 187, 0.45)",
                "transparent",
              ]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={tabStyles.tabBarGlow}
            />
          </View>
        ),
        tabBarStyle: {
          position: "absolute",
          bottom: Math.max(insets.bottom - 4, 8),
          left: 12,
          right: 12,
          height: 60,
          borderRadius: radii.full,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 18 },
          shadowOpacity: 0.9,
          shadowRadius: 45,
          paddingBottom: 0,
          paddingTop: 0,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: fonts.sizes.xs,
          fontWeight: fonts.weights.semibold,
          marginTop: -2,
        },
        tabBarIcon: ({ color }) => {
          const Icon = TAB_ICON_MAP[route.name];
          return Icon ? <Icon color={color} size={20} /> : null;
        },
        tabBarItemStyle: {
          borderRadius: radii.full,
          paddingVertical: 4,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Send" component={SendScreen} />
      <Tab.Screen name="Receive" component={ReceiveScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  tabBarBg: {
    borderRadius: radii.full,
    overflow: "hidden",
    backgroundColor: "rgba(7, 10, 12, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  tabBarGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "60%",
  },
});

export function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="TokenDetail" component={TokenDetailScreen} />
      <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
      <Stack.Screen name="SendStack" component={SendStackScreen} />
      <Stack.Screen name="ReceiveStack" component={ReceiveStackScreen} />
      <Stack.Screen name="PnL" component={PnLScreen} />
    </Stack.Navigator>
  );
}
