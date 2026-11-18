import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { ScaffoldScreen } from "../../src/components/ScaffoldScreen";

/** Placeholder route for rendering an authorized shared board definition and input view. */
export default function BoardFormScreen() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();

  return (
    <ScaffoldScreen
      title="Board / form renderer"
      purpose="A future mobile projection of a published @argus/schema BoardDefinition with field-level permissions."
      implementationNote="prepareBoardForm() is a typed throwing contract. The route identifier below is not a board lookup and exposes no record data."
    >
      <Text style={styles.identifier}>Unvalidated route parameter: {boardId}</Text>
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
