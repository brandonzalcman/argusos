import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button.js";
import { Field, Input } from "./field.js";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "./popover.js";

const meta = {
  title: "Overlays/Popover",
  component: PopoverContent,
  tags: ["autodocs"],
  args: {
    "aria-label": "Sample popover",
    side: "bottom",
    align: "start",
    children: <p className="text-base">Sample popover content.</p>,
  },
  argTypes: {
    side: { control: "inline-radio", options: ["top", "right", "bottom", "left"] },
    align: { control: "inline-radio", options: ["start", "center", "end"] },
  },
  parameters: { docs: { story: { inline: false, iframeHeight: 260 } } },
  render: (args) => (
    <div className="min-h-56 pt-4">
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button>Open popover</Button>
        </PopoverTrigger>
        <PopoverContent {...args} />
      </Popover>
    </div>
  ),
} satisfies Meta<typeof PopoverContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Top: Story = {
  args: { side: "top" },
  decorators: [
    (Story) => (
      <div className="pt-40">
        <Story />
      </div>
    ),
  ],
};

export const WithForm: Story = {
  args: {
    children: (
      <div className="grid gap-3">
        <Field label="Label">
          <Input placeholder="Sample value" />
        </Field>
        <PopoverClose asChild>
          <Button variant="primary">Apply</Button>
        </PopoverClose>
      </div>
    ),
  },
};

export const Dark: Story = { ...WithForm, globals: { theme: "dark" } };
export const Compact: Story = { ...WithForm, globals: { density: "compact" } };
export const HighContrast: Story = { ...WithForm, globals: { theme: "high-contrast" } };
