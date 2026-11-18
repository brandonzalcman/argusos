import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { ScaffoldScreen } from "../src/components/ScaffoldScreen";

const routes = [
  { href: "/check-in", label: "Check-in" },
  { href: "/tasks", label: "Assigned tasks" },
  { href: "/boards/scaffold-board", label: "Board and form renderer" },
  { href: "/capture", label: "Photo and GPS capture" },
  { href: "/alerts", label: "Alerts and acknowledgement" },
  { href: "/offline", label: "Offline drafts and conflicts" },
  { href: "/settings", label: "Settings" },
] as const;

/** Lists available scaffold routes; identifiers are navigation examples, not operational records. */
export default function MobileHomeScreen() {
  return (
    <ScaffoldScreen
      title="Responder shell"
      purpose="Typed Expo Router destinations for a future incident responder application."
      implementationNote="No route is connected to identity, an incident, a board, native hardware or persisted data."
    >
      <View style={styles.navigation} accessibilityRole="menu">
        {routes.map((route) => (
          <Link accessibilityRole="link" href={route.href} key={route.href} style={styles.link}>
            <Text style={styles.linkText}>{route.label}</Text>
          </Link>
        ))}
      </View>
    </ScaffoldScreen>
  );
}

const styles = StyleSheet.create({
  navigation: {
    gap: 12,
  },
  link: {
    backgroundColor: "#14252d",
    borderRadius: 6,
    color: "#ffffff",
    fontSize: 17,
    padding: 16,
  },
  linkText: {
    color: "#ffffff",
    fontSize: 17,
  },
});
