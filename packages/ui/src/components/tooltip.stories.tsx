import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button.js";
import { Kbd } from "./kbd.js";
import { Tooltip } from "./tooltip.js";

const meta: Meta<typeof Tooltip> = {
  title: "Overlays/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  args: {
    content: "Sample tooltip",
    defaultOpen: true,
    side: "top",
    children: <Button>Hover or focus me</Button>,
  },
  argTypes: {
    side: { control: "inline-radio", options: ["top", "right", "bottom", "left"] },
    align: { control: "inline-radio", options: ["start", "center", "end"] },
  },
  parameters: { docs: { story: { inline: false, iframeHeight: 200 } } },
  decorators: [
    (Story) => (
      <div className="flex min-h-40 items-center justify-center">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithShortcut: Story = { args: { shortcut: ["Ctrl", "K"] } };
export const Bottom: Story = { args: { side: "bottom" } };
export const Closed: Story = { args: { defaultOpen: false } };

export const KeyboardKeys: Story = {
  render: () => (
    <div className="flex items-center gap-2 text-base">
      <span>Open the palette with</span>
      <Kbd>Ctrl</Kbd>
      <Kbd>K</Kbd>
    </div>
  ),
};

export const Dark: Story = { args: { shortcut: ["Ctrl", "K"] }, globals: { theme: "dark" } };
export const Compact: Story = { globals: { density: "compact" } };
export const HighContrast: Story = { globals: { theme: "high-contrast" } };
