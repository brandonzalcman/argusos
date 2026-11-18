import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConnectionIndicator, type ConnectionState } from "./connection-indicator.js";

const states: readonly ConnectionState[] = ["live", "polling", "reconnecting", "offline"];

const meta = {
  title: "Realtime/ConnectionIndicator",
  component: ConnectionIndicator,
  tags: ["autodocs"],
  args: { state: "live", variant: "full" },
  argTypes: {
    state: { control: "inline-radio", options: states },
    variant: { control: "inline-radio", options: ["pill", "full"] },
  },
} satisfies Meta<typeof ConnectionIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllStates: Story = {
  render: () => (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {states.map((state) => (
          <ConnectionIndicator key={state} state={state} variant="pill" />
        ))}
      </div>
      <div className="grid gap-3">
        {states.map((state) => (
          <ConnectionIndicator key={state} state={state} variant="full" />
        ))}
      </div>
    </div>
  ),
};

export const WithDetail: Story = {
  args: { state: "offline", stateDetail: "Sync has not been connected" },
};

export const Reconnecting: Story = { args: { state: "reconnecting" } };
export const Offline: Story = { args: { state: "offline" } };
export const Dark: Story = { ...AllStates, globals: { theme: "dark" } };
export const Compact: Story = { ...AllStates, globals: { density: "compact" } };
export const HighContrast: Story = { ...AllStates, globals: { theme: "high-contrast" } };
