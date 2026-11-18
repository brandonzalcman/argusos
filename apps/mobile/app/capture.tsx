import { ScaffoldScreen } from "../src/components/ScaffoldScreen";

/** Placeholder route for later consented photo and foreground GPS capture into a local draft. */
export default function CaptureScreen() {
  return (
    <ScaffoldScreen
      title="Photo and GPS capture"
      purpose="Future incident-scoped media and location capture with explicit consent, accuracy metadata and secure upload."
      implementationNote="capturePhoto() and captureLocation() are typed throwing contracts. Camera, photo library, GPS and storage are not accessed."
    />
  );
}
