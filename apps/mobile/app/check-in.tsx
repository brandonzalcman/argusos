import { ScaffoldScreen } from "../src/components/ScaffoldScreen";

/** Placeholder route for future authorized incident and position check-in. */
export default function CheckInScreen() {
  return (
    <ScaffoldScreen
      title="Position check-in"
      purpose="A future responder will explicitly check into an authorized position within a selected incident or exercise."
      implementationNote="checkIn() is a typed throwing contract. Identity, incident selection, server time and audit persistence are not connected."
    />
  );
}
