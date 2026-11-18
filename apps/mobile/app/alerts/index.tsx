import { Link } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { ScaffoldScreen } from "../../src/components/ScaffoldScreen";

/** Placeholder alert inbox with a navigation-only example and no operational alert data. */
export default function AlertsScreen() {
  return (
    <ScaffoldScreen
      title="Alerts"
      purpose="A future permission-filtered inbox for incident alerts, delivery state and escalation notices."
      implementationNote="No push provider, inbox or realtime gateway is connected. The example link opens only the acknowledgement shell."
    >
      <Link accessibilityRole="link" href="/alerts/scaffold-alert" style={styles.link}>
        <Text style={styles.linkText}>Open acknowledgement placeholder</Text>
      </Link>
    </ScaffoldScreen>
  );
}

const styles = StyleSheet.create({
  link: {
    backgroundColor: "#14252d",
    borderRadius: 6,
    padding: 16,
  },
  linkText: {
    color: "#ffffff",
    fontSize: 17,
  },
});
