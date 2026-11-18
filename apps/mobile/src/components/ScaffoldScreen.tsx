import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export interface ScaffoldScreenProps {
  readonly title: string;
  readonly purpose: string;
  readonly implementationNote: string;
  readonly children?: ReactNode;
}

/** Renders an accessible, explicitly non-operational mobile route without invoking capability stubs. */
export function ScaffoldScreen({
  title,
  purpose,
  implementationNote,
  children,
}: ScaffoldScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View accessibilityRole="header" style={styles.headingGroup}>
        <Text style={styles.eyebrow}>ARGUSOS MOBILE · SCAFFOLD</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.purpose}>{purpose}</Text>
      <View accessibilityRole="alert" style={styles.notice}>
        <Text style={styles.noticeTitle}>Not implemented</Text>
        <Text style={styles.noticeText}>{implementationNote}</Text>
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 20,
    padding: 24,
    backgroundColor: "#f5f7f8",
  },
  headingGroup: {
    gap: 8,
  },
  eyebrow: {
    color: "#41535c",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  title: {
    color: "#14252d",
    fontSize: 30,
    fontWeight: "700",
  },
  purpose: {
    color: "#243a44",
    fontSize: 17,
    lineHeight: 26,
  },
  notice: {
    borderColor: "#9a6818",
    borderLeftWidth: 4,
    borderRadius: 6,
    backgroundColor: "#fff5da",
    gap: 6,
    padding: 16,
  },
  noticeTitle: {
    color: "#5e3d08",
    fontSize: 16,
    fontWeight: "700",
  },
  noticeText: {
    color: "#5e3d08",
    fontSize: 15,
    lineHeight: 22,
  },
});
