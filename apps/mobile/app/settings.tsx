import { ScaffoldScreen } from "../src/components/ScaffoldScreen";

/** Placeholder route for future account, tenant, retention, accessibility and privacy settings. */
export default function SettingsScreen() {
  return (
    <ScaffoldScreen
      title="Responder settings"
      purpose="Future session, incident, notification consent, offline retention and accessibility controls."
      implementationNote="No settings are read or changed. Authentication, secure storage and preference synchronization are not connected."
    />
  );
}
