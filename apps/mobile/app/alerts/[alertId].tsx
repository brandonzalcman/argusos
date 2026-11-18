import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { ScaffoldScreen } from "../../src/components/ScaffoldScreen";

/** Placeholder route for authorized, idempotent and version-checked alert acknowledgement. */
export default function AlertAcknowledgementScreen() {
  const { alertId } = useLocalSearchParams<{ alertId: string }>();

  return (
    <ScaffoldScreen
      title="Alert acknowledgement"
      purpose="A future responder will acknowledge an authorized delivery and receive an auditable server receipt."
      implementationNote="acknowledgeAlert() is a typed throwing contract. The identifier below is unvalidated and no acknowledgement is submitted."
    >
      <Text style={styles.identifier}>Unvalidated route parameter: {alertId}</Text>
    </ScaffoldScreen>
  );
}

const styles = StyleSheet.create({
  identifier: {
    color: "#41535c",
    fontFamily: "monospace",
    fontSize: 14,
  },
});
