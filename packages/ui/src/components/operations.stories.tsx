import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConflictBanner } from "./conflict-banner.js";
import { ConnectionIndicator } from "./connection-indicator.js";
import { NewRowsIndicator } from "./new-rows-indicator.js";
import { PresenceAvatars } from "./presence-avatars.js";

/*
 * Composition-only story: the individual components have their own stories
 * (Realtime/*). This shows how live-feedback pieces sit together on one surface.
 */
const meta = {
  title: "Operations/Live feedback",
  tags: ["autodocs"],
  render: () => (
    <div className="grid max-w-xl gap-4">
      <ConnectionIndicator state="reconnecting" />
      <PresenceAvatars people={[]} />
      <NewRowsIndicator count={3} noun="items" onShowNewRows={() => undefined} />
      <ConflictBanner
        recordLabel="Sample record"
        fields={[
          {
            fieldId: "sample-field",
            fieldLabel: "Sample field",
            localValue: "Local sample value",
            serverValue: "Server sample value",
          },
        ]}
      />
    </div>
  ),
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Composition: Story = {};
export const CompositionDark: Story = { globals: { theme: "dark" } };
