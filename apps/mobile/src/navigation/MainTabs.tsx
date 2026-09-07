import React from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { DashboardScreen } from "@/screens/main/DashboardScreen";
import { PortfoliosScreen } from "@/screens/main/PortfoliosScreen";
import { RiskScreen } from "@/screens/main/RiskScreen";
import { AlertsScreen } from "@/screens/main/AlertsScreen";
import { SettingsScreen } from "@/screens/main/SettingsScreen";
import { CopilotSheet } from "@/components/CopilotSheet";

export type MainTabParamList = {
  Dashboard: undefined;
  Portfolios: undefined;
  Risk: undefined;
  Alerts: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<keyof MainTabParamList, { focused: IoniconName; unfocused: IoniconName }> =
  {
    Dashboard: { focused: "home", unfocused: "home-outline" },
    Portfolios: { focused: "briefcase", unfocused: "briefcase-outline" },
    Risk: { focused: "shield", unfocused: "shield-outline" },
    Alerts: { focused: "notifications", unfocused: "notifications-outline" },
    Settings: { focused: "settings", unfocused: "settings-outline" },
  };

export function MainTabs() {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            const icons = TAB_ICONS[route.name as keyof MainTabParamList];
            const iconName = focused ? icons.focused : icons.unfocused;
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: "#3b82f6",
          tabBarInactiveTintColor: "#94a3b8",
          tabBarStyle: {
            borderTopColor: "#e2e8f0",
            backgroundColor: "#ffffff",
            height: 60,
            paddingBottom: 8,
          },
          headerStyle: { backgroundColor: "#ffffff" },
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "700", fontSize: 18 },
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: "Dashboard" }} />
        <Tab.Screen
          name="Portfolios"
          component={PortfoliosScreen}
          options={{ title: "Portfolios" }}
        />
        <Tab.Screen name="Risk" component={RiskScreen} options={{ title: "Risk Center" }} />
        <Tab.Screen name="Alerts" component={AlertsScreen} options={{ title: "Alerts" }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
      </Tab.Navigator>
      <CopilotSheet />
    </View>
  );
}
