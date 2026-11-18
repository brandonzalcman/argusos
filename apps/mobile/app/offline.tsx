import { ScaffoldScreen } from "../src/components/ScaffoldScreen";

/** Placeholder route for later encrypted drafts, idempotent replay and explicit same-field conflicts. */
export default function OfflineScreen() {
  return (
    <ScaffoldScreen
      title="Offline drafts and conflicts"
      purpose="Future device-local drafts, connection status, replay outcomes and field-by-field conflict decisions."
      implementationNote="Offline capability contracts throw. Nothing is persisted, synchronized, merged or represented as a submitted record."
    />
  );
}
