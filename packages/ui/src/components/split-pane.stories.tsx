import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SplitPane } from "./split-pane.js";

const pane = (label: string) => (
  <div className="h-full bg-surface p-4 text-base">
    <p>{label}</p>
  </div>
);

const meta: Meta<typeof SplitPane> = {
  title: "Layout/SplitPane",
  component: SplitPane,
  tags: ["autodocs"],
  args: {
    separatorLabel: "Resize sample panes",
    first: pane("First pane (sample)"),
    second: pane("Second pane (sample)"),
    orientation: "horizontal",
    defaultSize: 50,
  },
  argTypes: { orientation: { control: "inline-radio", options: ["horizontal", "vertical"] } },
  decorators: [
    (Story) => (
      <div className="h-96 overflow-hidden rounded-md border border-border">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Vertical: Story = { args: { orientation: "vertical" } };
export const NarrowFirst: Story = { args: { defaultSize: 25, minSize: 10, maxSize: 60 } };

function ControlledSplit() {
  const [size, setSize] = useState(40);
  return (
    <div className="h-full">
      <SplitPane
        separatorLabel="Resize controlled panes"
        size={size}
        onSizeChange={setSize}
        first={pane(`First pane: ${Math.round(size)}%`)}
        second={pane("Second pane (sample)")}
      />
    </div>
  );
}

export const Controlled: Story = { render: () => <ControlledSplit /> };

export const Dark: Story = { globals: { theme: "dark" } };
export const Compact: Story = { globals: { density: "compact" } };
export const HighContrast: Story = { globals: { theme: "high-contrast" } };
