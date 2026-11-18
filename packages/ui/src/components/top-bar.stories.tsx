import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConnectionIndicator } from "./connection-indicator.js";
import { TopBar } from "./top-bar.js";

const meta = {
  title: "Layout/TopBar",
  component: TopBar,
  tags: ["autodocs"],
  args: {
    activeIncidentLabel: null,
    incidentLevel: null,
    operationalPeriodLabel: null,
    positionLabel: null,
    connection: (
      <ConnectionIndicator
        variant="pill"
        state="offline"
        stateDetail="Sync has not been connected"
      />
    ),
  },
} satisfies Meta<typeof TopBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoContext: Story = {};

export const SampleContext: Story = {
  args: {
    activeIncidentLabel: "Exercise ALPHA (training)",
    incidentLevel: { label: "Level 0 (training)", status: "info" },
    operationalPeriodLabel: "Period 0 (sample)",
    positionLabel: "Sample position",
    connection: <ConnectionIndicator variant="pill" state="live" />,
    onOpenCommandPalette: () => undefined,
  },
};

export const Reconnecting: Story = {
  args: {
    ...SampleContext.args,
    connection: <ConnectionIndicator variant="pill" state="reconnecting" />,
  },
};

export const Dark: Story = { ...SampleContext, globals: { theme: "dark" } };
export const Compact: Story = { ...SampleContext, globals: { density: "compact" } };
export const HighContrast: Story = { ...SampleContext, globals: { theme: "high-contrast" } };
