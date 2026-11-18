import { Stack } from "expo-router";

/** Defines the typed Expo Router shell; no authentication or data-loading provider is connected yet. */
export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#14252d" },
        headerTintColor: "#ffffff",
        contentStyle: { backgroundColor: "#f5f7f8" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Responder scaffold" }} />
      <Stack.Screen name="check-in" options={{ title: "Check-in" }} />
      <Stack.Screen name="tasks" options={{ title: "Assigned tasks" }} />
      <Stack.Screen name="boards/[boardId]" options={{ title: "Board / form" }} />
      <Stack.Screen name="capture" options={{ title: "Photo and GPS" }} />
      <Stack.Screen name="alerts/index" options={{ title: "Alerts" }} />
      <Stack.Screen name="alerts/[alertId]" options={{ title: "Alert acknowledgement" }} />
      <Stack.Screen name="offline" options={{ title: "Offline drafts" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}
