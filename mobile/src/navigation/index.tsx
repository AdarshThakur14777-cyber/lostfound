import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../state/AuthContext";
import { colors } from "../theme";
import type { RootStackParamList, TabParamList } from "./types";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { BoardScreen } from "../screens/BoardScreen";
import { ReportScreen } from "../screens/ReportScreen";
import { MyScreen } from "../screens/MyScreen";
import { SecurityScreen } from "../screens/SecurityScreen";
import { AdminScreen } from "../screens/AdminScreen";
import { ItemDetailScreen } from "../screens/ItemDetailScreen";
import { ClaimCreateScreen } from "../screens/ClaimCreateScreen";
import { ClaimDetailScreen } from "../screens/ClaimDetailScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Auth = createNativeStackNavigator();
const Tabs = createBottomTabNavigator<TabParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    border: colors.border,
  },
};

const screenOptions = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: "700" as const },
  contentStyle: { backgroundColor: colors.bg },
};

function AuthNavigator() {
  return (
    <Auth.Navigator screenOptions={screenOptions}>
      <Auth.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Auth.Screen name="Register" component={RegisterScreen} options={{ title: "Create account" }} />
    </Auth.Navigator>
  );
}

function TabNavigator() {
  const { user } = useAuth();
  const staff = !!user && ["security", "admin", "sysadmin"].includes(user.role);
  const admin = !!user && ["admin", "sysadmin"].includes(user.role);

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: route.name !== "Board",
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Board: "list",
            Report: "add-circle",
            Me: "person",
            Staff: "shield-checkmark",
            Admin: "settings",
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Board" component={BoardScreen} options={{ title: "Lost & Found" }} />
      <Tabs.Screen name="Report" component={ReportScreen} options={{ title: "Report" }} />
      {staff ? (
        <Tabs.Screen name="Staff" component={SecurityScreen} options={{ title: "Operations" }} />
      ) : null}
      {admin ? (
        <Tabs.Screen name="Admin" component={AdminScreen} options={{ title: "Admin" }} />
      ) : null}
      <Tabs.Screen name="Me" component={MyScreen} options={{ title: "Me" }} />
    </Tabs.Navigator>
  );
}

function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: "Item" }} />
      <Stack.Screen name="ClaimCreate" component={ClaimCreateScreen} options={{ title: "Open a claim" }} />
      <Stack.Screen name="ClaimDetail" component={ClaimDetailScreen} options={{ title: "Claim" }} />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: "Notifications" }}
      />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
